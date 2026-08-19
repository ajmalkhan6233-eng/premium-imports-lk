/* Premium Imports LK - internal app (vanilla JS, no build step) */

/* Theme is a personal, per-device preference ("pick your mood"), not shop
   data — stored in localStorage, applied before anything else renders so
   there's no flash of the default theme. */
const THEMES = [
  { id: 'navy', label: 'Royal & Gold' },
  { id: 'forest', label: 'Forest & Cream' },
  { id: 'slate', label: 'Charcoal & Slate' }
];
function applyTheme(id) {
  if (id && id !== 'navy') document.documentElement.setAttribute('data-theme', id);
  else document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('pilk_theme', id || 'navy');
}
applyTheme(localStorage.getItem('pilk_theme') || 'navy');

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
  waConversations: [],
  documents: [],
  uiConfig: null,
  activeTab: 'home',
  sellCart: [],
  sellType: 'bill',
  sellPayment: 'cash',
  sellCustomerId: null,
  sellDiscountType: 'fixed',
  sellDiscountValue: 0,
  sellPaymentPlanIdx: 0,
  sellPaymentRef: '',
  sellCashTendered: '',
  secretsStatus: null
};

const KEYS = ['settings', 'products', 'customers', 'vendors', 'lenders', 'bills', 'grns', 'orders', 'waConversations', 'documents', 'expenses'];
const LOW_STOCK_THRESHOLD = 5;

const NAV_ITEMS = [
  { id: 'sell', label: 'Sell', icon: '\u{1F9FE}' },
  { id: 'home', label: 'Home', icon: '\u{1F3E0}' },
  { id: 'products', label: 'Products', icon: '\u{1F4E6}' },
  { id: 'grn', label: 'GRN', icon: '\u{1F4E5}' },
  { id: 'bills', label: 'Bills', icon: '\u{1F4DC}' },
  { id: 'customers', label: 'Customers', icon: '\u{1F465}' },
  { id: 'vendors', label: 'Vendors', icon: '\u{1F69A}' },
  { id: 'loans', label: 'Loans', icon: '\u{1F4B0}' },
  { id: 'expenses', label: 'Expenses', icon: '\u{1F4B8}' },
  { id: 'messages', label: 'Messages', icon: '\u{1F4AC}' },
  { id: 'reports', label: 'Reports', icon: '\u{1F4CA}' },
  { id: 'settings', label: 'Settings', icon: '\u{2699}\u{FE0F}' },
  { id: 'siteEditor', label: 'Site & POS Editor', icon: '\u{1F5A5}\u{FE0F}' },
  { id: 'help', label: 'Help', icon: '\u{2753}' },
  // Deliberately not in MOBILE_PRIMARY/MOBILE_MORE — reached via a button
  // inside Settings, not a permanent nav tab (one-time/rare setup flow).
  { id: 'onboarding', label: 'Shop Setup', icon: '\u{1F4CB}' }
];
const MOBILE_PRIMARY = ['sell', 'home', 'products', 'customers'];
const MOBILE_MORE = ['grn', 'bills', 'vendors', 'loans', 'expenses', 'messages', 'reports', 'settings', 'siteEditor', 'help'];
const ADMIN_ONLY_TABS = ['reports', 'settings', 'siteEditor', 'onboarding'];

/* ---------------- Auth token (AUTH_COMMAND.md Step 2) ---------------- */
// Every /api/data/:key and staff-workflow write now requires this on the
// server (see server.js requireSession/requireAdmin) — kept in localStorage
// so a page reload doesn't force a re-login, same lifetime pattern as
// pilk_user already used.
let AUTH_TOKEN = localStorage.getItem('pilk_token') || null;
function setAuthToken(token) {
  AUTH_TOKEN = token;
  if (token) localStorage.setItem('pilk_token', token);
  else localStorage.removeItem('pilk_token');
}
function authHeaders(extra) {
  const h = Object.assign({}, extra || {});
  if (AUTH_TOKEN) h['Authorization'] = 'Bearer ' + AUTH_TOKEN;
  return h;
}

