/* Premium Imports LK - public storefront */

const SHOP = {
  settings: null,
  products: [],
  cart: [], // {productId, name, price, qty}
  categoryFilter: 'All'
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
  document.getElementById('shopTitle').textContent = SHOP.settings.shopName || 'Premium Imports LK';
  document.title = SHOP.settings.shopName || 'Premium Imports LK';
  renderFilters();
  renderGrid();
  updateCartCount();
  document.getElementById('cartBtn').onclick = openCartDrawer;
  startParticleBackground();
}

/* ---- Ambient gold particle background ---- */
function startParticleBackground() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  let width, height, particles;

  function makeParticles() {
    const count = Math.max(35, Math.min(90, Math.round((width * height) / 22000)));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 1 + Math.random() * 2.2,
      dx: (Math.random() - 0.5) * 0.18,
      dy: -0.05 - Math.random() * 0.15,
      a: 0.15 + Math.random() * 0.35
    }));
  }
  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    makeParticles();
  }
  function tick() {
    ctx.clearRect(0, 0, width, height);
    particles.forEach((p) => {
      p.x += p.dx;
      p.y += p.dy;
      if (p.x < -5) p.x = width + 5;
      if (p.x > width + 5) p.x = -5;
      if (p.y < -5) p.y = height + 5;
      if (p.y > height + 5) p.y = -5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(201, 162, 75, ${p.a})`;
      ctx.fill();
    });
    requestAnimationFrame(tick);
  }
  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(tick);
}

/* ---- Scroll-in reveal for product cards ---- */
let cardObserver = null;
function observeCardsForReveal() {
  const cards = document.querySelectorAll('.product-card.card-pending');
  if (!('IntersectionObserver' in window)) {
    cards.forEach((el) => el.classList.remove('card-pending'));
    return;
  }
  if (!cardObserver) {
    cardObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.remove('card-pending');
          entry.target.classList.add('card-in');
          cardObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
  }
  cards.forEach((el) => cardObserver.observe(el));
}

function renderFilters() {
  const cats = ['All', ...(SHOP.settings.categories || [])];
  document.getElementById('catFilters').innerHTML = cats.map((c) =>
    `<button data-cat="${escapeHtml(c)}" class="${c === SHOP.categoryFilter ? 'active' : ''}">${escapeHtml(c)}</button>`
  ).join('');
  document.querySelectorAll('#catFilters button').forEach((b) => {
    b.onclick = () => { SHOP.categoryFilter = b.dataset.cat; renderFilters(); renderGrid(); };
  });
}

function renderGrid() {
  const grid = document.getElementById('productGrid');
  const list = SHOP.products.filter((p) => (p.stock || 0) > 0 && (SHOP.categoryFilter === 'All' || p.category === SHOP.categoryFilter));
  if (list.length === 0) {
    grid.innerHTML = '<div class="empty-state">No products available right now. Please check back soon.</div>';
    return;
  }
  grid.innerHTML = list.map((p, idx) => {
    const hasPrice = p.sellingPrice && p.sellingPrice > 0;
    const waNumber = (SHOP.settings.whatsappNumber || '').replace(/\D/g, '');
    const waText = encodeURIComponent(`Hi, I'm interested in "${p.name}". Can you tell me the price?`);
    const delay = (idx % 10) * 45;
    return `<div class="product-card card-pending" style="animation-delay:${delay}ms">
      ${p.photo ? `<img class="photo" src="${p.photo}">` : `<div class="photo"></div>`}
      <div class="body">
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="cat">${escapeHtml(p.category)}</div>
        ${hasPrice
          ? `<div class="price">${money(p.sellingPrice)}</div><button data-add="${p.id}">Add to Cart</button>`
          : `<div class="price">Ask for Price</div><a class="ask" style="display:block" href="https://wa.me/${waNumber}?text=${waText}" target="_blank"><button class="ask" type="button">Ask on WhatsApp</button></a>`}
      </div>
    </div>`;
  }).join('');
  grid.querySelectorAll('[data-add]').forEach((btn) => {
    btn.onclick = () => addToCart(btn.dataset.add);
  });
  observeCardsForReveal();
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
              <div><div>${escapeHtml(it.name)}</div><div style="color:var(--ink-soft);font-size:0.85rem">${money(it.price)} each</div></div>
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
