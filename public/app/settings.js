/* ================= SETTINGS ================= */
function renderSettings() {
  const c = document.getElementById('pageContent');
  const s = STATE.settings;
  c.innerHTML = `
    <div class="card">
      <h3>Shop</h3>
      <div class="field"><label>Shop Name</label><input id="st-shopname" value="${escapeHtml(s.shopName || '')}"></div>
      <div class="field"><label>WhatsApp Number</label><input id="st-whatsapp" value="${escapeHtml(s.whatsappNumber || '')}"></div>
      <button class="btn small" id="st-save-shop">Save</button>
    </div>

    <div class="card" style="margin-top:14px">
      <h3>Bank Details (used for QR code)</h3>
      <div class="field"><label>Account Name</label><input id="st-accname" value="${escapeHtml(s.bankDetails.accountName || '')}"></div>
      <div class="field"><label>Account Number</label><input id="st-accno" value="${escapeHtml(s.bankDetails.accountNumber || '')}"></div>
      <div class="field"><label>Bank Name</label><input id="st-bankname" value="${escapeHtml(s.bankDetails.bankName || '')}"></div>
      <div class="field"><label>Branch</label><input id="st-branch" value="${escapeHtml(s.bankDetails.branch || '')}"></div>
      <button class="btn small" id="st-save-bank">Save</button>
    </div>

    <div class="card" style="margin-top:14px">
      <h3>Categories</h3>
      <div id="st-cat-list">
        ${s.categories.map((cat, idx) => `<div class="list-row"><span>${escapeHtml(cat)}</span>
          <div><button class="btn small secondary" data-rename="${idx}">Rename</button> <button class="btn small danger" data-remove="${idx}">Remove</button></div></div>`).join('')}
      </div>
      <div class="row" style="margin-top:10px">
        <div class="field"><input id="st-newcat" placeholder="New category"></div>
        <button class="btn small" id="st-addcat">Add</button>
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <h3>Billing</h3>
      <div class="field"><label>Starting bill number</label><input type="number" min="1" id="st-startbill" value="${s.startingBillNumber || 1}"></div>
      <p class="sub" style="margin-top:-6px">Sets what number new invoices start counting from — use this to continue from an existing paper bill book instead of starting at 0001. Only affects new invoices going forward.</p>
      <button class="btn small" id="st-save-startbill">Save</button>
    </div>

    <div class="card" style="margin-top:14px">
      <h3>Change PIN (${STATE.user})</h3>
      <div class="field"><label>New PIN</label><input type="password" id="st-newpin" maxlength="8"></div>
      <button class="btn small" id="st-savepin">Save PIN</button>
    </div>

    <div class="card" style="margin-top:14px">
      <h3>Manage Users</h3>
      <p class="sub" style="margin-top:-6px">AJMAL is the one Admin account and can't be removed here. Staff can use Sell, GRN, and Customers/Vendors/Loans, but can't edit or delete existing records, and can't open Settings or Reports.</p>
      <div id="st-user-list">
        ${(s.users || []).map((u, idx) => `
          <div class="list-row" style="cursor:default">
            <div><div class="title">${escapeHtml(u.name)}</div><div class="sub">${u.role === 'admin' ? 'Admin' : 'Staff'}</div></div>
            ${u.role === 'admin' ? '' : `
              <div style="display:flex;align-items:center;gap:8px">
                <input placeholder="New PIN" maxlength="8" style="width:100px;padding:6px 8px;border:1px solid var(--line);border-radius:8px" data-reset-pin="${idx}">
                <button class="btn small secondary" data-reset-pin-btn="${idx}">Reset PIN</button>
                <button class="btn small danger" data-remove-user="${idx}">Remove</button>
              </div>
            `}
          </div>
        `).join('')}
      </div>
      <div class="row" style="margin-top:10px">
        <div class="field"><input id="st-newuser-name" placeholder="Staff name"></div>
        <div class="field"><input id="st-newuser-pin" placeholder="PIN" maxlength="8"></div>
      </div>
      <button class="btn small" id="st-addstaff">+ Add Staff</button>
    </div>
  `;

  document.getElementById('st-save-shop').onclick = async () => {
    s.shopName = document.getElementById('st-shopname').value.trim();
    s.whatsappNumber = document.getElementById('st-whatsapp').value.trim();
    await saveKey('settings');
    document.getElementById('sidebarBrand').textContent = s.shopName;
    toast('Saved');
  };
  document.getElementById('st-save-bank').onclick = async () => {
    s.bankDetails = {
      accountName: document.getElementById('st-accname').value.trim(),
      accountNumber: document.getElementById('st-accno').value.trim(),
      bankName: document.getElementById('st-bankname').value.trim(),
      branch: document.getElementById('st-branch').value.trim()
    };
    await saveKey('settings');
    toast('Saved');
  };
  document.getElementById('st-save-startbill').onclick = async () => {
    const val = parseInt(document.getElementById('st-startbill').value, 10);
    s.startingBillNumber = (val && val > 0) ? val : 1;
    await saveKey('settings');
    toast('Saved');
  };
  document.getElementById('st-addcat').onclick = async () => {
    const val = document.getElementById('st-newcat').value.trim();
    if (!val) return;
    if (s.categories.includes(val)) { toast('Category already exists'); return; }
    s.categories.push(val);
    await saveKey('settings');
    renderSettings();
  };
  c.querySelectorAll('[data-rename]').forEach((btn) => {
    btn.onclick = async () => {
      const idx = parseInt(btn.dataset.rename, 10);
      const val = prompt('Rename category', s.categories[idx]);
      if (!val || !val.trim()) return;
      const oldName = s.categories[idx];
      s.categories[idx] = val.trim();
      STATE.products.forEach((p) => { if (p.category === oldName) p.category = val.trim(); });
      await Promise.all([saveKey('settings'), saveKey('products')]);
      renderSettings();
    };
  });
  c.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.onclick = async () => {
      const idx = parseInt(btn.dataset.remove, 10);
      if (!confirm(`Remove category "${s.categories[idx]}"?`)) return;
      s.categories.splice(idx, 1);
      await saveKey('settings');
      renderSettings();
    };
  });
  document.getElementById('st-savepin').onclick = async () => {
    const val = document.getElementById('st-newpin').value.trim();
    if (!val) { toast('Enter a PIN'); return; }
    findUser(STATE.user).pin = val;
    await saveKey('settings');
    toast('PIN updated');
  };
  document.getElementById('st-addstaff').onclick = async () => {
    const name = document.getElementById('st-newuser-name').value.trim().toUpperCase();
    const pin = document.getElementById('st-newuser-pin').value.trim();
    if (!name) { toast('Enter a name'); return; }
    if (!pin) { toast('Enter a PIN'); return; }
    if (findUser(name)) { toast('A user with that name already exists'); return; }
    s.users.push({ name, pin, role: 'staff' });
    await saveKey('settings');
    renderSettings();
    toast('Staff added');
  };
  c.querySelectorAll('[data-reset-pin-btn]').forEach((btn) => {
    btn.onclick = async () => {
      const idx = parseInt(btn.dataset.resetPinBtn, 10);
      const input = c.querySelector(`[data-reset-pin="${idx}"]`);
      const val = input.value.trim();
      if (!val) { toast('Enter a new PIN'); return; }
      s.users[idx].pin = val;
      await saveKey('settings');
      renderSettings();
      toast('PIN reset');
    };
  });
  c.querySelectorAll('[data-remove-user]').forEach((btn) => {
    btn.onclick = async () => {
      const idx = parseInt(btn.dataset.removeUser, 10);
      const u = s.users[idx];
      if (!confirm(`Remove staff account "${u.name}"?`)) return;
      s.users.splice(idx, 1);
      await saveKey('settings');
      renderSettings();
      toast('Staff removed');
    };
  });
}
