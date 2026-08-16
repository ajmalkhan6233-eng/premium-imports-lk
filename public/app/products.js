/* ================= PRODUCTS ================= */
// Search added alongside the category pills — every other list screen
// (Sell, GRN, Bills, Vendors) already had a text search; Products didn't,
// which was inconsistent and a real gap once the catalog grows past a
// screenful.
let productFilter = 'All';
let productSearchQuery = '';
function renderProducts() {
  const c = document.getElementById('pageContent');
  const cats = ['All', ...STATE.settings.categories];
  c.innerHTML = `
    <input id="product-search" placeholder="Search products or item code..." value="${escapeHtml(productSearchQuery)}" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;margin-bottom:10px">
    <div class="pill-filters">${cats.map((cat) => `<button data-cat="${escapeHtml(cat)}" class="${cat === productFilter ? 'active' : ''}">${escapeHtml(cat)}</button>`).join('')}</div>
    ${isAdmin() ? '<button class="btn" id="addProductBtn">+ Add Product</button>' : '<p class="sub">View only — ask an Admin to add or edit products.</p>'}
    <div class="product-grid" id="product-grid-list" style="margin-top:14px">${renderProductGridHtml()}</div>
  `;
  // Filters only #product-grid-list on each keystroke (not a full
  // renderProducts()) so the search input never loses focus mid-type —
  // same pattern as the Vendors/Bills search fields elsewhere in this app.
  document.getElementById('product-search').oninput = (e) => {
    productSearchQuery = e.target.value;
    document.getElementById('product-grid-list').innerHTML = renderProductGridHtml();
    bindProductGridEvents();
  };
  c.querySelectorAll('.pill-filters button').forEach((b) => {
    b.onclick = () => { productFilter = b.dataset.cat; renderProducts(); };
  });
  if (isAdmin()) document.getElementById('addProductBtn').onclick = () => openProductForm(null);
  bindProductGridEvents();
}
function renderProductGridHtml() {
  const q = productSearchQuery.trim().toLowerCase();
  const list = STATE.products.filter((p) =>
    (productFilter === 'All' || p.category === productFilter) &&
    (!q || `${p.name} ${p.itemCode || ''} ${p.brand || ''}`.toLowerCase().includes(q))
  );
  const agingMap = computeProductAgingDates();
  if (list.length === 0) {
    return `<div class="empty-state"><div class="empty-icon">\u{1F4E6}</div><div>${STATE.products.length === 0 ? 'No products yet.' : 'No products match this filter.'}</div>${STATE.products.length === 0 && !isAdmin() ? '<p class="sub">Ask an Admin to add the first product.</p>' : ''}</div>`;
  }
  return list.map((p) => productCardHtml(p, agingMap)).join('');
}
function bindProductGridEvents() {
  if (isAdmin()) {
    document.querySelectorAll('.product-card').forEach((el) => {
      el.onclick = () => openProductForm(el.dataset.id);
    });
    document.querySelectorAll('[data-edit-product]').forEach((btn) => {
      btn.onclick = (e) => { e.stopPropagation(); openProductForm(btn.dataset.editProduct); };
    });
    document.querySelectorAll('[data-delete-product]').forEach((btn) => {
      btn.onclick = (e) => { e.stopPropagation(); deleteProduct(btn.dataset.deleteProduct); };
    });
  } else {
    document.querySelectorAll('.product-card').forEach((el) => { el.style.cursor = 'default'; });
  }
}
function productCardHtml(p, agingMap) {
  const margin = p.sellingPrice ? (((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100).toFixed(0) : '—';
  const days = daysInStock(p.id, agingMap);
  const threshold = STATE.settings.agingThresholdDays !== undefined ? STATE.settings.agingThresholdDays : 30;
  const isAging = days !== null && days > threshold;
  return `<div class="card product-card" data-id="${p.id}" style="cursor:pointer">
    ${p.photo ? `<img class="product-photo" src="${p.photo}">` : `<div class="product-photo"></div>`}
    <div class="sub" style="font-family:var(--mono);font-size:0.72rem;color:var(--accent);margin-top:6px">${escapeHtml(p.itemCode || '')}</div>
    <div style="font-weight:600">${escapeHtml(p.name)}</div>
    <div class="sub" style="color:var(--ink-soft);font-size:0.85rem">${escapeHtml(p.category)} ${p.brand ? '· ' + escapeHtml(p.brand) : ''}</div>
    <div style="margin-top:6px;display:flex;justify-content:space-between">
      <strong>${money(p.sellingPrice)}</strong>
      <span class="badge ${p.stock <= LOW_STOCK_THRESHOLD ? 'due' : 'ok'}">${p.stock} in stock</span>
    </div>
    <div class="sub" style="font-size:0.8rem;color:var(--ink-soft);display:flex;justify-content:space-between;align-items:center">
      <span>Margin: ${margin}${margin !== '—' ? '%' : ''}${days !== null ? ' · Days in stock: ' + days : ''}</span>
      ${isAging ? '<span class="badge due">Aging</span>' : ''}
    </div>
    ${isAdmin() ? `<div style="display:flex;gap:6px;margin-top:8px">
      <button class="btn small secondary" data-edit-product="${p.id}" style="flex:1">Edit</button>
      <button class="btn small danger" data-delete-product="${p.id}" style="flex:1">Delete</button>
    </div>` : ''}
  </div>`;
}
// Shared by the card's direct Delete button and the edit form's Delete
// button (openProductForm) — same confirm + save path either way. Returns
// false without doing anything if the confirm is cancelled, so callers
// that also need to close a modal only do so on an actual delete.
function deleteProduct(id) {
  const p = STATE.products.find((x) => x.id === id);
  if (!p) return false;
  if (!confirm(`Delete "${p.name}"? This can't be undone.`)) return false;
  STATE.products = STATE.products.filter((x) => x.id !== id);
  saveKey('products').then(() => { renderProducts(); toast('Product deleted'); });
  return true;
}

function openProductForm(id) {
  const p = id ? STATE.products.find((x) => x.id === id) : null;
  let photoData = p ? p.photo : null;
  openModal(`
    <h3>${p ? 'Edit Product' : 'Add Product'}</h3>
    <div class="field"><label>Photo</label>
      <div id="photoPreviewWrap">${photoData ? `<img class="product-photo" id="photoPreview" src="${photoData}">` : ''}</div>
      <input type="file" accept="image/*" id="photoInput">
    </div>
    <div class="field"><label>Item Code</label><div style="font-family:var(--mono);color:var(--ink-soft)">${p ? escapeHtml(p.itemCode || '') : 'Assigned automatically on save'}</div></div>
    <div class="field"><label>Name</label><input id="pf-name" value="${p ? escapeHtml(p.name) : ''}"></div>
    <div class="row">
      <div class="field"><label>Category</label>
        <select id="pf-category">${STATE.settings.categories.map((c) => `<option ${p && p.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Brand</label><input id="pf-brand" value="${p ? escapeHtml(p.brand || '') : ''}"></div>
    </div>
    <div class="field"><label>Source (optional)</label><input id="pf-source" placeholder="e.g. Dubai" value="${p ? escapeHtml(p.source || '') : ''}"></div>
    <div class="row">
      <div class="field"><label>Cost Price</label><input type="number" step="0.01" id="pf-cost" value="${p ? p.costPrice : ''}"></div>
      <div class="field"><label>Selling Price</label><input type="number" step="0.01" id="pf-price" value="${p ? p.sellingPrice : ''}"></div>
    </div>
    <div class="field"><label>Margin</label><div id="pf-margin" style="color:var(--ink-soft)">—</div></div>
    ${p ? `<p class="sub">Stock: ${p.stock} — adjust stock only through GRN, not here.</p>` : ''}
    <div class="field"><label>Notes</label><textarea id="pf-notes">${p ? escapeHtml(p.notes || '') : ''}</textarea></div>
    <div class="modal-actions">
      <button class="btn secondary" id="pf-cancel">Cancel</button>
      <button class="btn" id="pf-save">Save</button>
      ${p ? '<button class="btn danger" id="pf-delete">Delete</button>' : ''}
    </div>
  `);
  const updateMargin = () => {
    const cost = parseFloat(document.getElementById('pf-cost').value) || 0;
    const price = parseFloat(document.getElementById('pf-price').value) || 0;
    const el = document.getElementById('pf-margin');
    el.textContent = price > 0 ? `${(((price - cost) / price) * 100).toFixed(1)}%` : '—';
  };
  document.getElementById('pf-cost').oninput = updateMargin;
  document.getElementById('pf-price').oninput = updateMargin;
  updateMargin();

  document.getElementById('photoInput').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    compressImage(file, 360, (dataUrl) => {
      photoData = dataUrl;
      document.getElementById('photoPreviewWrap').innerHTML = `<img class="product-photo" id="photoPreview" src="${dataUrl}">`;
    });
  };
  document.getElementById('pf-cancel').onclick = closeModal;
  if (p) document.getElementById('pf-delete').onclick = () => { if (deleteProduct(p.id)) closeModal(); };
  document.getElementById('pf-save').onclick = async () => {
    const name = document.getElementById('pf-name').value.trim();
    if (!name) { toast('Name is required'); return; }
    const category = document.getElementById('pf-category').value;
    const brand = document.getElementById('pf-brand').value.trim();
    const source = document.getElementById('pf-source').value.trim();
    const costPrice = parseFloat(document.getElementById('pf-cost').value) || 0;
    const sellingPrice = parseFloat(document.getElementById('pf-price').value) || 0;
    const notes = document.getElementById('pf-notes').value.trim();
    const now = new Date().toISOString();
    if (p) {
      const priceChanged = p.sellingPrice !== sellingPrice;
      Object.assign(p, { name, category, brand, source, costPrice, sellingPrice, notes, photo: photoData, updatedAt: now });
      if (priceChanged) {
        p.priceHistory = p.priceHistory || [];
        p.priceHistory.push({ price: sellingPrice, date: now });
      }
    } else {
      STATE.products.push({
        id: uid('P'), itemCode: nextItemCode(), name, category, brand, source, costPrice, sellingPrice, stock: 0, notes, photo: photoData,
        priceHistory: [{ price: sellingPrice, date: now }], createdAt: now, updatedAt: now
      });
    }
    await saveKey('products');
    closeModal();
    renderProducts();
    toast('Product saved');
  };
}

