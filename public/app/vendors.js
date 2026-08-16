/* ================= VENDORS ================= */
let selectedVendorId = null;
let vendorSearchQuery = '';

function renderVendors() {
  const c = document.getElementById('pageContent');
  c.innerHTML = `
    <div class="split-layout">
      <div class="split-list">
        <button class="btn block" id="addVendorBtn">+ Add Vendor</button>
        <input id="vendor-search" placeholder="Search vendors..." value="${escapeHtml(vendorSearchQuery)}" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;margin-top:10px">
        <div id="vendor-list" style="margin-top:10px">${renderVendorListHtml()}</div>
      </div>
      <div class="split-detail" id="vendorDetail">${renderVendorDetailHtml()}</div>
    </div>
  `;
  document.getElementById('addVendorBtn').onclick = () => openVendorForm(null);
  // Filters only the list div on each keystroke (not a full renderVendors())
  // so the search input never loses focus mid-type — same pattern as the
  // Sell/GRN search fields elsewhere in this app.
  document.getElementById('vendor-search').oninput = (e) => {
    vendorSearchQuery = e.target.value;
    document.getElementById('vendor-list').innerHTML = renderVendorListHtml();
    bindVendorListEvents();
  };
  bindVendorListEvents();
  bindVendorDetailEvents();
}

function renderVendorListHtml() {
  const q = vendorSearchQuery.trim().toLowerCase();
  const list = q ? STATE.vendors.filter((v) => `${v.name} ${v.phone || ''}`.toLowerCase().includes(q)) : STATE.vendors;
  if (list.length === 0) {
    return `<div class="empty-state">
      <div class="empty-icon">\u{1F69A}</div>
      <div>${STATE.vendors.length === 0 ? 'No vendors yet.' : 'No vendors match that search.'}</div>
    </div>`;
  }
  return list.map((v) => `
    <div class="list-row ${v.id === selectedVendorId ? 'active' : ''}" data-id="${v.id}">
      <div><div class="title">${escapeHtml(v.name)}</div><div class="sub">Purchased ${money(v.purchased)} · Paid ${money(v.paid)}</div></div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="badge ${v.balance > 0 ? 'due' : 'ok'}">${v.balance > 0 ? money(v.balance) + ' due' : 'Settled'}</span>
        ${isAdmin() ? `<button class="btn small secondary" data-edit-vendor="${v.id}">Edit</button>
        <button class="btn small danger" data-delete-vendor="${v.id}">Delete</button>` : ''}
      </div>
    </div>`).join('');
}
function bindVendorListEvents() {
  document.querySelectorAll('#vendor-list [data-id]').forEach((el) => {
    el.onclick = () => { selectedVendorId = el.dataset.id; renderVendors(); };
  });
  document.querySelectorAll('#vendor-list [data-edit-vendor]').forEach((btn) => {
    btn.onclick = (e) => { e.stopPropagation(); openVendorForm(btn.dataset.editVendor); };
  });
  document.querySelectorAll('#vendor-list [data-delete-vendor]').forEach((btn) => {
    btn.onclick = (e) => { e.stopPropagation(); deleteVendor(btn.dataset.deleteVendor); };
  });
}

