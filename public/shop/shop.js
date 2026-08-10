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
}

function renderFilters() {
  const cats = ['All', ...(SHOP.settings.categories || [])];
  document.getElementById('catFilters').innerHTML = cats.map((c) =>
    `<div data-cat="${escapeHtml(c)}" class="cat${c === SHOP.categoryFilter ? ' active' : ''}">${escapeHtml(c)}</div>`
  ).join('');
  document.querySelectorAll('#catFilters .cat').forEach((b) => {
    b.onclick = () => { SHOP.categoryFilter = b.dataset.cat; renderFilters(); renderGrid(); };
  });
}

function renderGrid() {
  const grid = document.getElementById('productGrid');
  const q = SHOP.searchQuery;
  const list = SHOP.products.filter((p) =>
    (p.stock || 0) > 0 &&
    (SHOP.categoryFilter === 'All' || p.category === SHOP.categoryFilter) &&
    (!q || p.name.toLowerCase().includes(q))
  );
  if (list.length === 0) {
    grid.innerHTML = '<div class="empty-state">No products available right now. Please check back soon.</div>';
    return;
  }
  const waNumber = (SHOP.settings.whatsappNumber || '').replace(/\D/g, '');
  grid.innerHTML = list.map((p) => {
    const hasPrice = p.sellingPrice && p.sellingPrice > 0;
    const waText = encodeURIComponent(`Hi, I'm interested in "${p.name}". Can you tell me the price?`);
    return `<div class="card reveal">
      <div class="thumb">${p.photo ? `<img src="${p.photo}">` : 'photo'}</div>
      <div class="info">
        <div class="cat-tag">${escapeHtml(p.category)}</div>
        <h3>${escapeHtml(p.name)}</h3>
        <div class="row">
          ${hasPrice
            ? `<div class="price">${money(p.sellingPrice)}</div><button class="add" data-add="${p.id}">+</button>`
            : `<div class="price">Ask for Price</div><a class="ask-btn" href="https://wa.me/${waNumber}?text=${waText}" target="_blank">Ask</a>`}
        </div>
      </div>
    </div>`;
  }).join('');
  grid.querySelectorAll('[data-add]').forEach((btn) => {
    btn.onclick = () => addToCart(btn.dataset.add);
  });
  grid.querySelectorAll('.card').forEach(observeReveal);
}

function addToCart(productId) {
  const p = SHOP.products.find((x) => x.id === productId);
  if (!p) return;
  const existing = SHOP.cart.find((it) => it.productId === productId);
  const inCartQty = existing ? existing.qty : 0;
  if (inCartQty + 1 > p.stock) { alert('Not enough stock available.'); return; }
  if (existing) existing.qty += 1;
  else SHOP.cart.push({ productId: p.id, name: p.name, price: p.sellingPrice, qty: 1 });
  saveCartToStorage();
  updateCartCount();
}
function updateCartCount() {
  document.getElementById('cartCount').textContent = SHOP.cart.reduce((s, it) => s + it.qty, 0);
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
                <button data-minus="${idx}">-</button>
                <span>${it.qty}</span>
                <button data-plus="${idx}">+</button>
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
        <div class="field"><label>Name</label><input id="co-name"></div>
        <div class="field"><label>Phone</label><input id="co-phone"></div>
        <div class="field"><label>Address</label><textarea id="co-address" rows="3"></textarea></div>
        <div class="toggle-group">
          <button data-pay="cod" class="active">Cash on Delivery</button>
          <button data-pay="bank">Bank Transfer</button>
        </div>
        <div id="bankArea" class="hidden">
          <div class="qr-box"><div id="qrTarget"></div><div style="margin-top:8px;font-size:0.85rem;white-space:pre-line">${escapeHtml(bankDetailsText())}</div></div>
        </div>
        <div class="field"><label>Notes (optional)</label><textarea id="co-notes" rows="2"></textarea></div>
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
      document.querySelectorAll('.toggle-group button[data-pay]').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
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
    const order = {
      id: uid('O'), number: null, date: todayISO(), customerName: name, phone, address,
      items: SHOP.cart.map((it) => ({ productId: it.productId, name: it.name, qty: it.qty, price: it.price })),
      total, paymentMethod, status: 'pending', notes
    };
    const placeBtn = document.getElementById('placeOrderBtn');
    placeBtn.disabled = true;
    placeBtn.textContent = 'Placing order...';
    try {
      const currentOrders = await apiGet('orders');
      order.number = `ORD-${String(currentOrders.length + 1).padStart(4, '0')}`;
      currentOrders.push(order);
      await apiPut('orders', currentOrders);
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
    const waText = encodeURIComponent(`New order ${order.number}\nName: ${name}\nPhone: ${phone}\nAddress: ${address}\n\n${lines}\n\nTotal: ${money(total)}\nPayment: ${paymentMethod === 'cod' ? 'Cash on Delivery' : 'Bank Transfer'}${notes ? '\nNote: ' + notes : ''}`);
    window.open(`https://wa.me/${waNumber}?text=${waText}`, '_blank');
    closeDrawer();
    renderGrid();
    alert(`Order ${order.number} placed! We'll contact you on WhatsApp shortly.`);
  };
}

boot();
