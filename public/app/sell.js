function renderOnlineOrdersBadge() {
  const badge = document.getElementById('onlineOrdersBadge');
  const pending = STATE.orders.filter((o) => o.status === 'pending');
  if (STATE.activeTab === 'sell' && pending.length) {
    badge.classList.remove('hidden');
    badge.innerHTML = `<div class="card" style="margin-bottom:14px;border-color:var(--accent);cursor:pointer" id="pendingOrdersCard">
      <strong>${pending.length} online order${pending.length > 1 ? 's' : ''} waiting</strong> — tap to review
    </div>`;
    document.getElementById('pendingOrdersCard').onclick = showPendingOrders;
  } else {
    badge.classList.add('hidden');
    badge.innerHTML = '';
  }
}
/* ================= SELL ================= */
// SELF_SUSTAINING_ADMIN_COMMAND.md Phase 2 POS redesign: classic retail-
// terminal flow — browse and add to cart freely, no customer/payment step
// blocking item selection. Customer is optional (blank = walk-in cash
// sale) and only required at Complete Sale time for credit sales, checked
// there rather than gating the whole screen up front.
let sellCategoryFilter = 'All';
let sellCustomerQuery = '';
let sellNeedsItemFocus = false;
let sellNewCustomerFormOpen = false;
// Legacy sentinel from the old customer-first flow's "Cash Sale" picker
// entry — no longer offered as a choice (blank now means the same thing),
// kept only so held sales saved before this redesign still resume
// correctly. See resumeHeldSale().
const CASH_SALE_ID = '__cash_sale__';
// Payment methods beyond plain cash — everything except 'credit' is treated
// as paid-in-full by the server (see server.js POST /api/bills), 'credit'
// alone triggers the payment-plan/due-date/customer-ledger path. 'card',
// 'cheque', and 'online' additionally get an optional reference field.
// Which methods show and their order now come from STATE.uiConfig.pos
// (Site & POS Editor tab) — this is only the fallback if that hasn't
// loaded, same fail-open pattern as fetchUiConfig() in app.js.
const PAYMENT_METHODS_FALLBACK = [
  { id: 'cash', label: 'Cash', enabled: true },
  { id: 'card', label: 'Card', enabled: true },
  { id: 'cheque', label: 'Cheque', enabled: true },
  { id: 'bank', label: 'Bank Transfer', enabled: true },
  { id: 'online', label: 'Online Transfer', enabled: true },
  { id: 'credit', label: 'Credit', enabled: true }
];
const PAYMENT_METHODS_WITH_REF = new Set(['card', 'cheque', 'online']);
function activePaymentMethods() {
  const configured = STATE.uiConfig && STATE.uiConfig.pos && STATE.uiConfig.pos.paymentMethods;
  const list = (configured && configured.length) ? configured : PAYMENT_METHODS_FALLBACK;
  const enabled = list.filter((m) => m.enabled !== false);
  return enabled.length ? enabled : PAYMENT_METHODS_FALLBACK;
}
function posFeatureEnabled(name) {
  return !STATE.uiConfig || !STATE.uiConfig.pos || !STATE.uiConfig.pos.features || STATE.uiConfig.pos.features[name] !== false;
}

// pos-visual-hierarchy: the primary number is state-dependent. Building the
// cart, Total is what matters; the moment cash is tendered, Change Due (or
// how much short) becomes the number the cashier actually needs to act on,
// so it takes over the dominant slot and Total demotes to a small line above
// it — instead of Total staying visually primary through the whole payment
// step, which is how wrong change gets given.
function sellTotalBarPrimaryHtml() {
  const { discountAmount, total } = computeSellTotals();
  const tendered = parseFloat(STATE.sellCashTendered);
  const cashActive = STATE.sellType !== 'quote' && STATE.sellPayment === 'cash';
  const hasTender = cashActive && STATE.sellCashTendered !== '' && !isNaN(tendered);
  if (hasTender) {
    const change = tendered - total;
    const short = change < 0;
    return `
      <span>Total ${money(total)}</span>
      <strong class="cd-primary${short ? ' short' : ''}">${short ? `${money(-change)} short` : `Change due: ${money(change)}`}</strong>
    `;
  }
  return `
    ${discountAmount > 0 ? `<span>Total (after -${money(discountAmount)} discount)</span>` : '<span>Total</span>'}
    <strong>${money(total)}</strong>
  `;
}

function computeSellTotals() {
  const subtotal = STATE.sellCart.reduce((s, it) => s + it.qty * it.price, 0);
  const rawDiscount = STATE.sellDiscountType === 'percent'
    ? subtotal * ((parseFloat(STATE.sellDiscountValue) || 0) / 100)
    : (parseFloat(STATE.sellDiscountValue) || 0);
  const discountAmount = Math.max(0, Math.min(subtotal, rawDiscount));
  const total = subtotal - discountAmount;
  return { subtotal, discountAmount, total };
}

/* ---------------- Held sales ----------------
   Parks the current cart (per Ajmal's "hold the sale" request) so a second
   customer can be served without losing the first cart. Device-local
   (localStorage) — this is a single-till shop, not synced across devices,
   which is a real, deliberate scope boundary, not an oversight. */
