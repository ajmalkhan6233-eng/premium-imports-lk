/* ================= SETTINGS ================= */
function renderSettings() {
  const c = document.getElementById('pageContent');
  const s = STATE.settings;
  const currentTheme = localStorage.getItem('pilk_theme') || 'navy';
  c.innerHTML = `
    <div class="card">
      <h3>Appearance</h3>
      <p class="sub" style="margin-top:-6px">Pick whichever fits your mood — this is just a look, not shop data, and only affects this device.</p>
      <div class="toggle-group" id="st-theme-group" style="margin-bottom:0">
        ${THEMES.map((t) => `<button data-theme-pick="${t.id}" class="${t.id === currentTheme ? 'active' : ''}">${escapeHtml(t.label)}</button>`).join('')}
      </div>
    </div>

    <div class="card" style="margin-top:10px">
      <h3>Shop</h3>
      <div class="field"><label>Shop Name</label><input id="st-shopname" value="${escapeHtml(s.shopName || '')}"></div>
      <div class="field"><label>WhatsApp Number</label><input id="st-whatsapp" value="${escapeHtml(s.whatsappNumber || '')}"></div>
      <div class="field"><label>Opening Hours (shown to customers by the WhatsApp assistant)</label><input id="st-hours" placeholder="e.g. 9 AM - 8 PM, Mon-Sat" value="${escapeHtml(s.shopHours || '')}"></div>
      <button class="btn small" id="st-save-shop">Save</button>
    </div>

    <div class="card" style="margin-top:10px">
      <h3>Bank Details (used for QR code)</h3>
      <div class="field"><label>Account Name</label><input id="st-accname" value="${escapeHtml(s.bankDetails.accountName || '')}"></div>
      <div class="field"><label>Account Number</label><input id="st-accno" value="${escapeHtml(s.bankDetails.accountNumber || '')}"></div>
      <div class="field"><label>Bank Name</label><input id="st-bankname" value="${escapeHtml(s.bankDetails.bankName || '')}"></div>
      <div class="field"><label>Branch</label><input id="st-branch" value="${escapeHtml(s.bankDetails.branch || '')}"></div>
      <button class="btn small" id="st-save-bank">Save</button>
    </div>

    <div class="card" style="margin-top:10px">
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

    <div class="card" style="margin-top:10px">
      <h3>Payment Plans</h3>
      <p class="sub" style="margin-top:-6px">Offered on Credit sales, and to customers who ask the WhatsApp assistant about paying later.</p>
      <div id="st-plan-list">
        ${(s.paymentPlans || []).map((pl, idx) => `<div class="list-row"><span>${escapeHtml(pl.name)} <span class="sub">(${pl.days === 0 ? 'due today' : `due in ${pl.days} day${pl.days === 1 ? '' : 's'}`})</span></span>
          <div><button class="btn small secondary" data-plan-rename="${idx}">Rename</button> <button class="btn small danger" data-plan-remove="${idx}">Remove</button></div></div>`).join('')}
      </div>
      <div class="row" style="margin-top:10px">
        <div class="field"><input id="st-newplan-name" placeholder="Plan name, e.g. 2 weeks"></div>
        <div class="field"><input type="number" min="0" id="st-newplan-days" placeholder="Days until due"></div>
        <button class="btn small" id="st-addplan">Add</button>
      </div>
    </div>

    <div class="card" style="margin-top:10px">
      <h3>WhatsApp Assistant</h3>
      <div class="field"><label>Replies as</label><input id="st-assistantname" value="${escapeHtml(s.assistantName || 'Nushra')}"></div>
      <p class="sub" style="margin-top:-6px">The assistant replies as this person — warm and familiar, not an announced bot.</p>
      <button class="btn small" id="st-save-assistant">Save</button>
    </div>

    <div class="card" style="margin-top:10px">
      <h3>Delivery Zones</h3>
      <div class="field"><label>Home base</label><input id="st-dz-base" value="${escapeHtml((s.deliveryZones && s.deliveryZones.homeBase) || '')}"></div>
      <div class="field"><label>Free delivery minimum (Rs.)</label><input type="number" min="0" step="0.01" id="st-dz-min" value="${(s.deliveryZones && s.deliveryZones.freeDeliveryMin) || 0}"></div>
      <div class="field"><label>Zone notes</label><textarea id="st-dz-notes" placeholder="e.g. Close by (Thihariya, Yakkala): free. Further out: charge applies, ask for a quote.">${escapeHtml((s.deliveryZones && s.deliveryZones.zoneNotes) || '')}</textarea></div>
      <p class="sub" style="margin-top:-6px">Plain text is fine — the assistant reads this to answer delivery questions in its own words, not a rigid table.</p>
      <button class="btn small" id="st-save-delivery">Save</button>
    </div>

    <div class="card" style="margin-top:10px">
      <h3>Marketing Links</h3>
      <p class="sub" style="margin-top:-6px">Paste these into your Facebook Page's WhatsApp button and your TikTok bio. Messages that start with these exact phrases get tagged by source automatically.</p>
      <div class="field"><label>Facebook</label>
        <div style="display:flex;gap:8px">
          <input readonly id="st-link-fb" style="flex:1" value="https://wa.me/${(s.whatsappNumber || '').replace(/\D/g, '')}?text=${encodeURIComponent('Hi! I saw this on Facebook and wanted to ask about...')}">
          <button class="btn small secondary" data-copy-link="st-link-fb">Copy</button>
        </div>
      </div>
      <div class="field"><label>TikTok</label>
        <div style="display:flex;gap:8px">
          <input readonly id="st-link-tt" style="flex:1" value="https://wa.me/${(s.whatsappNumber || '').replace(/\D/g, '')}?text=${encodeURIComponent('Hi! I saw this on TikTok and wanted to ask about...')}">
          <button class="btn small secondary" data-copy-link="st-link-tt">Copy</button>
        </div>
      </div>
      <p class="sub">Storefront checkout already tags its own orders as "website" — nothing to add there.</p>
    </div>

    <div class="card" style="margin-top:10px">
      <h3>Billing</h3>
      <div class="field"><label>Starting bill number</label><input type="number" min="1" id="st-startbill" value="${s.startingBillNumber || 1}"></div>
      <p class="sub" style="margin-top:-6px">Sets what number new invoices start counting from — use this to continue from an existing paper bill book instead of starting at 0001. Only affects new invoices going forward.</p>
      <button class="btn small" id="st-save-startbill">Save</button>
    </div>

    <div class="card" style="margin-top:10px">
      <h3>Inventory</h3>
      <div class="field"><label>Aging threshold (days)</label><input type="number" min="1" step="1" id="st-agingdays" value="${s.agingThresholdDays !== undefined ? s.agingThresholdDays : 30}"></div>
      <p class="sub" style="margin-top:-6px">Products still unsold this many days after their oldest received batch get an "Aging" badge on the Products list, so slow-moving stock doesn't get forgotten. Visibility only — never changes cost price or margin.</p>
      <button class="btn small" id="st-save-agingdays">Save</button>
    </div>

    ${isAdmin() ? `
    <div class="card" style="margin-top:10px">
      <h3>Backup</h3>
      <p class="sub" style="margin-top:-6px">Downloads everything — products, bills, customers, vendors, settings — as one file, right now. The server also backs up automatically once a day on its own, but this gives you your own copy whenever you want one.</p>
      <button class="btn small" id="st-download-backup">Download Backup</button>
    </div>
    ` : ''}

    <div class="card" style="margin-top:10px">
      <h3>Change PIN (${STATE.user})</h3>
      <div class="field"><label>New PIN</label><input type="password" id="st-newpin" maxlength="8"></div>
      <button class="btn small" id="st-savepin">Save PIN</button>
    </div>

    <div class="card" style="margin-top:10px">
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

  c.querySelectorAll('[data-theme-pick]').forEach((btn) => {
    btn.onclick = () => {
      applyTheme(btn.dataset.themePick);
      c.querySelectorAll('#st-theme-group button').forEach((b) => b.classList.toggle('active', b === btn));
    };
  });
  const backupBtn = document.getElementById('st-download-backup');
  if (backupBtn) backupBtn.onclick = async () => {
    backupBtn.disabled = true; backupBtn.textContent = 'Preparing...';
    try {
      const res = await fetch('/api/admin/backup', { headers: authHeaders() });
      if (!res.ok) throw new Error('Backup request failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `premium-imports-lk-backup-${todayISO()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('Backup downloaded');
    } catch (e) {
      toast('Could not download backup');
    }
    backupBtn.disabled = false; backupBtn.textContent = 'Download Backup';
  };
  document.getElementById('st-save-shop').onclick = async () => {
    s.shopName = document.getElementById('st-shopname').value.trim();
    s.whatsappNumber = document.getElementById('st-whatsapp').value.trim();
    s.shopHours = document.getElementById('st-hours').value.trim();
    await saveKey('settings');
    document.getElementById('sidebarBrand').textContent = s.shopName;
    toast('Saved');
  };
  document.getElementById('st-save-bank').onclick = async () => {
    // Bank details drive the payment QR code shown to real customers, so
    // the server requires a valid user PIN on any change to them (see
    // server.js bankDetailsChanged/pinMatchesAnyUser) — re-confirm here
    // even though STATE.user is already logged in, since the check is
    // enforced server-side, not just by this prompt.
    const pin = prompt('Enter your PIN to confirm changing bank details:');
    if (pin === null) return;
    const prevBankDetails = s.bankDetails;
    s.bankDetails = {
      accountName: document.getElementById('st-accname').value.trim(),
      accountNumber: document.getElementById('st-accno').value.trim(),
      bankName: document.getElementById('st-bankname').value.trim(),
      branch: document.getElementById('st-branch').value.trim()
    };
    try {
      await saveKey('settings', { pin });
      toast('Saved');
    } catch (e) {
      s.bankDetails = prevBankDetails;
      toast(e.message || 'Could not save bank details');
    }
  };
  document.getElementById('st-addplan').onclick = async () => {
    const name = document.getElementById('st-newplan-name').value.trim();
    const days = parseInt(document.getElementById('st-newplan-days').value, 10);
    if (!name) { toast('Enter a plan name'); return; }
    if (isNaN(days) || days < 0) { toast('Enter days until due (0 for due today)'); return; }
    s.paymentPlans = s.paymentPlans || [];
    s.paymentPlans.push({ name, days });
    await saveKey('settings');
    renderSettings();
  };
  c.querySelectorAll('[data-plan-rename]').forEach((btn) => {
    btn.onclick = async () => {
      const idx = parseInt(btn.dataset.planRename, 10);
      const plan = s.paymentPlans[idx];
      const name = prompt('Rename plan', plan.name);
      if (!name || !name.trim()) return;
      const daysStr = prompt('Days until due (0 for due today)', plan.days);
      const days = parseInt(daysStr, 10);
      plan.name = name.trim();
      if (!isNaN(days) && days >= 0) plan.days = days;
      await saveKey('settings');
      renderSettings();
    };
  });
  c.querySelectorAll('[data-plan-remove]').forEach((btn) => {
    btn.onclick = async () => {
      const idx = parseInt(btn.dataset.planRemove, 10);
      if (!confirm(`Remove payment plan "${s.paymentPlans[idx].name}"?`)) return;
      s.paymentPlans.splice(idx, 1);
      await saveKey('settings');
      renderSettings();
    };
  });
  document.getElementById('st-save-assistant').onclick = async () => {
    s.assistantName = document.getElementById('st-assistantname').value.trim() || 'Nushra';
    await saveKey('settings');
    toast('Saved');
  };
  document.getElementById('st-save-delivery').onclick = async () => {
    s.deliveryZones = {
      homeBase: document.getElementById('st-dz-base').value.trim(),
      freeDeliveryMin: parseFloat(document.getElementById('st-dz-min').value) || 0,
      zoneNotes: document.getElementById('st-dz-notes').value.trim()
    };
    await saveKey('settings');
    toast('Saved');
  };
  c.querySelectorAll('[data-copy-link]').forEach((btn) => {
    btn.onclick = () => {
      const input = document.getElementById(btn.dataset.copyLink);
      input.select();
      navigator.clipboard.writeText(input.value).then(() => toast('Link copied')).catch(() => {
        document.execCommand('copy');
        toast('Link copied');
      });
    };
  });
  document.getElementById('st-save-agingdays').onclick = async () => {
    const val = parseInt(document.getElementById('st-agingdays').value, 10);
    s.agingThresholdDays = (!isNaN(val) && val > 0) ? val : 30;
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
