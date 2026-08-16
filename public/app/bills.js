/* ================= BILLS (history) ================= */
// New in APP_MODERNIZATION_COMMAND.md Phase 2 — there was previously no way
// to browse past bills at all except the Home dashboard's period breakdown
// modals (which are read-only summaries, not a searchable list with actions).
let billsQuery = '';
let billsStatusFilter = 'all';

const BILLS_STATUS_OPTIONS = ['all', 'paid', 'pending', 'partial', 'voided', 'quote'];

function renderBills() {
  const c = document.getElementById('pageContent');
  c.innerHTML = `
    <input id="bills-search" placeholder="Search by bill number or customer..." value="${escapeHtml(billsQuery)}" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;margin-bottom:10px">
    <div class="pill-filters">
      ${BILLS_STATUS_OPTIONS.map((s) => `<button data-status="${s}" class="${billsStatusFilter === s ? 'active' : ''}">${s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)}</button>`).join('')}
    </div>
    <div id="bills-list">${renderBillsListHtml()}</div>
  `;
  // Filters only #bills-list on each keystroke, not the whole screen, so the
  // search input never loses focus mid-type (same reasoning as vendors.js).
  document.getElementById('bills-search').oninput = (e) => {
    billsQuery = e.target.value;
    document.getElementById('bills-list').innerHTML = renderBillsListHtml();
    bindBillsListEvents();
  };
  c.querySelectorAll('.pill-filters button').forEach((btn) => {
    btn.onclick = () => { billsStatusFilter = btn.dataset.status; renderBills(); };
  });
  bindBillsListEvents();
}
function renderBillsListHtml() {
  const q = billsQuery.trim().toLowerCase();
  const sorted = [...STATE.bills].sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  const filtered = sorted.filter((b) => {
    if (q && !(`${b.number} ${b.customerName || ''}`.toLowerCase().includes(q))) return false;
    if (billsStatusFilter === 'all') return true;
    return billStatus(b).label.toLowerCase() === billsStatusFilter;
  });
  if (filtered.length === 0) {
    return `<div class="empty-state">
      <div class="empty-icon">\u{1F4DC}</div>
      <div>${STATE.bills.length === 0 ? 'No bills yet — they will show up here after your first sale.' : 'No bills match that search.'}</div>
      ${STATE.bills.length === 0 ? '<button class="btn small" id="bills-empty-sell">Go to Sell</button>' : ''}
    </div>`;
  }
  return filtered.map((b) => {
    const st = billStatus(b);
    return `<div class="list-row" data-id="${b.id}">
      <div><div class="title">${escapeHtml(b.number || '')} — ${escapeHtml(b.customerName || 'Walk-in')}</div>
        <div class="sub">${fmtDate(b.date)} ${b.time || ''} · ${typeLabel(b)}</div></div>
      <div style="text-align:right;display:flex;align-items:center;gap:10px">
        <strong class="mono">${money(b.total)}</strong>
        <span class="badge ${st.cls}">${st.label}</span>
      </div>
    </div>`;
  }).join('');
}
function bindBillsListEvents() {
  const emptySellBtn = document.getElementById('bills-empty-sell');
  if (emptySellBtn) emptySellBtn.onclick = () => goTab('sell');
  document.querySelectorAll('#bills-list .list-row[data-id]').forEach((row) => {
    row.onclick = () => openBillActions(row.dataset.id);
  });
}

