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

/* ---------------- Shared utils (used by multiple screen files) ---------------- */
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


function labelForLedgerType(t) {
  return { bill: 'Bill', memo: 'Credit Memo', payment: 'Payment', grn: 'GRN', loan: 'Loan' }[t] || t;
}

boot();
