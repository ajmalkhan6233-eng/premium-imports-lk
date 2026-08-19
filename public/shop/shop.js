/* Premium Imports LK - public storefront */

const SHOP = {
  settings: null,
  products: [],
  cart: [], // {productId, name, price, qty}
  categoryFilter: 'All',
  searchQuery: ''
};

async function apiGet(key) {
  const res = await fetch(`/api/data/${key}`);
  const json = await res.json();
  return json.value;
}
async function apiPut(key, value) {
  const res = await fetch(`/api/data/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value })
  });
  return res.json();
}
function money(n) {
  const v = Number(n) || 0;
  return 'Rs. ' + v.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 9999)}`;
}

// Inline SVG placeholder for products without a photo — no external network
// dependency, so the catalog never shows broken images if a third-party
// placeholder service is slow/down. Matches the storefront's dark/gold theme.
function placeholderImage(name) {
  const initials = String(name || '?')
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="169" viewBox="0 0 300 169">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1A2233"/><stop offset="1" stop-color="#121826"/>
    </linearGradient></defs>
    <rect width="300" height="169" fill="url(#g)"/>
    <text x="150" y="94" font-family="sans-serif" font-size="42" font-weight="700"
      fill="#C9A24B" text-anchor="middle" dominant-baseline="middle">${escapeHtml(initials)}</text>
  </svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
function todayISO() { return new Date().toISOString().slice(0, 10); }

const CART_STORAGE_KEY = 'pilk_shop_cart';
function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (raw) SHOP.cart = JSON.parse(raw);
  } catch (e) { SHOP.cart = []; }
}
function saveCartToStorage() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(SHOP.cart));
}

/* ---- Reveal-on-scroll (hero glow / section labels / product cards) ---- */
let revealObserver = null;
function observeReveal(el) {
  if (!('IntersectionObserver' in window)) { el.classList.add('in'); return; }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
  }
  revealObserver.observe(el);
}

async function boot() {
  loadCartFromStorage();
  try {
    const [settings, products] = await Promise.all([apiGet('settings'), apiGet('products')]);
    SHOP.settings = settings;
    SHOP.products = products;
  } catch (e) {
    document.getElementById('productGrid').innerHTML = '<div class="empty-state">Could not load the shop. Please try again later.</div>';
    return;
  }
  document.title = SHOP.settings.shopName || 'Premium Imports LK';
  const freeMin = SHOP.settings.deliveryZones && SHOP.settings.deliveryZones.freeDeliveryMin;
  if (freeMin > 0) {
    const el = document.getElementById('freeDeliveryNote');
    el.textContent = `Free delivery on orders over ${money(freeMin)}`;
    el.classList.remove('hidden');
  }
  startAmbientBackground('particleBg');
  renderFilters();
  renderGrid();
  updateCartCount();
  document.getElementById('cartBtn').onclick = openCartDrawer;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    SHOP.searchQuery = e.target.value.trim().toLowerCase();
    renderGrid();
  });
  document.getElementById('searchBtn').onclick = () => document.getElementById('searchInput').focus();
  document.querySelectorAll('main .reveal').forEach(observeReveal);
  applyUiConfig();
}

// SELF_SUSTAINING_ADMIN_COMMAND.md Phase 2: hero tagline + announcement
// banner, editable from the admin "Site & POS Editor" tab
// (server.js GET /api/public/ui-config). Best-effort only — if this fails
// the hero keeps whatever's already in the static HTML, so the storefront
// never goes blank because of a config fetch, per the command's own rule.
async function applyUiConfig() {
  try {
    const res = await fetch('/api/public/ui-config');
    if (!res.ok) return;
    const { value } = await res.json();
    if (!value) return;
    if (value.heroTagline) {
      const el = document.getElementById('heroTagline');
      if (el) el.textContent = value.heroTagline;
    }
    const banner = value.announcementBanner;
    const bannerEl = document.getElementById('announcementBanner');
    if (bannerEl && banner && banner.active && banner.text) {
      bannerEl.textContent = banner.text;
      bannerEl.classList.remove('hidden');
    }
  } catch (e) { /* keep static HTML defaults */ }
}

const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function renderFilters() {
  const cats = ['All', ...(SHOP.settings.categories || [])];
  document.getElementById('catFilters').innerHTML = cats.map((c) =>
    `<button type="button" data-cat="${escapeHtml(c)}" class="cat${c === SHOP.categoryFilter ? ' active' : ''}" aria-pressed="${c === SHOP.categoryFilter}">${escapeHtml(c)}</button>`
  ).join('');
  document.querySelectorAll('#catFilters .cat').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.cat === SHOP.categoryFilter) return;
      SHOP.categoryFilter = b.dataset.cat;
      renderFilters();
      switchGrid();
    };
  });
}

