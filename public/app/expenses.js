/* ================= EXPENSES ================= */
// AI-INTELLIGENCE-LAYER-v2-command.md Feature 1. STATE.expenses is
// prefetched at boot like every other key (see app.js KEYS); creation/void
// go through the dedicated, validated /api/expenses endpoints (server.js
// -> routes/expenses.js) rather than a raw PUT of the whole array, same
// reasoning as bills/GRN having their own POST endpoints.
const EXPENSE_CATEGORIES = ['rent', 'salaries', 'transport', 'utilities', 'packaging', 'misc'];
// Left uninitialized here (not `todayISO().slice(...)`) because this file
// loads before app.js, which is where todayISO() is defined — evaluating
// it at module scope would throw immediately on page load. Defaulted
// lazily inside renderExpenses() instead, once app.js has run.
let expensesFrom = null;
let expensesTo = null;
let expensesCategoryFilter = 'all';

function renderExpenses() {
  if (expensesFrom === null) expensesFrom = todayISO().slice(0, 7) + '-01'; // default: this month
  if (expensesTo === null) expensesTo = todayISO();
  const c = document.getElementById('pageContent');
  c.innerHTML = `
    <div class="row" style="margin-bottom:10px">
      <button class="btn" id="exp-add">+ Add Expense</button>
    </div>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <div class="field" style="margin-bottom:0"><label>From</label><input type="date" id="exp-from" value="${expensesFrom}"></div>
      <div class="field" style="margin-bottom:0"><label>To</label><input type="date" id="exp-to" value="${expensesTo}"></div>
      <div class="field" style="margin-bottom:0"><label>Category</label>
        <select id="exp-cat-filter">
          <option value="all">All</option>
          ${EXPENSE_CATEGORIES.map((cat) => `<option value="${cat}" ${expensesCategoryFilter === cat ? 'selected' : ''}>${cat[0].toUpperCase() + cat.slice(1)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="exp-list">${renderExpensesListHtml()}</div>
  `;
  document.getElementById('exp-add').onclick = openAddExpenseModal;
  document.getElementById('exp-from').onchange = (e) => { expensesFrom = e.target.value; refreshExpensesList(); };
  document.getElementById('exp-to').onchange = (e) => { expensesTo = e.target.value; refreshExpensesList(); };
  document.getElementById('exp-cat-filter').onchange = (e) => { expensesCategoryFilter = e.target.value; refreshExpensesList(); };
  bindExpensesListEvents();
}
function refreshExpensesList() {
  document.getElementById('exp-list').innerHTML = renderExpensesListHtml();
  bindExpensesListEvents();
}
function filteredExpenses() {
  return (STATE.expenses || [])
    .filter((e) => !e.voided)
    .filter((e) => (!expensesFrom || e.date >= expensesFrom) && (!expensesTo || e.date <= expensesTo))
    .filter((e) => expensesCategoryFilter === 'all' || e.category === expensesCategoryFilter)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}
function renderExpensesListHtml() {
  const list = filteredExpenses();
  const total = list.reduce((s, e) => s + (e.amount || 0), 0);
  const header = `<div class="section-title"><h3>Running Total</h3><strong>${money(total)}</strong></div>`;
  if (list.length === 0) {
    return header + `<div class="empty-state">
      <div class="empty-icon">\u{1F4B8}</div>
      <div>${(STATE.expenses || []).length === 0 ? 'No expenses logged yet.' : 'No expenses match this filter.'}</div>
    </div>`;
  }
  return header + list.map((e) => `
    <div class="list-row" data-id="${e.id}">
      <div><div class="title">${escapeHtml(e.description || e.category)}</div>
        <div class="sub">${fmtDate(e.date)} · ${e.category[0].toUpperCase() + e.category.slice(1)} · ${escapeHtml(e.enteredBy || '')}</div></div>
      <div style="display:flex;align-items:center;gap:10px">
        <strong class="mono">${money(e.amount)}</strong>
        ${isAdmin() ? `<button class="btn small danger" data-void="${e.id}">Void</button>` : ''}
      </div>
    </div>`).join('');
}
function bindExpensesListEvents() {
  document.querySelectorAll('#exp-list [data-void]').forEach((btn) => {
    btn.onclick = (ev) => { ev.stopPropagation(); voidExpenseFlow(btn.dataset.void); };
  });
}

function openAddExpenseModal() {
  openModal(`
    <h3>Add Expense</h3>
    <div class="field"><label>Date</label><input type="date" id="ae-date" value="${todayISO()}"></div>
    <div class="field"><label>Category</label>
      <select id="ae-category">${EXPENSE_CATEGORIES.map((cat) => `<option value="${cat}">${cat[0].toUpperCase() + cat.slice(1)}</option>`).join('')}</select>
    </div>
    <div class="field"><label>Description</label><input id="ae-description" placeholder="e.g. Delivery van fuel"></div>
    <div class="field"><label>Amount (Rs.)</label><input type="number" id="ae-amount" min="0" step="0.01"></div>
    <div class="modal-actions">
      <button class="btn secondary" id="ae-cancel">Cancel</button>
      <button class="btn" id="ae-save">Save</button>
    </div>
  `);
  document.getElementById('ae-cancel').onclick = closeModal;
  document.getElementById('ae-save').onclick = async () => {
    const date = document.getElementById('ae-date').value || todayISO();
    const category = document.getElementById('ae-category').value;
    const description = document.getElementById('ae-description').value.trim();
    const amount = parseFloat(document.getElementById('ae-amount').value);
    if (!amount || amount <= 0) { toast('Enter a valid amount'); return; }
    const btn = document.getElementById('ae-save');
    btn.disabled = true; btn.textContent = 'Saving...';
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ date, category, description, amount })
      });
      const data = await res.json();
      if (!res.ok) { toast(data.message || 'Could not save expense'); btn.disabled = false; btn.textContent = 'Save'; return; }
      STATE.expenses = STATE.expenses || [];
      STATE.expenses.push(data.expense);
    } catch (e) {
      toast('Could not reach the server to save this expense.');
      btn.disabled = false; btn.textContent = 'Save';
      return;
    }
    closeModal();
    renderExpenses();
    toast('Expense logged');
  };
}

function voidExpenseFlow(expenseId) {
  const expense = (STATE.expenses || []).find((e) => e.id === expenseId);
  if (!expense) return;
  openModal(`
    <h3>Void this expense?</h3>
    <p class="sub" style="margin-top:-6px">${escapeHtml(expense.description || expense.category)} — ${money(expense.amount)}. This cannot be undone.</p>
    <div class="field"><label>Reason (optional)</label><input id="ve-reason" placeholder="e.g. Entered twice by mistake"></div>
    <div class="modal-actions">
      <button class="btn secondary" id="ve-cancel">Cancel</button>
      <button class="btn danger" id="ve-confirm">Void Expense</button>
    </div>
  `);
  document.getElementById('ve-cancel').onclick = closeModal;
  document.getElementById('ve-confirm').onclick = async () => {
    const btn = document.getElementById('ve-confirm');
    btn.disabled = true; btn.textContent = 'Voiding...';
    try {
      const res = await fetch(`/api/expenses/${expenseId}/void`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ reason: document.getElementById('ve-reason').value.trim() })
      });
      const data = await res.json();
      if (!res.ok) { toast(data.message || 'Could not void this expense'); btn.disabled = false; btn.textContent = 'Void Expense'; return; }
      const idx = (STATE.expenses || []).findIndex((e) => e.id === expenseId);
      if (idx >= 0) STATE.expenses[idx] = data.expense;
    } catch (e) {
      toast('Could not reach the server to void this expense.');
      btn.disabled = false; btn.textContent = 'Void Expense';
      return;
    }
    closeModal();
    renderExpenses();
    toast('Expense voided');
  };
}