/* ---------------- API helpers ---------------- */
async function apiGet(key) {
  const res = await fetch(`/api/data/${key}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to load ${key}`);
  const json = await res.json();
  return json.value;
}
async function apiPut(key, value, extra) {
  const res = await fetch(`/api/data/${key}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(Object.assign({ value }, extra || {}))
  });
  if (!res.ok) {
    let message = `Failed to save ${key}`;
    try { const body = await res.json(); if (body && body.message) message = body.message; } catch (e) { /* non-JSON error body */ }
    throw new Error(message);
  }
  return res.json();
}
async function saveKey(key, extra) {
  await apiPut(key, STATE[key], extra);
}
// uiConfig lives on its own routes (server.js /api/admin/ui-config), not
// the generic /api/data/:key KEYS list — see server.js's comment on why.
// Fails open to the same defaults server.js's defaultData() ships, so a
// fetch failure degrades to "everything on" rather than hiding POS buttons
// or blanking storefront text that used to be hardcoded.
async function fetchUiConfig() {
  try {
    const res = await fetch('/api/admin/ui-config', { headers: authHeaders() });
    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    STATE.uiConfig = data.value;
  } catch (e) {
    STATE.uiConfig = { storefront: { heroTagline: '', announcementBanner: { active: false, text: '' } }, pos: { features: { grnPhotoScan: true } } };
  }
}

/* ---------------- Utils ---------------- */
function money(n) {
  const v = Number(n) || 0;
  return 'Rs. ' + v.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + (parseInt(days, 10) || 0));
  return d.toISOString().slice(0, 10);
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
// Durable, never-reused sequence numbers. Backed by settings.counters
// (persisted to data.json) instead of array length, which would silently
// reuse a number after any deletion or reset.
function nextNumber(counterKey, prefix, startAt) {
  STATE.settings.counters = STATE.settings.counters || {};
  const next = (STATE.settings.counters[counterKey] || 0) + 1;
  STATE.settings.counters[counterKey] = next;
  const base = (parseInt(startAt, 10) || 1) - 1;
  return `${prefix}-${String(base + next).padStart(4, '0')}`;
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
// No close-on-outside-click (it used to silently discard whatever was typed
// in the modal) — every modal gets one explicit X button here instead, so
// closing is always a deliberate action, consistently across the app.
function openModal(html) {
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop" id="modalBackdrop">
      <div class="modal">
        <button type="button" class="modal-close" id="modalCloseBtn" aria-label="Close">&times;</button>
        ${html}
      </div>
    </div>`;
  document.getElementById('modalCloseBtn').onclick = closeModal;
}

/* ---------------- Keyboard shortcuts ---------------- */
// Kept deliberately small per the spec: Esc closes any open modal (works app-
// wide, not just Sell); on the Sell screen only, Enter completes the sale and
// "/" jumps focus to the customer field — both skipped while a text field is
// focused so they never fight the per-field Enter handlers already in sell.js.
function isTypingInField() {
  const tag = document.activeElement && document.activeElement.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.getElementById('modalRoot').innerHTML.trim()) closeModal();
    return;
  }
  if (STATE.activeTab !== 'sell') return;
  if (e.key === 'Enter' && !isTypingInField()) {
    const btn = document.getElementById('sell-complete');
    if (btn && !btn.disabled) btn.click();
    return;
  }
  if (e.key === '/' && !isTypingInField()) {
    e.preventDefault();
    const el = document.getElementById('sell-customer-search');
    if (el) el.focus();
  }
});

