/* ================= HOME / DASHBOARD ================= */
function renderHome() {
  const c = document.getElementById('pageContent');
  const today = todayISO();
  const monthKey = today.slice(0, 7);

  const todaysBills = STATE.bills.filter((b) => b.date === today && b.type !== 'quote');
  const monthBills = STATE.bills.filter((b) => (b.date || '').slice(0, 7) === monthKey && b.type !== 'quote');

  const todaysSales = todaysBills.reduce((s, b) => s + (b.total || 0), 0);
  const todaysProfit = todaysBills.reduce((s, b) => {
    const billProfit = (b.items || []).reduce((ps, it) => ps + ((it.price - it.cost) * it.qty), 0);
    return s + billProfit;
  }, 0);
  const stockValue = STATE.products.reduce((s, p) => s + (p.costPrice || 0) * (p.stock || 0), 0);
  const totalDues = STATE.customers.reduce((s, cu) => s + (cu.dues || 0), 0);
  const totalLoans = STATE.lenders.reduce((s, l) => s + (l.balance || 0), 0);
  const lowStock = STATE.products.filter((p) => (p.stock || 0) <= LOW_STOCK_THRESHOLD);

  c.innerHTML = `
    <div class="grid">
      <div class="card stat-card" id="stat-today"><div class="label">Today's Sales</div><div class="value">${money(todaysSales)}</div></div>
      <div class="card stat-card" id="stat-todayprofit"><div class="label">Today's Profit</div><div class="value">${money(todaysProfit)}</div></div>
      <div class="card stat-card" id="stat-stockvalue"><div class="label">Stock Value</div><div class="value">${money(stockValue)}</div></div>
      <div class="card stat-card ${totalDues > 0 ? 'warn' : ''}" id="stat-dues"><div class="label">Customer Dues</div><div class="value">${money(totalDues)}</div></div>
      <div class="card stat-card ${totalLoans > 0 ? 'warn' : ''}" id="stat-loans"><div class="label">Loans Outstanding</div><div class="value">${money(totalLoans)}</div></div>
      <div class="card stat-card" id="stat-lowstock"><div class="label">Low Stock</div><div class="value">${lowStock.length}</div></div>
    </div>
    <div class="card" id="monthly-detail-link" style="margin-top:14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">
      <span>View monthly detail</span><span>&rsaquo;</span>
    </div>
  `;

  document.getElementById('stat-today').onclick = () => showBreakdown("Today's Sales", todaysBills);
  document.getElementById('stat-todayprofit').onclick = () => showProfitBreakdown("Today's Profit", todaysBills);
  document.getElementById('stat-stockvalue').onclick = () => showStockValueBreakdown();
  document.getElementById('stat-dues').onclick = () => showDuesBreakdown();
  document.getElementById('stat-loans').onclick = () => showLoansBreakdown();
  document.getElementById('stat-lowstock').onclick = () => showLowStockBreakdown(lowStock);
  document.getElementById('monthly-detail-link').onclick = () => renderMonthlyDetail();
}
function showLowStockBreakdown(lowStock) {
  openModal(`
    <h3>Low Stock (≤ ${LOW_STOCK_THRESHOLD})</h3>
    ${lowStock.length === 0 ? '<div class="empty-state">Nothing low on stock.</div>' :
      lowStock.map((p) => `<div class="list-row"><div><div class="title">${escapeHtml(p.name)}</div><div class="sub">${escapeHtml(p.category)}</div></div><span class="badge due">${p.stock} left</span></div>`).join('')}
    <div class="modal-actions"><button class="btn secondary block" id="closeBreakdown">Close</button></div>
  `);
  document.getElementById('closeBreakdown').onclick = closeModal;
}

/* ---- Monthly detail (secondary screen, linked from Home) ---- */
function renderMonthlyDetail() {
  const c = document.getElementById('pageContent');
  document.getElementById('pageTitle').textContent = 'Monthly Detail';
  const monthKey = todayISO().slice(0, 7);
  const monthBills = STATE.bills.filter((b) => (b.date || '').slice(0, 7) === monthKey && b.type !== 'quote');
  const monthSales = monthBills.reduce((s, b) => s + (b.total || 0), 0);
  const monthProfit = monthBills.reduce((s, b) => {
    const billProfit = (b.items || []).reduce((ps, it) => ps + ((it.price - it.cost) * it.qty), 0);
    return s + billProfit;
  }, 0);
  const productsByValue = [...STATE.products].sort((a, b) => (b.costPrice * b.stock) - (a.costPrice * a.stock));
  const totalStockValue = STATE.products.reduce((s, p) => s + (p.costPrice || 0) * (p.stock || 0), 0);

  c.innerHTML = `
    <div class="list-row" id="md-back" style="cursor:pointer"><span>&lsaquo; Back to Home</span></div>
    <div class="grid" style="margin-top:10px">
      <div class="card stat-card" id="md-sales"><div class="label">This Month Sales</div><div class="value">${money(monthSales)}</div></div>
      <div class="card stat-card" id="md-profit"><div class="label">This Month Profit</div><div class="value">${money(monthProfit)}</div></div>
    </div>
    <div class="section-title"><h3>Full Stock Breakdown</h3><strong>${money(totalStockValue)}</strong></div>
    ${productsByValue.length === 0 ? '<div class="empty-state">No products yet.</div>' :
      productsByValue.map((p) => `<div class="list-row"><div><div class="title">${escapeHtml(p.name)}</div><div class="sub">${escapeHtml(p.category)} · ${p.stock} × ${money(p.costPrice)}</div></div><strong>${money((p.costPrice || 0) * (p.stock || 0))}</strong></div>`).join('')}
  `;
  document.getElementById('md-back').onclick = () => goTab('home');
  document.getElementById('md-sales').onclick = () => showBreakdown('This Month Sales', monthBills);
  document.getElementById('md-profit').onclick = () => showProfitBreakdown('This Month Profit', monthBills);
}

