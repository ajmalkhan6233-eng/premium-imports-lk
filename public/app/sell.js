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
let sellCategoryFilter = 'All';
let sellCustomerQuery = '';
let sellNeedsCustomerFocus = false;
let sellNewCustomerFormOpen = false;
// Sentinel id for the permanent "Cash Sale" customer-dropdown entry — not a
// real record in STATE.customers, so it can't be edited/deleted like one.
const CASH_SALE_ID = '__cash_sale__';
function computeSellTotals() {
  const subtotal = STATE.sellCart.reduce((s, it) => s + it.qty * it.price, 0);
  const rawDiscount = STATE.sellDiscountType === 'percent'
    ? subtotal * ((parseFloat(STATE.sellDiscountValue) || 0) / 100)
    : (parseFloat(STATE.sellDiscountValue) || 0);
  const discountAmount = Math.max(0, Math.min(subtotal, rawDiscount));
  const total = subtotal - discountAmount;
  return { subtotal, discountAmount, total };
}
function renderSell() {
  const c = document.getElementById('pageContent');
  const cats = ['All', ...STATE.settings.categories];
  const list = STATE.products.filter((p) => (sellCategoryFilter === 'All' || p.category === sellCategoryFilter) && p.stock > 0);
  const isCashSale = STATE.sellCustomerId === CASH_SALE_ID;
  const customer = (STATE.sellCustomerId && !isCashSale) ? STATE.customers.find((x) => x.id === STATE.sellCustomerId) : null;
  const chosenDisplay = customer ? { name: customer.name, sub: customer.phone || '' }
    : isCashSale ? { name: 'Cash Sale', sub: 'No name or phone needed' }
    : null;
  const itemsGated = !chosenDisplay;
  const { subtotal, discountAmount, total } = computeSellTotals();
  let custLabel = 'Customer';
  if (itemsGated) custLabel += ' — pick a customer or Cash Sale to continue';
  else if (isCashSale && STATE.sellPayment === 'credit' && STATE.sellType !== 'quote') custLabel += " (Cash Sale can't be used for credit — pick a named customer instead)";

  c.innerHTML = `
    <div class="toggle-group">
      <button data-type="bill" class="${STATE.sellType === 'bill' ? 'active' : ''}">Bill</button>
      <button data-type="memo" class="${STATE.sellType === 'memo' ? 'active' : ''}">Credit Memo</button>
      <button data-type="quote" class="${STATE.sellType === 'quote' ? 'active' : ''}">Quotation</button>
    </div>
    <div class="card" id="sell-customer-card">
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
    </div>
    <div class="sell-items-area${itemsGated ? ' gated' : ''}">
      <div class="pill-filters">${cats.map((cat) => `<button data-cat="${escapeHtml(cat)}" class="${cat === sellCategoryFilter ? 'active' : ''}" ${itemsGated ? 'disabled' : ''}>${escapeHtml(cat)}</button>`).join('')}</div>
      <input style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;margin-bottom:10px" id="sell-search" placeholder="Search products..." ${itemsGated ? 'disabled' : ''}>
      <div class="grid sell-grid" id="sell-product-grid">
        ${list.length === 0 ? '<div class="empty-state">No products in stock.</div>' : list.map((p) => `
          <div class="card sell-tile" data-id="${p.id}" data-name="${escapeHtml(p.name.toLowerCase())}" style="cursor:pointer">
            ${p.photo ? `<img class="sell-tile-photo" src="${p.photo}">` : `<div class="sell-tile-photo"></div>`}
            <div style="font-weight:600">${escapeHtml(p.name)}</div>
            <div class="sub" style="color:var(--ink-soft);font-size:0.85rem">${escapeHtml(p.category)}</div>
            <div style="margin-top:6px;display:flex;justify-content:space-between"><strong>${money(p.sellingPrice)}</strong><span class="badge ${p.stock <= LOW_STOCK_THRESHOLD ? 'due' : ''}">${p.stock} left${p.stock <= LOW_STOCK_THRESHOLD ? ' ⚠' : ''}</span></div>
          </div>`).join('')}
      </div>
    </div>

    <div class="section-title"><h3>Cart</h3></div>
    ${STATE.sellCart.length === 0 ? '<div class="empty-state">Cart is empty.</div>' :
      STATE.sellCart.map((it, idx) => `
      <div class="list-row">
        <div><div class="title">${escapeHtml(it.name)}</div>
          <div class="sub" style="display:flex;align-items:center;gap:4px">Rs.
            <input type="number" min="0" step="0.01" class="cart-price-input" data-priceidx="${idx}" value="${it.price}" style="width:80px;padding:2px 4px;border:1px solid var(--line);border-radius:4px">
            each
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <button class="btn small secondary" data-qtyminus="${idx}">-</button>
          <span>${it.qty}</span>
          <button class="btn small secondary" data-qtyplus="${idx}">+</button>
          <strong style="min-width:90px;text-align:right">${money(it.qty * it.price)}</strong>
          <button class="btn small secondary" data-remove="${idx}">✕</button>
        </div>
      </div>`).join('')}

    <div class="card" style="margin-top:10px">
      <div class="field"><label>Discount</label>
        <div style="display:flex;gap:8px">
          <input type="number" min="0" step="0.01" id="sell-discount-value" value="${STATE.sellDiscountValue || ''}" placeholder="0" style="flex:1">
          <div class="toggle-group" style="margin-bottom:0;width:150px">
            <button data-disc="fixed" class="${STATE.sellDiscountType === 'fixed' ? 'active' : ''}">Rs.</button>
            <button data-disc="percent" class="${STATE.sellDiscountType === 'percent' ? 'active' : ''}">%</button>
          </div>
        </div>
      </div>
      ${STATE.sellType === 'quote' ? `<p class="sub">A quotation is a shareable price estimate — it does not deduct stock or record payment.</p>` : `
        <div class="toggle-group">
          <button data-pay="cash" class="${STATE.sellPayment === 'cash' ? 'active' : ''}">Cash</button>
          <button data-pay="bank" class="${STATE.sellPayment === 'bank' ? 'active' : ''}">Bank</button>
          <button data-pay="credit" class="${STATE.sellPayment === 'credit' ? 'active' : ''}">Credit</button>
        </div>
        ${STATE.sellPayment === 'bank' ? `<div class="qr-box"><div id="qrTarget"></div><div style="margin-top:8px;font-size:0.85rem;color:var(--ink-soft)">${bankDetailsText()}</div></div>` : ''}
        ${STATE.sellPayment === 'credit' ? `
          <div class="field"><label>Payment Plan</label>
            <select id="sell-payment-plan">
              ${(STATE.settings.paymentPlans || []).map((pl, idx) => `<option value="${idx}" ${STATE.sellPaymentPlanIdx === idx ? 'selected' : ''}>${escapeHtml(pl.name)} (${pl.days === 0 ? 'due today' : `due in ${pl.days}d`})</option>`).join('')}
            </select>
          </div>
        ` : ''}
      `}
      ${discountAmount > 0 ? `
        <div style="display:flex;justify-content:space-between;margin-top:10px;color:var(--ink-soft)"><span>Subtotal</span><span>${money(subtotal)}</span></div>
        <div style="display:flex;justify-content:space-between;color:var(--ink-soft)"><span>Discount</span><span>-${money(discountAmount)}</span></div>
      ` : ''}
    </div>
    <div class="sell-total-spacer"></div>
  `;

  const totalBarHtml = `
    <div class="sell-total-bar">
      <div class="sell-total-bar-amount">
        ${discountAmount > 0 ? `<span>Total (after -${money(discountAmount)} discount)</span>` : '<span>Total</span>'}
        <strong>${money(total)}</strong>
      </div>
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
  c.querySelectorAll('.toggle-group button[data-disc]').forEach((b) => {
    b.onclick = () => { STATE.sellDiscountType = b.dataset.disc; renderSell(); };
  });
  document.getElementById('sell-discount-value').onchange = (e) => {
    STATE.sellDiscountValue = parseFloat(e.target.value) || 0;
    renderSell();
  };
  const planSelect = document.getElementById('sell-payment-plan');
  if (planSelect) planSelect.onchange = (e) => { STATE.sellPaymentPlanIdx = parseInt(e.target.value, 10) || 0; };
  c.querySelectorAll('.pill-filters button').forEach((b) => {
    b.onclick = () => { sellCategoryFilter = b.dataset.cat; renderSell(); };
  });
  document.getElementById('sell-search').oninput = (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#sell-product-grid .sell-tile').forEach((card) => {
      card.style.display = card.dataset.name.includes(q) ? '' : 'none';
    });
  };
  document.getElementById('sell-search').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const visible = Array.from(document.querySelectorAll('#sell-product-grid .sell-tile')).filter((card) => card.style.display !== 'none');
    if (visible.length === 1) { addToCart(visible[0].dataset.id); e.target.value = ''; e.target.dispatchEvent(new Event('input')); }
  });
  // Delegated so re-renders (adding items, filtering) never lose the tap/click binding.
  // itemsGated also guards here in case CSS pointer-events is bypassed (e.g. touch).
  c.onclick = (e) => {
    if (itemsGated) return;
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

  if (sellNeedsCustomerFocus) {
    sellNeedsCustomerFocus = false;
    const el = document.getElementById('sell-customer-search');
    if (el) el.focus(); else focusItemSearch();
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
    <div class="list-row" id="sell-cust-cashsale" style="cursor:pointer;border-color:var(--accent)"><div class="title">\u{1F4B5} Cash Sale</div></div>
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
  document.getElementById('sell-cust-cashsale').onclick = () => selectSellCustomer(CASH_SALE_ID);
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
      <input id="sell-newcust-phone" placeholder="Phone" type="tel">
      <button class="btn small" id="sell-newcust-save">Save & Select</button>
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
  if (!STATE.sellCustomerId) return; // gate: customer or Cash Sale must be chosen first
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
function nextBillNumber() {
  return nextNumber('bill', 'INV', STATE.settings.startingBillNumber);
}
async function completeSale() {
  if (STATE.sellCart.length === 0) return;
  const isQuote = STATE.sellType === 'quote';
  const isCashSale = STATE.sellCustomerId === CASH_SALE_ID;
  const customer = (STATE.sellCustomerId && !isCashSale) ? STATE.customers.find((x) => x.id === STATE.sellCustomerId) : null;
  // Mirrors the item-area gate as a safety net in case it's ever bypassed.
  if (!customer && !isCashSale) { toast('Select a customer or Cash Sale first'); return; }
  if (!isQuote && STATE.sellPayment === 'credit' && !customer) { toast('Select a named customer for credit sales'); return; }
  const { subtotal, discountAmount, total } = computeSellTotals();
  const isCredit = !isQuote && STATE.sellPayment === 'credit';
  const plan = isCredit ? (STATE.settings.paymentPlans || [])[STATE.sellPaymentPlanIdx] : null;
  const dueDate = plan ? addDaysISO(plan.days) : null;
  const bill = {
    id: uid('B'),
    number: isQuote ? nextNumber('quote', 'QUO') : nextBillNumber(),
    type: STATE.sellType,
    date: todayISO(), time: nowTimeStr(),
    customerId: customer ? customer.id : null, customerName: customer ? customer.name : (isCashSale ? 'Cash Sale' : 'Walk-in'),
    items: STATE.sellCart.map((it) => ({ productId: it.productId, name: it.name, qty: it.qty, price: it.price, cost: it.cost })),
    subtotal, discountType: STATE.sellDiscountType, discountValue: STATE.sellDiscountValue || 0, discountAmount,
    total,
    paymentType: isQuote ? null : STATE.sellPayment,
    paid: isQuote ? 0 : (STATE.sellPayment === 'credit' ? 0 : total),
    balanceDue: isQuote ? 0 : (STATE.sellPayment === 'credit' ? total : 0),
    paymentPlan: plan ? plan.name : null, dueDate,
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
      customer.ledger.push({ id: uid('L'), type: bill.type, date: bill.date, amount: total, balanceAfter: customer.dues, ref: bill.number, note: '', dueDate, by: STATE.user });
    }
  }
  await Promise.all([
    saveKey('bills'),
    saveKey('settings'),
    isQuote ? Promise.resolve() : saveKey('products'),
    (!isQuote && customer) ? saveKey('customers') : Promise.resolve()
  ]);
  STATE.sellCart = [];
  STATE.sellCustomerId = null;
  sellCustomerQuery = '';
  sellNeedsCustomerFocus = true;
  STATE.sellDiscountValue = 0;
  STATE.sellPaymentPlanIdx = 0;
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
    bill.paymentType ? `Payment: ${bill.paymentType}` : null,
    !bill.paymentType ? null : `Paid: ${money(bill.paid)}`,
    (bill.balanceDue || 0) > 0 ? `Balance due: ${money(bill.balanceDue)}` : null,
    bill.dueDate ? `Due: ${fmtDate(bill.dueDate)} (${bill.paymentPlan})` : null
  ].filter(Boolean).join('\n');
  const waText = encodeURIComponent(`✨ *${shopName}* ✨\n${label} ${bill.number}\nDate: ${bill.date} ${bill.time}\n\n${lines}\n\n${summaryLines}${upsellText}\n\nThank you for shopping with us! 🙏`);
  const customer = bill.customerId ? STATE.customers.find((c) => c.id === bill.customerId) : null;
  const waNumber = customer && customer.phone ? customer.phone.replace(/\D/g, '') : '';
  const preferWhatsApp = !!waNumber;
  const printBtn = `<button class="btn ${preferWhatsApp ? 'secondary' : ''}" id="rc-print">Print / Save PDF</button>`;
  const waBtn = `<a class="btn ${preferWhatsApp ? '' : 'secondary'}" style="text-decoration:none" target="_blank" href="https://wa.me/${waNumber}?text=${waText}">Share on WhatsApp</a>`;
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
      ${bill.paymentType ? `<div class="sub">Payment: ${bill.paymentType} · Paid: ${money(bill.paid)}</div>` : ''}
      ${(bill.balanceDue || 0) > 0 ? `<div class="sub">Balance due: ${money(bill.balanceDue)}</div>` : ''}
      ${bill.dueDate ? `<div class="sub">Due: ${fmtDate(bill.dueDate)} (${escapeHtml(bill.paymentPlan)})</div>` : ''}
    </div>
    <div class="modal-actions">
      ${preferWhatsApp ? waBtn + printBtn : printBtn + waBtn}
    </div>
    <button class="btn secondary block" style="margin-top:10px" id="rc-close">Close</button>
  `);
  document.getElementById('rc-print').onclick = () => window.print();
  document.getElementById('rc-close').onclick = () => {
    closeModal();
    const el = document.getElementById('sell-customer-search');
    if (el) el.focus(); else focusItemSearch();
  };
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
    await Promise.all([saveKey('bills'), saveKey('settings'), saveKey('products'), saveKey('orders')]);
    closeModal();
    renderOnlineOrdersBadge();
    toast('Order confirmed and billed');
  };
}