/* ---------------- Boot ---------------- */
// AUTH_COMMAND.md Step 2: a token in localStorage is only a claim — it's
// verified against the server's real session store here before anything
// trusts it. If it's expired or was invalidated by a logout elsewhere,
// this clears it and falls through to the login screen instead of a
// broken "signed in" state with no real data access.
//
// Only `settings` is fetched before we know whether we're authenticated —
// it's the one key that's always readable (filtered publicly, full once
// logged in). Every other key now 401s with no session, so fetching all of
// KEYS up front (the pre-auth version of this function) would reject the
// whole Promise.all on the very first 401 and never even reach the login
// screen. The rest of KEYS is fetched only after login is confirmed.
async function boot() {
  try {
    STATE.settings = await apiGet('settings');
  } catch (e) {
    toast('Could not reach server. Is it running?');
    return;
  }
  document.getElementById('loginShopName').textContent = STATE.settings.shopName || 'Premium Imports LK';

  if (AUTH_TOKEN) {
    try {
      const res = await fetch('/api/session', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        STATE.user = data.user;
        STATE.role = data.role;
      } else {
        setAuthToken(null);
        localStorage.removeItem('pilk_user');
      }
    } catch (e) { /* connectivity issue — surfaced by the fetch below either way */ }
  }

  if (!STATE.user) { showLogin(); return; }
  try {
    const values = await Promise.all(KEYS.map((k) => apiGet(k)));
    KEYS.forEach((k, i) => { STATE[k] = values[i]; });
  } catch (e) {
    toast('Could not reach server. Is it running?');
    return;
  }
  await fetchUiConfig();
  showApp();
  obxInit();
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
  startAmbientBackground('loginAmbientBg');
  let selectedUser = null;
  const picker = document.getElementById('userPicker');
  // Names only, from the public /api/login-users endpoint — the days of
  // fetching the whole settings.users list (PINs included!) just to draw
  // this picker are gone. See AUTH_COMMAND.md SESSION_LOG.md entry.
  picker.innerHTML = '<div class="sub">Loading…</div>';
  fetch('/api/login-users').then((r) => r.json()).then((data) => {
    picker.innerHTML = (data.users || []).map((name) =>
      `<button class="user-btn" data-user="${escapeHtml(name)}">${escapeHtml(name)}</button>`
    ).join('');
    picker.querySelectorAll('.user-btn').forEach((btn) => {
      btn.onclick = () => {
        picker.querySelectorAll('.user-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        selectedUser = btn.dataset.user;
        document.getElementById('loginError').textContent = '';
      };
    });
  }).catch(() => { picker.innerHTML = '<div class="sub">Could not reach server.</div>'; });
  document.getElementById('pinInput').value = '';
  document.getElementById('loginError').textContent = '';
  document.getElementById('loginBtn').onclick = async () => {
    const pin = document.getElementById('pinInput').value.trim();
    if (!selectedUser) {
      document.getElementById('loginError').textContent = 'Pick a user first.';
      return;
    }
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    let data;
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedUser, pin })
      });
      data = await res.json();
      if (!res.ok) {
        document.getElementById('loginError').textContent = data.message || 'Wrong PIN.';
        btn.disabled = false;
        return;
      }
    } catch (e) {
      document.getElementById('loginError').textContent = 'Could not reach the server.';
      btn.disabled = false;
      return;
    }
    btn.disabled = false;
    setAuthToken(data.token);
    STATE.user = data.user;
    STATE.role = data.role;
    localStorage.setItem('pilk_user', data.user);
    // The pre-login boot() fetch ran with no session, so settings/products
    // were the narrow public view — refetch everything now that requests
    // carry a real session, so the app isn't stuck on filtered data.
    try {
      const values = await Promise.all(KEYS.map((k) => apiGet(k)));
      KEYS.forEach((k, i) => { STATE[k] = values[i]; });
    } catch (e) { /* showApp() proceeds regardless; other calls will surface any real issue */ }
    await fetchUiConfig();
    showApp();
  };
}

function logout() {
  const headers = authHeaders({ 'Content-Type': 'application/json' });
  setAuthToken(null);
  STATE.user = null;
  STATE.role = null;
  localStorage.removeItem('pilk_user');
  fetch('/api/logout', { method: 'POST', headers }).catch(() => {});
  showLogin();
}

function showApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  document.getElementById('sidebarBrand').textContent = STATE.settings.shopName || 'Premium Imports LK';
  document.getElementById('sidebarUser').textContent = `${STATE.user} (${isAdmin() ? 'Admin' : 'Staff'})`;
  document.getElementById('logoutLinkSidebar').onclick = (e) => { e.preventDefault(); logout(); };
  ensureItemCodes();
  renderNav();
  goTab('sell');
  startLiveClock();
}