/* Category switch: fade the current grid out, swap content, fade the new
   items in with a stagger (renderGrid applies the per-card delay) so the
   catalog reflows instead of hard-cutting to the new category. */
function switchGrid() {
  const grid = document.getElementById('productGrid');
  if (prefersReducedMotion) { renderGrid(); return; }
  grid.classList.add('switching');
  setTimeout(() => {
    renderGrid();
    grid.classList.remove('switching');
  }, 160);
}

function renderGrid() {
  const grid = document.getElementById('productGrid');
  const q = SHOP.searchQuery;
  // Show every product that matches the filter, in stock or not — a
  // catalog customers can browse and ask about, not an empty wall just
  // because today's stock happens to be zero. Cards for zero-stock items
  // render in a distinct "Out of Stock" state (no add-to-cart) instead of
  // being hidden outright.
  const list = SHOP.products.filter((p) =>
    (SHOP.categoryFilter === 'All' || p.category === SHOP.categoryFilter) &&
    (!q || p.name.toLowerCase().includes(q))
  );
  if (list.length === 0) {
    const waNumber = (SHOP.settings.whatsappNumber || '').replace(/\D/g, '');
    const scope = SHOP.categoryFilter !== 'All' ? ` for ${SHOP.categoryFilter}` : '';
    const waText = encodeURIComponent(`Hi, could you let me know what's available${scope}?`);
    grid.innerHTML = `<div class="empty-state">
      <svg class="empty-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M7 16 24 6l17 10" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <rect x="7" y="16" width="34" height="24" rx="2" stroke="currentColor" stroke-width="2"/>
        <path d="M24 24v10M18 27h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <h3>Nothing listed here yet</h3>
      <p>Message us on WhatsApp and we'll tell you what's available.</p>
      <a class="btn" href="https://wa.me/${waNumber}?text=${waText}" target="_blank">Ask on WhatsApp</a>
    </div>`;
    return;
  }
  const waNumber = (SHOP.settings.whatsappNumber || '').replace(/\D/g, '');
  grid.innerHTML = list.map((p, idx) => {
    const inStock = (p.stock || 0) > 0;
    const hasPrice = p.sellingPrice && p.sellingPrice > 0;
    const askText = hasPrice
      ? `Hi, I'm interested in "${p.name}". Is it back in stock?`
      : `Hi, I'm interested in "${p.name}". Can you tell me the price?`;
    const waText = encodeURIComponent(askText);
    const delay = prefersReducedMotion ? 0 : Math.min(idx * 35, 300);
    let actionHtml;
    if (!inStock) {
      actionHtml = `<div class="price">${hasPrice ? money(p.sellingPrice) : 'Ask for Price'}</div><a class="ask-btn" href="https://wa.me/${waNumber}?text=${waText}" target="_blank">Notify Me</a>`;
    } else if (hasPrice) {
      actionHtml = `<div class="price">${money(p.sellingPrice)}</div><button class="add" data-add="${p.id}" aria-label="Add ${escapeHtml(p.name)} to cart">+</button>`;
    } else {
      actionHtml = `<div class="price">Ask for Price</div><a class="ask-btn" href="https://wa.me/${waNumber}?text=${waText}" target="_blank">Ask</a>`;
    }
    return `<div class="card reveal${inStock ? '' : ' oos'}" style="transition-delay:${delay}ms">
      <div class="thumb"><img src="${p.photo || placeholderImage(p.name)}" onerror="this.onerror=null;this.src=placeholderImage('${escapeHtml(p.name).replace(/'/g, "\\'")}')">${inStock ? '' : '<span class="oos-tag">Out of Stock</span>'}</div>
      <div class="info">
        <div class="cat-tag">${escapeHtml(p.category)}</div>
        <h3>${escapeHtml(p.name)}</h3>
        <div class="row">${actionHtml}</div>
      </div>
    </div>`;
  }).join('');
  grid.querySelectorAll('[data-add]').forEach((btn) => {
    btn.onclick = () => addToCart(btn.dataset.add, btn);
  });
  grid.querySelectorAll('.card').forEach(observeReveal);
}