const HELD_SALES_KEY = 'pilk_held_sales';
function loadHeldSales() {
  try { return JSON.parse(localStorage.getItem(HELD_SALES_KEY)) || []; } catch (e) { return []; }
}
function saveHeldSales(list) { localStorage.setItem(HELD_SALES_KEY, JSON.stringify(list)); }
function holdCurrentSale() {
  if (STATE.sellCart.length === 0) { toast('Cart is empty — nothing to hold'); return; }
  const customer = STATE.sellCustomerId ? STATE.customers.find((x) => x.id === STATE.sellCustomerId) : null;
  const label = customer ? customer.name : 'Walk-in / Cash Sale';
  const held = loadHeldSales();
  held.push({
    id: uid('HOLD'), heldAt: new Date().toISOString(), label,
    sellType: STATE.sellType, sellCustomerId: STATE.sellCustomerId,
    cart: STATE.sellCart, discountType: STATE.sellDiscountType, discountValue: STATE.sellDiscountValue,
    payment: STATE.sellPayment
  });
  saveHeldSales(held);
  STATE.sellCart = [];
  STATE.sellCustomerId = null;
  sellCustomerQuery = '';
  STATE.sellDiscountValue = 0;
  STATE.sellCashTendered = '';
  sellNeedsItemFocus = true;
  renderSell();
  toast('Sale held — resume it anytime from Held Sales');
}
function openHeldSalesModal() {
  const held = loadHeldSales();
  openModal(`
    <h3>Held Sales</h3>
    ${held.length === 0 ? '<div class="empty-state">No held sales right now.</div>' : held.map((h) => {
      const heldTotal = h.cart.reduce((s, it) => s + it.qty * it.price, 0);
      return `<div class="list-row">
        <div><div class="title">${escapeHtml(h.label)}</div><div class="sub">${h.cart.length} item(s) · ${money(heldTotal)} · held ${fmtDate(h.heldAt.slice(0, 10))}</div></div>
        <div style="display:flex;gap:6px">
          <button class="btn small" data-resume="${h.id}">Resume</button>
          <button class="btn small danger" data-discard="${h.id}">Discard</button>
        </div>
      </div>`;
    }).join('')}
    <button class="btn secondary block" style="margin-top:10px" id="hs-close">Close</button>
  `);
  document.getElementById('hs-close').onclick = closeModal;
  document.querySelectorAll('[data-resume]').forEach((btn) => { btn.onclick = () => resumeHeldSale(btn.dataset.resume); });
  document.querySelectorAll('[data-discard]').forEach((btn) => {
    btn.onclick = () => { saveHeldSales(loadHeldSales().filter((h) => h.id !== btn.dataset.discard)); openHeldSalesModal(); };
  });
}
function resumeHeldSale(id) {
  const held = loadHeldSales();
  const h = held.find((x) => x.id === id);
  if (!h) return;
  if (STATE.sellCart.length > 0 && !confirm('This replaces your current cart with the held sale. Continue?')) return;
  const cart = [];
  let reduced = 0, dropped = 0;
  h.cart.forEach((it) => {
    const p = STATE.products.find((x) => x.id === it.productId);
    if (!p || (p.stock || 0) <= 0) { dropped++; return; }
    const qty = Math.min(it.qty, p.stock);
    if (qty < it.qty) reduced++;
    cart.push({ productId: it.productId, name: it.name, qty, price: it.price, cost: p.costPrice });
  });
  STATE.sellCart = cart;
  STATE.sellType = h.sellType;
  // Held sales saved before the POS redesign may carry the old CASH_SALE_ID
  // sentinel — that now just means "no customer" (blank), same end state.
  STATE.sellCustomerId = h.sellCustomerId === CASH_SALE_ID ? null : h.sellCustomerId;
  STATE.sellDiscountType = h.discountType;
  STATE.sellDiscountValue = h.discountValue;
  STATE.sellPayment = h.payment;
  saveHeldSales(held.filter((x) => x.id !== id));
  closeModal();
  renderSell();
  if (dropped || reduced) toast(`Resumed — ${[dropped ? `${dropped} item(s) out of stock` : null, reduced ? `${reduced} item(s) reduced to available stock` : null].filter(Boolean).join(', ')}`);
  else toast('Sale resumed');
}