/* ---------------- Live pulse (today's running sales, every screen) ---------------- */
function renderLivePulse() {
  const el = document.getElementById('livePulse');
  if (!el) return;
  const today = todayISO();
  const todays = STATE.bills.filter((b) => b.type !== 'quote' && b.status !== 'voided' && b.date === today);
  const total = todays.reduce((s, b) => s + (b.total || 0), 0);
  el.innerHTML = `<strong>${money(total)}</strong><span>Today · ${todays.length} sale${todays.length === 1 ? '' : 's'}</span>`;
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
    <button type="button" class="nav-item" id="moreNavBtn"><span class="icon" aria-hidden="true">\u{2630}</span><span>More</span></button>`;
  bottomNav.querySelectorAll('.nav-item[data-tab]').forEach((el) => {
    el.onclick = () => goTab(el.dataset.tab);
  });
  document.getElementById('moreNavBtn').onclick = showMoreSheet;
}
function navItemHtml(item) {
  return `<button type="button" class="nav-item" data-tab="${item.id}"><span class="icon" aria-hidden="true">${item.icon}</span><span>${item.label}</span></button>`;
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
    const isActive = el.dataset.tab === tab;
    el.classList.toggle('active', isActive);
    if (isActive) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
  document.getElementById('pageTitle').textContent = NAV_ITEMS.find((n) => n.id === tab).label;
  renderOnlineOrdersBadge();
  if (typeof obxRenderBadge === 'function') obxRenderBadge();
  if (tab === 'sell') sellNeedsCustomerFocus = true;
  if (tab !== 'sell') document.getElementById('sellTotalBarRoot').innerHTML = '';
  const renderers = {
    home: renderHome, products: renderProducts, sell: renderSell, grn: renderGRN, bills: renderBills,
    customers: renderCustomers, vendors: renderVendors, loans: renderLoans, expenses: renderExpenses,
    messages: renderMessages, reports: renderReports, settings: renderSettings, siteEditor: renderSiteEditor,
    help: renderHelp, onboarding: renderOnboardingWizard
  };
  renderers[tab]();
  renderLivePulse();
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


// Plain base64 read, no compression — for non-image attachments (PDF) where
// compressImage's <img>/canvas pipeline doesn't apply.
function readFileAsDataUrl(file, cb) {
  const reader = new FileReader();
  reader.onload = (e) => cb(e.target.result);
  reader.readAsDataURL(file);
}
// Derives a bill's display status purely from fields already on the bill —
// never invents payment history. "Partial" is correct-by-construction (paid
// > 0 and balanceDue > 0) but won't currently appear: nothing in this app
// yet records a partial payment against a specific bill (only aggregate
// customer-level payments exist). Documented rather than faked.
function billStatus(b) {
  if (b.status === 'voided') return { label: 'Voided', cls: 'voided' };
  if (b.type === 'quote') return { label: 'Quote', cls: '' };
  if ((b.balanceDue || 0) <= 0) return { label: 'Paid', cls: 'ok' };
  if ((b.paid || 0) > 0 && (b.balanceDue || 0) > 0) return { label: 'Partial', cls: 'due' };
  return { label: 'Pending', cls: 'due' };
}
function labelForLedgerType(t) {
  return { bill: 'Bill', memo: 'Credit Memo', payment: 'Payment', grn: 'GRN', loan: 'Loan', void: 'Void' }[t] || t;
}

// Shared running-balance chart for any ledger array (vendors, lenders,
// customers) — each entry already carries balanceAfter, so this just plots
// it over time. No charting library: a handful of SVG elements is plenty
// for "is this trending up or down," and it stays themeable via CSS vars.
function renderLedgerChartSvg(ledger) {
  const entries = [...(ledger || [])].sort((a, b) => a.date.localeCompare(b.date));
  if (entries.length === 0) return '<div class="empty-state">No transactions yet — nothing to chart.</div>';
  const width = 560, height = 140, padX = 10, padTop = 14, padBottom = 22;
  const values = entries.map((e) => e.balanceAfter || 0);
  const maxV = Math.max(...values, 0);
  const minV = Math.min(...values, 0);
  const range = (maxV - minV) || 1;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;
  const xFor = (i) => entries.length === 1 ? padX + innerW / 2 : padX + (i / (entries.length - 1)) * innerW;
  const yFor = (v) => padTop + innerH - ((v - minV) / range) * innerH;
  const points = entries.map((e, i) => [xFor(i), yFor(e.balanceAfter || 0)]);
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const zeroY = yFor(0).toFixed(1);
  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${zeroY} L${points[0][0].toFixed(1)},${zeroY} Z`;
  const dots = entries.map((e, i) => {
    // 'void' reverses a bill's effect on dues, so it decreases the balance
    // owed exactly like a payment does — group it with payments for coloring.
    const isCredit = e.type !== 'payment' && e.type !== 'void';
    return `<circle class="${isCredit ? 'lc-dot-credit' : 'lc-dot-debit'}" cx="${points[i][0].toFixed(1)}" cy="${points[i][1].toFixed(1)}" r="3"><title>${escapeHtml(fmtDate(e.date))} · ${escapeHtml(labelForLedgerType(e.type))} · ${money(e.amount)} · Balance ${money(e.balanceAfter)}</title></circle>`;
  }).join('');
  const firstLabel = escapeHtml(fmtDate(entries[0].date));
  const lastLabel = escapeHtml(fmtDate(entries[entries.length - 1].date));
  return `
    <div class="ledger-chart-wrap">
      <svg class="ledger-chart" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none">
        <line class="lc-axis" x1="${padX}" y1="${zeroY}" x2="${width - padX}" y2="${zeroY}"></line>
        <path class="lc-area" d="${areaPath}"></path>
        <path class="lc-line" d="${linePath}"></path>
        ${dots}
        <text class="lc-label" x="${padX}" y="${height - 6}">${firstLabel}</text>
        <text class="lc-label" x="${width - padX}" y="${height - 6}" text-anchor="end">${lastLabel}</text>
      </svg>
      <div class="chart-legend">
        <span><span class="dot" style="background:var(--red)"></span> Increases balance owed</span>
        <span><span class="dot" style="background:var(--green)"></span> Payment received/made</span>
      </div>
    </div>`;
}

