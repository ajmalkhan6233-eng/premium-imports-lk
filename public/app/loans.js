/* ================= LOANS ================= */
let selectedLenderId = null;
let lenderLedgerView = 'credit'; // 'credit' (loans given) | 'debit' (repayments) — display split only, ledger array itself stays mixed
let lenderSearchQuery = '';

function renderLoans() {
  const c = document.getElementById('pageContent');
  const totalOutstanding = STATE.lenders.reduce((s, l) => s + (l.balance || 0), 0);
  c.innerHTML = `
    <div class="split-layout">
      <div class="split-list">
        <div class="row">
          <button class="btn" id="addLoanBtn">+ Add Loan</button>
          <button class="btn secondary" id="addLenderBtn">+ New Lender</button>
        </div>
        <div class="card" style="margin-top:10px;display:flex;justify-content:space-between"><strong>Total Outstanding</strong><strong>${money(totalOutstanding)}</strong></div>
        <input id="lender-search" placeholder="Search lenders..." value="${escapeHtml(lenderSearchQuery)}" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;margin-top:10px">
        <div id="lender-list" style="margin-top:10px">${renderLenderListHtml()}</div>
      </div>
      <div class="split-detail" id="lenderDetail">${renderLenderDetailHtml()}</div>
    </div>
  `;
  document.getElementById('addLoanBtn').onclick = () => openAddLoanForm();
  document.getElementById('addLenderBtn').onclick = () => openLenderForm(null);
  document.getElementById('lender-search').oninput = (e) => {
    lenderSearchQuery = e.target.value;
    document.getElementById('lender-list').innerHTML = renderLenderListHtml();
    bindLenderListEvents();
  };
  bindLenderListEvents();
  bindLenderDetailEvents();
}
function renderLenderListHtml() {
  const q = lenderSearchQuery.trim().toLowerCase();
  const list = q ? STATE.lenders.filter((l) => l.name.toLowerCase().includes(q) || (l.phone || '').includes(lenderSearchQuery.trim())) : STATE.lenders;
  if (list.length === 0) return `<div class="empty-state">${STATE.lenders.length === 0 ? 'No lenders yet.' : 'No lenders match that search.'}</div>`;
  return list.map((l) => `
    <div class="list-row ${l.id === selectedLenderId ? 'active' : ''}" data-id="${l.id}">
      <div><div class="title">${escapeHtml(l.name)}</div><div class="sub">Given ${money(l.given)} · Repaid ${money(l.repaid)}</div></div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="badge ${l.balance > 0 ? 'due' : 'ok'}">${money(l.balance)}</span>
        ${isAdmin() ? `<button class="btn small secondary" data-edit-lender="${l.id}">Edit</button>
        <button class="btn small danger" data-delete-lender="${l.id}">Delete</button>` : ''}
      </div>
    </div>`).join('');
}
function bindLenderListEvents() {
  document.querySelectorAll('#lender-list .list-row').forEach((el) => {
    el.onclick = () => { selectedLenderId = el.dataset.id; lenderLedgerView = 'credit'; renderLoans(); };
  });
  document.querySelectorAll('[data-edit-lender]').forEach((btn) => {
    btn.onclick = (e) => { e.stopPropagation(); openLenderForm(btn.dataset.editLender); };
  });
  document.querySelectorAll('[data-delete-lender]').forEach((btn) => {
    btn.onclick = (e) => { e.stopPropagation(); deleteLender(btn.dataset.deleteLender); };
  });
}
// Selects a lender in the split view — kept as a function (not inlined)
// since dashboard.js's Loans-outstanding breakdown navigates here by id.
function openLenderLedger(id) {
  selectedLenderId = id;
  lenderLedgerView = 'credit';
  renderLoans();
}

