/* ================= CUSTOMERS ================= */
function renderCustomers() {
  const c = document.getElementById('pageContent');
  c.innerHTML = `
    <button class="btn" id="addCustomerBtn">+ Add Customer</button>
    <div style="margin-top:14px">
      ${STATE.customers.length === 0 ? '<div class="empty-state">No customers yet.</div>' :
        STATE.customers.map((cu) => `
          <div class="list-row" data-id="${cu.id}">
            <div><div class="title">${escapeHtml(cu.name)}</div><div class="sub">${escapeHtml(cu.phone || '')}</div></div>
            <span class="badge ${cu.dues > 0 ? 'due' : 'ok'}">${cu.dues > 0 ? money(cu.dues) + ' due' : 'Settled'}</span>
          </div>`).join('')}
    </div>
  `;
  document.getElementById('addCustomerBtn').onclick = () => openCustomerForm(null);
  c.querySelectorAll('.list-row').forEach((el) => el.onclick = () => openCustomerLedger(el.dataset.id));
}
function openCustomerForm(id) {
  const cu = id ? STATE.customers.find((x) => x.id === id) : null;
  openModal(`
    <h3>${cu ? 'Edit Customer' : 'Add Customer'}</h3>
    <div class="field"><label>Name</label><input id="cf-name" value="${cu ? escapeHtml(cu.name) : ''}"></div>
    <div class="field"><label>Phone</label><input id="cf-phone" value="${cu ? escapeHtml(cu.phone || '') : ''}"></div>
    <div class="field"><label>Address</label><input id="cf-address" value="${cu ? escapeHtml(cu.address || '') : ''}"></div>
    <div class="modal-actions">
      <button class="btn secondary" id="cf-cancel">Cancel</button>
      <button class="btn" id="cf-save">Save</button>
      ${cu && isAdmin() ? '<button class="btn danger" id="cf-delete">Delete</button>' : ''}
    </div>
  `);
  document.getElementById('cf-cancel').onclick = closeModal;
  if (cu && isAdmin()) document.getElementById('cf-delete').onclick = () => {
    if (!confirm(`Delete ${cu.name}? This cannot be undone.`)) return;
    STATE.customers = STATE.customers.filter((x) => x.id !== cu.id);
    saveKey('customers').then(() => { closeModal(); renderCustomers(); toast('Customer deleted'); });
  };
  document.getElementById('cf-save').onclick = async () => {
    const name = document.getElementById('cf-name').value.trim();
    if (!name) { toast('Name is required'); return; }
    const phone = document.getElementById('cf-phone').value.trim();
    const address = document.getElementById('cf-address').value.trim();
    if (cu) Object.assign(cu, { name, phone, address });
    else STATE.customers.push({ id: uid('C'), name, phone, address, dues: 0, ledger: [] });
    await saveKey('customers');
    closeModal();
    renderCustomers();
  };
}
function openCustomerLedger(id) {
  const cu = STATE.customers.find((x) => x.id === id);
  if (!cu) return;
  const sorted = [...(cu.ledger || [])].sort((a, b) => b.date.localeCompare(a.date));
  openModal(`
    <h3>${escapeHtml(cu.name)}</h3>
    <div class="sub">${escapeHtml(cu.phone || '')} · ${escapeHtml(cu.address || '')}</div>
    <div class="card" style="margin:10px 0;display:flex;justify-content:space-between"><strong>Dues</strong><strong>${money(cu.dues)}</strong></div>
    ${isAdmin() ? '<button class="btn small" id="cl-edit">Edit</button>' : ''}
    <button class="btn small" id="cl-pay">Record Payment</button>
    <div class="section-title"><h3>Ledger</h3></div>
    ${sorted.length === 0 ? '<div class="empty-state">No transactions.</div>' :
      sorted.map((l) => `<div class="list-row"><div><div class="title">${labelForLedgerType(l.type)} ${l.ref ? '(' + l.ref + ')' : ''}</div><div class="sub">${fmtDate(l.date)} ${l.note ? '· ' + escapeHtml(l.note) : ''}</div></div><div style="text-align:right"><strong>${l.type === 'payment' ? '-' : '+'}${money(l.amount)}</strong>${l.balanceAfter !== undefined ? `<div class="sub">Bal: ${money(l.balanceAfter)}</div>` : ''}</div></div>`).join('')}
    <button class="btn secondary block" style="margin-top:10px" id="cl-close">Close</button>
  `);
  document.getElementById('cl-close').onclick = closeModal;
  if (isAdmin()) document.getElementById('cl-edit').onclick = () => openCustomerForm(id);
  document.getElementById('cl-pay').onclick = () => openCustomerPaymentForm(id);
}
function openCustomerPaymentForm(id) {
  const cu = STATE.customers.find((x) => x.id === id);
  openModal(`
    <h3>Record Payment — ${escapeHtml(cu.name)}</h3>
    <div class="field"><label>Amount</label><input type="number" step="0.01" id="cp-amount"></div>
    <div class="field"><label>Date</label><input type="date" id="cp-date" value="${todayISO()}"></div>
    <div class="field"><label>Method</label><select id="cp-method"><option value="cash">Cash</option><option value="bank">Bank</option><option value="other">Other</option></select></div>
    <div class="field"><label>Note</label><input id="cp-note"></div>
    <div class="modal-actions">
      <button class="btn secondary" id="cp-cancel">Cancel</button>
      <button class="btn" id="cp-save">Save</button>
    </div>
  `);
  document.getElementById('cp-cancel').onclick = closeModal;
  document.getElementById('cp-save').onclick = async () => {
    const amount = parseFloat(document.getElementById('cp-amount').value) || 0;
    if (amount <= 0) { toast('Enter an amount'); return; }
    cu.dues = (cu.dues || 0) - amount;
    cu.ledger = cu.ledger || [];
    cu.ledger.push({
      id: uid('L'), type: 'payment', date: document.getElementById('cp-date').value || todayISO(),
      amount, balanceAfter: cu.dues, ref: '', note: `${document.getElementById('cp-method').value}${document.getElementById('cp-note').value ? ' - ' + document.getElementById('cp-note').value : ''}`,
      by: STATE.user
    });
    await saveKey('customers');
    closeModal();
    openCustomerLedger(id);
    renderCustomers();
  };
}

