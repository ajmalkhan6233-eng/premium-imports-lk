/* ================= GRN ================= */
let grnDraft = null;
function renderGRN() {
  if (!grnDraft) grnDraft = { vendorId: null, vendorName: '', items: [], aiSuggestions: [] };
  if (!grnDraft.aiSuggestions) grnDraft.aiSuggestions = [];
  const c = document.getElementById('pageContent');
  const total = grnDraft.items.reduce((s, it) => s + it.qty * it.cost, 0);
  c.innerHTML = `
    <div class="card">
      <div class="field"><label>Vendor</label>
        <select id="grn-vendor">
          <option value="">— Select vendor —</option>
          ${STATE.vendors.map((v) => `<option value="${v.id}" ${grnDraft.vendorId === v.id ? 'selected' : ''}>${escapeHtml(v.name)}</option>`).join('')}
          <option value="__new__">+ Add new vendor</option>
        </select>
      </div>
    </div>
    <div class="section-title"><h3>Items</h3>
      <div style="display:flex;gap:8px">
        <button class="btn small secondary" id="grn-scan-photo">📷 Scan Photo</button>
        <button class="btn small" id="grn-add-item">+ Add Line</button>
      </div>
    </div>
    <input type="file" accept="image/*" capture="environment" id="grn-scan-input" class="hidden">
    ${grnDraft.aiSuggestions.length === 0 ? '' : `
      <div class="section-title"><h3 style="color:var(--gold-dark)">AI suggested — check before saving</h3></div>
      ${grnDraft.aiSuggestions.map((s, idx) => `
        <div class="list-row" data-ai-review="${idx}" style="border-color:var(--gold)">
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
    ${grnDraft.items.length === 0 ? '<div class="empty-state">No items added yet.</div>' :
      grnDraft.items.map((it, idx) => `
        <div class="list-row" data-edit-idx="${idx}"><div><div class="title">${escapeHtml(it.name)}</div><div class="sub">${escapeHtml(it.category || '')} · ${it.qty} × ${money(it.cost)}</div></div>
        <div style="display:flex;align-items:center;gap:10px"><strong>${money(it.qty * it.cost)}</strong><button class="btn small secondary" data-idx="${idx}">Remove</button></div></div>
      `).join('')}
    <div class="card" style="margin-top:14px"><div style="display:flex;justify-content:space-between"><strong>Total</strong><strong>${money(total)}</strong></div></div>
    <button class="btn block" style="margin-top:14px" id="grn-save" ${grnDraft.items.length === 0 ? 'disabled' : ''}>Save GRN</button>
  `;
  document.getElementById('grn-vendor').onchange = (e) => {
    const val = e.target.value;
    if (val === '__new__') { e.target.value = grnDraft.vendorId || ''; openQuickAddVendor(); return; }
    const v = STATE.vendors.find((x) => x.id === val);
    grnDraft.vendorId = v ? v.id : null;
    grnDraft.vendorName = v ? v.name : '';
  };
  document.getElementById('grn-add-item').onclick = openGrnLineForm;
  document.getElementById('grn-scan-photo').onclick = startGrnScan;
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
      const res = await fetch('/api/grn-scan/status');
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
        headers: { 'Content-Type': 'application/json' },
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
function openGrnQtyCost(product) {
  openModal(`
    <h3>${escapeHtml(product.name)}</h3>
    <div class="row">
      <div class="field"><label>Qty received</label><input type="number" id="gq-qty" value="1"></div>
      <div class="field"><label>Cost Price</label><input type="number" step="0.01" id="gq-cost" value="${product.costPrice || ''}"></div>
    </div>
    <button class="btn block" id="gq-add">Add to GRN</button>
  `);
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
async function saveGrn() {
  if (!grnDraft.vendorId) { toast('Select a vendor'); return; }
  const total = grnDraft.items.reduce((s, it) => s + it.qty * it.cost, 0);
  const grn = {
    id: uid('G'), number: nextNumber(STATE.grns, 'GRN'), date: todayISO(),
    vendorId: grnDraft.vendorId, vendorName: grnDraft.vendorName, items: grnDraft.items, total, by: STATE.user
  };
  STATE.grns.push(grn);
  grnDraft.items.forEach((it) => {
    const p = STATE.products.find((x) => x.id === it.productId);
    if (p) { p.stock = (p.stock || 0) + it.qty; p.costPrice = it.cost; }
  });
  const vendor = STATE.vendors.find((v) => v.id === grnDraft.vendorId);
  if (vendor) {
    vendor.purchased = (vendor.purchased || 0) + total;
    vendor.balance = (vendor.purchased || 0) - (vendor.paid || 0);
    vendor.ledger = vendor.ledger || [];
    vendor.ledger.push({ id: uid('L'), type: 'grn', date: todayISO(), amount: total, ref: grn.number, note: '', balanceAfter: vendor.balance, by: STATE.user });
  }
  await Promise.all([saveKey('grns'), saveKey('products'), saveKey('vendors')]);
  grnDraft = null;
  toast('GRN saved, stock updated');
  renderGRN();
}