function renderLenderDetailHtml() {
  const l = selectedLenderId ? STATE.lenders.find((x) => x.id === selectedLenderId) : null;
  if (!l) return '<div class="empty-state">Select a lender to see contact info, balance, and history.</div>';
  const sorted = [...(l.ledger || [])].sort((a, b) => b.date.localeCompare(a.date));
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div>
          <h3 style="margin-bottom:2px">${escapeHtml(l.name)}</h3>
          <div class="sub">${escapeHtml(l.phone || 'No phone on file')}${l.address ? ' · ' + escapeHtml(l.address) : ''}</div>
        </div>
        ${isAdmin() ? '<button class="btn small secondary" id="ld-edit">Edit</button>' : ''}
      </div>
    </div>
    <div class="grid" style="margin:14px 0">
      <div class="card"><div class="label">Given</div><div class="value">${money(l.given)}</div></div>
      <div class="card"><div class="label">Repaid</div><div class="value">${money(l.repaid)}</div></div>
      <div class="card"><div class="label">Balance</div><div class="value">${money(l.balance)}</div></div>
    </div>
    <button class="btn small" id="ld-pay">Record Payment</button>
    <div class="section-title"><h3>Balance over time</h3></div>
    <div class="card">${renderLedgerChartSvg(l.ledger)}</div>
    <div class="section-title"><h3>Ledger</h3></div>
    <div class="toggle-group" id="lenderLedgerTabs">
      <button data-view="credit" class="${lenderLedgerView === 'credit' ? 'active' : ''}">Credit — Given (${money(l.given)})</button>
      <button data-view="debit" class="${lenderLedgerView === 'debit' ? 'active' : ''}">Debit — Repaid (${money(l.repaid)})</button>
    </div>
    ${renderLenderLedgerList(sorted)}
  `;
}
function renderLenderLedgerList(sorted) {
  const wantType = lenderLedgerView === 'debit' ? 'payment' : 'loan';
  const entries = sorted.filter((l2) => l2.type === wantType);
  if (entries.length === 0) return `<div class="empty-state">No ${lenderLedgerView === 'debit' ? 'repayments' : 'loans given'} yet.</div>`;
  return entries.map((l2) => `
    <div class="list-row" style="cursor:default">
      <div><div class="title">${l2.type === 'loan' ? 'Loan Given' : 'Repayment'}${l2.method ? ' (' + escapeHtml(l2.method) + ')' : ''}</div>
        <div class="sub">${fmtDate(l2.date)} ${l2.note ? '· ' + escapeHtml(l2.note) : ''}</div></div>
      <div style="text-align:right"><strong>${l2.type === 'payment' ? '-' : '+'}${money(l2.amount)}</strong>${l2.balanceAfter !== undefined ? `<div class="sub">Bal: ${money(l2.balanceAfter)}</div>` : ''}</div>
    </div>`).join('');
}
function bindLenderDetailEvents() {
  const l = selectedLenderId ? STATE.lenders.find((x) => x.id === selectedLenderId) : null;
  if (!l) return;
  const editBtn = document.getElementById('ld-edit');
  if (editBtn) editBtn.onclick = () => openLenderForm(l.id);
  const payBtn = document.getElementById('ld-pay');
  if (payBtn) payBtn.onclick = () => openLoanPaymentForm(l.id);
  const tabs = document.getElementById('lenderLedgerTabs');
  if (tabs) tabs.querySelectorAll('button[data-view]').forEach((b) => {
    b.onclick = () => { lenderLedgerView = b.dataset.view; renderLoans(); };
  });
}

// Shared by the list row's direct Delete button and the edit form's
// Delete button. Extra warning if the lender is still owed money.
function deleteLender(id) {
  const l = STATE.lenders.find((x) => x.id === id);
  if (!l) return false;
  const warn = l.balance > 0 ? ` They're still owed ${money(l.balance)} — deleting them loses that record too.` : '';
  if (!confirm(`Delete ${l.name}? This cannot be undone.${warn}`)) return false;
  STATE.lenders = STATE.lenders.filter((x) => x.id !== id);
  if (selectedLenderId === id) selectedLenderId = null;
  saveKey('lenders').then(() => { renderLoans(); toast('Lender deleted'); });
  return true;
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
  if (l && isAdmin()) document.getElementById('lf-delete').onclick = () => { if (deleteLender(l.id)) closeModal(); };
  document.getElementById('lf-save').onclick = async () => {
    const name = document.getElementById('lf-name').value.trim();
    if (!name) { toast('Name is required'); return; }
    const phone = document.getElementById('lf-phone').value.trim();
    const address = document.getElementById('lf-address').value.trim();
    let saved = l;
    if (l) {
      Object.assign(l, { name, phone, address });
    } else {
      saved = { id: uid('LN'), name, phone, address, given: 0, repaid: 0, balance: 0, ledger: [] };
      STATE.lenders.push(saved);
      selectedLenderId = saved.id;
    }
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
    selectedLenderId = l.id;
    closeModal();
    renderLoans();
  };
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
    renderLoans();
  };
}
