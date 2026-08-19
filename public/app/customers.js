/* ================= CUSTOMERS ================= */
let customerSearchQuery = '';
function renderCustomers() {
  const c = document.getElementById('pageContent');
  c.innerHTML = `
    <div class="row">
      <button class="btn" id="addCustomerBtn">+ Add Customer</button>
      <button class="btn secondary" id="insightsBtn">📊 Purchase Insights</button>
    </div>
    <input id="customer-search" placeholder="Search name or phone..." value="${escapeHtml(customerSearchQuery)}" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;margin-top:10px">
    <div id="customer-list" style="margin-top:14px">${renderCustomerListHtml()}</div>
  `;
  document.getElementById('addCustomerBtn').onclick = () => openCustomerForm(null);
  document.getElementById('insightsBtn').onclick = openSegmentsModal;
  // Filters only #customer-list on each keystroke, not the whole screen —
  // same pattern as Vendors/Bills, so the search input keeps focus.
  document.getElementById('customer-search').oninput = (e) => {
    customerSearchQuery = e.target.value;
    document.getElementById('customer-list').innerHTML = renderCustomerListHtml();
    bindCustomerListEvents();
  };
  bindCustomerListEvents();
}
function renderCustomerListHtml() {
  const q = customerSearchQuery.trim().toLowerCase();
  const list = q ? STATE.customers.filter((cu) => cu.name.toLowerCase().includes(q) || (cu.phone || '').includes(customerSearchQuery.trim())) : STATE.customers;
  if (list.length === 0) return `<div class="empty-state">${STATE.customers.length === 0 ? 'No customers yet.' : 'No customers match that search.'}</div>`;
  return list.map((cu) => {
    const nextDue = cu.dues > 0 ? nextDueForCustomer(cu) : null;
    const overdue = nextDue && nextDue < todayISO();
    return `
    <div class="list-row" data-id="${cu.id}">
      <div><div class="title">${escapeHtml(cu.name)}</div><div class="sub">${escapeHtml(cu.phone || '')}${overdue ? ' · ⚠ overdue since ' + fmtDate(nextDue) : ''}</div></div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="badge ${cu.dues > 0 ? (overdue ? 'due' : 'warn') : 'ok'}">${cu.dues > 0 ? money(cu.dues) + ' due' : 'Settled'}</span>
        ${isAdmin() ? `<button class="btn small secondary" data-edit-customer="${cu.id}">Edit</button>
        <button class="btn small danger" data-delete-customer="${cu.id}">Delete</button>` : ''}
      </div>
    </div>`;
  }).join('');
}
function bindCustomerListEvents() {
  document.querySelectorAll('#customer-list .list-row').forEach((el) => el.onclick = () => openCustomerLedger(el.dataset.id));
  document.querySelectorAll('[data-edit-customer]').forEach((btn) => {
    btn.onclick = (e) => { e.stopPropagation(); openCustomerForm(btn.dataset.editCustomer); };
  });
  document.querySelectorAll('[data-delete-customer]').forEach((btn) => {
    btn.onclick = (e) => { e.stopPropagation(); deleteCustomer(btn.dataset.deleteCustomer); };
  });
}

