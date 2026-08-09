/* ================= VENDORS ================= */
function renderVendors() {
  const c = document.getElementById('pageContent');
  c.innerHTML = `
    <button class="btn" id="addVendorBtn">+ Add Vendor</button>
    <div style="margin-top:14px">
      ${STATE.vendors.length === 0 ? '<div class="empty-state">No vendors yet.</div>' :
        STATE.vendors.map((v) => `
          <div class="list-row" data-id="${v.id}">
            <div><div class="title">${escapeHtml(v.name)}</div><div class="sub">Purchased ${money(v.purchased)} · Paid ${money(v.paid)}</div></div>
            <span class="badge ${v.balance > 0 ? 'due' : 'ok'}">${v.balance > 0 ? money(v.balance) + ' due' : 'Settled'}</span>
          </div>`).join('')}
    </div>
  `;
  document.getElementById('addVendorBtn').onclick = () => openVendorForm(null);
  c.querySelectorAll('.list-row').forEach((el) => el.onclick = () => openVendorLedger(el.dataset.id));
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
  if (v && isAdmin()) document.getElementById('vf-delete').onclick = () => {
    if (!confirm(`Delete ${v.name}? This cannot be undone.`)) return;
    STATE.vendors = STATE.vendors.filter((x) => x.id !== v.id);
    saveKey('vendors').then(() => { closeModal(); renderVendors(); toast('Vendor deleted'); });
  };
  document.getElementById('vf-save').onclick = async () => {
    const name = document.getElementById('vf-name').value.trim();
    if (!name) { toast('Name is required'); return; }
    const phone = document.getElementById('vf-phone').value.trim();
    const address = document.getElementById('vf-address').value.trim();
    if (v) Object.assign(v, { name, phone, address });
    else STATE.vendors.push({ id: uid('V'), name, phone, address, purchased: 0, paid: 0, balance: 0, ledger: [] });
    await saveKey('vendors');
    closeModal();
    renderVendors();
  };
}
function openVendorLedger(id) {
  const v = STATE.vendors.find((x) => x.id === id);
  if (!v) return;
  const sorted = [...(v.ledger || [])].sort((a, b) => b.date.localeCompare(a.date));
  openModal(`
    <h3>${escapeHtml(v.name)}</h3>
    <div class="sub">${escapeHtml(v.phone || '')}${v.address ? ' · ' + escapeHtml(v.address) : ''}</div>
    <div class="grid" style="margin:10px 0">
      <div class="card"><div class="label">Purchased</div><div class="value">${money(v.purchased)}</div></div>
      <div class="card"><div class="label">Paid</div><div class="value">${money(v.paid)}</div></div>
      <div class="card"><div class="label">Balance</div><div class="value">${money(v.balance)}</div></div>
    </div>
    ${isAdmin() ? '<button class="btn small" id="vl-edit">Edit</button>' : ''}
    <button class="btn small" id="vl-pay">Record Payment</button>
    <div class="section-title"><h3>Ledger</h3></div>
    ${sorted.length === 0 ? '<div class="empty-state">No transactions.</div>' :
      sorted.map((l) => `<div class="list-row"><div><div class="title">${escapeHtml(v.name)} — ${labelForLedgerType(l.type)}${l.ref ? ' (' + escapeHtml(l.ref) + ')' : ''}${l.method ? ' (' + escapeHtml(l.method) + ')' : ''}</div><div class="sub">${fmtDate(l.date)} ${l.note ? '· ' + escapeHtml(l.note) : ''}</div></div><div style="text-align:right"><strong>${l.type === 'payment' ? '-' : '+'}${money(l.amount)}</strong>${l.balanceAfter !== undefined ? `<div class="sub">Bal: ${money(l.balanceAfter)}</div>` : ''}</div></div>`).join('')}
    <button class="btn secondary block" style="margin-top:10px" id="vl-close">Close</button>
  `);
  document.getElementById('vl-close').onclick = closeModal;
  if (isAdmin()) document.getElementById('vl-edit').onclick = () => openVendorForm(id);
  document.getElementById('vl-pay').onclick = () => openVendorPaymentForm(id);
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
    openVendorLedger(id);
    renderVendors();
  };
}

