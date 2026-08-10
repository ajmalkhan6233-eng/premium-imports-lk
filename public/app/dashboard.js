/* ================= HOME / DASHBOARD ================= */
let homePeriod = 'today'; // 'today' | 'week' | 'month'

function periodRange(period) {
  const today = todayISO();
  if (period === 'week') {
    const d = new Date();
    const day = d.getDay();
    const diff = (day === 0 ? 6 : day - 1); // days since Monday
    d.setDate(d.getDate() - diff);
    return { from: d.toISOString().slice(0, 10), to: today, label: 'This Week' };
  }
  if (period === 'month') return { from: today.slice(0, 7) + '-01', to: today, label: 'This Month' };
  return { from: today, to: today, label: 'Today' };
}

function renderHome() {
  const c = document.getElementById('pageContent');
  const { from, to, label } = periodRange(homePeriod);
  const periodBills = STATE.bills.filter((b) => b.type !== 'quote' && b.date >= from && b.date <= to);

  const periodSales = periodBills.reduce((s, b) => s + (b.total || 0), 0);
  const periodProfit = periodBills.reduce((s, b) => {
    const billProfit = (b.items || []).reduce((ps, it) => ps + ((it.price - it.cost) * it.qty), 0) - (b.discountAmount || 0);
    return s + billProfit;
  }, 0);
  const stockValue = STATE.products.reduce((s, p) => s + (p.costPrice || 0) * (p.stock || 0), 0);
  const totalDues = STATE.customers.reduce((s, cu) => s + (cu.dues || 0), 0);
  const totalLoans = STATE.lenders.reduce((s, l) => s + (l.balance || 0), 0);
  const lowStock = STATE.products.filter((p) => (p.stock || 0) <= LOW_STOCK_THRESHOLD);

  c.innerHTML = `
    <div class="toggle-group" id="home-period-group">
      <button data-period="today" class="${homePeriod === 'today' ? 'active' : ''}">Today</button>
      <button data-period="week" class="${homePeriod === 'week' ? 'active' : ''}">This Week</button>
      <button data-period="month" class="${homePeriod === 'month' ? 'active' : ''}">This Month</button>
    </div>
    <div class="row" style="margin-bottom:14px">
      <button class="btn secondary" id="home-download">⬇ Download Summary</button>
      <button class="btn secondary" id="home-upload">⬆ Upload Document</button>
    </div>
    <div class="grid">
      <div class="card stat-card" id="stat-sales"><div class="label">Sales — ${label}</div><div class="value">${money(periodSales)}</div></div>
      <div class="card stat-card" id="stat-profit"><div class="label">Profit — ${label}</div><div class="value">${money(periodProfit)}</div></div>
      <div class="card stat-card" id="stat-stockvalue"><div class="label">Stock Value — right now</div><div class="value">${money(stockValue)}</div></div>
      <div class="card stat-card ${totalDues > 0 ? 'warn' : ''}" id="stat-dues"><div class="label">Customer Dues — right now</div><div class="value">${money(totalDues)}</div></div>
      <div class="card stat-card ${totalLoans > 0 ? 'warn' : ''}" id="stat-loans"><div class="label">Loans Outstanding — right now</div><div class="value">${money(totalLoans)}</div></div>
      <div class="card stat-card ${lowStock.length ? 'warn' : ''}" id="stat-lowstock"><div class="label">Low Stock — right now</div><div class="value">${lowStock.length}</div></div>
    </div>
    <div class="card" id="monthly-detail-link" style="margin-top:14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">
      <span>View full stock breakdown</span><span>&rsaquo;</span>
    </div>
    <div class="section-title"><h3>Documents</h3></div>
    <div id="home-doc-list">${renderDocumentList()}</div>
    <div id="dashPrintArea" style="position:absolute;left:-9999px;top:0"></div>
  `;

  c.querySelectorAll('#home-period-group button').forEach((b) => {
    b.onclick = () => { homePeriod = b.dataset.period; renderHome(); };
  });
  document.getElementById('stat-sales').onclick = () => showBreakdown(`Sales — ${label}`, periodBills);
  document.getElementById('stat-profit').onclick = () => showProfitBreakdown(`Profit — ${label}`, periodBills);
  document.getElementById('stat-stockvalue').onclick = () => showStockValueBreakdown();
  document.getElementById('stat-dues').onclick = () => showDuesBreakdown();
  document.getElementById('stat-loans').onclick = () => showLoansBreakdown();
  document.getElementById('stat-lowstock').onclick = () => showLowStockBreakdown(lowStock);
  document.getElementById('monthly-detail-link').onclick = () => renderMonthlyDetail();
  document.getElementById('home-download').onclick = () => downloadDashboardSummary({ label, periodSales, periodProfit, stockValue, totalDues, totalLoans });
  document.getElementById('home-upload').onclick = () => openUploadDocumentModal();
  bindDocumentListEvents();
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

/* ---- Downloadable sales/profit summary (window.print → Save as PDF) ---- */
function downloadDashboardSummary({ label, periodSales, periodProfit, stockValue, totalDues, totalLoans }) {
  const shopName = STATE.settings.shopName || 'Premium Imports LK';
  document.getElementById('dashPrintArea').innerHTML = `
    <h2>${escapeHtml(shopName)}</h2>
    <h3>Sales &amp; Profit Summary — ${escapeHtml(label)}</h3>
    <p class="sub">Generated ${fmtDate(todayISO())}</p>
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Sales (${escapeHtml(label)})</td><td>${money(periodSales)}</td></tr>
      <tr><td>Profit (${escapeHtml(label)})</td><td>${money(periodProfit)}</td></tr>
      <tr><td>Stock Value (right now)</td><td>${money(stockValue)}</td></tr>
      <tr><td>Customer Dues (right now)</td><td>${money(totalDues)}</td></tr>
      <tr><td>Loans Outstanding (right now)</td><td>${money(totalLoans)}</td></tr>
    </table>
  `;
  window.print();
}

/* ---- Documents (bank statements / supplier invoices / general files) ---- */
function renderDocumentList() {
  const docs = [...(STATE.documents || [])].sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
  if (docs.length === 0) return '<div class="empty-state">No documents uploaded yet.</div>';
  const typeLabel = { bank: 'Bank Statement', invoice: 'Supplier Invoice', general: 'Document' };
  return docs.map((d) => {
    const vendor = d.vendorId ? STATE.vendors.find((v) => v.id === d.vendorId) : null;
    return `<div class="list-row" style="cursor:default">
      <div><div class="title">${escapeHtml(d.filename)}</div>
        <div class="sub">${typeLabel[d.type] || 'Document'}${vendor ? ' · ' + escapeHtml(vendor.name) : ''} · ${fmtDate(d.uploadedAt)}</div></div>
      <div style="display:flex;gap:8px">
        <a class="btn small secondary" style="text-decoration:none" href="${d.fileData}" download="${escapeHtml(d.filename)}">Open</a>
        ${isAdmin() ? `<button class="btn small danger" data-del-doc="${d.id}">Delete</button>` : ''}
      </div>
    </div>`;
  }).join('');
}
function bindDocumentListEvents() {
  document.querySelectorAll('[data-del-doc]').forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm('Delete this document?')) return;
      STATE.documents = (STATE.documents || []).filter((d) => d.id !== btn.dataset.delDoc);
      await saveKey('documents');
      renderHome();
      toast('Document deleted');
    };
  });
}
function openUploadDocumentModal() {
  openModal(`
    <h3>Upload Document</h3>
    <div class="field"><label>Type</label>
      <select id="ud-type">
        <option value="bank">Bank Statement</option>
        <option value="invoice">Supplier Invoice</option>
        <option value="general">General Document</option>
      </select>
    </div>
    <div class="field" id="ud-vendor-field" style="display:none"><label>Vendor (optional)</label>
      <select id="ud-vendor"><option value="">— None —</option>${STATE.vendors.map((v) => `<option value="${v.id}">${escapeHtml(v.name)}</option>`).join('')}</select>
    </div>
    <div class="field"><label>File (PDF, up to 5MB)</label><input type="file" accept="application/pdf" id="ud-file"></div>
    <div class="modal-actions">
      <button class="btn secondary" id="ud-cancel">Cancel</button>
      <button class="btn" id="ud-save">Upload</button>
    </div>
  `);
  document.getElementById('ud-type').onchange = (e) => {
    document.getElementById('ud-vendor-field').style.display = e.target.value === 'invoice' ? '' : 'none';
  };
  document.getElementById('ud-cancel').onclick = closeModal;
  document.getElementById('ud-save').onclick = async () => {
    const file = document.getElementById('ud-file').files[0];
    if (!file) { toast('Choose a PDF file first'); return; }
    if (file.type !== 'application/pdf') { toast('Only PDF files are supported'); return; }
    if (file.size > 5 * 1024 * 1024) { toast('File is too large (max 5MB)'); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const doc = {
        id: uid('D'), type: document.getElementById('ud-type').value,
        vendorId: document.getElementById('ud-vendor').value || null,
        filename: file.name, fileData: e.target.result,
        uploadedAt: new Date().toISOString(), by: STATE.user
      };
      STATE.documents = STATE.documents || [];
      STATE.documents.push(doc);
      await saveKey('documents');
      closeModal();
      renderHome();
      toast('Document uploaded');
    };
    reader.readAsDataURL(file);
  };
}

/* ---- Monthly detail (secondary screen, linked from Home) ---- */
function renderMonthlyDetail() {
  const c = document.getElementById('pageContent');
  document.getElementById('pageTitle').textContent = 'Monthly Detail';
  const monthKey = todayISO().slice(0, 7);
  const monthBills = STATE.bills.filter((b) => (b.date || '').slice(0, 7) === monthKey && b.type !== 'quote');
  const monthSales = monthBills.reduce((s, b) => s + (b.total || 0), 0);
  const monthProfit = monthBills.reduce((s, b) => {
    const billProfit = (b.items || []).reduce((ps, it) => ps + ((it.price - it.cost) * it.qty), 0) - (b.discountAmount || 0);
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
        const p = (b.items || []).reduce((s, it) => s + ((it.price - it.cost) * it.qty), 0) - (b.discountAmount || 0);
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
