/* Premium Imports LK - internal app (vanilla JS, no build step) */

const STATE = {
  user: null,
  role: null,
  settings: null,
  products: [],
  customers: [],
  vendors: [],
  lenders: [],
  bills: [],
  grns: [],
  orders: [],
  activeTab: 'home',
  sellCart: [],
  sellType: 'bill',
  sellPayment: 'cash',
  sellCustomerId: null,
  secretsStatus: null
};

const KEYS = ['settings', 'products', 'customers', 'vendors', 'lenders', 'bills', 'grns', 'orders'];
const LOW_STOCK_THRESHOLD = 5;

const NAV_ITEMS = [
  { id: 'sell', label: 'Sell', icon: '\u{1F9FE}' },
  { id: 'home', label: 'Home', icon: '\u{1F3E0}' },
  { id: 'products', label: 'Products', icon: '\u{1F4E6}' },
  { id: 'grn', label: 'GRN', icon: '\u{1F4E5}' },
  { id: 'customers', label: 'Customers', icon: '\u{1F465}' },
  { id: 'vendors', label: 'Vendors', icon: '\u{1F69A}' },
  { id: 'loans', label: 'Loans', icon: '\u{1F4B0}' },
  { id: 'reports', label: 'Reports', icon: '\u{1F4CA}' },
  { id: 'settings', label: 'Settings', icon: '\u{2699}\u{FE0F}' }
];
const MOBILE_PRIMARY = ['sell', 'home', 'products', 'customers'];
const MOBILE_MORE = ['grn', 'vendors', 'loans', 'reports', 'settings'];
const ADMIN_ONLY_TABS = ['reports', 'settings'];

