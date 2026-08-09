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
/* ================= SELL ================= */
let sellCategoryFilter = 'All';
let sellScanSuggestions = [];
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
  const customer = STATE.sellCustomerId ? STATE.customers.find((x) => x.id === STATE.sellCustomerId) : null;
  const { subtotal, discountAmount, total } = computeSellTotals();

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
  const { subtotal, discountAmount, total } = computeSellTotals();
  const customer = STATE.sellCustomerId ? STATE.customers.find((x) => x.id === STATE.sellCustomerId) : null;
  const isCredit = !isQuote && STATE.sellPayment === 'credit';
  const plan = isCredit ? (STATE.settings.paymentPlans || [])[STATE.sellPaymentPlanIdx] : null;
  const dueDate = plan ? addDaysISO(plan.days) : null;
  const bill = {
    id: uid('B'),
    number: isQuote ? nextNumber(STATE.bills.filter((b) => b.type === 'quote'), 'QUO') : nextBillNumber(),
    type: STATE.sellType,
    date: todayISO(), time: nowTimeStr(),
    customerId: customer ? customer.id : null, customerName: customer ? customer.name : 'Walk-in',
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
    isQuote ? Promise.resolve() : saveKey('products'),
    (!isQuote && customer) ? saveKey('customers') : Promise.resolve()
  ]);
  STATE.sellCart = [];
  STATE.sellCustomerId = null;
  STATE.sellDiscountValue = 0;
  STATE.sellPaymentPlanIdx = 0;
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
  const subtotal = bill.subtotal !== undefined ? bill.subtotal : bill.total;
  const discountAmount = bill.discountAmount || 0;
  const lines = bill.items.map((it) => `*${it.name}* x${it.qty} = ${money(it.qty * it.price)}`).join('\n');
  const upsells = bill.type === 'quote' ? [] : suggestUpsellProducts(bill);
  const upsellText = upsells.length ? `\n\n✨ *You might also like* ✨\n${upsells.map((p) => `⭐ ${p.name} — ${money(p.sellingPrice)}`).join('\n')}` : '';
  const summaryLines = [
    discountAmount > 0 ? `Subtotal: ${money(subtotal)}` : null,
    discountAmount > 0 ? `Discount: -${money(discountAmount)}` : null,
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

