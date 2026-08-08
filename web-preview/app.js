/* GRN Entry — static preview, no server, no build step.
   Saves to localStorage only. This is a visual/UX preview of the GRN
   screen from the full Premium Imports LK app, not a substitute for it. */

const STORAGE_KEY = 'grn-entries';
let draftLines = [];

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}
function money(n) {
  const v = Number(n) || 0;
  return 'Rs. ' + v.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' });
}
function uid() {
  return 'G-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 9999);
}

function refreshSuggestions() {
  const entries = loadEntries();
  const vendors = new Set();
  const products = new Set();
  const categories = new Set();
  entries.forEach((e) => {
    if (e.vendor) vendors.add(e.vendor);
    (e.lines || []).forEach((l) => {
      if (l.name) products.add(l.name);
      if (l.category) categories.add(l.category);
    });
  });
  draftLines.forEach((l) => {
    if (l.name) products.add(l.name);
    if (l.category) categories.add(l.category);
  });
  document.getElementById('vendorSuggestions').innerHTML =
    [...vendors].map((v) => `<option value="${escapeHtml(v)}">`).join('');
  document.getElementById('productSuggestions').innerHTML =
    [...products].map((p) => `<option value="${escapeHtml(p)}">`).join('');
  document.getElementById('categorySuggestions').innerHTML =
    [...categories].map((c) => `<option value="${escapeHtml(c)}">`).join('');
}

function renderLines() {
  const list = document.getElementById('linesList');
  if (draftLines.length === 0) {
    list.innerHTML = '';
  } else {
    list.innerHTML = draftLines.map((l, idx) => `
      <div class="line-row">
        <div class="info">
          <div class="name">${escapeHtml(l.name)}</div>
          <div class="meta">${escapeHtml(l.category || 'No category')} · ${l.qty} × ${money(l.cost)}</div>
        </div>
        <div class="amount-wrap">
          <div class="amount">${money(l.qty * l.cost)}</div>
          <button class="remove-btn" data-remove="${idx}" aria-label="Remove line">✕</button>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.onclick = () => {
        draftLines.splice(parseInt(btn.dataset.remove, 10), 1);
        renderLines();
        updateTotal();
      };
    });
  }
  updateTotal();
}
function updateTotal() {
  const total = draftLines.reduce((s, l) => s + (l.qty * l.cost), 0);
  document.getElementById('totalValue').textContent = money(total);
}

function addLine() {
  const name = document.getElementById('li-name').value.trim();
  const category = document.getElementById('li-category').value.trim();
  const cost = parseFloat(document.getElementById('li-cost').value) || 0;
  const qty = parseFloat(document.getElementById('li-qty').value) || 0;
  if (!name) { showNote('Enter a product name first.'); return; }
  if (qty <= 0) { showNote('Quantity must be more than 0.'); return; }
  draftLines.push({ name, category, cost, qty });
  document.getElementById('li-name').value = '';
  document.getElementById('li-category').value = '';
  document.getElementById('li-cost').value = '';
  document.getElementById('li-qty').value = '1';
  document.getElementById('li-name').focus();
  renderLines();
  refreshSuggestions();
  showNote('');
}

function showNote(msg) {
  document.getElementById('saveNote').textContent = msg;
}

function saveGrn() {
  const vendor = document.getElementById('vendorName').value.trim();
  const date = document.getElementById('grnDate').value || todayISO();
  if (!vendor) { showNote('Enter a vendor name before saving.'); return; }
  if (draftLines.length === 0) { showNote('Add at least one line item before saving.'); return; }
  const total = draftLines.reduce((s, l) => s + (l.qty * l.cost), 0);
  const entries = loadEntries();
  entries.unshift({
    id: uid(),
    vendor,
    date,
    lines: draftLines.map((l) => ({ ...l })),
    total,
    createdAt: new Date().toISOString()
  });
  saveEntries(entries);
  draftLines = [];
  document.getElementById('vendorName').value = '';
  document.getElementById('grnDate').value = todayISO();
  renderLines();
  renderSaved();
  refreshSuggestions();
  showNote('GRN saved to this browser.');
  setTimeout(() => showNote(''), 2500);
}

function renderSaved() {
  const entries = loadEntries();
  const root = document.getElementById('savedList');
  if (entries.length === 0) {
    root.innerHTML = '<div class="empty-state">No GRNs saved yet on this device.</div>';
    return;
  }
  root.innerHTML = entries.map((e) => `
    <div class="saved-card" data-id="${e.id}">
      <div class="top-row">
        <div>
          <div class="vendor">${escapeHtml(e.vendor)}</div>
          <div class="date">${fmtDate(e.date)}</div>
        </div>
        <div class="total">${money(e.total)}</div>
      </div>
      <div class="lines-detail">
        ${(e.lines || []).map((l) => `
          <div>
            <span>${escapeHtml(l.name)} <span class="cat">(${escapeHtml(l.category || 'No category')})</span></span>
            <span>${l.qty} × ${money(l.cost)} = ${money(l.qty * l.cost)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
  root.querySelectorAll('.saved-card').forEach((card) => {
    card.onclick = () => card.classList.toggle('expanded');
  });
}

function boot() {
  document.getElementById('grnDate').value = todayISO();
  document.getElementById('addLineBtn').onclick = addLine;
  document.getElementById('saveGrnBtn').onclick = saveGrn;
  ['li-name', 'li-category', 'li-cost', 'li-qty'].forEach((id) => {
    document.getElementById(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addLine(); }
    });
  });
  refreshSuggestions();
  renderLines();
  renderSaved();
}

boot();