function addToCart(productId, btnEl) {
  const p = SHOP.products.find((x) => x.id === productId);
  if (!p) return;
  const existing = SHOP.cart.find((it) => it.productId === productId);
  const inCartQty = existing ? existing.qty : 0;
  if (inCartQty + 1 > p.stock) { alert('Not enough stock available.'); return; }
  if (existing) existing.qty += 1;
  else SHOP.cart.push({ productId: p.id, name: p.name, price: p.sellingPrice, qty: 1 });
  saveCartToStorage();
  updateCartCount();
  bumpCartBtn();
  if (btnEl) flashAdded(btnEl);
}
function updateCartCount() {
  document.getElementById('cartCount').textContent = SHOP.cart.reduce((s, it) => s + it.qty, 0);
}
function bumpCartBtn() {
  if (prefersReducedMotion) return;
  const btn = document.getElementById('cartBtn');
  btn.classList.remove('bump');
  void btn.offsetWidth;
  btn.classList.add('bump');
}
function flashAdded(btn) {
  const original = btn.textContent;
  btn.textContent = '✓';
  btn.classList.add('added');
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove('added');
  }, 500);
}

function openCartDrawer() {
  renderCartDrawer();
}
function renderCartDrawer() {
  const total = SHOP.cart.reduce((s, it) => s + it.qty * it.price, 0);
  document.getElementById('drawerRoot').innerHTML = `
    <div class="cart-drawer" id="cartDrawerBackdrop">
      <div class="cart-panel">
        <h2>Your Cart</h2>
        ${SHOP.cart.length === 0 ? '<div class="empty-state">Your cart is empty.</div>' :
          SHOP.cart.map((it, idx) => `
            <div class="cart-item">
              <div><div>${escapeHtml(it.name)}</div><div style="color:var(--muted);font-size:0.85rem">${money(it.price)} each</div></div>
              <div class="qty-controls">
                <button data-minus="${idx}" aria-label="Decrease quantity of ${escapeHtml(it.name)}">-</button>
                <span aria-label="Quantity: ${it.qty}">${it.qty}</span>
                <button data-plus="${idx}" aria-label="Increase quantity of ${escapeHtml(it.name)}">+</button>
              </div>
            </div>
          `).join('')}
        ${SHOP.cart.length > 0 ? `<div class="cart-total"><span>Total</span><span>${money(total)}</span></div>
          <button class="btn block" id="checkoutBtn">Checkout</button>` : ''}
        <button class="btn secondary block" style="margin-top:10px" id="closeCartBtn">Close</button>
      </div>
    </div>
  `;
  document.getElementById('cartDrawerBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'cartDrawerBackdrop') closeDrawer();
  });
  document.getElementById('closeCartBtn').onclick = closeDrawer;
  document.querySelectorAll('[data-minus]').forEach((b) => b.onclick = () => adjustCartQty(parseInt(b.dataset.minus, 10), -1));
  document.querySelectorAll('[data-plus]').forEach((b) => b.onclick = () => adjustCartQty(parseInt(b.dataset.plus, 10), 1));
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn) checkoutBtn.onclick = openCheckoutForm;
}
function adjustCartQty(idx, delta) {
  const it = SHOP.cart[idx];
  const p = SHOP.products.find((x) => x.id === it.productId);
  const newQty = it.qty + delta;
  if (newQty <= 0) { SHOP.cart.splice(idx, 1); }
  else if (p && newQty > p.stock) { alert('Not enough stock available.'); return; }
  else { it.qty = newQty; }
  saveCartToStorage();
  updateCartCount();
  renderCartDrawer();
}
function closeDrawer() {
  document.getElementById('drawerRoot').innerHTML = '';
}

function bankDetailsText() {
  const b = SHOP.settings.bankDetails || {};
  const lines = [
    b.accountName ? `Account Name: ${b.accountName}` : null,
    b.accountNumber ? `Account No: ${b.accountNumber}` : null,
    b.bankName ? `Bank: ${b.bankName}` : null,
    b.branch ? `Branch: ${b.branch}` : null
  ].filter(Boolean);
  return lines.length ? lines.join('\n') : 'Bank details not available yet. Please contact us on WhatsApp.';
}
function renderQr(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = '';
  try {
    const qr = qrcode(0, 'M');
    qr.addData(bankDetailsText());
    qr.make();
    target.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2 });
  } catch (e) {
    target.innerHTML = '';
  }
}

