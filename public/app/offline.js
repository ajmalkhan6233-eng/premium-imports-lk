/* ================= OFFLINE SALE OUTBOX =================
   First increment of offline-first sync (2026-08-19), scoped to the
   Sell screen's completeSale() only — see SESSION_LOG.md for the design
   notes and what's explicitly NOT covered yet (GRN and other screens'
   offline capture, deep multi-device conflict resolution beyond the
   dedupe below).

   How it stays conflict-safe / never silently drops data:
   - Every queued sale gets a client-generated UUID (clientRequestId)
     the moment it's captured, before any network call is attempted.
   - The server (POST /api/bills) is idempotent on that id: if a bill
     with the same clientRequestId already exists, it returns that
     existing bill instead of creating a second one. So a retry (flaky
     connection, the same item flushed twice, the app closed mid-sync
     and reopened) can never double-bill or double-deduct stock.
   - A sale that fails for a real business reason once back online
     (e.g. the stock sold out from under it while this device was
     offline) is marked "needs attention" and stays visibly queued —
     it is never auto-discarded. A human decides what to do with it.
   - Nothing here ever assumes network type (home WiFi vs mobile data)
     — it only reacts to the browser's online/offline signal, which is
     the same either way. */

const OBX_DB_NAME = 'pilk_offline';
const OBX_STORE = 'outbox';

function obxOpenDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OBX_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OBX_STORE)) {
        db.createObjectStore(OBX_STORE, { keyPath: 'clientRequestId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function obxTx(mode, fn) {
  const db = await obxOpenDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OBX_STORE, mode);
    const store = tx.objectStore(OBX_STORE);
    const result = fn(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}
function obxRequestToPromise(req) {
  return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
}

async function obxQueueSale(payload) {
  const clientRequestId = (crypto.randomUUID ? crypto.randomUUID() : `ob-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const record = { clientRequestId, payload, createdAt: new Date().toISOString(), status: 'pending', lastError: null };
  await obxTx('readwrite', (store) => store.put(record));
  obxRenderBadge();
  return record;
}
async function obxGetAll() {
  return obxTx('readonly', (store) => obxRequestToPromise(store.getAll()));
}
async function obxRemove(clientRequestId) {
  await obxTx('readwrite', (store) => store.delete(clientRequestId));
  obxRenderBadge();
}
async function obxMarkFailed(clientRequestId, message) {
  const all = await obxGetAll();
  const rec = all.find((r) => r.clientRequestId === clientRequestId);
  if (!rec) return;
  rec.status = 'failed';
  rec.lastError = message;
  await obxTx('readwrite', (store) => store.put(rec));
  obxRenderBadge();
}

let obxFlushing = false;
async function obxFlush() {
  if (obxFlushing || !navigator.onLine) return;
  obxFlushing = true;
  try {
    const all = await obxGetAll();
    const pending = all.filter((r) => r.status === 'pending');
    let anySynced = false;
    for (const rec of pending) {
      try {
        const res = await fetch('/api/bills', {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(rec.payload)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          await obxRemove(rec.clientRequestId);
          anySynced = true;
        } else {
          // A real rejection from the server (e.g. stock ran out while
          // offline) — not a network problem. Stop auto-retrying this
          // one, but keep it visible; only a human resolves it.
          await obxMarkFailed(rec.clientRequestId, data.message || 'Rejected by server');
        }
      } catch (e) {
        // Still offline / connection dropped mid-flush — leave it
        // pending, try again on the next online event or flush call.
        break;
      }
    }
    if (anySynced) {
      const [bills, products, customers, settings] = await Promise.all([apiGet('bills'), apiGet('products'), apiGet('customers'), apiGet('settings')]);
      STATE.bills = bills; STATE.products = products; STATE.customers = customers; STATE.settings = settings;
      toast('Offline sale(s) synced');
      if (STATE.activeTab === 'sell') renderSell();
    }
  } finally {
    obxFlushing = false;
    obxRenderBadge();
  }
}

async function obxPendingSummary() {
  const all = await obxGetAll();
  return { pending: all.filter((r) => r.status === 'pending').length, failed: all.filter((r) => r.status === 'failed').length, all };
}

async function obxRenderBadge() {
  const el = document.getElementById('offlineSyncBadge');
  if (!el) return;
  const { pending, failed } = await obxPendingSummary();
  const total = pending + failed;
  if (total === 0) { el.classList.add('hidden'); el.innerHTML = ''; return; }
  el.classList.remove('hidden');
  const label = failed > 0 ? `\u{26A0}\u{FE0F} ${failed} need${failed === 1 ? 's' : ''} attention` : `\u{1F504} ${pending} pending sync`;
  el.innerHTML = `<button class="btn small ${failed > 0 ? 'danger' : 'secondary'}" id="offlineSyncBtn">${label}</button>`;
  document.getElementById('offlineSyncBtn').onclick = obxOpenQueueModal;
}
async function obxOpenQueueModal() {
  const { all } = await obxPendingSummary();
  openModal(`
    <h3>Offline Sales Queue</h3>
    ${all.length === 0 ? '<div class="empty-state">Nothing queued.</div>' : all.map((r) => {
      const total = (r.payload.items || []).reduce((s, it) => s + it.qty * it.price, 0);
      return `<div class="list-row" style="cursor:default;flex-direction:column;align-items:stretch;gap:4px">
        <div class="title">${r.payload.items.length} item(s) · ${money(total)} · ${fmtDate(r.createdAt.slice(0, 10))}</div>
        ${r.status === 'failed' ? `<div class="sub" style="color:var(--red)">Needs attention: ${escapeHtml(r.lastError || 'Rejected')}</div>` : '<div class="sub">Waiting to sync...</div>'}
        <div style="display:flex;gap:6px">
          ${r.status === 'failed' ? `<button class="btn small" data-retry="${r.clientRequestId}">Retry now</button><button class="btn small danger" data-discard="${r.clientRequestId}">Discard (data loss — confirm)</button>` : ''}
        </div>
      </div>`;
    }).join('')}
    <button class="btn secondary block" style="margin-top:10px" id="obx-close">Close</button>
  `);
  document.getElementById('obx-close').onclick = closeModal;
  document.querySelectorAll('[data-retry]').forEach((b) => {
    b.onclick = async () => {
      const all2 = await obxGetAll();
      const rec = all2.find((r) => r.clientRequestId === b.dataset.retry);
      if (rec) { rec.status = 'pending'; await obxTx('readwrite', (store) => store.put(rec)); }
      closeModal();
      await obxFlush();
    };
  });
  document.querySelectorAll('[data-discard]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm('This permanently discards a sale that was never recorded on the server. Only do this if you are certain it should not be billed. Continue?')) return;
      await obxRemove(b.dataset.discard);
      closeModal();
    };
  });
}

function obxInit() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline shell just won't be available this session */ });
  }
  window.addEventListener('online', obxFlush);
  obxRenderBadge();
  obxFlush();
}