/* ---- Purchase-behavior segmentation (rule-based, no AI) ---- */
function computeCustomerSegments() {
  const cutoff90 = addDaysISO(-90);
  const cutoff30 = addDaysISO(-30);
  const perCustomer = {};
  STATE.bills.filter((b) => b.type !== 'quote' && b.status !== 'voided' && b.customerId).forEach((b) => {
    const rec = perCustomer[b.customerId] || (perCustomer[b.customerId] = { count: 0, count90: 0, lastDate: null, catQty: {} });
    rec.count++;
    if (b.date >= cutoff90) rec.count90++;
    if (!rec.lastDate || b.date > rec.lastDate) rec.lastDate = b.date;
    (b.items || []).forEach((it) => {
      const p = STATE.products.find((x) => x.id === it.productId);
      const cat = p ? p.category : 'Other';
      rec.catQty[cat] = (rec.catQty[cat] || 0) + it.qty;
    });
  });
  const frequent = [], goneQuiet = [], prefs = [];
  STATE.customers.forEach((cu) => {
    const rec = perCustomer[cu.id];
    if (!rec) return;
    if (rec.count90 >= 3) frequent.push({ cu, count90: rec.count90 });
    if (rec.count >= 2 && rec.lastDate && rec.lastDate < cutoff30) goneQuiet.push({ cu, lastDate: rec.lastDate });
    const topCat = Object.entries(rec.catQty).sort((a, b) => b[1] - a[1])[0];
    if (topCat) prefs.push({ cu, category: topCat[0], qty: topCat[1] });
  });
  frequent.sort((a, b) => b.count90 - a.count90);
  goneQuiet.sort((a, b) => a.lastDate.localeCompare(b.lastDate));
  prefs.sort((a, b) => b.qty - a.qty);
  return { frequent, goneQuiet, prefs };
}
function draftMessageFor(cu, kind, extra) {
  const shopName = STATE.settings.shopName || 'Premium Imports LK';
  const name = cu.name.split(' ')[0];
  if (kind === 'goneQuiet') return `Hi ${name}! It's been a little while since we've seen you at ${shopName} — hope you're doing well 🙏 We've got fresh stock in and would love to have you back. Let us know if you need anything!`;
  if (kind === 'frequent') return `Hi ${name}! Just wanted to say thanks for being one of our regulars at ${shopName} 🙏 We really appreciate it — let us know if there's anything you're after.`;
  return `Hi ${name}! We just got new ${extra} stock in at ${shopName} — thought you'd want to know since that's usually your thing 😊`;
}
function openDraftMessage(cu, kind, extra) {
  const text = draftMessageFor(cu, kind, extra);
  const waNumber = (cu.phone || '').replace(/\D/g, '');
  openModal(`
    <h3>Draft message — ${escapeHtml(cu.name)}</h3>
    <p class="sub">Nothing is sent automatically. Copy it or open it in WhatsApp and send it yourself.</p>
    <textarea id="draft-text" style="min-height:110px">${escapeHtml(text)}</textarea>
    <div class="modal-actions">
      <button class="btn secondary" id="draft-copy">Copy</button>
      ${waNumber ? `<a class="btn" style="text-decoration:none" target="_blank" href="https://wa.me/${waNumber}?text=${encodeURIComponent(text)}">Open in WhatsApp</a>` : '<span class="sub">No phone number on file</span>'}
    </div>
    <button class="btn secondary block" style="margin-top:10px" id="draft-close">Close</button>
  `);
  document.getElementById('draft-close').onclick = closeModal;
  document.getElementById('draft-copy').onclick = () => {
    navigator.clipboard.writeText(document.getElementById('draft-text').value).then(() => toast('Copied')).catch(() => toast('Could not copy'));
  };
}
function openSegmentsModal() {
  const { frequent, goneQuiet, prefs } = computeCustomerSegments();
  openModal(`
    <h3>Purchase Insights</h3>
    <p class="sub" style="margin-top:-6px">Rule-based grouping from real purchase history — no AI involved.</p>
    <button class="btn small secondary" id="seg-export">Export CSV</button>
    <div class="section-title"><h3>Frequent buyers (3+ purchases in 90 days)</h3></div>
    ${frequent.length === 0 ? '<div class="empty-state">None yet.</div>' :
      frequent.map(({ cu, count90 }) => `<div class="list-row" style="cursor:default"><div><div class="title">${escapeHtml(cu.name)}</div><div class="sub">${count90} purchases in the last 90 days</div></div><button class="btn small secondary" data-draft="frequent" data-cid="${cu.id}">Draft message</button></div>`).join('')}
    <div class="section-title"><h3>Gone quiet (30+ days, used to buy regularly)</h3></div>
    ${goneQuiet.length === 0 ? '<div class="empty-state">None yet.</div>' :
      goneQuiet.map(({ cu, lastDate }) => `<div class="list-row" style="cursor:default"><div><div class="title">${escapeHtml(cu.name)}</div><div class="sub">Last bought ${fmtDate(lastDate)}</div></div><button class="btn small secondary" data-draft="goneQuiet" data-cid="${cu.id}">Draft message</button></div>`).join('')}
    <div class="section-title"><h3>Category preferences</h3></div>
    ${prefs.length === 0 ? '<div class="empty-state">None yet.</div>' :
      prefs.map(({ cu, category }) => `<div class="list-row" style="cursor:default"><div><div class="title">${escapeHtml(cu.name)}</div><div class="sub">Mostly buys ${escapeHtml(category)}</div></div><button class="btn small secondary" data-draft="category" data-cid="${cu.id}" data-cat="${escapeHtml(category)}">Draft message</button></div>`).join('')}
    <button class="btn secondary block" style="margin-top:10px" id="seg-close">Close</button>
  `);
  document.getElementById('seg-close').onclick = closeModal;
  document.getElementById('seg-export').onclick = () => {
    const rows = [['Segment', 'Customer', 'Phone', 'Detail']];
    frequent.forEach(({ cu, count90 }) => rows.push(['Frequent buyer', cu.name, cu.phone, `${count90} purchases in last 90 days`]));
    goneQuiet.forEach(({ cu, lastDate }) => rows.push(['Gone quiet', cu.name, cu.phone, `Last bought ${fmtDate(lastDate)}`]));
    prefs.forEach(({ cu, category }) => rows.push(['Category preference', cu.name, cu.phone, `Mostly buys ${category}`]));
    downloadCsv(rows, 'purchase-insights.csv');
  };
  document.querySelectorAll('[data-draft]').forEach((btn) => {
    btn.onclick = () => {
      const cu = STATE.customers.find((x) => x.id === btn.dataset.cid);
      openDraftMessage(cu, btn.dataset.draft, btn.dataset.cat);
    };
  });
}