/* ---------------- API helpers ---------------- */
async function apiGet(key) {
  const res = await fetch(`/api/data/${key}`);
  if (!res.ok) throw new Error(`Failed to load ${key}`);
  const json = await res.json();
  return json.value;
}
async function apiPut(key, value) {
  const res = await fetch(`/api/data/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value })
  });
  if (!res.ok) throw new Error(`Failed to save ${key}`);
  return res.json();
}
async function saveKey(key) {
  await apiPut(key, STATE[key]);
}

/* ---------------- Utils ---------------- */
function money(n) {
  const v = Number(n) || 0;
  return 'Rs. ' + v.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function nowTimeStr() {
  return new Date().toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' });
}
function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 9999)}`;
}
function nextNumber(list, prefix) {
  const n = (list.length + 1).toString().padStart(4, '0');
  return `${prefix}-${n}`;
}
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function toast(msg) {
  const root = document.getElementById('toastRoot');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  root.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}
function openModal(html) {
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop" id="modalBackdrop">
      <div class="modal">${html}</div>
    </div>`;
  document.getElementById('modalBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modalBackdrop') closeModal();
  });
}

/* ---------------- Boot ---------------- */
async function boot() {
  try {
    const values = await Promise.all(KEYS.map((k) => apiGet(k)));
    KEYS.forEach((k, i) => { STATE[k] = values[i]; });
  } catch (e) {
    toast('Could not reach server. Is it running?');
    return;
  }
  document.getElementById('loginShopName').textContent = STATE.settings.shopName || 'Premium Imports LK';
  const savedUser = localStorage.getItem('pilk_user');
  if (savedUser && findUser(savedUser)) {
    STATE.user = savedUser;
    STATE.role = findUser(savedUser).role;
    showApp();
  } else {
    showLogin();
  }
}

function findUser(name) {
  return (STATE.settings.users || []).find((u) => u.name === name);
}
function isAdmin() {
  return STATE.role === 'admin';
}

function showLogin() {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('appShell').classList.add('hidden');
  let selectedUser = null;
  const picker = document.getElementById('userPicker');
  picker.innerHTML = (STATE.settings.users || []).map((u) =>
    `<button class="user-btn" data-user="${escapeHtml(u.name)}">${escapeHtml(u.name)}</button>`
  ).join('');
  picker.querySelectorAll('.user-btn').forEach((btn) => {
    btn.onclick = () => {
      picker.querySelectorAll('.user-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedUser = btn.dataset.user;
      document.getElementById('loginError').textContent = '';
    };
  });
  document.getElementById('pinInput').value = '';
  document.getElementById('loginError').textContent = '';
  document.getElementById('loginBtn').onclick = () => {
    const pin = document.getElementById('pinInput').value.trim();
    if (!selectedUser) {
      document.getElementById('loginError').textContent = 'Pick a user first.';
      return;
    }
    const u = findUser(selectedUser);
    if (!u || u.pin !== pin) {
      document.getElementById('loginError').textContent = 'Wrong PIN.';
      return;
    }
    STATE.user = selectedUser;
    STATE.role = u.role;
    localStorage.setItem('pilk_user', selectedUser);
    showApp();
  };
}

function logout() {
  STATE.user = null;
  STATE.role = null;
  localStorage.removeItem('pilk_user');
  showLogin();
}

function showApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  document.getElementById('sidebarBrand').textContent = STATE.settings.shopName || 'Premium Imports LK';
  document.getElementById('sidebarUser').textContent = `${STATE.user} (${isAdmin() ? 'Admin' : 'Staff'})`;
  document.getElementById('logoutLinkSidebar').onclick = (e) => { e.preventDefault(); logout(); };
  renderNav();
  goTab('sell');
  startLiveClock();
}

let liveClockTimer = null;
function updateLiveClock() {
  const el = document.getElementById('liveClock');
  if (!el) return;
  const now = new Date();
  const time = now.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('en-LK', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  el.innerHTML = `<span class="live-clock-time">${time}</span><span class="live-clock-date">${date}</span>`;
}
function startLiveClock() {
  if (liveClockTimer) return;
  updateLiveClock();
  liveClockTimer = setInterval(updateLiveClock, 60000);
}

/* ---------------- Nav ---------------- */
function renderNav() {
  const visibleNav = NAV_ITEMS.filter((item) => isAdmin() || !ADMIN_ONLY_TABS.includes(item.id));
  const sidebarNav = document.getElementById('sidebarNav');
  sidebarNav.innerHTML = visibleNav.map((item) => navItemHtml(item)).join('');
  sidebarNav.querySelectorAll('.nav-item').forEach((el) => {
    el.onclick = () => goTab(el.dataset.tab);
  });

  const bottomNav = document.getElementById('bottomNav');
  const primaryHtml = MOBILE_PRIMARY.map((id) => navItemHtml(NAV_ITEMS.find((n) => n.id === id))).join('');
  bottomNav.innerHTML = primaryHtml + `
    <div class="nav-item" id="moreNavBtn"><span class="icon">\u{2630}</span><span>More</span></div>`;
  bottomNav.querySelectorAll('.nav-item[data-tab]').forEach((el) => {
    el.onclick = () => goTab(el.dataset.tab);
  });
  document.getElementById('moreNavBtn').onclick = showMoreSheet;
}
function navItemHtml(item) {
  return `<div class="nav-item" data-tab="${item.id}"><span class="icon">${item.icon}</span><span>${item.label}</span></div>`;
}
function showMoreSheet() {
  const visibleMore = MOBILE_MORE.filter((id) => isAdmin() || !ADMIN_ONLY_TABS.includes(id));
  openModal(`
    <h3>More</h3>
    ${visibleMore.map((id) => {
      const item = NAV_ITEMS.find((n) => n.id === id);
      return `<div class="list-row" data-tab="${item.id}"><span>${item.icon} ${item.label}</span><span>&rsaquo;</span></div>`;
    }).join('')}
  `);
  document.querySelectorAll('#modalRoot .list-row').forEach((el) => {
    el.onclick = () => { closeModal(); goTab(el.dataset.tab); };
  });
}
function goTab(tab) {
  if (ADMIN_ONLY_TABS.includes(tab) && !isAdmin()) {
    toast('Staff accounts cannot open this screen');
    tab = 'sell';
  }
  STATE.activeTab = tab;
  document.querySelectorAll('.nav-item[data-tab]').forEach((el) => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  document.getElementById('pageTitle').textContent = NAV_ITEMS.find((n) => n.id === tab).label;
  renderOnlineOrdersBadge();
  if (tab !== 'sell') document.getElementById('sellTotalBarRoot').innerHTML = '';
  const renderers = {
    home: renderHome, products: renderProducts, sell: renderSell, grn: renderGRN,
    customers: renderCustomers, vendors: renderVendors, loans: renderLoans,
    reports: renderReports, settings: renderSettings
  };
  renderers[tab]();
}

function renderOnlineOrdersBadge() {
  const badge = document.getElementById('onlineOrdersBadge');
  const pending = STATE.orders.filter((o) => o.status === 'pending');
  if (STATE.activeTab === 'sell' && pending.length) {
    badge.classList.remove('hidden');
    badge.innerHTML = `<div class="card" style="margin-bottom:14px;border-color:var(--gold);cursor:pointer" id="pendingOrdersCard">
      <strong>${pending.length} online order${pending.length > 1 ? 's' : ''} waiting</strong> — tap to review
    </div>`;
    document.getElementById('pendingOrdersCard').onclick = showPendingOrders;
  } else {
    badge.classList.add('hidden');
    badge.innerHTML = '';
  }
}

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

/* ================= PRODUCTS ================= */
let productFilter = 'All';
function renderProducts() {
  const c = document.getElementById('pageContent');
  const cats = ['All', ...STATE.settings.categories];
  const list = STATE.products.filter((p) => productFilter === 'All' || p.category === productFilter);
  c.innerHTML = `
    <div class="pill-filters">${cats.map((cat) => `<button data-cat="${escapeHtml(cat)}" class="${cat === productFilter ? 'active' : ''}">${escapeHtml(cat)}</button>`).join('')}</div>
    ${isAdmin() ? '<button class="btn" id="addProductBtn">+ Add Product</button>' : '<p class="sub">View only — ask an Admin to add or edit products.</p>'}
    <div class="grid" style="margin-top:14px">
      ${list.length === 0 ? '<div class="empty-state">No products yet.</div>' : list.map(productCardHtml).join('')}
    </div>
  `;
  c.querySelectorAll('.pill-filters button').forEach((b) => {
    b.onclick = () => { productFilter = b.dataset.cat; renderProducts(); };
  });
  if (isAdmin()) {
    document.getElementById('addProductBtn').onclick = () => openProductForm(null);
    c.querySelectorAll('.product-card').forEach((el) => {
      el.onclick = () => openProductForm(el.dataset.id);
    });
  } else {
    c.querySelectorAll('.product-card').forEach((el) => { el.style.cursor = 'default'; });
  }
}
function productCardHtml(p) {
  const margin = p.sellingPrice ? (((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100).toFixed(0) : '—';
  return `<div class="card product-card" data-id="${p.id}" style="cursor:pointer">
    ${p.photo ? `<img class="product-photo" src="${p.photo}">` : `<div class="product-photo"></div>`}
    <div style="margin-top:8px;font-weight:600">${escapeHtml(p.name)}</div>
    <div class="sub" style="color:var(--ink-soft);font-size:0.85rem">${escapeHtml(p.category)} ${p.brand ? '· ' + escapeHtml(p.brand) : ''}</div>
    <div style="margin-top:6px;display:flex;justify-content:space-between">
      <strong>${money(p.sellingPrice)}</strong>
      <span class="badge ${p.stock <= LOW_STOCK_THRESHOLD ? 'due' : 'ok'}">${p.stock} in stock</span>
    </div>
    <div class="sub" style="font-size:0.8rem;color:var(--ink-soft)">Margin: ${margin}${margin !== '—' ? '%' : ''}</div>
  </div>`;
}

function compressImage(file, maxDim, cb) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
      else if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function openProductForm(id) {
  const p = id ? STATE.products.find((x) => x.id === id) : null;
  let photoData = p ? p.photo : null;
  openModal(`
    <h3>${p ? 'Edit Product' : 'Add Product'}</h3>
    <div class="field"><label>Photo</label>
      <div id="photoPreviewWrap">${photoData ? `<img class="product-photo" id="photoPreview" src="${photoData}">` : ''}</div>
      <input type="file" accept="image/*" id="photoInput">
    </div>
    <div class="field"><label>Name</label><input id="pf-name" value="${p ? escapeHtml(p.name) : ''}"></div>
    <div class="row">
      <div class="field"><label>Category</label>
        <select id="pf-category">${STATE.settings.categories.map((c) => `<option ${p && p.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Brand</label><input id="pf-brand" value="${p ? escapeHtml(p.brand || '') : ''}"></div>
    </div>
    <div class="field"><label>Source (optional)</label><input id="pf-source" placeholder="e.g. Dubai" value="${p ? escapeHtml(p.source || '') : ''}"></div>
    <div class="row">
      <div class="field"><label>Cost Price</label><input type="number" step="0.01" id="pf-cost" value="${p ? p.costPrice : ''}"></div>
      <div class="field"><label>Selling Price</label><input type="number" step="0.01" id="pf-price" value="${p ? p.sellingPrice : ''}"></div>
    </div>
    <div class="field"><label>Margin</label><div id="pf-margin" style="color:var(--ink-soft)">—</div></div>
    <div class="field"><label>Stock</label><input type="number" id="pf-stock" value="${p ? p.stock : 0}"></div>
    <div class="field"><label>Notes</label><textarea id="pf-notes">${p ? escapeHtml(p.notes || '') : ''}</textarea></div>
    <div class="modal-actions">
      <button class="btn secondary" id="pf-cancel">Cancel</button>
      <button class="btn" id="pf-save">Save</button>
      ${p ? '<button class="btn danger" id="pf-delete">Delete</button>' : ''}
    </div>
  `);
  const updateMargin = () => {
    const cost = parseFloat(document.getElementById('pf-cost').value) || 0;
    const price = parseFloat(document.getElementById('pf-price').value) || 0;
    const el = document.getElementById('pf-margin');
    el.textContent = price > 0 ? `${(((price - cost) / price) * 100).toFixed(1)}%` : '—';
  };
  document.getElementById('pf-cost').oninput = updateMargin;
  document.getElementById('pf-price').oninput = updateMargin;
  updateMargin();

  document.getElementById('photoInput').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    compressImage(file, 360, (dataUrl) => {
      photoData = dataUrl;
      document.getElementById('photoPreviewWrap').innerHTML = `<img class="product-photo" id="photoPreview" src="${dataUrl}">`;
    });
  };
  document.getElementById('pf-cancel').onclick = closeModal;
  if (p) document.getElementById('pf-delete').onclick = () => {
    if (!confirm('Delete this product?')) return;
    STATE.products = STATE.products.filter((x) => x.id !== p.id);
    saveKey('products').then(() => { closeModal(); renderProducts(); toast('Product deleted'); });
  };
  document.getElementById('pf-save').onclick = async () => {
    const name = document.getElementById('pf-name').value.trim();
    if (!name) { toast('Name is required'); return; }
    const category = document.getElementById('pf-category').value;
    const brand = document.getElementById('pf-brand').value.trim();
    const source = document.getElementById('pf-source').value.trim();
    const costPrice = parseFloat(document.getElementById('pf-cost').value) || 0;
    const sellingPrice = parseFloat(document.getElementById('pf-price').value) || 0;
    const stock = parseInt(document.getElementById('pf-stock').value, 10) || 0;
    const notes = document.getElementById('pf-notes').value.trim();
    const now = new Date().toISOString();
    if (p) {
      const priceChanged = p.sellingPrice !== sellingPrice;
      Object.assign(p, { name, category, brand, source, costPrice, sellingPrice, stock, notes, photo: photoData, updatedAt: now });
      if (priceChanged) {
        p.priceHistory = p.priceHistory || [];
        p.priceHistory.push({ price: sellingPrice, date: now });
      }
    } else {
      STATE.products.push({
        id: uid('P'), name, category, brand, source, costPrice, sellingPrice, stock, notes, photo: photoData,
        priceHistory: [{ price: sellingPrice, date: now }], createdAt: now, updatedAt: now
      });
    }
    await saveKey('products');
    closeModal();
    renderProducts();
    toast('Product saved');
  };
}

/* ================= GRN ================= */
let grnDraft = null;
function renderGRN() {
  if (!grnDraft) grnDraft = { vendorId: null, vendorName: '', items: [], aiSuggestions: [] };
  if (!grnDraft.aiSuggestions) grnDraft.aiSuggestions = [];
  const c = document.getElementById('pageContent');
  const total = grnDraft.items.reduce((s, it) => s + it.qty * it.cost, 0);
  c.innerHTML = `
    <div class="card">
      <div class="field"><label>Vendor</label>
        <select id="grn-vendor">
          <option value="">— Select vendor —</option>
          ${STATE.vendors.map((v) => `<option value="${v.id}" ${grnDraft.vendorId === v.id ? 'selected' : ''}>${escapeHtml(v.name)}</option>`).join('')}
          <option value="__new__">+ Add new vendor</option>
        </select>
      </div>
    </div>
    <div class="section-title"><h3>Items</h3>
      <div style="display:flex;gap:8px">
        <button class="btn small secondary" id="grn-scan-photo">📷 Scan Photo</button>
        <button class="btn small" id="grn-add-item">+ Add Line</button>
      </div>
    </div>
    <input type="file" accept="image/*" capture="environment" id="grn-scan-input" class="hidden">
    ${grnDraft.aiSuggestions.length === 0 ? '' : `
      <div class="section-title"><h3 style="color:var(--gold-dark)">AI suggested — check before saving</h3></div>
      ${grnDraft.aiSuggestions.map((s, idx) => `
        <div class="list-row" data-ai-review="${idx}" style="border-color:var(--gold)">
          <div><div class="title">${escapeHtml(s.name || '(unreadable name)')}</div>
            <div class="sub">${s.quantity === null || s.quantity === undefined ? 'Qty: ?' : 'Qty: ' + s.quantity} · ${s.costPrice === null || s.costPrice === undefined ? 'Cost: ?' : 'Cost: ' + money(s.costPrice)}</div></div>
          <div style="display:flex;gap:8px">
            <button class="btn small" data-ai-add="${idx}">Review & Add</button>
            <button class="btn small secondary" data-ai-discard="${idx}">Discard</button>
          </div>
        </div>
      `).join('')}
    `}
    <div class="section-title"><h3>Confirmed Lines</h3></div>
    ${grnDraft.items.length === 0 ? '<div class="empty-state">No items added yet.</div>' :
      grnDraft.items.map((it, idx) => `
        <div class="list-row" data-edit-idx="${idx}"><div><div class="title">${escapeHtml(it.name)}</div><div class="sub">${escapeHtml(it.category || '')} · ${it.qty} × ${money(it.cost)}</div></div>
        <div style="display:flex;align-items:center;gap:10px"><strong>${money(it.qty * it.cost)}</strong><button class="btn small secondary" data-idx="${idx}">Remove</button></div></div>
      `).join('')}
    <div class="card" style="margin-top:14px"><div style="display:flex;justify-content:space-between"><strong>Total</strong><strong>${money(total)}</strong></div></div>
    <button class="btn block" style="margin-top:14px" id="grn-save" ${grnDraft.items.length === 0 ? 'disabled' : ''}>Save GRN</button>
  `;
  document.getElementById('grn-vendor').onchange = (e) => {
    const val = e.target.value;
    if (val === '__new__') { e.target.value = grnDraft.vendorId || ''; openQuickAddVendor(); return; }
    const v = STATE.vendors.find((x) => x.id === val);
    grnDraft.vendorId = v ? v.id : null;
    grnDraft.vendorName = v ? v.name : '';
  };
  document.getElementById('grn-add-item').onclick = openGrnLineForm;
  document.getElementById('grn-scan-photo').onclick = startGrnScan;
  document.getElementById('grn-scan-input').onchange = handleGrnScanFile;
  c.querySelectorAll('[data-idx]').forEach((btn) => {
    btn.onclick = (e) => { e.stopPropagation(); grnDraft.items.splice(parseInt(btn.dataset.idx, 10), 1); renderGRN(); };
  });
  c.querySelectorAll('[data-edit-idx]').forEach((row) => {
    row.style.cursor = 'pointer';
    row.onclick = () => openGrnLineEdit(parseInt(row.dataset.editIdx, 10));
  });
  c.querySelectorAll('[data-ai-add]').forEach((btn) => {
    btn.onclick = () => reviewAiSuggestion(parseInt(btn.dataset.aiAdd, 10));
  });
  c.querySelectorAll('[data-ai-discard]').forEach((btn) => {
    btn.onclick = () => { grnDraft.aiSuggestions.splice(parseInt(btn.dataset.aiDiscard, 10), 1); renderGRN(); };
  });
  const saveBtn = document.getElementById('grn-save');
  if (saveBtn) saveBtn.onclick = saveGrn;
}

function showScanSetupModal(kind) {
  const draftsText = kind === 'bill' ? 'drafts line items from an old paper bill' : 'drafts GRN lines';
  openModal(`
    <h3>Photo scan needs setup</h3>
    <p>This feature reads a photo and ${draftsText} for you to check. It needs an Anthropic API key added first.</p>
    <p style="color:var(--ink-soft);font-size:0.9rem">Ask whoever set up this computer to open <code>secrets.json</code> in the project folder, paste the key between the quotes for <code>"anthropicApiKey"</code>, then restart the server.</p>
    <button class="btn secondary block" id="scan-setup-close">Close</button>
  `);
  document.getElementById('scan-setup-close').onclick = closeModal;
}

async function startGrnScan() {
  if (STATE.secretsStatus === null) {
    try {
      const res = await fetch('/api/grn-scan/status');
      const data = await res.json();
      STATE.secretsStatus = { configured: !!data.configured };
    } catch (e) {
      STATE.secretsStatus = { configured: false };
    }
  }
  if (!STATE.secretsStatus.configured) {
    showScanSetupModal();
    return;
  }
  document.getElementById('grn-scan-input').click();
}

function handleGrnScanFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  compressImage(file, 1024, async (dataUrl) => {
    const base64 = dataUrl.split(',')[1];
    toast('Scanning photo...');
    try {
      const res = await fetch('/api/grn-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: 'image/jpeg' })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'not_configured') {
          STATE.secretsStatus = { configured: false };
          showScanSetupModal();
          return;
        }
        toast(data.message || 'Scan failed');
        return;
      }
      if (!data.lines || data.lines.length === 0) {
        toast('Could not read any products from that photo.');
        return;
      }
      grnDraft.aiSuggestions = (grnDraft.aiSuggestions || []).concat(data.lines);
      renderGRN();
      toast(`Found ${data.lines.length} possible line(s) — review before saving`);
    } catch (err) {
      toast('Could not reach the server for scanning.');
    } finally {
      e.target.value = '';
    }
  });
}

