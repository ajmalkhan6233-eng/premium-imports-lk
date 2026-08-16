/* ================= GRN ================= */
// Fails open (true) if uiConfig hasn't loaded yet — see app.js fetchUiConfig.
function grnPhotoScanEnabled() {
  return !STATE.uiConfig || !STATE.uiConfig.pos || !STATE.uiConfig.pos.features || STATE.uiConfig.pos.features.grnPhotoScan !== false;
}
let grnDraft = null;
let grnHistoryQuery = '';
function renderGRN() {
  if (!grnDraft) grnDraft = { vendorId: null, vendorName: '', invoiceNumber: '', discount: 0, items: [], aiSuggestions: [], attachment: null };
  if (!grnDraft.aiSuggestions) grnDraft.aiSuggestions = [];
  const c = document.getElementById('pageContent');
  const subtotal = grnDraft.items.reduce((s, it) => s + it.qty * it.cost, 0);
  const discount = parseFloat(grnDraft.discount) || 0;
  const total = Math.max(0, subtotal - discount);
  c.innerHTML = `
    <div class="card">
      <div class="field"><label>Vendor</label>
        <select id="grn-vendor">
          <option value="">— Select vendor —</option>
          ${STATE.vendors.map((v) => `<option value="${v.id}" ${grnDraft.vendorId === v.id ? 'selected' : ''}>${escapeHtml(v.name)}</option>`).join('')}
          <option value="__new__">+ Add new vendor</option>
        </select>
      </div>
      <div class="field"><label>Invoice number</label><input id="grn-invoice-number" placeholder="From the supplier's paper invoice" value="${escapeHtml(grnDraft.invoiceNumber || '')}"></div>
      <div class="field">
        <label>Supplier invoice attachment (optional — fallback alongside Scan Photo)</label>
        ${grnDraft.attachment ? `
          <div class="list-row" style="cursor:default">
            <div><div class="title">${escapeHtml(grnDraft.attachment.filename)}</div><div class="sub">Attached</div></div>
            <div style="display:flex;gap:8px">
              <a class="btn small secondary" style="text-decoration:none" href="${grnDraft.attachment.dataUrl}" download="${escapeHtml(grnDraft.attachment.filename)}">View</a>
              <button class="btn small danger" id="grn-attachment-remove">Remove</button>
            </div>
          </div>
        ` : `<button class="btn small secondary" id="grn-attachment-btn">\u{1F4CE} Attach Photo / PDF</button>`}
        <input type="file" accept="image/*,application/pdf" id="grn-attachment-input" class="hidden">
      </div>
    </div>
    <div class="section-title"><h3>Items</h3>
      <div style="display:flex;gap:8px">
        ${grnPhotoScanEnabled() ? '<button class="btn small secondary" id="grn-scan-photo">📷 Scan Photo</button>' : ''}
        <button class="btn small" id="grn-add-item">+ Add Line</button>
      </div>
    </div>
    <input type="file" accept="image/*" capture="environment" id="grn-scan-input" class="hidden">
    ${grnDraft.aiSuggestions.length === 0 ? '' : `
      <div class="section-title"><h3 style="color:var(--accent-dark)">AI suggested — check before saving</h3></div>
      ${grnDraft.aiSuggestions.map((s, idx) => `
        <div class="list-row" data-ai-review="${idx}" style="border-color:var(--accent)">
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
    ${grnDraft.items.length === 0 ? '<div class="empty-state"><div class="empty-icon">\u{1F4E5}</div><div>No items added yet — scan a photo or add a line above.</div></div>' :
      grnDraft.items.map((it, idx) => {
        const last = findLastVendorPrice(grnDraft.vendorId, it.productId);
        const priceFlag = last && last.cost !== it.cost
          ? `<div class="sub" style="color:${it.cost > last.cost ? 'var(--red)' : 'var(--green)'}">${it.cost > last.cost ? '▲' : '▼'} was ${money(last.cost)} last time</div>`
          : '';
        return `
        <div class="list-row" data-edit-idx="${idx}"><div><div class="title">${escapeHtml(it.name)}</div><div class="sub">${escapeHtml(it.category || '')} · ${it.qty} × ${money(it.cost)}</div>${priceFlag}</div>
        <div style="display:flex;align-items:center;gap:10px"><strong>${money(it.qty * it.cost)}</strong><button class="btn small secondary" data-idx="${idx}">Remove</button></div></div>
      `;
      }).join('')}
    <div class="card" style="margin-top:14px">
      <div class="field"><label>Discount given on invoice (Rs.)</label><input type="number" min="0" step="0.01" id="grn-discount" value="${grnDraft.discount || ''}" placeholder="0"></div>
      <div style="display:flex;justify-content:space-between;color:var(--ink-soft)"><span>Subtotal</span><span>${money(subtotal)}</span></div>
      ${discount > 0 ? `<div style="display:flex;justify-content:space-between;color:var(--ink-soft)"><span>Discount</span><span>-${money(discount)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;margin-top:6px"><strong>Invoice total</strong><strong>${money(total)}</strong></div>
      <p class="sub">Check this matches the paper invoice before saving.</p>
    </div>
    <button class="btn" style="margin-top:14px" id="grn-save" ${grnDraft.items.length === 0 ? 'disabled' : ''}>Save GRN</button>

    <div class="section-title"><h3>Recent GRNs</h3></div>
    <input id="grn-history-search" placeholder="Search by vendor or invoice number..." value="${escapeHtml(grnHistoryQuery)}" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;margin-bottom:10px">
    <div id="grn-history-list">${renderGrnHistoryList()}</div>
  `;
  const attachBtn = document.getElementById('grn-attachment-btn');
  if (attachBtn) attachBtn.onclick = () => document.getElementById('grn-attachment-input').click();
  const attachRemoveBtn = document.getElementById('grn-attachment-remove');
  if (attachRemoveBtn) attachRemoveBtn.onclick = () => { grnDraft.attachment = null; renderGRN(); };
  document.getElementById('grn-attachment-input').onchange = handleGrnAttachmentFile;
  document.getElementById('grn-history-search').oninput = (e) => {
    grnHistoryQuery = e.target.value;
    document.getElementById('grn-history-list').innerHTML = renderGrnHistoryList();
    bindGrnHistoryEvents();
  };
  bindGrnHistoryEvents();
  document.getElementById('grn-vendor').onchange = (e) => {
    const val = e.target.value;
    if (val === '__new__') { e.target.value = grnDraft.vendorId || ''; openQuickAddVendor(); return; }
    const v = STATE.vendors.find((x) => x.id === val);
    grnDraft.vendorId = v ? v.id : null;
    grnDraft.vendorName = v ? v.name : '';
  };
  document.getElementById('grn-invoice-number').onchange = (e) => { grnDraft.invoiceNumber = e.target.value.trim(); };
  document.getElementById('grn-discount').onchange = (e) => {
    grnDraft.discount = parseFloat(e.target.value) || 0;
    renderGRN();
  };
  document.getElementById('grn-add-item').onclick = openGrnLineForm;
  const grnScanBtn = document.getElementById('grn-scan-photo');
  if (grnScanBtn) grnScanBtn.onclick = startGrnScan;
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
      const res = await fetch('/api/grn-scan/status', { headers: authHeaders() });
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
        headers: authHeaders({ 'Content-Type': 'application/json' }),
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
// Attachment is a fallback alongside the AI Scan Photo flow — this just
// captures and previews the raw file (image or PDF); it's attached to the
// GRN record as-is when Save GRN is pressed (see saveGrn()), it doesn't try
// to read line items out of it the way Scan Photo does.
function handleGrnAttachmentFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const isImage = file.type.startsWith('image/');
  if (!isImage && file.type !== 'application/pdf') { toast('Only images or PDF files are supported'); e.target.value = ''; return; }
  if (file.size > 8 * 1024 * 1024) { toast('File is too large (max 8MB)'); e.target.value = ''; return; }
  const finish = (dataUrl) => {
    grnDraft.attachment = { filename: file.name, dataUrl, mediaType: file.type };
    renderGRN();
  };
  if (isImage) compressImage(file, 1600, finish);
  else readFileAsDataUrl(file, finish);
  e.target.value = '';
}

function renderGrnHistoryList() {
  const q = grnHistoryQuery.trim().toLowerCase();
  const sorted = [...STATE.grns].sort((a, b) => b.date.localeCompare(a.date));
  const filtered = q ? sorted.filter((g) => `${g.vendorName} ${g.invoiceNumber}`.toLowerCase().includes(q)) : sorted;
  if (filtered.length === 0) {
    return `<div class="empty-state">
      <div class="empty-icon">\u{1F4E5}</div>
      <div>${STATE.grns.length === 0 ? 'No GRNs recorded yet.' : 'No GRNs match that search.'}</div>
    </div>`;
  }
  return filtered.map((g) => `
    <div class="list-row" data-grn-id="${g.id}">
      <div><div class="title">${escapeHtml(g.number)}${g.invoiceNumber ? ' — Invoice ' + escapeHtml(g.invoiceNumber) : ''}${g.attachment ? ' \u{1F4CE}' : ''}</div>
        <div class="sub">${escapeHtml(g.vendorName)} · ${fmtDate(g.date)} · ${g.items.length} item(s)</div></div>
      <strong class="mono">${money(g.total)}</strong>
    </div>`).join('');
}
function bindGrnHistoryEvents() {
  document.querySelectorAll('#grn-history-list [data-grn-id]').forEach((row) => {
    row.onclick = () => openGrnHistoryDetail(row.dataset.grnId);
  });
}
function openGrnHistoryDetail(id) {
  const g = STATE.grns.find((x) => x.id === id);
  if (!g) return;
  openModal(`
    <h3>${escapeHtml(g.number)}</h3>
    <div class="sub">${escapeHtml(g.vendorName)} · ${fmtDate(g.date)}${g.invoiceNumber ? ' · Invoice ' + escapeHtml(g.invoiceNumber) : ''}</div>
    <table style="margin-top:10px">
      <tr><th>Item</th><th>Qty</th><th>Cost</th></tr>
      ${g.items.map((it) => `<tr><td>${escapeHtml(it.name)}</td><td>${it.qty}</td><td>${money(it.cost)}</td></tr>`).join('')}
    </table>
    <div style="display:flex;justify-content:space-between;margin-top:10px"><strong>Total</strong><strong>${money(g.total)}</strong></div>
    ${g.attachment ? `<a class="btn secondary block" style="margin-top:10px;text-decoration:none" href="${g.attachment.dataUrl}" download="${escapeHtml(g.attachment.filename)}">\u{1F4CE} View Attachment</a>` : ''}
    <button class="btn secondary block" style="margin-top:10px" id="gh-close">Close</button>
  `);
  document.getElementById('gh-close').onclick = closeModal;
}
// Last price this vendor actually charged for this product, from real GRN
// history — so a price change is something Ajmal notices, not something he
// has to remember.
function findLastVendorPrice(vendorId, productId) {
  if (!vendorId) return null;
  const matches = STATE.grns
    .filter((g) => g.vendorId === vendorId)
    .flatMap((g) => (g.items || []).filter((it) => it.productId === productId).map((it) => ({ cost: it.cost, date: g.date, number: g.number })))
    .sort((a, b) => b.date.localeCompare(a.date));
  return matches[0] || null;
}
function openGrnQtyCost(product) {
  const last = findLastVendorPrice(grnDraft.vendorId, product.id);
  openModal(`
    <h3>${escapeHtml(product.name)}</h3>
    ${last ? `<p class="sub" style="margin-top:-6px">Last paid this vendor: ${money(last.cost)} (${escapeHtml(last.number)}, ${fmtDate(last.date)})</p>` : ''}
    <div class="row">
      <div class="field"><label>Qty received</label><input type="number" id="gq-qty" value="1"></div>
      <div class="field"><label>Cost Price</label><input type="number" step="0.01" id="gq-cost" value="${product.costPrice || ''}"></div>
    </div>
    <p class="sub" id="gq-price-flag"></p>
    <button class="btn" id="gq-add">Add to GRN</button>
  `);
  const updateFlag = () => {
    const el = document.getElementById('gq-price-flag');
    if (!last) { el.textContent = ''; return; }
    const cost = parseFloat(document.getElementById('gq-cost').value) || 0;
    if (cost === last.cost) { el.textContent = ''; el.style.color = ''; return; }
    const higher = cost > last.cost;
    el.style.color = higher ? 'var(--red)' : 'var(--green)';
    el.textContent = `${higher ? '▲' : '▼'} ${higher ? 'Rs. ' + (cost - last.cost).toFixed(2) + ' higher' : 'Rs. ' + (last.cost - cost).toFixed(2) + ' lower'} than last time`;
  };
  if (last) { document.getElementById('gq-cost').oninput = updateFlag; updateFlag(); }
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
// Fix #4 (AUDIT_REPORT.md finding 2.3): GRN numbering, stock increment, and
// the vendor ledger update now happen atomically server-side in
// POST /api/grns instead of this screen generating the GRN number locally
// and PUTting four whole collections back.
async function saveGrn() {
  if (!grnDraft.vendorId) { toast('Select a vendor'); return; }
  if (!grnDraft.invoiceNumber || !grnDraft.invoiceNumber.trim()) { toast('Invoice number is required'); return; }
  const saveBtn = document.getElementById('grn-save');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
  try {
    const res = await fetch('/api/grns', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        vendorId: grnDraft.vendorId, invoiceNumber: grnDraft.invoiceNumber.trim(),
        items: grnDraft.items.map((it) => ({ productId: it.productId, qty: it.qty, cost: it.cost })),
        discount: grnDraft.discount || 0, by: STATE.user, attachment: grnDraft.attachment || null
      })
    });
    const data = await res.json();
    if (!res.ok) { toast(data.message || 'Could not save GRN'); return; }
  } catch (e) {
    toast('Could not reach the server to save the GRN.');
    return;
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save GRN'; }
  }
  const [grns, products, vendors] = await Promise.all([apiGet('grns'), apiGet('products'), apiGet('vendors')]);
  STATE.grns = grns; STATE.products = products; STATE.vendors = vendors;
  grnDraft = null;
  toast('GRN saved, stock updated');
  renderGRN();
}