function renderSell() {
  const c = document.getElementById('pageContent');
  const cats = ['All', ...STATE.settings.categories];
  const list = STATE.products.filter((p) => (sellCategoryFilter === 'All' || p.category === sellCategoryFilter) && p.stock > 0);
  const globallyOutOfStock = !STATE.products.some((p) => (p.stock || 0) > 0);
  const customer = STATE.sellCustomerId ? STATE.customers.find((x) => x.id === STATE.sellCustomerId) : null;
  const chosenDisplay = customer ? { name: customer.name, sub: customer.phone || '' } : null;
  const { subtotal, discountAmount, total } = computeSellTotals();
  const methods = activePaymentMethods();
  if (!methods.some((m) => m.id === STATE.sellPayment)) STATE.sellPayment = methods[0].id;
  let custLabel = 'Customer (optional — leave blank for a walk-in cash sale)';
  if (!customer && STATE.sellPayment === 'credit' && STATE.sellType !== 'quote') custLabel = 'Customer — required for credit sales';
  const heldCount = loadHeldSales().length;

  c.innerHTML = `
    <div class="sell-toolbar">
      <div class="toggle-group" style="margin-bottom:0">
        <button data-type="bill" class="${STATE.sellType === 'bill' ? 'active' : ''}">Bill</button>
        <button data-type="memo" class="${STATE.sellType === 'memo' ? 'active' : ''}">Credit Memo</button>
        <button data-type="quote" class="${STATE.sellType === 'quote' ? 'active' : ''}">Quotation</button>
      </div>
      ${posFeatureEnabled('heldSales') ? `<button class="btn small secondary" id="sell-held-btn">\u{1F553} Held Sales${heldCount ? ` (${heldCount})` : ''}</button>` : ''}
      ${posFeatureEnabled('returnVoid') ? `<button class="btn small secondary" id="sell-return-btn">↺ Return / Void a Bill</button>` : ''}
    </div>
    ${globallyOutOfStock ? `<div class="empty-state">
      <div class="empty-icon">\u{1F4E6}</div>
      <div>${STATE.products.length === 0 ? 'No products yet.' : 'Nothing in stock right now.'}</div>
      ${isAdmin() ? '<button class="btn small" id="sell-empty-grn">Go to GRN to restock</button>' : ''}
    </div>` : `
    <div class="sell-split">
      <div class="sell-cat-rail" id="sell-cat-rail">
        ${cats.map((cat) => `<button data-cat="${escapeHtml(cat)}" class="${cat === sellCategoryFilter ? 'active' : ''}">${escapeHtml(cat)}</button>`).join('')}
      </div>
      <div class="sell-picker">
        <input class="sell-search-input" id="sell-search" placeholder="Search products or item code...">
        <div class="sell-grid" id="sell-product-grid">
          ${list.length === 0 ? '<div class="empty-state">No products match this category/search.</div>' : list.map((p) => `
            <div class="card sell-tile" data-id="${p.id}" data-name="${escapeHtml((p.name + ' ' + (p.itemCode || '')).toLowerCase())}" style="cursor:pointer">
              ${p.photo ? `<img class="sell-tile-photo" src="${p.photo}">` : `<div class="sell-tile-photo"></div>`}
              <div class="sell-tile-code">${escapeHtml(p.itemCode || '')}</div>
              <div class="sell-tile-name">${escapeHtml(p.name)}</div>
              <div class="sell-tile-row"><strong>${money(p.sellingPrice)}</strong><span class="badge ${p.stock <= LOW_STOCK_THRESHOLD ? 'due' : ''}">${p.stock} left</span></div>
            </div>`).join('')}
        </div>
      </div>

      <div class="sell-cart-panel">
        <div class="sell-cart-head"><h3>Cart</h3><span style="display:flex;align-items:center;gap:10px"><span class="sub">${STATE.sellCart.length} item${STATE.sellCart.length === 1 ? '' : 's'}</span>${STATE.sellCart.length ? '<button class="btn small secondary" id="sell-clear-cart">Clear</button>' : ''}</span></div>
        <div class="sell-cart-list">
          ${STATE.sellCart.length === 0 ? '<div class="empty-state">Cart is empty — tap a product to add it.</div>' :
            STATE.sellCart.map((it, idx) => {
              const prod = STATE.products.find((x) => x.id === it.productId);
              return `<div class="sell-cart-row">
              <div class="sci">
                <div class="scn">${escapeHtml(it.name)}</div>
                <div class="scc">${escapeHtml(prod ? prod.itemCode || '' : '')} · Rs.
                  ${isAdmin()
                    ? `<input type="number" min="0" step="0.01" class="cart-price-input" data-priceidx="${idx}" value="${it.price}">`
                    : `<span>${it.price}</span>`}
                  each
                </div>
              </div>
              <div class="scq">
                <button class="btn small secondary" data-qtyminus="${idx}">-</button>
                <span>${it.qty}</span>
                <button class="btn small secondary" data-qtyplus="${idx}">+</button>
              </div>
              <strong class="sca">${money(it.qty * it.price)}</strong>
              <button class="btn small secondary" data-remove="${idx}">✕</button>
            </div>`;
            }).join('')}
        </div>

        <div class="card sell-cart-footer">
          <div class="field dropdown-wrap"><label>${escapeHtml(custLabel)}</label>
            ${chosenDisplay ? '' : `<input id="sell-customer-search" placeholder="Search name or phone..." value="${escapeHtml(sellCustomerQuery)}" autocomplete="off">
            <div id="sell-customer-results" class="dropdown-panel"></div>`}
          </div>
          ${chosenDisplay ? `
            <div class="list-row" style="border-color:var(--accent)">
              <div><div class="title">${escapeHtml(chosenDisplay.name)}</div><div class="sub">${escapeHtml(chosenDisplay.sub)}</div></div>
              <button class="btn small secondary" id="sell-customer-clear">Change</button>
            </div>
          ` : ''}
          <div class="field" style="margin-top:10px"><label>Discount</label>
            <div style="display:flex;gap:8px">
              <input type="number" min="0" step="0.01" id="sell-discount-value" value="${STATE.sellDiscountValue || ''}" placeholder="0" style="flex:1">
              <div class="toggle-group" style="margin-bottom:0;width:150px">
                <button data-disc="fixed" class="${STATE.sellDiscountType === 'fixed' ? 'active' : ''}">Rs.</button>
                <button data-disc="percent" class="${STATE.sellDiscountType === 'percent' ? 'active' : ''}">%</button>
              </div>
            </div>
          </div>
          ${STATE.sellType === 'quote' ? `<p class="sub">A quotation is a shareable price estimate — it does not deduct stock or record payment.</p>` : `
            <div class="toggle-group" style="flex-wrap:wrap">
              ${methods.map((pm) => `<button data-pay="${pm.id}" class="${STATE.sellPayment === pm.id ? 'active' : ''}">${escapeHtml(pm.label)}</button>`).join('')}
            </div>
            ${PAYMENT_METHODS_WITH_REF.has(STATE.sellPayment) ? `<div class="field"><label>Reference / Cheque No. (optional)</label><input id="sell-payment-ref" value="${escapeHtml(STATE.sellPaymentRef || '')}"></div>` : ''}
            ${STATE.sellPayment === 'cash' ? `
              <div class="field"><label>Cash Tendered (optional)</label><input type="number" min="0" step="0.01" id="sell-cash-tendered" placeholder="${money(total)}" value="${STATE.sellCashTendered || ''}"></div>
              <div id="sell-change-due" class="sub" style="font-size:0.95rem"></div>
            ` : ''}
            ${STATE.sellPayment === 'bank' ? `<div class="qr-box"><div id="qrTarget"></div><div style="margin-top:8px;font-size:0.85rem;color:var(--ink-soft)">${bankDetailsText()}</div></div>` : ''}
            ${STATE.sellPayment === 'credit' ? `
              <div class="field"><label>Payment Plan</label>
                <select id="sell-payment-plan">
                  ${(STATE.settings.paymentPlans || []).map((pl, idx) => `<option value="${idx}" ${STATE.sellPaymentPlanIdx === idx ? 'selected' : ''}>${escapeHtml(pl.name)} (${pl.days === 0 ? 'due today' : `due in ${pl.days}d`})</option>`).join('')}
                </select>
              </div>
              ${customer && customer.creditLimit && (customer.dues || 0) + total > customer.creditLimit ? `
                <p class="sub" style="color:var(--red)">⚠ This sale puts ${escapeHtml(customer.name)} at ${money((customer.dues || 0) + total)}, over their ${money(customer.creditLimit)} credit limit. You can still complete the sale.</p>
              ` : ''}
            ` : ''}
          `}
          ${discountAmount > 0 ? `
            <div style="display:flex;justify-content:space-between;margin-top:10px;color:var(--ink-soft)"><span>Subtotal</span><span>${money(subtotal)}</span></div>
            <div style="display:flex;justify-content:space-between;color:var(--ink-soft)"><span>Discount</span><span>-${money(discountAmount)}</span></div>
          ` : ''}
        </div>
      </div>
    </div>
    `}
    <div class="sell-total-spacer"></div>
  `;

  const totalBarHtml = `
    <div class="sell-total-bar">
      <div class="sell-total-bar-amount" id="sellTotalBarAmount">
        ${sellTotalBarPrimaryHtml()}
      </div>
      <div style="display:flex;gap:8px">
        ${STATE.sellType !== 'quote' ? `<button class="btn secondary" id="sell-hold" ${STATE.sellCart.length === 0 ? 'disabled' : ''}>Hold</button>` : ''}
        <button class="btn" id="sell-complete" ${STATE.sellCart.length === 0 ? 'disabled' : ''}>${STATE.sellType === 'quote' ? 'Generate Quotation' : 'Complete Sale'}</button>
      </div>
    </div>`;
  document.getElementById('sellTotalBarRoot').innerHTML = totalBarHtml;

  if (STATE.sellType !== 'quote' && STATE.sellPayment === 'bank') renderQr('qrTarget', bankDetailsText());

  c.querySelectorAll('.toggle-group button[data-type]').forEach((b) => {
    b.onclick = () => { STATE.sellType = b.dataset.type; renderSell(); };
  });
  c.querySelectorAll('.toggle-group button[data-pay]').forEach((b) => {
    b.onclick = () => { STATE.sellPayment = b.dataset.pay; renderSell(); };
  });
  c.querySelectorAll('.toggle-group button[data-disc]').forEach((b) => {
    b.onclick = () => { STATE.sellDiscountType = b.dataset.disc; renderSell(); };
  });
  const discountInput = document.getElementById('sell-discount-value');
  if (discountInput) discountInput.onchange = (e) => { STATE.sellDiscountValue = parseFloat(e.target.value) || 0; renderSell(); };
  const refInput = document.getElementById('sell-payment-ref');
  if (refInput) refInput.onchange = (e) => { STATE.sellPaymentRef = e.target.value; };
  const cashInput = document.getElementById('sell-cash-tendered');
  if (cashInput) {
    const updateChangeDue = () => {
      const tendered = parseFloat(cashInput.value);
      const dueEl = document.getElementById('sell-change-due');
      if (dueEl) {
        if (isNaN(tendered) || cashInput.value === '') { dueEl.textContent = ''; }
        else {
          const change = tendered - total;
          dueEl.textContent = change >= 0 ? `Change due: ${money(change)}` : `${money(-change)} short`;
          dueEl.style.color = change >= 0 ? 'var(--ink-soft)' : 'var(--red)';
        }
      }
      // Keep the fixed total bar (the actually-dominant, always-visible
      // element) in sync live, without a full renderSell() — that would
      // blur this input mid-keystroke.
      const barAmountEl = document.getElementById('sellTotalBarAmount');
      if (barAmountEl) barAmountEl.innerHTML = sellTotalBarPrimaryHtml();
    };
    cashInput.oninput = () => { STATE.sellCashTendered = cashInput.value; updateChangeDue(); };
    updateChangeDue();
  }
  const planSelect = document.getElementById('sell-payment-plan');
  if (planSelect) planSelect.onchange = (e) => { STATE.sellPaymentPlanIdx = parseInt(e.target.value, 10) || 0; };
  c.querySelectorAll('.sell-cat-rail button').forEach((b) => {
    b.onclick = () => { sellCategoryFilter = b.dataset.cat; renderSell(); focusItemSearch(); };
  });
  const emptyGrnBtn = document.getElementById('sell-empty-grn');
  if (emptyGrnBtn) emptyGrnBtn.onclick = () => goTab('grn');
  const heldBtn = document.getElementById('sell-held-btn');
  if (heldBtn) heldBtn.onclick = openHeldSalesModal;
  const returnBtn = document.getElementById('sell-return-btn');
  if (returnBtn) returnBtn.onclick = () => openQuickLookupModal('');
  const holdBtn = document.getElementById('sell-hold');
  if (holdBtn) holdBtn.onclick = holdCurrentSale;
  const clearCartBtn = document.getElementById('sell-clear-cart');
  if (clearCartBtn) clearCartBtn.onclick = () => {
    if (!confirm('Clear all items from the cart?')) return;
    STATE.sellCart = [];
    renderSell();
  };
  const searchInput = document.getElementById('sell-search');
  if (searchInput) {
    searchInput.oninput = (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('#sell-product-grid .sell-tile').forEach((card) => {
        card.style.display = card.dataset.name.includes(q) ? '' : 'none';
      });
    };
    searchInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const visible = Array.from(document.querySelectorAll('#sell-product-grid .sell-tile')).filter((card) => card.style.display !== 'none');
      if (visible.length === 1) { addToCart(visible[0].dataset.id); e.target.value = ''; e.target.dispatchEvent(new Event('input')); }
    });
  }
  // Delegated so re-renders (adding items, filtering) never lose the tap/click binding.
  c.onclick = (e) => {
    const tile = e.target.closest('.sell-tile');
    if (tile) addToCart(tile.dataset.id);
  };
  c.querySelectorAll('[data-qtyminus]').forEach((b) => b.onclick = () => { adjustQty(parseInt(b.dataset.qtyminus, 10), -1); });
  c.querySelectorAll('[data-qtyplus]').forEach((b) => b.onclick = () => { adjustQty(parseInt(b.dataset.qtyplus, 10), 1); });
  c.querySelectorAll('[data-remove]').forEach((b) => b.onclick = () => { STATE.sellCart.splice(parseInt(b.dataset.remove, 10), 1); renderSell(); });
  c.querySelectorAll('.cart-price-input').forEach((el) => {
    el.onclick = (e) => e.stopPropagation();
    el.onchange = (e) => {
      const price = parseFloat(e.target.value);
      STATE.sellCart[parseInt(e.target.dataset.priceidx, 10)].price = isNaN(price) || price < 0 ? 0 : price;
      renderSell();
    };
  });
  setupSellCustomerField(chosenDisplay);
  document.getElementById('sell-complete').onclick = completeSale;

  if (sellNeedsItemFocus) {
    sellNeedsItemFocus = false;
    focusItemSearch();
  }
}
function focusItemSearch() {
  const el = document.getElementById('sell-search');
  if (el) el.focus();
}
function matchSellCustomers(q) {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  return STATE.customers.filter((cu) => cu.name.toLowerCase().includes(query) || (cu.phone || '').includes(q.trim()));
}
// Most-recently-billed customers, newest first, deduped — shown when the
// dropdown is opened with nothing typed yet, so repeat sales are one tap.
function recentSellCustomers(limit) {
  const seen = new Set();
  const out = [];
  const sorted = [...STATE.bills]
    .filter((b) => b.customerId)
    .sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  for (const b of sorted) {
    if (seen.has(b.customerId)) continue;
    const cu = STATE.customers.find((x) => x.id === b.customerId);
    if (!cu) continue;
    seen.add(b.customerId);
    out.push(cu);
    if (out.length >= limit) break;
  }
  return out;
}
function setupSellCustomerField(chosenDisplay) {
  sellNewCustomerFormOpen = false;
  if (chosenDisplay) {
    document.getElementById('sell-customer-clear').onclick = () => {
      STATE.sellCustomerId = null;
      sellCustomerQuery = '';
      renderSell();
      const el = document.getElementById('sell-customer-search');
      if (el) el.focus();
    };
    return;
  }
  const input = document.getElementById('sell-customer-search');
  if (!input) return;
  input.oninput = (e) => {
    sellCustomerQuery = e.target.value;
    renderSellCustomerResults(e.target.value);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = e.target.value.trim();
    if (!q) return; // customer step can no longer be skipped by pressing Enter on empty
    const results = matchSellCustomers(q);
    if (results.length === 1) { selectSellCustomer(results[0].id); return; }
    const nameInput = document.getElementById('sell-newcust-name');
    if (nameInput) nameInput.focus(); else toggleNewCustomerForm(q);
  });
  renderSellCustomerResults(sellCustomerQuery);
}
function renderSellCustomerResults(query) {
  const resultsEl = document.getElementById('sell-customer-results');
  if (!resultsEl) return;
  const q = query.trim();
  const matches = q ? matchSellCustomers(q) : recentSellCustomers(5);
  const pinnedHtml = `
    <div class="list-row" id="sell-cust-skip" style="cursor:pointer;border-color:var(--accent)"><div class="title">\u{1F4B5} Skip — walk-in / cash sale</div></div>
    <div class="list-row" id="sell-cust-addnew" style="cursor:pointer"><div class="title">+ New Customer</div></div>
    <div id="sell-cust-addnew-form"></div>`;
  const listHtml = matches.length
    ? (q ? '' : '<div class="sub" style="padding:4px 6px">Recent</div>') +
      matches.map((cu) => `<div class="list-row" data-id="${cu.id}" style="cursor:pointer"><div><div class="title">${escapeHtml(cu.name)}</div><div class="sub">${escapeHtml(cu.phone || '')}</div></div></div>`).join('')
    : (q ? '<div class="sub" style="padding:4px 6px">No match</div>' : '');
  resultsEl.innerHTML = pinnedHtml + listHtml;
  resultsEl.querySelectorAll('[data-id]').forEach((el) => {
    el.onclick = () => selectSellCustomer(el.dataset.id);
  });
  // "Skip" just leaves sellCustomerId blank (already the default — walk-in
  // cash sale) and moves focus to items, rather than setting any sentinel id.
  document.getElementById('sell-cust-skip').onclick = () => {
    sellCustomerQuery = '';
    renderSell();
    focusItemSearch();
  };
  document.getElementById('sell-cust-addnew').onclick = () => toggleNewCustomerForm(q);
  // Auto-open the add form on a typed query with zero matches (old
  // no-match behavior), on top of the persistent manual toggle above.
  if (sellNewCustomerFormOpen || (q && matches.length === 0)) renderNewCustomerForm(q);
}
function renderNewCustomerForm(prefillName) {
  const area = document.getElementById('sell-cust-addnew-form');
  if (!area) return;
  area.innerHTML = `
    <div class="list-row" style="flex-direction:column;align-items:stretch;gap:8px;cursor:default">
      <input id="sell-newcust-name" placeholder="Name" value="${escapeHtml(prefillName || '')}">
      <div style="display:flex;gap:8px">
        <input id="sell-newcust-phone" placeholder="Phone" type="tel" style="flex:1">
        <button class="btn small" id="sell-newcust-save" style="flex-shrink:0">Save</button>
      </div>
    </div>`;
  document.getElementById('sell-newcust-save').onclick = saveInlineSellCustomer;
  ['sell-newcust-name', 'sell-newcust-phone'].forEach((id) => {
    document.getElementById(id).addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      saveInlineSellCustomer();
    });
  });
}
function toggleNewCustomerForm(prefillName) {
  sellNewCustomerFormOpen = true;
  renderNewCustomerForm(prefillName);
  const nameInput = document.getElementById('sell-newcust-name');
  if (nameInput) nameInput.focus();
}
function selectSellCustomer(id) {
  STATE.sellCustomerId = id;
  sellCustomerQuery = '';
  renderSell();
  focusItemSearch();
}
async function saveInlineSellCustomer() {
  const name = document.getElementById('sell-newcust-name').value.trim();
  const phone = document.getElementById('sell-newcust-phone').value.trim();
  if (!name) { toast('Name is required'); return; }
  if (!phone) { toast('Phone is required'); return; }
  const cust = { id: uid('C'), name, phone, address: '', dues: 0, ledger: [] };
  STATE.customers.push(cust);
  await saveKey('customers');
  STATE.sellCustomerId = cust.id;
  sellCustomerQuery = '';
  renderSell();
  focusItemSearch();
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
// Fix #4 (AUDIT_REPORT.md findings 2.2, 2.3): bill creation — invoice
// numbering, stock deduction, and the credit ledger update — now happens
// atomically server-side in POST /api/bills, instead of this screen
// generating the number locally and PUTting four whole collections back
// (which is what let two near-simultaneous sales collide on the same
// invoice number or silently overwrite each other's stock changes).
async function completeSale() {
  if (STATE.sellCart.length === 0) return;
  const isQuote = STATE.sellType === 'quote';
  const customer = STATE.sellCustomerId ? STATE.customers.find((x) => x.id === STATE.sellCustomerId) : null;
  const isCashSale = !customer;
  // Only credit sales require a named customer now — everything else
  // defaults to a walk-in cash sale with no customer picked at all.
  if (!isQuote && STATE.sellPayment === 'credit' && !customer) { toast('Select a customer for credit sales'); return; }
  // error-prevention-design: a discount this size (>20% of the cart) is
  // cheap to apply by mistake (fat-finger, wrong toggle) and expensive to
  // let through silently — confirm it at the actual commit point, stating
  // the real cost, rather than a generic "Are you sure?". Quotations don't
  // move money or stock, so they're excluded.
  const { subtotal: sellSubtotal, discountAmount: sellDiscountAmount } = computeSellTotals();
  if (!isQuote && sellSubtotal > 0 && sellDiscountAmount > 0) {
    const discountPercent = (sellDiscountAmount / sellSubtotal) * 100;
    if (discountPercent > 20) {
      const ok = confirm(`This sale has a ${discountPercent.toFixed(0)}% discount (${money(sellDiscountAmount)} off ${money(sellSubtotal)}). Continue?`);
      if (!ok) return;
    }
  }
  const btn = document.getElementById('sell-complete');
  if (btn) { btn.disabled = true; btn.textContent = isQuote ? 'Generating...' : 'Saving...'; }
  const salePayload = {
    // Generated once, up front, whether this ends up going straight to
    // the server or into the offline queue — lets the server dedupe a
    // retried/re-flushed request (or an accidental double-tap) instead
    // of ever creating two bills for the same sale. See offline.js.
    clientRequestId: (crypto.randomUUID ? crypto.randomUUID() : `sale-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    type: STATE.sellType,
    customerId: customer ? customer.id : null,
    isCashSale,
    items: STATE.sellCart.map((it) => ({ productId: it.productId, qty: it.qty, price: it.price })),
    discountType: STATE.sellDiscountType, discountValue: STATE.sellDiscountValue || 0,
    paymentType: isQuote ? null : STATE.sellPayment,
    paymentRef: isQuote ? null : STATE.sellPaymentRef,
    paymentPlanIdx: STATE.sellPaymentPlanIdx,
    by: STATE.user, source: 'in-store'
  };
  // Offline-first (Sell screen only, first increment — see offline.js):
  // known offline up front, skip the doomed network round-trip and queue
  // immediately instead of waiting out a timeout. Quotations aren't
  // queued — no money/stock commitment, just retry once back online.
  if (!isQuote && !navigator.onLine) {
    await sellQueueOffline(salePayload);
    if (btn) { btn.disabled = false; btn.textContent = 'Complete Sale'; }
    return;
  }
  let bill;
  try {
    const res = await fetch('/api/bills', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(salePayload)
    });
    const data = await res.json();
    if (!res.ok) { toast(data.message || 'Could not complete sale'); return; }
    bill = data.bill;
  } catch (e) {
    // Network actually failed mid-request (not just "we knew offline
    // already" above) — e.g. WiFi dropped between tapping Complete Sale
    // and the request landing. Same queue path, not a plain error toast.
    if (!isQuote) { await sellQueueOffline(salePayload); return; }
    toast('Could not reach the server to complete the sale.');
    return;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = isQuote ? 'Generate Quotation' : 'Complete Sale'; }
  }
  // Resync from the server (authoritative bill number, stock, counters,
  // customer dues) rather than re-deriving them locally.
  const [bills, products, customers, settings] = await Promise.all([apiGet('bills'), apiGet('products'), apiGet('customers'), apiGet('settings')]);
  STATE.bills = bills; STATE.products = products; STATE.customers = customers; STATE.settings = settings;
  STATE.sellCart = [];
  STATE.sellCustomerId = null;
  sellCustomerQuery = '';
  sellNeedsItemFocus = true;
  STATE.sellDiscountValue = 0;
  STATE.sellPaymentPlanIdx = 0;
  STATE.sellPaymentRef = '';
  STATE.sellCashTendered = '';
  showReceipt(bill);
  renderSell();
  renderLivePulse();
}
// Offline capture: queues the sale (obxQueueSale, offline.js) instead of
// completing it — there is no real bill/invoice number yet, so this must
// never look like a normal completed sale. Optimistically decrements the
// local stock view so the same items don't get oversold again by this
// same device before it's back online (the server re-checks stock for
// real once the queued sale actually syncs).
async function sellQueueOffline(payload) {
  const rec = await obxQueueSale(payload);
  payload.items.forEach((it) => {
    const p = STATE.products.find((x) => x.id === it.productId);
    if (p) p.stock = Math.max(0, (p.stock || 0) - it.qty);
  });
  const total = payload.items.reduce((s, it) => s + it.qty * it.price, 0);
  STATE.sellCart = [];
  STATE.sellCustomerId = null;
  sellCustomerQuery = '';
  sellNeedsItemFocus = true;
  STATE.sellDiscountValue = 0;
  STATE.sellPaymentPlanIdx = 0;
  STATE.sellPaymentRef = '';
  STATE.sellCashTendered = '';
  renderSell();
  openModal(`
    <h3>\u{1F4F5} Saved offline</h3>
    <p class="sub">No connection right now — this sale is saved on this device
    (${payload.items.length} item(s), ${money(total)}) and will sync automatically
    once you're back online. It does not have a real bill number yet —
    that's assigned when it syncs.</p>
    <p class="sub">Reference: PENDING-${escapeHtml(rec.clientRequestId.slice(0, 8))}</p>
    <button class="btn block" id="ob-offline-close">OK</button>
  `);
  document.getElementById('ob-offline-close').onclick = closeModal;
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
  const subtotal = bill.subtotal !== undefined ? bill.subtotal : bill.total;
  const discountAmount = bill.discountAmount || 0;
  const lines = bill.items.map((it) => `*${it.name}* x${it.qty} = ${money(it.qty * it.price)}`).join('\n');
  const upsells = bill.type === 'quote' ? [] : suggestUpsellProducts(bill);
  const upsellText = upsells.length ? `\n\n✨ *You might also like* ✨\n${upsells.map((p) => `⭐ ${p.name} — ${money(p.sellingPrice)}`).join('\n')}` : '';
  const discountPercentLabel = bill.discountType === 'percent' && bill.discountValue
    ? ` (${bill.discountValue}% off)`
    : (subtotal > 0 ? ` (${Math.round((discountAmount / subtotal) * 100)}% off)` : '');
  const summaryLines = [
    discountAmount > 0 ? `Subtotal: ${money(subtotal)}` : null,
    discountAmount > 0 ? `🎉 You saved: ${money(discountAmount)}${discountPercentLabel}` : null,
    `*Total: ${money(bill.total)}*`,
    bill.paymentType ? `Payment: ${bill.paymentType}${bill.paymentRef ? ' (' + bill.paymentRef + ')' : ''}` : null,
    !bill.paymentType ? null : `Paid: ${money(bill.paid)}`,
    (bill.balanceDue || 0) > 0 ? `Balance due: ${money(bill.balanceDue)}` : null,
    bill.dueDate ? `Due: ${fmtDate(bill.dueDate)} (${bill.paymentPlan})` : null
  ].filter(Boolean).join('\n');
  const waText = encodeURIComponent(`✨ *${shopName}* ✨\n${label} ${bill.number}\nDate: ${bill.date} ${bill.time}\n\n${lines}\n\n${summaryLines}${upsellText}\n\nThank you for shopping with us! 🙏`);
  const customer = bill.customerId ? STATE.customers.find((c) => c.id === bill.customerId) : null;
  const waNumber = customer && customer.phone ? customer.phone.replace(/\D/g, '') : '';
  const preferWhatsApp = !!waNumber;
  const printBtn = `<button class="btn ${preferWhatsApp ? 'secondary' : ''}" id="rc-print">Print</button>`;
  const imgBtn = `<button class="btn secondary" id="rc-image">Bill as Image</button>`;
  const waBtn = `<a class="btn ${preferWhatsApp ? '' : 'secondary'}" style="text-decoration:none" target="_blank" href="https://wa.me/${waNumber}?text=${waText}">Share on WhatsApp</a>`;
  const voidBtn = bill.type !== 'quote' ? `<button class="btn danger" id="rc-void">Void / Return</button>` : '';
  openModal(`
    <div id="receiptPrintArea">
      <h3>${shopName}</h3>
      <div>${label.toUpperCase()} ${bill.number}</div>
      <div class="sub">${fmtDate(bill.date)} ${bill.time} · ${escapeHtml(bill.customerName)}</div>
      <table style="margin-top:10px">
        <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
        ${bill.items.map((it) => `<tr><td>${escapeHtml(it.name)}</td><td>${it.qty}</td><td>${money(it.price)}</td><td>${money(it.qty * it.price)}</td></tr>`).join('')}
      </table>
      ${discountAmount > 0 ? `
        <div style="display:flex;justify-content:space-between;margin-top:10px"><span>Subtotal</span><span>${money(subtotal)}</span></div>
        <div style="display:flex;justify-content:space-between"><span>Discount</span><span>-${money(discountAmount)}</span></div>
      ` : ''}
      <div style="display:flex;justify-content:space-between;margin-top:${discountAmount > 0 ? '0' : '10px'}"><strong>Total</strong><strong>${money(bill.total)}</strong></div>
      ${bill.paymentType ? `<div class="sub">Payment: ${bill.paymentType}${bill.paymentRef ? ' — ' + escapeHtml(bill.paymentRef) : ''} · Paid: ${money(bill.paid)}</div>` : ''}
      ${(bill.balanceDue || 0) > 0 ? `<div class="sub">Balance due: ${money(bill.balanceDue)}</div>` : ''}
      ${bill.dueDate ? `<div class="sub">Due: ${fmtDate(bill.dueDate)} (${escapeHtml(bill.paymentPlan)})</div>` : ''}
    </div>
    <div class="modal-actions" style="flex-wrap:wrap">
      ${preferWhatsApp ? waBtn + imgBtn + printBtn : imgBtn + printBtn + waBtn}
    </div>
    ${voidBtn ? `<div class="modal-actions">${voidBtn}</div>` : ''}
    <button class="btn secondary block" style="margin-top:10px" id="rc-close">Close</button>
  `);
  document.getElementById('rc-print').onclick = () => window.print();
  document.getElementById('rc-image').onclick = () => downloadBillImage(bill);
  const voidBtnEl = document.getElementById('rc-void');
  if (voidBtnEl) voidBtnEl.onclick = () => voidBillFlow(bill, () => { closeModal(); renderSell(); });
  document.getElementById('rc-close').onclick = () => {
    closeModal();
    focusItemSearch();
  };
}

/* ---------------- Bill as image (WhatsApp) ----------------
   Ajmal's own words: "not a PDF, just a picture kind of thing... put my
   logo also... rather printing, I could send him via WhatsApp." Renders
   the bill onto a canvas (shop logo, name, WhatsApp number, line items,
   totals) and produces a real JPG — via the native share sheet with the
   file attached where supported (iOS/Android Safari/Chrome), or a direct
   download to attach manually where it isn't. */
function loadImageEl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
async function buildBillCanvas(bill) {
  const shopName = STATE.settings.shopName || 'Premium Imports LK';
  const phone = STATE.settings.whatsappNumber || '';
  let logoImg = null;
  if (STATE.settings.logo) { try { logoImg = await loadImageEl(STATE.settings.logo); } catch (e) { logoImg = null; } }

  const width = 720, padX = 36, rowH = 32;
  const height = 150 + (bill.items.length * rowH) + 170;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  let y = 44;
  if (logoImg) {
    const logoSize = 56;
    ctx.drawImage(logoImg, padX, y - 34, logoSize, logoSize);
    ctx.fillStyle = '#1A1A1A'; ctx.font = '700 22px Arial';
    ctx.fillText(shopName, padX + logoSize + 14, y - 6);
    ctx.fillStyle = '#666'; ctx.font = '400 13px Arial';
    if (phone) ctx.fillText(`WhatsApp: ${phone}`, padX + logoSize + 14, y + 16);
    y += 46;
  } else {
    ctx.fillStyle = '#1A1A1A'; ctx.font = '700 24px Arial';
    ctx.fillText(shopName, padX, y);
    y += 22;
    if (phone) { ctx.fillStyle = '#666'; ctx.font = '400 13px Arial'; ctx.fillText(`WhatsApp: ${phone}`, padX, y); y += 20; }
    y += 14;
  }

  ctx.strokeStyle = '#E0E0E0'; ctx.beginPath(); ctx.moveTo(padX, y); ctx.lineTo(width - padX, y); ctx.stroke();
  y += 26;

  const label = typeLabel(bill);
  ctx.fillStyle = '#1A1A1A'; ctx.font = '700 16px Arial';
  ctx.fillText(`${label} ${bill.number || ''}`, padX, y);
  ctx.fillStyle = '#666'; ctx.font = '400 12px Arial'; ctx.textAlign = 'right';
  ctx.fillText(`${bill.date} ${bill.time || ''}`, width - padX, y);
  ctx.textAlign = 'left';
  y += 20;
  ctx.fillText(`Customer: ${bill.customerName || 'Walk-in'}`, padX, y);
  y += 22;

  ctx.strokeStyle = '#E0E0E0'; ctx.beginPath(); ctx.moveTo(padX, y); ctx.lineTo(width - padX, y); ctx.stroke();
  y += 20;

  ctx.font = '700 12px Arial'; ctx.fillStyle = '#999';
  ctx.fillText('ITEM', padX, y);
  ctx.textAlign = 'center'; ctx.fillText('QTY', width * 0.62, y);
  ctx.textAlign = 'right'; ctx.fillText('TOTAL', width - padX, y);
  ctx.textAlign = 'left';
  y += 20;

  ctx.font = '400 14px Arial';
  bill.items.forEach((it) => {
    ctx.fillStyle = '#1A1A1A';
    const name = it.name.length > 32 ? it.name.slice(0, 30) + '…' : it.name;
    ctx.fillText(name, padX, y);
    ctx.textAlign = 'center'; ctx.fillText(String(it.qty), width * 0.62, y);
    ctx.textAlign = 'right'; ctx.fillText(money(it.qty * it.price), width - padX, y);
    ctx.textAlign = 'left';
    y += rowH;
  });

  ctx.strokeStyle = '#E0E0E0'; ctx.beginPath(); ctx.moveTo(padX, y); ctx.lineTo(width - padX, y); ctx.stroke();
  y += 26;

  const subtotal = bill.subtotal !== undefined ? bill.subtotal : bill.total;
  const discountAmount = bill.discountAmount || 0;
  if (discountAmount > 0) {
    ctx.font = '400 13px Arial'; ctx.fillStyle = '#666';
    ctx.fillText('Subtotal', padX, y); ctx.textAlign = 'right'; ctx.fillText(money(subtotal), width - padX, y); ctx.textAlign = 'left';
    y += 20;
    ctx.fillText('Discount', padX, y); ctx.textAlign = 'right'; ctx.fillText('-' + money(discountAmount), width - padX, y); ctx.textAlign = 'left';
    y += 22;
  }
  ctx.font = '700 18px Arial'; ctx.fillStyle = '#1A1A1A';
  ctx.fillText('Total', padX, y); ctx.textAlign = 'right'; ctx.fillText(money(bill.total), width - padX, y); ctx.textAlign = 'left';
  y += 26;

  if (bill.paymentType) {
    ctx.font = '400 13px Arial'; ctx.fillStyle = '#666';
    ctx.fillText(`Payment: ${bill.paymentType}${bill.paymentRef ? ' (' + bill.paymentRef + ')' : ''}`, padX, y);
    y += 18;
  }
  if ((bill.balanceDue || 0) > 0) {
    ctx.fillStyle = '#B5533C';
    ctx.fillText(`Balance due: ${money(bill.balanceDue)}`, padX, y);
    y += 18;
  }

  ctx.font = 'italic 12px Arial'; ctx.fillStyle = '#999';
  ctx.fillText('Thank you for shopping with us!', padX, height - 24);

  return canvas;
}
async function downloadBillImage(bill) {
  const btn = document.getElementById('rc-image');
  if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }
  let canvas;
  try {
    canvas = await buildBillCanvas(bill);
  } catch (e) {
    toast('Could not generate the bill image');
    if (btn) { btn.disabled = false; btn.textContent = 'Bill as Image'; }
    return;
  }
  canvas.toBlob(async (blob) => {
    if (btn) { btn.disabled = false; btn.textContent = 'Bill as Image'; }
    if (!blob) { toast('Could not generate the bill image'); return; }
    const filename = `${bill.number || 'bill'}.jpg`;
    try {
      const file = new File([blob], filename, { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return;
      }
    } catch (e) { /* cancelled or unsupported — fall through to a plain download */ }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Bill image saved — attach it in WhatsApp');
  }, 'image/jpeg', 0.92);
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
    // Fix #4: same atomic server-side path as completeSale() — order.items
    // prices are already the authoritative product price at this point
    // (server-resolved when the order was placed via POST /api/orders,
    // see Fix #3), so no re-pricing is needed here, just atomic billing.
    // orderId is passed through so the server trusts these prices as-is
    // (its own record of what was resolved at order time) regardless of
    // who's confirming — see the price-gating note on POST /api/bills.
    let bill;
    try {
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          type: 'bill', customerId: null, isCashSale: true, customerName: o.customerName, orderId: o.id,
          items: o.items.map((it) => ({ productId: it.productId, qty: it.qty, price: it.price })),
          discountType: 'fixed', discountValue: 0,
          paymentType: o.paymentMethod === 'cod' ? 'cash' : 'bank',
          by: STATE.user, source: 'website'
        })
      });
      const data = await res.json();
      if (!res.ok) { toast(data.message || 'Could not confirm order'); return; }
      bill = data.bill;
    } catch (e) {
      toast('Could not reach the server.');
      return;
    }
    o.status = 'confirmed';
    const [bills, products, settings] = await Promise.all([saveKey('orders').then(() => apiGet('bills')), apiGet('products'), apiGet('settings')]);
    STATE.bills = bills; STATE.products = products; STATE.settings = settings;
    closeModal();
    renderOnlineOrdersBadge();
    toast('Order confirmed and billed');
  };
}