// Days-in-stock tracking (Products list + Stock report). For each product,
// finds the date of its oldest not-yet-sold GRN batch via FIFO — GRN batches
// consumed oldest-first by historical sales, so what's left really is the
// oldest stock still on the shelf. Falls back to the most recent GRN date if
// the product has never been sold yet (nothing to FIFO-consume), or no date
// at all if it has no GRN history (e.g. legacy/manually-added stock).
// Visibility only — never touches cost price, margin, or any profit number.
function computeProductAgingDates() {
  const batchesByProduct = {};
  [...STATE.grns].sort((a, b) => a.date.localeCompare(b.date)).forEach((g) => {
    (g.items || []).forEach((it) => {
      if (!it.productId) return;
      (batchesByProduct[it.productId] = batchesByProduct[it.productId] || []).push({ date: g.date, remaining: it.qty });
    });
  });
  const soldByProduct = {};
  // Voided bills are excluded: their stock was restored (see POST
  // /api/bills/:id/void), so treating them as consumed here would make aging
  // think stock was sold when it's actually still on the shelf.
  STATE.bills.filter((b) => b.type !== 'quote' && b.status !== 'voided').sort((a, b) => a.date.localeCompare(b.date)).forEach((b) => {
    (b.items || []).forEach((it) => {
      if (!it.productId) return;
      (soldByProduct[it.productId] = soldByProduct[it.productId] || []).push(it.qty);
    });
  });
  const oldestUnsoldDate = {};
  Object.keys(batchesByProduct).forEach((productId) => {
    const batches = batchesByProduct[productId];
    let bIdx = 0;
    (soldByProduct[productId] || []).forEach((qty) => {
      let remainingToConsume = qty;
      while (remainingToConsume > 0 && bIdx < batches.length) {
        const batch = batches[bIdx];
        if (batch.remaining <= 0) { bIdx++; continue; }
        const take = Math.min(remainingToConsume, batch.remaining);
        batch.remaining -= take;
        remainingToConsume -= take;
        if (batch.remaining <= 0) bIdx++;
      }
    });
    const oldestRemaining = batches.find((b) => b.remaining > 0);
    oldestUnsoldDate[productId] = oldestRemaining ? oldestRemaining.date : batches[batches.length - 1].date;
  });
  return oldestUnsoldDate;
}
function daysInStock(productId, agingMap) {
  const map = agingMap || computeProductAgingDates();
  const d = map[productId];
  if (!d) return null;
  return Math.max(0, Math.round((Date.now() - Date.parse(d)) / 86400000));
}