function openCheckoutForm() {
  const total = SHOP.cart.reduce((s, it) => s + it.qty * it.price, 0);
  document.getElementById('drawerRoot').innerHTML = `
    <div class="cart-drawer" id="checkoutBackdrop">
      <div class="cart-panel">
        <h2>Checkout</h2>
        <div class="field"><label for="co-name">Name</label><input id="co-name"></div>
        <div class="field"><label for="co-phone">Phone</label><input id="co-phone" type="tel" autocomplete="tel"></div>
        <div class="field"><label for="co-address">Address</label><textarea id="co-address" rows="3"></textarea></div>
        <div class="toggle-group" role="group" aria-label="Payment method">
          <button data-pay="cod" class="active" aria-pressed="true">Cash on Delivery</button>
          <button data-pay="bank" aria-pressed="false">Bank Transfer</button>
        </div>
        <div id="bankArea" class="hidden">
          <div class="qr-box"><div id="qrTarget"></div><div style="margin-top:8px;font-size:0.85rem;white-space:pre-line">${escapeHtml(bankDetailsText())}</div></div>
        </div>
        <div class="field"><label for="co-notes">Notes (optional)</label><textarea id="co-notes" rows="2"></textarea></div>
        <div class="cart-total"><span>Total</span><span>${money(total)}</span></div>
        <button class="btn block" id="placeOrderBtn">Place Order</button>
        <button class="btn secondary block" style="margin-top:10px" id="backToCartBtn">Back to Cart</button>
      </div>
    </div>
  `;
  let paymentMethod = 'cod';
  document.getElementById('checkoutBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'checkoutBackdrop') closeDrawer();
  });
  document.querySelectorAll('.toggle-group button[data-pay]').forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll('.toggle-group button[data-pay]').forEach((x) => { x.classList.remove('active'); x.setAttribute('aria-pressed', 'false'); });
      b.classList.add('active');
      b.setAttribute('aria-pressed', 'true');
      paymentMethod = b.dataset.pay;
      const bankArea = document.getElementById('bankArea');
      if (paymentMethod === 'bank') { bankArea.classList.remove('hidden'); renderQr('qrTarget'); }
      else bankArea.classList.add('hidden');
    };
  });
  document.getElementById('backToCartBtn').onclick = renderCartDrawer;
  document.getElementById('placeOrderBtn').onclick = async () => {
    const name = document.getElementById('co-name').value.trim();
    const phone = document.getElementById('co-phone').value.trim();
    const address = document.getElementById('co-address').value.trim();
    if (!name || !phone || !address) { alert('Please fill in name, phone and address.'); return; }
    const notes = document.getElementById('co-notes').value.trim();
    const placeBtn = document.getElementById('placeOrderBtn');
    placeBtn.disabled = true;
    placeBtn.textContent = 'Placing order...';
    // Fix #3/#4 (AUDIT_REPORT.md findings 3.2, 2.1): order creation — number
    // assignment and price — now happens server-side in POST /api/orders.
    // The price sent here is only a display hint; the server always re-prices
    // every line from its own product data and ignores this value if it
    // differs (see server.js /api/orders).
    let order;
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name, phone, address, notes, paymentMethod,
          items: SHOP.cart.map((it) => ({ productId: it.productId, qty: it.qty, price: it.price }))
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Could not place order. Please check your connection and try again.');
        placeBtn.disabled = false;
        placeBtn.textContent = 'Place Order';
        return;
      }
      order = data.order;
    } catch (e) {
      alert('Could not place order. Please check your connection and try again.');
      placeBtn.disabled = false;
      placeBtn.textContent = 'Place Order';
      return;
    }
    SHOP.cart = [];
    saveCartToStorage();
    updateCartCount();
    const lines = order.items.map((it) => `${it.name} x${it.qty} = ${money(it.qty * it.price)}`).join('\n');
    const waNumber = (SHOP.settings.whatsappNumber || '').replace(/\D/g, '');
    const waText = encodeURIComponent(`New order ${order.number}\nName: ${name}\nPhone: ${phone}\nAddress: ${address}\n\n${lines}\n\nTotal: ${money(order.total)}\nPayment: ${paymentMethod === 'cod' ? 'Cash on Delivery' : 'Bank Transfer'}${notes ? '\nNote: ' + notes : ''}`);
    window.open(`https://wa.me/${waNumber}?text=${waText}`, '_blank');
    closeDrawer();
    renderGrid();
    alert(`Order ${order.number} placed! We'll contact you on WhatsApp shortly.`);
  };
}

boot();