function openBillActions(billId) {
  const b = STATE.bills.find((x) => x.id === billId);
  if (!b) return;
  const st = billStatus(b);
  const canVoid = b.type !== 'quote' && b.status !== 'voided';
  const canDuplicate = b.type !== 'quote';
  openModal(`
    <h3>${escapeHtml(b.number || '')}</h3>
    <div class="sub">${escapeHtml(b.customerName || 'Walk-in')} · ${fmtDate(b.date)} ${b.time || ''}</div>
    <div class="sub">${typeLabel(b)} · <span class="badge ${st.cls}">${st.label}</span></div>
    <table style="margin-top:10px">
      <tr><th>Item</th><th>Qty</th><th>Price</th></tr>
      ${b.items.map((it) => `<tr><td>${escapeHtml(it.name)}</td><td>${it.qty}</td><td>${money(it.price)}</td></tr>`).join('')}
    </table>
    <div style="display:flex;justify-content:space-between;margin-top:10px"><strong>Total</strong><strong>${money(b.total)}</strong></div>
    ${b.status === 'voided' ? `<div class="sub" style="color:var(--red)">Voided ${fmtDate((b.voidedAt || '').slice(0, 10))}${b.voidReason ? ' — ' + escapeHtml(b.voidReason) : ''}</div>` : ''}
    <div class="modal-actions" style="flex-wrap:wrap;margin-top:14px">
      <button class="btn secondary" id="ba-reprint">Reprint</button>
      ${canDuplicate ? '<button class="btn secondary" id="ba-duplicate">Duplicate</button>' : ''}
      ${canVoid ? '<button class="btn danger" id="ba-void">Void / Return</button>' : ''}
    </div>
    <button class="btn secondary block" style="margin-top:10px" id="ba-close">Close</button>
  `);
  document.getElementById('ba-close').onclick = closeModal;
  document.getElementById('ba-reprint').onclick = () => { closeModal(); showReceipt(b); };
  const dupBtn = document.getElementById('ba-duplicate');
  if (dupBtn) dupBtn.onclick = () => { closeModal(); duplicateBill(b); };
  const voidBtn = document.getElementById('ba-void');
  if (voidBtn) voidBtn.onclick = () => voidBillFlow(b, () => { closeModal(); renderBills(); });
}

// Loads a past bill's items back into the Sell cart for a repeat sale.
// Quantities are clamped to whatever is actually in stock right now (never
// assumed to still match what was available when the original bill was
// made) — items that are now fully out of stock are dropped, with a toast
// explaining what changed, rather than silently letting the cart claim more
// stock than exists.
function duplicateBill(b) {
  const cart = [];
  let reduced = 0, dropped = 0;
  b.items.forEach((it) => {
    const p = STATE.products.find((x) => x.id === it.productId);
    if (!p || (p.stock || 0) <= 0) { dropped++; return; }
    const qty = Math.min(it.qty, p.stock);
    if (qty < it.qty) reduced++;
    cart.push({ productId: p.id, name: p.name, qty, price: it.price, cost: p.costPrice });
  });
  STATE.sellCart = cart;
  STATE.sellCustomerId = b.customerId || null;
  STATE.sellType = 'bill';
  goTab('sell');
  if (dropped || reduced) {
    toast(`Loaded into cart — ${[dropped ? `${dropped} item(s) out of stock` : null, reduced ? `${reduced} item(s) reduced to available stock` : null].filter(Boolean).join(', ')}`);
  } else {
    toast('Bill loaded into cart — review before completing');
  }
}

// Shared by the Bills screen and the post-sale receipt modal (sell.js).
// Reverses stock + (for credit sales) the customer ledger server-side —
// see POST /api/bills/:id/void in server.js. onDone lets the caller close
// its own modal / re-render its own screen after a successful void.
function voidBillFlow(bill, onDone) {
  openModal(`
    <h3>Void ${escapeHtml(bill.number || '')}?</h3>
    <p class="sub" style="margin-top:-6px">This restores ${bill.items.length} item(s) to stock${bill.paymentType === 'credit' ? " and reverses this customer's dues" : ''}. This cannot be undone.</p>
    <div class="field"><label>Reason (optional)</label><input id="void-reason" placeholder="e.g. Customer returned items"></div>
    <div class="modal-actions">
      <button class="btn secondary" id="void-cancel">Cancel</button>
      <button class="btn danger" id="void-confirm">Void Bill</button>
    </div>
  `);
  document.getElementById('void-cancel').onclick = closeModal;
  document.getElementById('void-confirm').onclick = async () => {
    const btn = document.getElementById('void-confirm');
    btn.disabled = true; btn.textContent = 'Voiding...';
    try {
      const res = await fetch(`/api/bills/${bill.id}/void`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ reason: document.getElementById('void-reason').value.trim(), by: STATE.user })
      });
      const data = await res.json();
      if (!res.ok) { toast(data.message || 'Could not void this bill'); btn.disabled = false; btn.textContent = 'Void Bill'; return; }
    } catch (e) {
      toast('Could not reach the server to void this bill.');
      btn.disabled = false; btn.textContent = 'Void Bill';
      return;
    }
    const [bills, products, customers] = await Promise.all([apiGet('bills'), apiGet('products'), apiGet('customers')]);
    STATE.bills = bills; STATE.products = products; STATE.customers = customers;
    closeModal();
    renderLivePulse();
    toast('Bill voided, stock restored');
    if (onDone) onDone();
  };
}