function reviewAiSuggestion(idx) {
  const s = grnDraft.aiSuggestions[idx];
  openModal(`
    <h3>Review AI Suggestion</h3>
    <div class="field"><label>Product name</label><input id="ai-name" value="${escapeHtml(s.name || '')}"></div>
    <div class="field"><label>Category</label>
      <select id="ai-category">${STATE.settings.categories.map((c) => `<option>${escapeHtml(c)}</option>`).join('')}</select>
    </div>
    <div class="row">
      <div class="field"><label>Cost Price</label><input type="number" step="0.01" id="ai-cost" value="${s.costPrice !== null && s.costPrice !== undefined ? s.costPrice : ''}"></div>
      <div class="field"><label>Quantity</label><input type="number" id="ai-qty" value="${s.quantity !== null && s.quantity !== undefined ? s.quantity : 1}"></div>
    </div>
    <div class="modal-actions">
      <button class="btn secondary" id="ai-cancel">Cancel</button>
      <button class="btn" id="ai-confirm">Add to GRN</button>
    </div>
  `);
  document.getElementById('ai-cancel').onclick = closeModal;
  document.getElementById('ai-confirm').onclick = async () => {
    const name = document.getElementById('ai-name').value.trim();
    if (!name) { toast('Name is required'); return; }
    const category = document.getElementById('ai-category').value;
    const cost = parseFloat(document.getElementById('ai-cost').value) || 0;
    const qty = parseInt(document.getElementById('ai-qty').value, 10) || 1;
    let product = STATE.products.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (!product) {
      const now = new Date().toISOString();
      product = {
        id: uid('P'), name, category, brand: '', costPrice: cost, sellingPrice: 0, stock: 0, notes: '',
        photo: null, priceHistory: [], createdAt: now, updatedAt: now
      };
      STATE.products.push(product);
      await saveKey('products');
    }
    grnDraft.items.push({ productId: product.id, name: product.name, category: product.category, qty, cost });
    grnDraft.aiSuggestions.splice(idx, 1);
    closeModal();
    renderGRN();
  };
}
function openQuickAddVendor() {
  openModal(`
    <h3>New Vendor</h3>
    <div class="field"><label>Name</label><input id="qv-name"></div>
    <div class="field"><label>Phone</label><input id="qv-phone"></div>
    <div class="modal-actions">
      <button class="btn secondary" id="qv-cancel">Cancel</button>
      <button class="btn" id="qv-save">Save</button>
    </div>
  `);
  document.getElementById('qv-cancel').onclick = closeModal;
  document.getElementById('qv-save').onclick = async () => {
    const name = document.getElementById('qv-name').value.trim();
    if (!name) { toast('Name is required'); return; }
    const phone = document.getElementById('qv-phone').value.trim();
    const v = { id: uid('V'), name, phone, purchased: 0, paid: 0, balance: 0, ledger: [] };
    STATE.vendors.push(v);
    await saveKey('vendors');
    grnDraft.vendorId = v.id;
    grnDraft.vendorName = v.name;
    closeModal();
    renderGRN();
  };
}
function openGrnLineForm() {
  openModal(`
    <h3>Add Line Item</h3>
    <div class="field"><label>Search product</label><input id="gl-search" placeholder="Type to search..."></div>
    <div id="gl-results"></div>
    <div id="gl-newProductArea"></div>
  `);
  const renderResults = (q) => {
    const results = q ? STATE.products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())) : [];
    const resEl = document.getElementById('gl-results');
    resEl.innerHTML = results.map((p) => `<div class="list-row" data-id="${p.id}"><div><div class="title">${escapeHtml(p.name)}</div><div class="sub">${escapeHtml(p.category)} · stock ${p.stock}</div></div></div>`).join('')
      + (q ? `<div class="list-row" id="gl-addNew"><span>+ Add new product "${escapeHtml(q)}"</span></div>` : '');
    resEl.querySelectorAll('[data-id]').forEach((el) => {
      el.onclick = () => openGrnQtyCost(STATE.products.find((p) => p.id === el.dataset.id));
    });
    const addNewEl = document.getElementById('gl-addNew');
    if (addNewEl) addNewEl.onclick = () => openInlineNewProduct(q);
  };
  document.getElementById('gl-search').oninput = (e) => renderResults(e.target.value.trim());
}
function openInlineNewProduct(nameGuess) {
  const area = document.getElementById('gl-newProductArea');
  area.innerHTML = `
    <div class="card" style="margin-top:10px">
      <h3>New Product</h3>
      <div class="field"><label>Name</label><input id="np-name" value="${escapeHtml(nameGuess || '')}"></div>
      <div class="field"><label>Category</label><select id="np-category">${STATE.settings.categories.map((c) => `<option>${escapeHtml(c)}</option>`).join('')}</select></div>
      <div class="row">
        <div class="field"><label>Cost Price</label><input type="number" step="0.01" id="np-cost"></div>
        <div class="field"><label>Qty received</label><input type="number" id="np-qty" value="1"></div>
      </div>
      <button class="btn block" id="np-save">Add to GRN</button>
    </div>
  `;
  document.getElementById('np-save').onclick = async () => {
    const name = document.getElementById('np-name').value.trim();
    if (!name) { toast('Name is required'); return; }
    const category = document.getElementById('np-category').value;
    const cost = parseFloat(document.getElementById('np-cost').value) || 0;
    const qty = parseInt(document.getElementById('np-qty').value, 10) || 1;
    const now = new Date().toISOString();
    const product = {
      id: uid('P'), name, category, brand: '', costPrice: cost, sellingPrice: 0, stock: 0, notes: '',
      photo: null, priceHistory: [], createdAt: now, updatedAt: now
    };
    STATE.products.push(product);
    await saveKey('products');
    grnDraft.items.push({ productId: product.id, name: product.name, category: product.category, qty, cost });
    closeModal();
    renderGRN();
    toast('New product added to GRN');
  };
}
function openGrnQtyCost(product) {
  openModal(`
    <h3>${escapeHtml(product.name)}</h3>
    <div class="row">
      <div class="field"><label>Qty received</label><input type="number" id="gq-qty" value="1"></div>
      <div class="field"><label>Cost Price</label><input type="number" step="0.01" id="gq-cost" value="${product.costPrice || ''}"></div>
    </div>
    <button class="btn block" id="gq-add">Add to GRN</button>
  `);
  document.getElementById('gq-add').onclick = () => {
    const qty = parseInt(document.getElementById('gq-qty').value, 10) || 1;
    const cost = parseFloat(document.getElementById('gq-cost').value) || 0;
    grnDraft.items.push({ productId: product.id, name: product.name, category: product.category, qty, cost });
    closeModal();
    renderGRN();
  };
}
function openGrnLineEdit(idx) {
  const it = grnDraft.items[idx];
  openModal(`
    <h3>Edit Line Item</h3>
    <div class="field"><label>Name</label><input id="ge-name" value="${escapeHtml(it.name)}"></div>
    <div class="field"><label>Category</label>
      <select id="ge-category">${STATE.settings.categories.map((c) => `<option ${it.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}</select>
    </div>
    <div class="row">
      <div class="field"><label>Cost Price</label><input type="number" step="0.01" id="ge-cost" value="${it.cost}"></div>
      <div class="field"><label>Qty received</label><input type="number" id="ge-qty" value="${it.qty}"></div>
    </div>
    <div class="modal-actions">
      <button class="btn secondary" id="ge-cancel">Cancel</button>
      <button class="btn" id="ge-save">Save</button>
      <button class="btn danger" id="ge-remove">Remove</button>
    </div>
  `);
  document.getElementById('ge-cancel').onclick = closeModal;
  document.getElementById('ge-remove').onclick = () => { grnDraft.items.splice(idx, 1); closeModal(); renderGRN(); };
  document.getElementById('ge-save').onclick = () => {
    const name = document.getElementById('ge-name').value.trim();
    if (!name) { toast('Name is required'); return; }
    it.name = name;
    it.category = document.getElementById('ge-category').value;
    it.cost = parseFloat(document.getElementById('ge-cost').value) || 0;
    it.qty = parseInt(document.getElementById('ge-qty').value, 10) || 1;
    closeModal();
    renderGRN();
  };
}
async function saveGrn() {
  if (!grnDraft.vendorId) { toast('Select a vendor'); return; }
  const total = grnDraft.items.reduce((s, it) => s + it.qty * it.cost, 0);
  const grn = {
    id: uid('G'), number: nextNumber(STATE.grns, 'GRN'), date: todayISO(),
    vendorId: grnDraft.vendorId, vendorName: grnDraft.vendorName, items: grnDraft.items, total, by: STATE.user
  };
  STATE.grns.push(grn);
  grnDraft.items.forEach((it) => {
    const p = STATE.products.find((x) => x.id === it.productId);
    if (p) { p.stock = (p.stock || 0) + it.qty; p.costPrice = it.cost; }
  });
  const vendor = STATE.vendors.find((v) => v.id === grnDraft.vendorId);
  if (vendor) {
    vendor.purchased = (vendor.purchased || 0) + total;
    vendor.balance = (vendor.purchased || 0) - (vendor.paid || 0);
    vendor.ledger = vendor.ledger || [];
    vendor.ledger.push({ id: uid('L'), type: 'grn', date: todayISO(), amount: total, ref: grn.number, note: '', balanceAfter: vendor.balance, by: STATE.user });
  }
  await Promise.all([saveKey('grns'), saveKey('products'), saveKey('vendors')]);
  grnDraft = null;
  toast('GRN saved, stock updated');
  renderGRN();
}

/* ================= SELL ================= */
let sellCategoryFilter = 'All';
let sellScanSuggestions = [];
function renderSell() {
  const c = document.getElementById('pageContent');
  const cats = ['All', ...STATE.settings.categories];
  const list = STATE.products.filter((p) => (sellCategoryFilter === 'All' || p.category === sellCategoryFilter) && p.stock > 0);
  const customer = STATE.sellCustomerId ? STATE.customers.find((x) => x.id === STATE.sellCustomerId) : null;
  const total = STATE.sellCart.reduce((s, it) => s + it.qty * it.price, 0);

  c.innerHTML = `
    <div class="toggle-group">
      <button data-type="bill" class="${STATE.sellType === 'bill' ? 'active' : ''}">Bill</button>
      <button data-type="memo" class="${STATE.sellType === 'memo' ? 'active' : ''}">Credit Memo</button>
      <button data-type="quote" class="${STATE.sellType === 'quote' ? 'active' : ''}">Quotation</button>
    </div>
    <div class="pill-filters">${cats.map((cat) => `<button data-cat="${escapeHtml(cat)}" class="${cat === sellCategoryFilter ? 'active' : ''}">${escapeHtml(cat)}</button>`).join('')}</div>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <input style="flex:1;padding:10px;border:1px solid var(--line);border-radius:8px" id="sell-search" placeholder="Search products...">
      <button class="btn small secondary" id="sell-scan-bill">📷 Scan Old Bill</button>
    </div>
    <input type="file" accept="image/*" capture="environment" id="sell-scan-input" class="hidden">
    ${sellScanSuggestions.length === 0 ? '' : `
      <div class="section-title"><h3 style="color:var(--gold-dark)">AI suggested — check before saving</h3></div>
      ${sellScanSuggestions.map((s, idx) => `
        <div class="list-row" style="border-color:var(--gold)">
          <div><div class="title">${escapeHtml(s.name || '(unreadable name)')}</div>
            <div class="sub">${s.quantity === null || s.quantity === undefined ? 'Qty: ?' : 'Qty: ' + s.quantity} · ${s.price === null || s.price === undefined ? 'Price: ?' : 'Price: ' + money(s.price)}</div></div>
          <div style="display:flex;gap:8px">
            <button class="btn small" data-bs-add="${idx}">Review & Add</button>
            <button class="btn small secondary" data-bs-discard="${idx}">Discard</button>
          </div>
        </div>
      `).join('')}
    `}
    <div class="grid sell-grid" id="sell-product-grid">
      ${list.length === 0 ? '<div class="empty-state">No products in stock.</div>' : list.map((p) => `
        <div class="card sell-tile" data-id="${p.id}" style="cursor:pointer">
          ${p.photo ? `<img class="sell-tile-photo" src="${p.photo}">` : `<div class="sell-tile-photo"></div>`}
          <div style="font-weight:600">${escapeHtml(p.name)}</div>
          <div class="sub" style="color:var(--ink-soft);font-size:0.85rem">${escapeHtml(p.category)}</div>
          <div style="margin-top:6px;display:flex;justify-content:space-between"><strong>${money(p.sellingPrice)}</strong><span class="badge">${p.stock} left</span></div>
        </div>`).join('')}
    </div>

    <div class="section-title"><h3>Cart</h3></div>
    ${STATE.sellCart.length === 0 ? '<div class="empty-state">Cart is empty.</div>' :
      STATE.sellCart.map((it, idx) => `
      <div class="list-row"><div><div class="title">${escapeHtml(it.name)}</div><div class="sub">${money(it.price)} each</div></div>
        <div style="display:flex;align-items:center;gap:8px">
          <button class="btn small secondary" data-qtyminus="${idx}">-</button>
          <span>${it.qty}</span>
          <button class="btn small secondary" data-qtyplus="${idx}">+</button>
          <strong style="min-width:90px;text-align:right">${money(it.qty * it.price)}</strong>
          <button class="btn small secondary" data-remove="${idx}">✕</button>
        </div>
      </div>`).join('')}

    <div class="card" style="margin-top:10px">
      <div class="field"><label>Customer ${STATE.sellPayment === 'credit' && STATE.sellType !== 'quote' ? '(required for credit)' : '(optional)'}</label>
        <select id="sell-customer">
          <option value="">Walk-in</option>
          ${STATE.customers.map((cu) => `<option value="${cu.id}" ${STATE.sellCustomerId === cu.id ? 'selected' : ''}>${escapeHtml(cu.name)}</option>`).join('')}
          <option value="__new__">+ Add new customer</option>
        </select>
      </div>
      ${STATE.sellType === 'quote' ? `<p class="sub">A quotation is a shareable price estimate — it does not deduct stock or record payment.</p>` : `
        <div class="toggle-group">
          <button data-pay="cash" class="${STATE.sellPayment === 'cash' ? 'active' : ''}">Cash</button>
          <button data-pay="bank" class="${STATE.sellPayment === 'bank' ? 'active' : ''}">Bank</button>
          <button data-pay="credit" class="${STATE.sellPayment === 'credit' ? 'active' : ''}">Credit</button>
        </div>
        ${STATE.sellPayment === 'bank' ? `<div class="qr-box"><div id="qrTarget"></div><div style="margin-top:8px;font-size:0.85rem;color:var(--ink-soft)">${bankDetailsText()}</div></div>` : ''}
      `}
    </div>
    <div class="sell-total-spacer"></div>
  `;

  const totalBarHtml = `
    <div class="sell-total-bar">
      <div class="sell-total-bar-amount"><span>Total</span><strong>${money(total)}</strong></div>
      <button class="btn" id="sell-complete" ${STATE.sellCart.length === 0 ? 'disabled' : ''}>${STATE.sellType === 'quote' ? 'Generate Quotation' : 'Complete Sale'}</button>
    </div>`;
  document.getElementById('sellTotalBarRoot').innerHTML = totalBarHtml;

  if (STATE.sellType !== 'quote' && STATE.sellPayment === 'bank') renderQr('qrTarget', bankDetailsText());

  c.querySelectorAll('.toggle-group button[data-type]').forEach((b) => {
    b.onclick = () => { STATE.sellType = b.dataset.type; renderSell(); };
  });
  c.querySelectorAll('.toggle-group button[data-pay]').forEach((b) => {
    b.onclick = () => { STATE.sellPayment = b.dataset.pay; renderSell(); };
  });
  c.querySelectorAll('.pill-filters button').forEach((b) => {
    b.onclick = () => { sellCategoryFilter = b.dataset.cat; renderSell(); };
  });
  document.getElementById('sell-search').oninput = (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#sell-product-grid .card').forEach((card) => {
      const name = card.querySelector('div').textContent.toLowerCase();
      card.style.display = name.includes(q) ? '' : 'none';
    });
  };
  document.querySelectorAll('#sell-product-grid .card').forEach((el) => {
    el.onclick = () => addToCart(el.dataset.id);
  });
  document.getElementById('sell-scan-bill').onclick = startBillScan;
  document.getElementById('sell-scan-input').onchange = handleBillScanFile;
  c.querySelectorAll('[data-bs-add]').forEach((b) => {
    b.onclick = () => reviewBillSuggestion(parseInt(b.dataset.bsAdd, 10));
  });
  c.querySelectorAll('[data-bs-discard]').forEach((b) => {
    b.onclick = () => { sellScanSuggestions.splice(parseInt(b.dataset.bsDiscard, 10), 1); renderSell(); };
  });
  c.querySelectorAll('[data-qtyminus]').forEach((b) => b.onclick = () => { adjustQty(parseInt(b.dataset.qtyminus, 10), -1); });
  c.querySelectorAll('[data-qtyplus]').forEach((b) => b.onclick = () => { adjustQty(parseInt(b.dataset.qtyplus, 10), 1); });
  c.querySelectorAll('[data-remove]').forEach((b) => b.onclick = () => { STATE.sellCart.splice(parseInt(b.dataset.remove, 10), 1); renderSell(); });
  document.getElementById('sell-customer').onchange = (e) => {
    if (e.target.value === '__new__') { e.target.value = STATE.sellCustomerId || ''; openQuickAddCustomer(); return; }
    STATE.sellCustomerId = e.target.value || null;
  };
  document.getElementById('sell-complete').onclick = completeSale;
}
function bankDetailsText() {
  const b = STATE.settings.bankDetails || {};
  const lines = [
    b.accountName ? `Account Name: ${b.accountName}` : null,
    b.accountNumber ? `Account No: ${b.accountNumber}` : null,
    b.bankName ? `Bank: ${b.bankName}` : null,
    b.branch ? `Branch: ${b.branch}` : null
  ].filter(Boolean);
  return lines.length ? lines.join('\n') : 'Bank details not set yet. Add them in Settings.';
}
function renderQr(targetId, text) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = '';
  try {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    target.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2 });
  } catch (e) {
    target.innerHTML = '<div class="empty-state">Could not generate QR (details too long or empty).</div>';
  }
}
function addToCart(productId) {
  const p = STATE.products.find((x) => x.id === productId);
  if (!p) return;
  const existing = STATE.sellCart.find((it) => it.productId === productId);
  const inCartQty = existing ? existing.qty : 0;
  if (inCartQty + 1 > p.stock) { toast('Not enough stock'); return; }
  if (existing) existing.qty += 1;
  else STATE.sellCart.push({ productId: p.id, name: p.name, qty: 1, price: p.sellingPrice, cost: p.costPrice });
  renderSell();
}
function adjustQty(idx, delta) {
  const it = STATE.sellCart[idx];
  const p = STATE.products.find((x) => x.id === it.productId);
  const newQty = it.qty + delta;
  if (newQty <= 0) { STATE.sellCart.splice(idx, 1); renderSell(); return; }
  if (p && newQty > p.stock) { toast('Not enough stock'); return; }
  it.qty = newQty;
  renderSell();
}
function openQuickAddCustomer() {
  openModal(`
    <h3>New Customer</h3>
    <div class="field"><label>Name</label><input id="qc-name"></div>
    <div class="field"><label>Phone</label><input id="qc-phone"></div>
    <div class="field"><label>Address</label><input id="qc-address"></div>
    <div class="modal-actions">
      <button class="btn secondary" id="qc-cancel">Cancel</button>
      <button class="btn" id="qc-save">Save</button>
    </div>
  `);
  document.getElementById('qc-cancel').onclick = closeModal;
  document.getElementById('qc-save').onclick = async () => {
    const name = document.getElementById('qc-name').value.trim();
    if (!name) { toast('Name is required'); return; }
    const cust = {
      id: uid('C'), name, phone: document.getElementById('qc-phone').value.trim(),
      address: document.getElementById('qc-address').value.trim(), dues: 0, ledger: []
    };
    STATE.customers.push(cust);
    await saveKey('customers');
    STATE.sellCustomerId = cust.id;
    closeModal();
    renderSell();
  };
}
async function startBillScan() {
  if (STATE.secretsStatus === null) {
    try {
      const res = await fetch('/api/grn-scan/status');
      const data = await res.json();
      STATE.secretsStatus = { configured: !!data.configured };
    } catch (e) {
      STATE.secretsStatus = { configured: false };
    }
  }
  if (!STATE.secretsStatus.configured) {
    showScanSetupModal('bill');
    return;
  }
  document.getElementById('sell-scan-input').click();
}
function handleBillScanFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  compressImage(file, 1024, async (dataUrl) => {
    const base64 = dataUrl.split(',')[1];
    toast('Scanning bill...');
    try {
      const res = await fetch('/api/bill-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: 'image/jpeg' })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'not_configured') {
          STATE.secretsStatus = { configured: false };
          showScanSetupModal('bill');
          return;
        }
        toast(data.message || 'Scan failed');
        return;
      }
      if (!data.lines || data.lines.length === 0) {
        toast('Could not read any products from that photo.');
        return;
      }
      sellScanSuggestions = sellScanSuggestions.concat(data.lines);
      renderSell();
      toast(`Found ${data.lines.length} possible line(s) — review before adding`);
    } catch (err) {
      toast('Could not reach the server for scanning.');
    } finally {
      e.target.value = '';
    }
  });
}
function reviewBillSuggestion(idx) {
  const s = sellScanSuggestions[idx];
  let matchedProduct = null;
  openModal(`
    <h3>Review scanned line</h3>
    <div class="field"><label>Match to product</label><input id="bs-search" placeholder="Search products..." value="${escapeHtml(s.name || '')}"></div>
    <div id="bs-results"></div>
    <div class="row">
      <div class="field"><label>Qty</label><input type="number" id="bs-qty" value="${s.quantity !== null && s.quantity !== undefined ? s.quantity : 1}"></div>
      <div class="field"><label>Price</label><input type="number" step="0.01" id="bs-price" value="${s.price !== null && s.price !== undefined ? s.price : ''}"></div>
    </div>
    <div class="modal-actions">
      <button class="btn secondary" id="bs-cancel">Cancel</button>
      <button class="btn" id="bs-addcart">Add to Cart</button>
      <button class="btn danger" id="bs-discard">Discard line</button>
    </div>
  `);
  const renderResults = (q) => {
    const results = q ? STATE.products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())) : [];
    document.getElementById('bs-results').innerHTML = results.map((p) => `<div class="list-row" data-id="${p.id}"><div><div class="title">${escapeHtml(p.name)}</div><div class="sub">${escapeHtml(p.category)} · stock ${p.stock}</div></div></div>`).join('');
    document.querySelectorAll('#bs-results [data-id]').forEach((el) => {
      el.onclick = () => {
        matchedProduct = STATE.products.find((p) => p.id === el.dataset.id);
        document.getElementById('bs-search').value = matchedProduct.name;
        document.getElementById('bs-results').innerHTML = '';
        if (!document.getElementById('bs-price').value) document.getElementById('bs-price').value = matchedProduct.sellingPrice;
      };
    });
  };
  document.getElementById('bs-search').oninput = (e) => { matchedProduct = null; renderResults(e.target.value.trim()); };
  renderResults(s.name || '');
  document.getElementById('bs-cancel').onclick = closeModal;
  document.getElementById('bs-discard').onclick = () => { sellScanSuggestions.splice(idx, 1); closeModal(); renderSell(); };
  document.getElementById('bs-addcart').onclick = () => {
    if (!matchedProduct) { toast('Search and select a matching product first'); return; }
    const qty = parseInt(document.getElementById('bs-qty').value, 10) || 1;
    const price = parseFloat(document.getElementById('bs-price').value) || matchedProduct.sellingPrice;
    if (qty > matchedProduct.stock) { toast('Not enough stock'); return; }
    const existing = STATE.sellCart.find((it) => it.productId === matchedProduct.id);
    if (existing) existing.qty += qty;
    else STATE.sellCart.push({ productId: matchedProduct.id, name: matchedProduct.name, qty, price, cost: matchedProduct.costPrice });
    sellScanSuggestions.splice(idx, 1);
    closeModal();
    renderSell();
    toast('Added to cart');
  };
}
function nextBillNumber() {
  const start = parseInt(STATE.settings.startingBillNumber, 10) || 1;
  const count = STATE.bills.filter((b) => b.type !== 'quote').length;
  return `INV-${String(start + count).padStart(4, '0')}`;
}
async function completeSale() {
  if (STATE.sellCart.length === 0) return;
  const isQuote = STATE.sellType === 'quote';
  if (!isQuote && STATE.sellPayment === 'credit' && !STATE.sellCustomerId) { toast('Select a customer for credit sales'); return; }
  const total = STATE.sellCart.reduce((s, it) => s + it.qty * it.price, 0);
  const customer = STATE.sellCustomerId ? STATE.customers.find((x) => x.id === STATE.sellCustomerId) : null;
  const bill = {
    id: uid('B'),
    number: isQuote ? nextNumber(STATE.bills.filter((b) => b.type === 'quote'), 'QUO') : nextBillNumber(),
    type: STATE.sellType,
    date: todayISO(), time: nowTimeStr(),
    customerId: customer ? customer.id : null, customerName: customer ? customer.name : 'Walk-in',
    items: STATE.sellCart.map((it) => ({ productId: it.productId, name: it.name, qty: it.qty, price: it.price, cost: it.cost })),
    total,
    paymentType: isQuote ? null : STATE.sellPayment,
    paid: isQuote ? 0 : (STATE.sellPayment === 'credit' ? 0 : total),
    balanceDue: isQuote ? 0 : (STATE.sellPayment === 'credit' ? total : 0),
    by: STATE.user, source: 'in-store'
  };
  STATE.bills.push(bill);
  if (!isQuote) {
    STATE.sellCart.forEach((it) => {
      const p = STATE.products.find((x) => x.id === it.productId);
      if (p) p.stock -= it.qty;
    });
    if (STATE.sellPayment === 'credit' && customer) {
      customer.dues = (customer.dues || 0) + total;
      customer.ledger = customer.ledger || [];
      customer.ledger.push({ id: uid('L'), type: bill.type, date: bill.date, amount: total, balanceAfter: customer.dues, ref: bill.number, note: '', by: STATE.user });
    }
  }
  await Promise.all([
    saveKey('bills'),
    isQuote ? Promise.resolve() : saveKey('products'),
    (!isQuote && customer) ? saveKey('customers') : Promise.resolve()
  ]);
  STATE.sellCart = [];
  STATE.sellCustomerId = null;
  sellScanSuggestions = [];
  showReceipt(bill);
  renderSell();
}
function typeLabel(bill) {
  return bill.type === 'memo' ? 'Credit Memo' : bill.type === 'quote' ? 'Quotation' : 'Invoice';
}
function suggestUpsellProducts(bill) {
  const inBillIds = new Set(bill.items.map((it) => it.productId));
  const billCategories = new Set(bill.items.map((it) => {
    const p = STATE.products.find((x) => x.id === it.productId);
    return p ? p.category : null;
  }).filter(Boolean));
  const candidates = STATE.products.filter((p) => !inBillIds.has(p.id) && (p.stock || 0) > 0);
  const sameCategory = candidates.filter((p) => billCategories.has(p.category)).sort((a, b) => (b.stock || 0) - (a.stock || 0));
  let picks = sameCategory.slice(0, 3);
  if (picks.length < 3) {
    const rest = candidates.filter((p) => !picks.includes(p)).sort((a, b) => (b.stock || 0) - (a.stock || 0));
    picks = picks.concat(rest.slice(0, 3 - picks.length));
  }
  return picks;
}
function showReceipt(bill) {
  const shopName = STATE.settings.shopName || 'Premium Imports LK';
  const label = typeLabel(bill);
  const lines = bill.items.map((it) => `*${it.name}* x${it.qty} = ${money(it.qty * it.price)}`).join('\n');
  const upsells = bill.type === 'quote' ? [] : suggestUpsellProducts(bill);
  const upsellText = upsells.length ? `\n\n✨ *You might also like* ✨\n${upsells.map((p) => `⭐ ${p.name} — ${money(p.sellingPrice)}`).join('\n')}` : '';
  const waText = encodeURIComponent(`✨ *${shopName}* ✨\n${label} ${bill.number}\nDate: ${bill.date} ${bill.time}\n\n${lines}\n\n*Total: ${money(bill.total)}*${bill.paymentType ? `\nPayment: ${bill.paymentType}` : ''}${upsellText}\n\nThank you for shopping with us! 🙏`);
  const customer = bill.customerId ? STATE.customers.find((c) => c.id === bill.customerId) : null;
  const waNumber = customer && customer.phone ? customer.phone.replace(/\D/g, '') : '';
  openModal(`
    <div id="receiptPrintArea">
      <h3>${shopName}</h3>
      <div>${label.toUpperCase()} ${bill.number}</div>
      <div class="sub">${fmtDate(bill.date)} ${bill.time} · ${escapeHtml(bill.customerName)}</div>
      <table style="margin-top:10px">
        <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
        ${bill.items.map((it) => `<tr><td>${escapeHtml(it.name)}</td><td>${it.qty}</td><td>${money(it.price)}</td><td>${money(it.qty * it.price)}</td></tr>`).join('')}
      </table>
      <div style="display:flex;justify-content:space-between;margin-top:10px"><strong>Total</strong><strong>${money(bill.total)}</strong></div>
      ${bill.paymentType ? `<div class="sub">Payment: ${bill.paymentType}</div>` : ''}
    </div>
    <div class="modal-actions">
      <button class="btn secondary" id="rc-print">Print / Save PDF</button>
      <a class="btn" style="text-decoration:none" target="_blank" href="https://wa.me/${waNumber}?text=${waText}">Share on WhatsApp</a>
    </div>
    <button class="btn secondary block" style="margin-top:10px" id="rc-close">Close</button>
  `);
  document.getElementById('rc-print').onclick = () => window.print();
  document.getElementById('rc-close').onclick = closeModal;
}

function showPendingOrders() {
  const pending = STATE.orders.filter((o) => o.status === 'pending');
  openModal(`
    <h3>Online Orders</h3>
    ${pending.length === 0 ? '<div class="empty-state">No pending orders.</div>' :
      pending.map((o) => `<div class="list-row" data-id="${o.id}"><div><div class="title">${o.number || ''} — ${escapeHtml(o.customerName)}</div><div class="sub">${fmtDate(o.date)} · ${o.items.length} item(s)</div></div><strong>${money(o.total)}</strong></div>`).join('')}
    <div class="modal-actions"><button class="btn secondary block" id="po-close">Close</button></div>
  `);
  document.getElementById('po-close').onclick = closeModal;
  document.querySelectorAll('#modalRoot .list-row').forEach((el) => {
    el.onclick = () => reviewOrder(el.dataset.id);
  });
}
function reviewOrder(orderId) {
  const o = STATE.orders.find((x) => x.id === orderId);
  if (!o) return;
  openModal(`
    <h3>${o.number || ''}</h3>
    <div class="sub">${escapeHtml(o.customerName)} · ${escapeHtml(o.phone || '')}</div>
    <div class="sub">${escapeHtml(o.address || '')}</div>
    <table style="margin-top:10px">
      <tr><th>Item</th><th>Qty</th><th>Price</th></tr>
      ${o.items.map((it) => `<tr><td>${escapeHtml(it.name)}</td><td>${it.qty}</td><td>${money(it.price)}</td></tr>`).join('')}
    </table>
    <div style="display:flex;justify-content:space-between;margin-top:10px"><strong>Total</strong><strong>${money(o.total)}</strong></div>
    <div class="sub">Payment: ${o.paymentMethod}</div>
    ${o.notes ? `<div class="sub">Note: ${escapeHtml(o.notes)}</div>` : ''}
    <div class="modal-actions">
      <button class="btn danger" id="ord-reject">Reject</button>
      <button class="btn" id="ord-confirm">Confirm & Bill</button>
    </div>
  `);
  document.getElementById('ord-reject').onclick = async () => {
    o.status = 'rejected';
    await saveKey('orders');
    closeModal();
    renderOnlineOrdersBadge();
    toast('Order rejected');
  };
  document.getElementById('ord-confirm').onclick = async () => {
    for (const it of o.items) {
      const p = STATE.products.find((x) => x.id === it.productId);
      if (!p || p.stock < it.qty) { toast(`Not enough stock for ${it.name}`); return; }
    }
    const total = o.items.reduce((s, it) => s + it.qty * it.price, 0);
    const bill = {
      id: uid('B'), number: nextBillNumber(), type: 'bill',
      date: todayISO(), time: nowTimeStr(), customerId: null, customerName: o.customerName,
      items: o.items.map((it) => {
        const p = STATE.products.find((x) => x.id === it.productId);
        return { productId: it.productId, name: it.name, qty: it.qty, price: it.price, cost: p ? p.costPrice : 0 };
      }),
      total, paymentType: o.paymentMethod === 'cod' ? 'cash' : 'bank', paid: total, balanceDue: 0,
      by: STATE.user, source: 'website'
    };
    STATE.bills.push(bill);
    o.items.forEach((it) => {
      const p = STATE.products.find((x) => x.id === it.productId);
      if (p) p.stock -= it.qty;
    });
    o.status = 'confirmed';
    await Promise.all([saveKey('bills'), saveKey('products'), saveKey('orders')]);
    closeModal();
    renderOnlineOrdersBadge();
    toast('Order confirmed and billed');
  };
}

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
function labelForLedgerType(t) {
  return { bill: 'Bill', memo: 'Credit Memo', payment: 'Payment', grn: 'GRN', loan: 'Loan' }[t] || t;
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

/* ================= REPORTS ================= */
function renderReports() {
  const c = document.getElementById('pageContent');
  c.innerHTML = `
    <div class="grid">
      <div class="card"><h3>Sales</h3><p class="sub">All bills and credit memos</p><button class="btn small" id="rep-sales">Export CSV</button></div>
      <div class="card"><h3>Stock</h3><p class="sub">Current product stock and value</p><button class="btn small" id="rep-stock">Export CSV</button></div>
      <div class="card"><h3>Customer Dues</h3><p class="sub">Outstanding balances</p><button class="btn small" id="rep-dues">Export CSV</button></div>
      <div class="card"><h3>Loans</h3><p class="sub">Lender balances</p><button class="btn small" id="rep-loans">Export CSV</button></div>
      <div class="card">
        <h3>Net Profit</h3>
        <p class="sub">Sale price − cost price, across all bill line items in the period</p>
        <div class="row">
          <div class="field"><label>From</label><input type="date" id="rep-np-from" value="${todayISO().slice(0, 8)}01"></div>
          <div class="field"><label>To</label><input type="date" id="rep-np-to" value="${todayISO()}"></div>
        </div>
        <button class="btn small" id="rep-netprofit">Export CSV</button>
      </div>
    </div>
  `;
  document.getElementById('rep-sales').onclick = () => {
    const rows = [['Number', 'Type', 'Date', 'Time', 'Customer', 'Total', 'Payment', 'Paid', 'Balance Due', 'By', 'Source']];
    STATE.bills.filter((b) => b.type !== 'quote').forEach((b) => rows.push([b.number, b.type, b.date, b.time, b.customerName, b.total, b.paymentType, b.paid, b.balanceDue, b.by, b.source]));
    downloadCsv(rows, 'sales.csv');
  };
  document.getElementById('rep-netprofit').onclick = () => {
    const from = document.getElementById('rep-np-from').value;
    const to = document.getElementById('rep-np-to').value;
    const bills = STATE.bills.filter((b) => b.type !== 'quote' && (!from || b.date >= from) && (!to || b.date <= to));
    const rows = [['Number', 'Date', 'Customer', 'Sale Total', 'Cost Total', 'Net Profit']];
    let grandProfit = 0;
    bills.forEach((b) => {
      const saleTotal = (b.items || []).reduce((s, it) => s + it.price * it.qty, 0);
      const costTotal = (b.items || []).reduce((s, it) => s + it.cost * it.qty, 0);
      const profit = saleTotal - costTotal;
      grandProfit += profit;
      rows.push([b.number, b.date, b.customerName, saleTotal, costTotal, profit]);
    });
    rows.push(['', '', '', '', 'TOTAL', grandProfit]);
    downloadCsv(rows, `net-profit-${from || 'all'}_to_${to || 'all'}.csv`);
  };
  document.getElementById('rep-stock').onclick = () => {
    const rows = [['Name', 'Category', 'Brand', 'Cost Price', 'Selling Price', 'Stock', 'Stock Value']];
    STATE.products.forEach((p) => rows.push([p.name, p.category, p.brand, p.costPrice, p.sellingPrice, p.stock, (p.costPrice || 0) * (p.stock || 0)]));
    downloadCsv(rows, 'stock.csv');
  };
  document.getElementById('rep-dues').onclick = () => {
    const rows = [['Customer', 'Phone', 'Dues']];
    STATE.customers.forEach((cu) => rows.push([cu.name, cu.phone, cu.dues]));
    downloadCsv(rows, 'customer-dues.csv');
  };
  document.getElementById('rep-loans').onclick = () => {
    const rows = [['Lender', 'Phone', 'Given', 'Repaid', 'Balance']];
    STATE.lenders.forEach((l) => rows.push([l.name, l.phone, l.given, l.repaid, l.balance]));
    downloadCsv(rows, 'loans.csv');
  };
}
function downloadCsv(rows, filename) {
  const csv = rows.map((r) => r.map((cell) => {
    const s = cell === null || cell === undefined ? '' : String(cell);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ================= SETTINGS ================= */
function renderSettings() {
  const c = document.getElementById('pageContent');
  const s = STATE.settings;
  c.innerHTML = `
    <div class="card">
      <h3>Shop</h3>
      <div class="field"><label>Shop Name</label><input id="st-shopname" value="${escapeHtml(s.shopName || '')}"></div>
      <div class="field"><label>WhatsApp Number</label><input id="st-whatsapp" value="${escapeHtml(s.whatsappNumber || '')}"></div>
      <button class="btn small" id="st-save-shop">Save</button>
    </div>

    <div class="card" style="margin-top:14px">
      <h3>Bank Details (used for QR code)</h3>
      <div class="field"><label>Account Name</label><input id="st-accname" value="${escapeHtml(s.bankDetails.accountName || '')}"></div>
      <div class="field"><label>Account Number</label><input id="st-accno" value="${escapeHtml(s.bankDetails.accountNumber || '')}"></div>
      <div class="field"><label>Bank Name</label><input id="st-bankname" value="${escapeHtml(s.bankDetails.bankName || '')}"></div>
      <div class="field"><label>Branch</label><input id="st-branch" value="${escapeHtml(s.bankDetails.branch || '')}"></div>
      <button class="btn small" id="st-save-bank">Save</button>
    </div>

    <div class="card" style="margin-top:14px">
      <h3>Categories</h3>
      <div id="st-cat-list">
        ${s.categories.map((cat, idx) => `<div class="list-row"><span>${escapeHtml(cat)}</span>
          <div><button class="btn small secondary" data-rename="${idx}">Rename</button> <button class="btn small danger" data-remove="${idx}">Remove</button></div></div>`).join('')}
      </div>
      <div class="row" style="margin-top:10px">
        <div class="field"><input id="st-newcat" placeholder="New category"></div>
        <button class="btn small" id="st-addcat">Add</button>
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <h3>Billing</h3>
      <div class="field"><label>Starting bill number</label><input type="number" min="1" id="st-startbill" value="${s.startingBillNumber || 1}"></div>
      <p class="sub" style="margin-top:-6px">Sets what number new invoices start counting from — use this to continue from an existing paper bill book instead of starting at 0001. Only affects new invoices going forward.</p>
      <button class="btn small" id="st-save-startbill">Save</button>
    </div>

    <div class="card" style="margin-top:14px">
      <h3>Change PIN (${STATE.user})</h3>
      <div class="field"><label>New PIN</label><input type="password" id="st-newpin" maxlength="8"></div>
      <button class="btn small" id="st-savepin">Save PIN</button>
    </div>

    <div class="card" style="margin-top:14px">
      <h3>Manage Users</h3>
      <p class="sub" style="margin-top:-6px">AJMAL is the one Admin account and can't be removed here. Staff can use Sell, GRN, and Customers/Vendors/Loans, but can't edit or delete existing records, and can't open Settings or Reports.</p>
      <div id="st-user-list">
        ${(s.users || []).map((u, idx) => `
          <div class="list-row" style="cursor:default">
            <div><div class="title">${escapeHtml(u.name)}</div><div class="sub">${u.role === 'admin' ? 'Admin' : 'Staff'}</div></div>
            ${u.role === 'admin' ? '' : `
              <div style="display:flex;align-items:center;gap:8px">
                <input placeholder="New PIN" maxlength="8" style="width:100px;padding:6px 8px;border:1px solid var(--line);border-radius:8px" data-reset-pin="${idx}">
                <button class="btn small secondary" data-reset-pin-btn="${idx}">Reset PIN</button>
                <button class="btn small danger" data-remove-user="${idx}">Remove</button>
              </div>
            `}
          </div>
        `).join('')}
      </div>
      <div class="row" style="margin-top:10px">
        <div class="field"><input id="st-newuser-name" placeholder="Staff name"></div>
        <div class="field"><input id="st-newuser-pin" placeholder="PIN" maxlength="8"></div>
      </div>
      <button class="btn small" id="st-addstaff">+ Add Staff</button>
    </div>
  `;

  document.getElementById('st-save-shop').onclick = async () => {
    s.shopName = document.getElementById('st-shopname').value.trim();
    s.whatsappNumber = document.getElementById('st-whatsapp').value.trim();
    await saveKey('settings');
    document.getElementById('sidebarBrand').textContent = s.shopName;
    toast('Saved');
  };
  document.getElementById('st-save-bank').onclick = async () => {
    s.bankDetails = {
      accountName: document.getElementById('st-accname').value.trim(),
      accountNumber: document.getElementById('st-accno').value.trim(),
      bankName: document.getElementById('st-bankname').value.trim(),
      branch: document.getElementById('st-branch').value.trim()
    };
    await saveKey('settings');
    toast('Saved');
  };
  document.getElementById('st-save-startbill').onclick = async () => {
    const val = parseInt(document.getElementById('st-startbill').value, 10);
    s.startingBillNumber = (val && val > 0) ? val : 1;
    await saveKey('settings');
    toast('Saved');
  };
  document.getElementById('st-addcat').onclick = async () => {
    const val = document.getElementById('st-newcat').value.trim();
    if (!val) return;
    if (s.categories.includes(val)) { toast('Category already exists'); return; }
    s.categories.push(val);
    await saveKey('settings');
    renderSettings();
  };
  c.querySelectorAll('[data-rename]').forEach((btn) => {
    btn.onclick = async () => {
      const idx = parseInt(btn.dataset.rename, 10);
      const val = prompt('Rename category', s.categories[idx]);
      if (!val || !val.trim()) return;
      const oldName = s.categories[idx];
      s.categories[idx] = val.trim();
      STATE.products.forEach((p) => { if (p.category === oldName) p.category = val.trim(); });
      await Promise.all([saveKey('settings'), saveKey('products')]);
      renderSettings();
    };
  });
  c.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.onclick = async () => {
      const idx = parseInt(btn.dataset.remove, 10);
      if (!confirm(`Remove category "${s.categories[idx]}"?`)) return;
      s.categories.splice(idx, 1);
      await saveKey('settings');
      renderSettings();
    };
  });
  document.getElementById('st-savepin').onclick = async () => {
    const val = document.getElementById('st-newpin').value.trim();
    if (!val) { toast('Enter a PIN'); return; }
    findUser(STATE.user).pin = val;
    await saveKey('settings');
    toast('PIN updated');
  };
  document.getElementById('st-addstaff').onclick = async () => {
    const name = document.getElementById('st-newuser-name').value.trim().toUpperCase();
    const pin = document.getElementById('st-newuser-pin').value.trim();
    if (!name) { toast('Enter a name'); return; }
    if (!pin) { toast('Enter a PIN'); return; }
    if (findUser(name)) { toast('A user with that name already exists'); return; }
    s.users.push({ name, pin, role: 'staff' });
    await saveKey('settings');
    renderSettings();
    toast('Staff added');
  };
  c.querySelectorAll('[data-reset-pin-btn]').forEach((btn) => {
    btn.onclick = async () => {
      const idx = parseInt(btn.dataset.resetPinBtn, 10);
      const input = c.querySelector(`[data-reset-pin="${idx}"]`);
      const val = input.value.trim();
      if (!val) { toast('Enter a new PIN'); return; }
      s.users[idx].pin = val;
      await saveKey('settings');
      renderSettings();
      toast('PIN reset');
    };
  });
  c.querySelectorAll('[data-remove-user]').forEach((btn) => {
    btn.onclick = async () => {
      const idx = parseInt(btn.dataset.removeUser, 10);
      const u = s.users[idx];
      if (!confirm(`Remove staff account "${u.name}"?`)) return;
      s.users.splice(idx, 1);
      await saveKey('settings');
      renderSettings();
      toast('Staff removed');
    };
  });
}

boot();
