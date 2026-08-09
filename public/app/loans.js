/* ================= LOANS ================= */
function renderLoans() {
  const c = document.getElementById('pageContent');
  const totalOutstanding = STATE.lenders.reduce((s, l) => s + (l.balance || 0), 0);
  c.innerHTML = `
    <div class="row">
      <button class="btn" id="addLoanBtn">+ Add Loan</button>
      <button class="btn secondary" id="addLenderBtn">+ New Lender</button>
    </div>
    <div style="margin-top:14px">
      ${STATE.lenders.length === 0 ? '<div class="empty-state">No lenders yet.</div>' :
        STATE.lenders.map((l) => `
          <div class="list-row" data-id="${l.id}">
            <div><div class="title">${escapeHtml(l.name)}</div><div class="sub">Given ${money(l.given)} · Repaid ${money(l.repaid)}</div></div>
            <span class="badge ${l.balance > 0 ? 'due' : 'ok'}">${money(l.balance)}</span>
          </div>`).join('')}
    </div>
    <div class="card" style="margin-top:16px;display:flex;justify-content:space-between"><strong>Total Outstanding</strong><strong>${money(totalOutstanding)}</strong></div>
  `;
  document.getElementById('addLoanBtn').onclick = () => openAddLoanForm();
  document.getElementById('addLenderBtn').onclick = () => openLenderForm(null);
  c.querySelectorAll('.list-row').forEach((el) => el.onclick = () => openLenderLedger(el.dataset.id));
}
function openLenderForm(id, onSaved) {
  const l = id ? STATE.lenders.find((x) => x.id === id) : null;
  openModal(`
    <h3>${l ? 'Edit Lender' : 'New Lender'}</h3>
    <div class="field"><label>Name</label><input id="lf-name" value="${l ? escapeHtml(l.name) : ''}"></div>
    <div class="field"><label>Phone</label><input id="lf-phone" value="${l ? escapeHtml(l.phone || '') : ''}"></div>
    <div class="field"><label>Address</label><input id="lf-address" value="${l ? escapeHtml(l.address || '') : ''}"></div>
    <div class="modal-actions">
      <button class="btn secondary" id="lf-cancel">Cancel</button>
      <button class="btn" id="lf-save">Save</button>
      ${l && isAdmin() ? '<button class="btn danger" id="lf-delete">Delete</button>' : ''}
    </div>
  `);
  document.getElementById('lf-cancel').onclick = closeModal;
  if (l && isAdmin()) document.getElementById('lf-delete').onclick = () => {
    if (!confirm(`Delete ${l.name}? This cannot be undone.`)) return;
    STATE.lenders = STATE.lenders.filter((x) => x.id !== l.id);
    saveKey('lenders').then(() => { closeModal(); renderLoans(); toast('Lender deleted'); });
  };
  document.getElementById('lf-save').onclick = async () => {
    const name = document.getElementById('lf-name').value.trim();
    if (!name) { toast('Name is required'); return; }
    const phone = document.getElementById('lf-phone').value.trim();
    const address = document.getElementById('lf-address').value.trim();
    let saved = l;
    if (l) Object.assign(l, { name, phone, address });
    else { saved = { id: uid('LN'), name, phone, address, given: 0, repaid: 0, balance: 0, ledger: [] }; STATE.lenders.push(saved); }
    await saveKey('lenders');
    if (onSaved) onSaved(saved);
    else { closeModal(); renderLoans(); }
  };
}
function openAddLoanForm(preselectLenderId, keepAmount, keepDate) {
  openModal(`
    <h3>Add Loan</h3>
    <div class="field"><label>Lender</label>
      <select id="al-lender">
        <option value="">— Select —</option>
        ${STATE.lenders.map((l) => `<option value="${l.id}" ${preselectLenderId === l.id ? 'selected' : ''}>${escapeHtml(l.name)}</option>`).join('')}
        <option value="__new__">+ New lender</option>
      </select>
    </div>
    <div class="field"><label>Amount</label><input type="number" step="0.01" id="al-amount" value="${keepAmount || ''}"></div>
    <div class="field"><label>Date</label><input type="date" id="al-date" value="${keepDate || todayISO()}"></div>
    <div class="modal-actions">
      <button class="btn secondary" id="al-cancel">Cancel</button>
      <button class="btn" id="al-save">Save</button>
    </div>
  `);
  document.getElementById('al-lender').onchange = (e) => {
    if (e.target.value === '__new__') {
      const amt = document.getElementById('al-amount').value;
      const dt = document.getElementById('al-date').value;
      openLenderForm(null, (newLender) => { openAddLoanForm(newLender.id, amt, dt); });
    }
  };
  document.getElementById('al-cancel').onclick = closeModal;
  document.getElementById('al-save').onclick = async () => {
    const lenderId = document.getElementById('al-lender').value;
    const l = STATE.lenders.find((x) => x.id === lenderId);
    if (!l) { toast('Select a lender'); return; }
    const amount = parseFloat(document.getElementById('al-amount').value) || 0;
    if (amount <= 0) { toast('Enter an amount'); return; }
    l.given = (l.given || 0) + amount;
    l.balance = (l.given || 0) - (l.repaid || 0);
    l.ledger = l.ledger || [];
    l.ledger.push({ id: uid('L'), type: 'loan', date: document.getElementById('al-date').value || todayISO(), amount, method: '', note: '', balanceAfter: l.balance, by: STATE.user });
    await saveKey('lenders');
    closeModal();
    renderLoans();
  };
}
function openLenderLedger(id) {
  const l = STATE.lenders.find((x) => x.id === id);
  if (!l) return;
  const sorted = [...(l.ledger || [])].sort((a, b) => b.date.localeCompare(a.date));
  openModal(`
    <h3>${escapeHtml(l.name)}</h3>
    <div class="sub">${escapeHtml(l.phone || '')}${l.address ? ' · ' + escapeHtml(l.address) : ''}</div>
    <div class="grid" style="margin:10px 0">
      <div class="card"><div class="label">Given</div><div class="value">${money(l.given)}</div></div>
      <div class="card"><div class="label">Repaid</div><div class="value">${money(l.repaid)}</div></div>
      <div class="card"><div class="label">Balance</div><div class="value">${money(l.balance)}</div></div>
    </div>
    ${isAdmin() ? '<button class="btn small" id="ll-edit">Edit</button>' : ''}
    <button class="btn small" id="ll-pay">Record Payment</button>
    <div class="section-title"><h3>Ledger</h3></div>
    ${sorted.length === 0 ? '<div class="empty-state">No transactions.</div>' :
      sorted.map((l2) => `<div class="list-row"><div><div class="title">${escapeHtml(l.name)} — ${l2.type === 'loan' ? 'Loan Given' : 'Repayment'}${l2.method ? ' (' + escapeHtml(l2.method) + ')' : ''}</div><div class="sub">${fmtDate(l2.date)} ${l2.note ? '· ' + escapeHtml(l2.note) : ''}</div></div><div style="text-align:right"><strong>${l2.type === 'payment' ? '-' : '+'}${money(l2.amount)}</strong>${l2.balanceAfter !== undefined ? `<div class="sub">Bal: ${money(l2.balanceAfter)}</div>` : ''}</div></div>`).join('')}
    <button class="btn secondary block" style="margin-top:10px" id="ll-close">Close</button>
  `);
  document.getElementById('ll-close').onclick = closeModal;
  if (isAdmin()) document.getElementById('ll-edit').onclick = () => openLenderForm(id);
  document.getElementById('ll-pay').onclick = () => openLoanPaymentForm(id);
}
function openLoanPaymentForm(id) {
  const l = STATE.lenders.find((x) => x.id === id);
  openModal(`
    <h3>Record Payment — ${escapeHtml(l.name)}</h3>
    <div class="field"><label>Amount</label><input type="number" step="0.01" id="lp-amount"></div>
    <div class="field"><label>Date</label><input type="date" id="lp-date" value="${todayISO()}"></div>
    <div class="field"><label>Method</label>
      <select id="lp-method"><option>Cash</option><option>Online Transfer</option><option>Cheque</option><option>Other</option></select>
    </div>
    <div class="field"><label>Note</label><input id="lp-note"></div>
    <div class="modal-actions">
      <button class="btn secondary" id="lp-cancel">Cancel</button>
      <button class="btn" id="lp-save">Save</button>
    </div>
  `);
  document.getElementById('lp-cancel').onclick = closeModal;
  document.getElementById('lp-save').onclick = async () => {
    const amount = parseFloat(document.getElementById('lp-amount').value) || 0;
    if (amount <= 0) { toast('Enter an amount'); return; }
    l.repaid = (l.repaid || 0) + amount;
    l.balance = (l.given || 0) - l.repaid;
    l.ledger = l.ledger || [];
    l.ledger.push({
      id: uid('L'), type: 'payment', date: document.getElementById('lp-date').value || todayISO(), amount,
      method: document.getElementById('lp-method').value, note: document.getElementById('lp-note').value.trim(),
      balanceAfter: l.balance, by: STATE.user
    });
    await saveKey('lenders');
    closeModal();
    openLenderLedger(id);
    renderLoans();
  };
}

