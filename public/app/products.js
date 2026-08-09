/* ================= PRODUCTS ================= */
let productFilter = 'All';
function renderProducts() {
  const c = document.getElementById('pageContent');
  const cats = ['All', ...STATE.settings.categories];
  const list = STATE.products.filter((p) => productFilter === 'All' || p.category === productFilter);
  c.innerHTML = `
    <div class="pill-filters">${cats.map((cat) => `<button data-cat="${escapeHtml(cat)}" class="${cat === productFilter ? 'active' : ''}">${escapeHtml(cat)}</button>`).join('')}</div>
    ${isAdmin() ? '<button class="btn" id="addProductBtn">+ Add Product</button>' : '<p class="sub">View only — ask an Admin to add or edit products.</p>'}
    <div class="grid" style="margin-top:14px">
      ${list.length === 0 ? '<div class="empty-state">No products yet.</div>' : list.map(productCardHtml).join('')}
    </div>
  `;
  c.querySelectorAll('.pill-filters button').forEach((b) => {
    b.onclick = () => { productFilter = b.dataset.cat; renderProducts(); };
  });
  if (isAdmin()) {
    document.getElementById('addProductBtn').onclick = () => openProductForm(null);
    c.querySelectorAll('.product-card').forEach((el) => {
      el.onclick = () => openProductForm(el.dataset.id);
    });
  } else {
    c.querySelectorAll('.product-card').forEach((el) => { el.style.cursor = 'default'; });
  }
}
function productCardHtml(p) {
  const margin = p.sellingPrice ? (((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100).toFixed(0) : '—';
  return `<div class="card product-card" data-id="${p.id}" style="cursor:pointer">
    ${p.photo ? `<img class="product-photo" src="${p.photo}">` : `<div class="product-photo"></div>`}
    <div style="margin-top:8px;font-weight:600">${escapeHtml(p.name)}</div>
    <div class="sub" style="color:var(--ink-soft);font-size:0.85rem">${escapeHtml(p.category)} ${p.brand ? '· ' + escapeHtml(p.brand) : ''}</div>
    <div style="margin-top:6px;display:flex;justify-content:space-between">
      <strong>${money(p.sellingPrice)}</strong>
      <span class="badge ${p.stock <= LOW_STOCK_THRESHOLD ? 'due' : 'ok'}">${p.stock} in stock</span>
    </div>
    <div class="sub" style="font-size:0.8rem;color:var(--ink-soft)">Margin: ${margin}${margin !== '—' ? '%' : ''}</div>
  </div>`;
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
    <div class="field"><label>Stock</label><input type="number" id="pf-stock" value="${p ? p.stock : 0}"></div>
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
  if (p) document.getElementById('pf-delete').onclick = () => {
    if (!confirm('Delete this product?')) return;
    STATE.products = STATE.products.filter((x) => x.id !== p.id);
    saveKey('products').then(() => { closeModal(); renderProducts(); toast('Product deleted'); });
  };
  document.getElementById('pf-save').onclick = async () => {
    const name = document.getElementById('pf-name').value.trim();
    if (!name) { toast('Name is required'); return; }
    const category = document.getElementById('pf-category').value;
    const brand = document.getElementById('pf-brand').value.trim();
    const source = document.getElementById('pf-source').value.trim();
    const costPrice = parseFloat(document.getElementById('pf-cost').value) || 0;
    const sellingPrice = parseFloat(document.getElementById('pf-price').value) || 0;
    const stock = parseInt(document.getElementById('pf-stock').value, 10) || 0;
    const notes = document.getElementById('pf-notes').value.trim();
    const now = new Date().toISOString();
    if (p) {
      const priceChanged = p.sellingPrice !== sellingPrice;
      Object.assign(p, { name, category, brand, source, costPrice, sellingPrice, stock, notes, photo: photoData, updatedAt: now });
      if (priceChanged) {
        p.priceHistory = p.priceHistory || [];
        p.priceHistory.push({ price: sellingPrice, date: now });
      }
    } else {
      STATE.products.push({
        id: uid('P'), name, category, brand, source, costPrice, sellingPrice, stock, notes, photo: photoData,
        priceHistory: [{ price: sellingPrice, date: now }], createdAt: now, updatedAt: now
      });
    }
    await saveKey('products');
    closeModal();
    renderProducts();
    toast('Product saved');
  };
}