/* ---------------- Item codes ---------------- */
// Short, human-readable per-product codes (distinct from the internal
// uid('P') id) — requested so every product has something a staff member
// can read off a shelf/receipt, not just an opaque internal id. Plain
// 2-digit numbers (01, 02, ...) — the original "PI-0001" style was judged
// too long to read/write by hand; see migrateItemCodes() for the one-time
// switch on existing data.
function nextItemCode() {
  const used = new Set(STATE.products.filter((p) => p.itemCode).map((p) => p.itemCode));
  let n = 1, code;
  do { code = String(n).padStart(2, '0'); n++; } while (used.has(code));
  return code;
}
// One-time backfill for products that existed before item codes did.
function ensureItemCodes() {
  let changed = migrateItemCodes();
  (STATE.products || []).forEach((p) => {
    if (!p.itemCode) { p.itemCode = nextItemCode(); changed = true; }
  });
  if (changed) saveKey('products');
}
// One-time migration: reassign any old "PI-0001"-style code to the new
// short format, in the same relative order (lowest PI-#### first), so
// existing labels/receipts stay predictable rather than shuffled randomly.
function migrateItemCodes() {
  const old = (STATE.products || []).filter((p) => p.itemCode && /^PI-\d+$/.test(p.itemCode));
  if (!old.length) return false;
  old.sort((a, b) => parseInt(a.itemCode.slice(3), 10) - parseInt(b.itemCode.slice(3), 10));
  old.forEach((p) => { p.itemCode = null; });
  old.forEach((p) => { p.itemCode = nextItemCode(); });
  return true;
}

/* ---------------- Quick lookup (invoice number or customer name) ----------------
   Shared by the Home search box and Sell's "Return / Void a Bill" button —
   brought to the front, not buried in Bills/Customers, per Ajmal's own
   request: he and his staff are the ones running lookups all day. */
function openQuickLookupModal(prefill) {
  openModal(`
    <h3>Look up an invoice or customer</h3>
    <div class="field"><input id="ql-search" placeholder="Invoice number or customer name..." value="${escapeHtml(prefill || '')}"></div>
    <div id="ql-results"></div>
    <button class="btn secondary block" style="margin-top:10px" id="ql-close">Close</button>
  `);
  document.getElementById('ql-close').onclick = closeModal;
  const input = document.getElementById('ql-search');
  const renderResults = () => {
    const q = input.value.trim().toLowerCase();
    const resultsEl = document.getElementById('ql-results');
    if (!q) { resultsEl.innerHTML = ''; return; }
    const billMatches = STATE.bills
      .filter((b) => b.type !== 'quote' && ((b.number || '').toLowerCase().includes(q) || (b.customerName || '').toLowerCase().includes(q)))
      .sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')))
      .slice(0, 8);
    const customerMatches = STATE.customers.filter((cu) => cu.name.toLowerCase().includes(q) || (cu.phone || '').includes(input.value.trim())).slice(0, 6);
    if (billMatches.length === 0 && customerMatches.length === 0) { resultsEl.innerHTML = '<div class="empty-state">No match.</div>'; return; }
    resultsEl.innerHTML =
      (billMatches.length ? '<div class="sub" style="padding:4px 6px">Bills</div>' +
        billMatches.map((b) => {
          const st = billStatus(b);
          return `<div class="list-row" data-bill="${b.id}"><div><div class="title">${escapeHtml(b.number || '')} — ${escapeHtml(b.customerName || 'Walk-in')}</div><div class="sub">${fmtDate(b.date)} · ${typeLabel(b)}</div></div><div style="text-align:right"><strong>${money(b.total)}</strong><div><span class="badge ${st.cls}">${st.label}</span></div></div></div>`;
        }).join('') : '') +
      (customerMatches.length ? '<div class="sub" style="padding:4px 6px">Customers</div>' +
        customerMatches.map((cu) => `<div class="list-row" data-customer="${cu.id}"><div><div class="title">${escapeHtml(cu.name)}</div><div class="sub">${escapeHtml(cu.phone || '')}</div></div>${cu.dues > 0 ? `<strong>${money(cu.dues)} due</strong>` : ''}</div>`).join('') : '');
    resultsEl.querySelectorAll('[data-bill]').forEach((el) => {
      el.onclick = () => { closeModal(); openBillActions(el.dataset.bill); };
    });
    resultsEl.querySelectorAll('[data-customer]').forEach((el) => {
      el.onclick = () => { closeModal(); goTab('customers'); setTimeout(() => openCustomerLedger(el.dataset.customer), 50); };
    });
  };
  input.oninput = renderResults;
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  renderResults();
  input.focus();
}

boot();