function renderVendorDetailHtml() {
  const v = selectedVendorId ? STATE.vendors.find((x) => x.id === selectedVendorId) : null;
  if (!v) return '<div class="empty-state">Select a vendor to see contact info, balance, and history.</div>';
  const sortedLedger = [...(v.ledger || [])].sort((a, b) => b.date.localeCompare(a.date));
  const vendorGrns = STATE.grns.filter((g) => g.vendorId === v.id).sort((a, b) => b.date.localeCompare(a.date));
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div>
          <h3 style="margin-bottom:2px">${escapeHtml(v.name)}</h3>
          <div class="sub">${escapeHtml(v.phone || 'No phone on file')}${v.address ? ' · ' + escapeHtml(v.address) : ''}</div>
        </div>
        ${isAdmin() ? '<button class="btn small secondary" id="vd-edit">Edit</button>' : ''}
      </div>
    </div>
    <div class="grid" style="margin:14px 0">
      <div class="card"><div class="label">Purchased</div><div class="value">${money(v.purchased)}</div></div>
      <div class="card"><div class="label">Paid</div><div class="value">${money(v.paid)}</div></div>
      <div class="card"><div class="label">Balance</div><div class="value">${money(v.balance)}</div></div>
    </div>
    <div class="modal-actions" style="margin-top:10px;flex-wrap:wrap">
      <button class="btn small" id="vd-pay">Record Payment</button>
      <button class="btn small secondary" id="vd-export-csv">Export CSV</button>
      <button class="btn small secondary" id="vd-export-pdf">Export PDF</button>
    </div>
    <div class="section-title"><h3>Balance over time</h3></div>
    <div class="card">${renderLedgerChartSvg(v.ledger)}</div>
    <div class="section-title"><h3>Ledger</h3></div>
    ${sortedLedger.length === 0 ? '<div class="empty-state"><div class="empty-icon">\u{1F4C4}</div><div>No transactions yet.</div></div>' :
      sortedLedger.map((l) => `
        <div class="list-row" style="cursor:default">
          <div><div class="title">${labelForLedgerType(l.type)}${l.ref ? ' (' + escapeHtml(l.ref) + ')' : ''}${l.method ? ' (' + escapeHtml(l.method) + ')' : ''}</div>
            <div class="sub">${fmtDate(l.date)} ${l.note ? '· ' + escapeHtml(l.note) : ''}</div></div>
          <div style="text-align:right"><strong>${l.type === 'payment' ? '-' : '+'}${money(l.amount)}</strong>${l.balanceAfter !== undefined ? `<div class="sub">Bal: ${money(l.balanceAfter)}</div>` : ''}</div>
        </div>`).join('')}
    <div class="section-title"><h3>GRN History</h3></div>
    ${vendorGrns.length === 0 ? `<div class="empty-state"><div class="empty-icon">\u{1F4E5}</div><div>No goods received yet.</div><button class="btn small" id="vd-empty-grn">Go to GRN</button></div>` :
      vendorGrns.map((g) => `
        <div class="list-row" style="cursor:default">
          <div><div class="title">${escapeHtml(g.number)}${g.invoiceNumber ? ' — Invoice ' + escapeHtml(g.invoiceNumber) : ''}</div>
            <div class="sub">${fmtDate(g.date)} · ${g.items.length} item(s)</div></div>
          <strong>${money(g.total)}</strong>
        </div>`).join('')}
  `;
}

function bindVendorDetailEvents() {
  const v = selectedVendorId ? STATE.vendors.find((x) => x.id === selectedVendorId) : null;
  if (!v) return;
  const editBtn = document.getElementById('vd-edit');
  if (editBtn) editBtn.onclick = () => openVendorForm(v.id);
  const payBtn = document.getElementById('vd-pay');
  if (payBtn) payBtn.onclick = () => openVendorPaymentForm(v.id);
  const csvBtn = document.getElementById('vd-export-csv');
  if (csvBtn) csvBtn.onclick = () => exportVendorCsv(v);
  const pdfBtn = document.getElementById('vd-export-pdf');
  if (pdfBtn) pdfBtn.onclick = () => exportVendorPdf(v);
  const emptyGrnBtn = document.getElementById('vd-empty-grn');
  if (emptyGrnBtn) emptyGrnBtn.onclick = () => goTab('grn');
}

// downloadCsv() is defined in reports.js — safe to call from here since all
// app scripts share one global scope and this only runs on a click, well
// after every script has finished loading.
function exportVendorCsv(v) {
  const rows = [['Type', 'Date', 'Reference', 'Amount', 'Balance After', 'Note', 'By']];
  [...(v.ledger || [])].sort((a, b) => a.date.localeCompare(b.date)).forEach((l) => {
    rows.push([labelForLedgerType(l.type), l.date, l.ref || '', l.type === 'payment' ? -l.amount : l.amount, l.balanceAfter, l.note || '', l.by || '']);
  });
  downloadCsv(rows, `vendor-${v.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-ledger.csv`);
}
function exportVendorPdf(v) {
  const sortedLedger = [...(v.ledger || [])].sort((a, b) => b.date.localeCompare(a.date));
  const vendorGrns = STATE.grns.filter((g) => g.vendorId === v.id).sort((a, b) => b.date.localeCompare(a.date));
  document.getElementById('vendorPrintArea').innerHTML = `
    <h2>${escapeHtml(STATE.settings.shopName || 'Premium Imports LK')}</h2>
    <h3>Vendor Statement — ${escapeHtml(v.name)}</h3>
    <p class="sub">Generated ${fmtDate(todayISO())} · Purchased ${money(v.purchased)} · Paid ${money(v.paid)} · Balance ${money(v.balance)}</p>
    <table>
      <tr><th>Type</th><th>Date</th><th>Reference</th><th>Amount</th><th>Balance After</th></tr>
      ${sortedLedger.map((l) => `<tr><td>${escapeHtml(labelForLedgerType(l.type))}</td><td>${fmtDate(l.date)}</td><td>${escapeHtml(l.ref || '')}</td><td>${l.type === 'payment' ? '-' : ''}${money(l.amount)}</td><td>${money(l.balanceAfter)}</td></tr>`).join('')}
    </table>
    <h3 style="margin-top:16px">GRN History</h3>
    <table>
      <tr><th>Number</th><th>Invoice</th><th>Date</th><th>Total</th></tr>
      ${vendorGrns.map((g) => `<tr><td>${escapeHtml(g.number)}</td><td>${escapeHtml(g.invoiceNumber || '')}</td><td>${fmtDate(g.date)}</td><td>${money(g.total)}</td></tr>`).join('')}
    </table>
  `;
  window.print();
}

// Shared by the list row's direct Delete button and the edit form's
// Delete button. Extra warning if the vendor has an outstanding balance.
function deleteVendor(id) {
  const v = STATE.vendors.find((x) => x.id === id);
  if (!v) return false;
  const warn = v.balance > 0 ? ` They're still owed ${money(v.balance)} — deleting them loses that record too.` : '';
  if (!confirm(`Delete ${v.name}? This cannot be undone.${warn}`)) return false;
  STATE.vendors = STATE.vendors.filter((x) => x.id !== id);
  if (selectedVendorId === id) selectedVendorId = null;
  saveKey('vendors').then(() => { renderVendors(); toast('Vendor deleted'); });
  return true;
}
function openVendorForm(id) {
  const v = id ? STATE.vendors.find((x) => x.id === id) : null;
  openModal(`
    <h3>${v ? 'Edit Vendor' : 'Add Vendor'}</h3>
    <div class="field"><label>Name</label><input id="vf-name" value="${v ? escapeHtml(v.name) : ''}"></div>
    <div class="field"><label>Phone</label><input id="vf-phone" value="${v ? escapeHtml(v.phone || '') : ''}"></div>
    <div class="field"><label>Address</label><input id="vf-address" value="${v ? escapeHtml(v.address || '') : ''}"></div>
    <div class="modal-actions">
      <button class="btn secondary" id="vf-cancel">Cancel</button>
      <button class="btn" id="vf-save">Save</button>
      ${v && isAdmin() ? '<button class="btn danger" id="vf-delete">Delete</button>' : ''}
    </div>
  `);
  document.getElementById('vf-cancel').onclick = closeModal;
  if (v && isAdmin()) document.getElementById('vf-delete').onclick = () => { if (deleteVendor(v.id)) closeModal(); };
  document.getElementById('vf-save').onclick = async () => {
    const name = document.getElementById('vf-name').value.trim();
    if (!name) { toast('Name is required'); return; }
    const phone = document.getElementById('vf-phone').value.trim();
    const address = document.getElementById('vf-address').value.trim();
    if (v) {
      Object.assign(v, { name, phone, address });
    } else {
      const newVendor = { id: uid('V'), name, phone, address, purchased: 0, paid: 0, balance: 0, ledger: [] };
      STATE.vendors.push(newVendor);
      selectedVendorId = newVendor.id;
    }
    await saveKey('vendors');
    closeModal();
    renderVendors();
  };
}
function openVendorPaymentForm(id) {
  const v = STATE.vendors.find((x) => x.id === id);
  openModal(`
    <h3>Record Payment — ${escapeHtml(v.name)}</h3>
    <div class="field"><label>Amount</label><input type="number" step="0.01" id="vp-amount"></div>
    <div class="field"><label>Date</label><input type="date" id="vp-date" value="${todayISO()}"></div>
    <div class="field"><label>Method</label>
      <select id="vp-method"><option>Cash</option><option>Online Transfer</option><option>Cheque</option><option>Other</option></select>
    </div>
    <div class="field"><label>Note</label><input id="vp-note"></div>
    <div class="modal-actions">
      <button class="btn secondary" id="vp-cancel">Cancel</button>
      <button class="btn" id="vp-save">Save</button>
    </div>
  `);
  document.getElementById('vp-cancel').onclick = closeModal;
  document.getElementById('vp-save').onclick = async () => {
    const amount = parseFloat(document.getElementById('vp-amount').value) || 0;
    if (amount <= 0) { toast('Enter an amount'); return; }
    v.paid = (v.paid || 0) + amount;
    v.balance = (v.purchased || 0) - v.paid;
    v.ledger = v.ledger || [];
    v.ledger.push({
      id: uid('L'), type: 'payment', date: document.getElementById('vp-date').value || todayISO(), amount,
      method: document.getElementById('vp-method').value, note: document.getElementById('vp-note').value.trim(),
      balanceAfter: v.balance, by: STATE.user
    });
    await saveKey('vendors');
    closeModal();
    renderVendors();
  };
}