function showBreakdown(title, bills) {
  const sorted = [...bills].sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  openModal(`
    <h3>${title}</h3>
    ${sorted.length === 0 ? '<div class="empty-state">No transactions.</div>' :
      sorted.map((b) => `<div class="list-row"><div><div class="title">${b.number || ''} — ${escapeHtml(b.customerName || 'Walk-in')}</div><div class="sub">${fmtDate(b.date)} ${b.time || ''} · ${b.type === 'memo' ? 'Credit Memo' : 'Bill'}</div></div><strong>${money(b.total)}</strong></div>`).join('')}
    <div class="modal-actions"><button class="btn secondary block" id="closeBreakdown">Close</button></div>
  `);
  document.getElementById('closeBreakdown').onclick = closeModal;
}
function showProfitBreakdown(title, bills) {
  const sorted = [...bills].sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  openModal(`
    <h3>${title}</h3>
    ${sorted.length === 0 ? '<div class="empty-state">No transactions.</div>' :
      sorted.map((b) => {
        const p = (b.items || []).reduce((s, it) => s + ((it.price - it.cost) * it.qty), 0);
        return `<div class="list-row"><div><div class="title">${b.number || ''} — ${escapeHtml(b.customerName || 'Walk-in')}</div><div class="sub">${fmtDate(b.date)}</div></div><strong>${money(p)}</strong></div>`;
      }).join('')}
    <div class="modal-actions"><button class="btn secondary block" id="closeBreakdown">Close</button></div>
  `);
  document.getElementById('closeBreakdown').onclick = closeModal;
}
function showStockValueBreakdown() {
  const items = STATE.products.filter((p) => (p.stock || 0) > 0)
    .sort((a, b) => (b.costPrice * b.stock) - (a.costPrice * a.stock));
  openModal(`
    <h3>Stock Value</h3>
    ${items.length === 0 ? '<div class="empty-state">No stock.</div>' :
      items.map((p) => `<div class="list-row"><div><div class="title">${escapeHtml(p.name)}</div><div class="sub">${p.stock} × ${money(p.costPrice)}</div></div><strong>${money((p.costPrice || 0) * (p.stock || 0))}</strong></div>`).join('')}
    <div class="modal-actions"><button class="btn secondary block" id="closeBreakdown">Close</button></div>
  `);
  document.getElementById('closeBreakdown').onclick = closeModal;
}
function showDuesBreakdown() {
  const items = STATE.customers.filter((c) => (c.dues || 0) > 0).sort((a, b) => b.dues - a.dues);
  openModal(`
    <h3>Total Customer Dues</h3>
    ${items.length === 0 ? '<div class="empty-state">No dues.</div>' :
      items.map((c) => `<div class="list-row" data-id="${c.id}"><div><div class="title">${escapeHtml(c.name)}</div><div class="sub">${escapeHtml(c.phone || '')}</div></div><strong>${money(c.dues)}</strong></div>`).join('')}
    <div class="modal-actions"><button class="btn secondary block" id="closeBreakdown">Close</button></div>
  `);
  document.querySelectorAll('#modalRoot .list-row').forEach((el) => {
    el.onclick = () => { closeModal(); goTab('customers'); setTimeout(() => openCustomerLedger(el.dataset.id), 50); };
  });
  document.getElementById('closeBreakdown').onclick = closeModal;
}
function showLoansBreakdown() {
  const items = STATE.lenders.filter((l) => (l.balance || 0) > 0).sort((a, b) => b.balance - a.balance);
  openModal(`
    <h3>Total Loans Outstanding</h3>
    ${items.length === 0 ? '<div class="empty-state">No loans outstanding.</div>' :
      items.map((l) => `<div class="list-row" data-id="${l.id}"><div><div class="title">${escapeHtml(l.name)}</div><div class="sub">${escapeHtml(l.phone || '')}</div></div><strong>${money(l.balance)}</strong></div>`).join('')}
    <div class="modal-actions"><button class="btn secondary block" id="closeBreakdown">Close</button></div>
  `);
  document.querySelectorAll('#modalRoot .list-row').forEach((el) => {
    el.onclick = () => { closeModal(); goTab('loans'); setTimeout(() => openLenderLedger(el.dataset.id), 50); };
  });
  document.getElementById('closeBreakdown').onclick = closeModal;
}