function openCustomerForm(id) {
  const cu = id ? STATE.customers.find((x) => x.id === id) : null;
  openModal(`
    <h3>${cu ? 'Edit Customer' : 'Add Customer'}</h3>
    <div class="field"><label>Name</label><input id="cf-name" value="${cu ? escapeHtml(cu.name) : ''}"></div>
    <div class="field"><label>Phone</label><input id="cf-phone" value="${cu ? escapeHtml(cu.phone || '') : ''}"></div>
    <div class="field"><label>Address</label><input id="cf-address" value="${cu ? escapeHtml(cu.address || '') : ''}"></div>
    <div class="field"><label>Credit Limit (optional)</label><input type="number" min="0" step="0.01" id="cf-creditlimit" placeholder="Leave blank for no limit" value="${cu && cu.creditLimit ? cu.creditLimit : ''}"></div>
    <p class="sub" style="margin-top:-6px">Warns at the Sell screen if a credit sale would push this customer over the limit — doesn't block the sale, staff can still go ahead.</p>
    <div class="field"><label>Notes (internal only — never shown on bills)</label><textarea id="cf-notes" placeholder="Preferences, reminders, anything worth remembering">${cu ? escapeHtml(cu.notes || '') : ''}</textarea></div>
    <div class="modal-actions">
      <button class="btn secondary" id="cf-cancel">Cancel</button>
      <button class="btn" id="cf-save">Save</button>
      ${cu && isAdmin() ? '<button class="btn danger" id="cf-delete">Delete</button>' : ''}
    </div>
  `);
  document.getElementById('cf-cancel').onclick = closeModal;
  if (cu && isAdmin()) document.getElementById('cf-delete').onclick = () => { if (deleteCustomer(cu.id)) closeModal(); };
  document.getElementById('cf-save').onclick = async () => {
    const name = document.getElementById('cf-name').value.trim();
    if (!name) { toast('Name is required'); return; }
    const phone = document.getElementById('cf-phone').value.trim();
    const address = document.getElementById('cf-address').value.trim();
    const notes = document.getElementById('cf-notes').value.trim();
    const creditLimitRaw = parseFloat(document.getElementById('cf-creditlimit').value);
    const creditLimit = isNaN(creditLimitRaw) || creditLimitRaw < 0 ? null : creditLimitRaw;
    if (cu) Object.assign(cu, { name, phone, address, notes, creditLimit });
    else STATE.customers.push({ id: uid('C'), name, phone, address, notes, creditLimit, dues: 0, ledger: [] });
    await saveKey('customers');
    closeModal();
    renderCustomers();
  };
}
// Shared by the row's direct Delete button and the edit form's Delete
// button. Extra warning if the customer has outstanding dues, since
// deleting them also loses that ledger/dues record, not just contact info.
function deleteCustomer(id) {
  const cu = STATE.customers.find((x) => x.id === id);
  if (!cu) return false;
  const warn = cu.dues > 0 ? ` They still owe ${money(cu.dues)} — deleting them loses that record too.` : '';
  if (!confirm(`Delete ${cu.name}? This cannot be undone.${warn}`)) return false;
  STATE.customers = STATE.customers.filter((x) => x.id !== id);
  saveKey('customers').then(() => { renderCustomers(); toast('Customer deleted'); });
  return true;
}
function nextDueForCustomer(cu) {
  const dated = (cu.ledger || []).filter((l) => (l.type === 'bill' || l.type === 'memo') && l.dueDate);
  if (!dated.length) return null;
  return dated.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0].dueDate;
}
function openCustomerLedger(id) {
  const cu = STATE.customers.find((x) => x.id === id);
  if (!cu) return;
  const sorted = [...(cu.ledger || [])].sort((a, b) => b.date.localeCompare(a.date));
  const nextDue = cu.dues > 0 ? nextDueForCustomer(cu) : null;
  const overdue = nextDue && nextDue < todayISO();
  openModal(`
    <h3>${escapeHtml(cu.name)}</h3>
    <div class="sub">${escapeHtml(cu.phone || '')} · ${escapeHtml(cu.address || '')}</div>
    ${cu.notes ? `<p class="sub" style="margin-top:4px"><em>${escapeHtml(cu.notes)}</em></p>` : ''}
    <div class="card" style="margin:10px 0;display:flex;justify-content:space-between"><strong>Dues</strong><strong>${money(cu.dues)}${cu.creditLimit ? ` / ${money(cu.creditLimit)} limit` : ''}</strong></div>
    ${nextDue ? `<div class="card" style="margin:-4px 0 10px;display:flex;justify-content:space-between"><span>${overdue ? '⚠ Overdue since' : 'Next due'}</span><strong${overdue ? ' style="color:var(--red)"' : ''}>${fmtDate(nextDue)}</strong></div>` : ''}
    ${isAdmin() ? '<button class="btn small" id="cl-edit">Edit</button>' : ''}
    <button class="btn small" id="cl-pay">Record Payment</button>
    ${cu.phone ? '<button class="btn small secondary" id="cl-whatsapp">💬 WhatsApp</button>' : ''}
    <div class="section-title"><h3>Ledger</h3></div>
    ${sorted.length === 0 ? '<div class="empty-state">No transactions.</div>' :
      sorted.map((l) => `<div class="list-row" style="cursor:default"><div><div class="title">${labelForLedgerType(l.type)} ${l.ref ? '(' + l.ref + ')' : ''}${l.voided ? ' <span class="badge voided">Voided</span>' : ''}</div><div class="sub">${fmtDate(l.date)} ${l.note ? '· ' + escapeHtml(l.note) : ''}</div></div><div style="text-align:right;display:flex;align-items:center;gap:8px"><div><strong>${l.type === 'payment' ? '-' : '+'}${money(l.amount)}</strong>${l.balanceAfter !== undefined ? `<div class="sub">Bal: ${money(l.balanceAfter)}</div>` : ''}</div>${isAdmin() && l.type === 'payment' && !l.voided ? `<button class="btn small danger" data-void-payment="${l.id}">Void</button>` : ''}</div></div>`).join('')}
    <button class="btn secondary block" style="margin-top:10px" id="cl-close">Close</button>
  `);
  document.getElementById('cl-close').onclick = closeModal;
  if (isAdmin()) document.getElementById('cl-edit').onclick = () => openCustomerForm(id);
  document.getElementById('cl-pay').onclick = () => openCustomerPaymentForm(id);
  const waBtn = document.getElementById('cl-whatsapp');
  if (waBtn) waBtn.onclick = () => window.open(`https://wa.me/${cu.phone.replace(/\D/g, '')}`, '_blank');
  document.querySelectorAll('[data-void-payment]').forEach((btn) => {
    btn.onclick = () => voidCustomerPayment(id, btn.dataset.voidPayment);
  });
}
// A recorded payment had no correction mechanism at all — this reverses
// it the same way voidBillFlow/voidGrnFlow do elsewhere: a new ledger
// entry undoing the effect, the original payment entry never mutated or
// removed, just labeled voided in its own type check above.
function voidCustomerPayment(customerId, ledgerEntryId) {
  const cu = STATE.customers.find((x) => x.id === customerId);
  if (!cu) return;
  const entry = (cu.ledger || []).find((l) => l.id === ledgerEntryId);
  if (!entry || entry.type !== 'payment' || entry.voided) return;
  if (!confirm(`Void this ${money(entry.amount)} payment? This adds it back to ${cu.name}'s dues.`)) return;
  const reason = prompt('Reason (optional):') || '';
  entry.voided = true;
  cu.dues = (cu.dues || 0) + entry.amount;
  cu.ledger.push({
    id: uid('L'), type: 'void', date: todayISO(), amount: entry.amount,
    balanceAfter: cu.dues, ref: '', note: reason ? `Payment voided: ${reason}` : 'Payment voided', by: STATE.user
  });
  saveKey('customers').then(() => {
    toast('Payment voided');
    openCustomerLedger(customerId);
    renderCustomers();
  });
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

