/* ================= SITE & POS EDITOR ================= */
// SELF_SUSTAINING_ADMIN_COMMAND.md Phase 2 scaffold. Admin-only tab (see
// ADMIN_ONLY_TABS in app.js) bound to STATE.uiConfig / server.js's
// /api/admin/ui-config. Only the fields something actually reads today are
// editable here — see server.js's uiConfig comment for why the shape is
// narrow on purpose.
function renderSiteEditor() {
  const c = document.getElementById('pageContent');
  const cfg = STATE.uiConfig;
  if (!cfg) {
    c.innerHTML = `<div class="card"><p class="sub">Could not load Site & POS settings from the server.</p></div>`;
    return;
  }
  const sf = cfg.storefront || {};
  const banner = sf.announcementBanner || { active: false, text: '' };
  const pos = cfg.pos || { features: {}, paymentMethods: [] };
  const methods = pos.paymentMethods && pos.paymentMethods.length ? pos.paymentMethods : [];
  c.innerHTML = `
    <div class="card">
      <h3>Storefront</h3>
      <p class="sub" style="margin-top:-6px">Changes apply to the live /shop page immediately after saving — no restart needed.</p>
      <div class="field"><label>Hero tagline</label><input id="se-hero-tagline" value="${escapeHtml(sf.heroTagline || '')}"></div>
      <div class="field">
        <label><input type="checkbox" id="se-banner-active" ${banner.active ? 'checked' : ''}> Show announcement banner</label>
        <input id="se-banner-text" placeholder="e.g. Eid restock arriving this week" value="${escapeHtml(banner.text || '')}">
      </div>
    </div>

    <div class="card" style="margin-top:10px">
      <h3>POS Buttons &amp; Features</h3>
      <div class="field">
        <label><input type="checkbox" id="se-feat-grnscan" ${pos.features && pos.features.grnPhotoScan ? 'checked' : ''}> GRN "Scan Photo" button</label>
      </div>
      <div class="field">
        <label><input type="checkbox" id="se-feat-heldsales" ${pos.features && pos.features.heldSales !== false ? 'checked' : ''}> Sell screen "Held Sales" button</label>
      </div>
      <div class="field">
        <label><input type="checkbox" id="se-feat-returnvoid" ${pos.features && pos.features.returnVoid !== false ? 'checked' : ''}> Sell screen "Return / Void a Bill" button</label>
      </div>
    </div>

    <div class="card" style="margin-top:10px">
      <h3>Payment Methods</h3>
      <p class="sub" style="margin-top:-6px">Which payment buttons appear on the Sell screen, and in what order.</p>
      <div id="se-pm-list">
        ${methods.map((m, idx) => `<div class="list-row" data-pm-idx="${idx}">
          <label style="display:flex;align-items:center;gap:8px;flex:1"><input type="checkbox" class="se-pm-enabled" data-pm="${idx}" ${m.enabled !== false ? 'checked' : ''}> ${escapeHtml(m.label)}</label>
          <div style="display:flex;gap:4px">
            <button class="btn small secondary" data-pm-up="${idx}" ${idx === 0 ? 'disabled' : ''}>↑</button>
            <button class="btn small secondary" data-pm-down="${idx}" ${idx === methods.length - 1 ? 'disabled' : ''}>↓</button>
          </div>
        </div>`).join('')}
      </div>
    </div>

    <button class="btn" id="se-save" style="margin-top:10px">Save</button>
  `;

  document.querySelectorAll('[data-pm-up]').forEach((btn) => {
    btn.onclick = () => { movePaymentMethod(parseInt(btn.dataset.pmUp, 10), -1); };
  });
  document.querySelectorAll('[data-pm-down]').forEach((btn) => {
    btn.onclick = () => { movePaymentMethod(parseInt(btn.dataset.pmDown, 10), 1); };
  });
  function movePaymentMethod(idx, dir) {
    const list = cfg.pos.paymentMethods;
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    [list[idx], list[target]] = [list[target], list[idx]];
    renderSiteEditor();
  }

  document.getElementById('se-save').onclick = async () => {
    const pin = prompt('Enter your PIN to confirm changing Site & POS settings:');
    if (pin === null) return;
    const next = {
      storefront: {
        heroTagline: document.getElementById('se-hero-tagline').value.trim(),
        announcementBanner: {
          active: document.getElementById('se-banner-active').checked,
          text: document.getElementById('se-banner-text').value.trim()
        }
      },
      pos: {
        features: {
          grnPhotoScan: document.getElementById('se-feat-grnscan').checked,
          heldSales: document.getElementById('se-feat-heldsales').checked,
          returnVoid: document.getElementById('se-feat-returnvoid').checked
        },
        paymentMethods: methods.map((m, idx) => ({
          id: m.id, label: m.label,
          enabled: document.querySelector(`.se-pm-enabled[data-pm="${idx}"]`).checked
        }))
      }
    };
    try {
      const res = await fetch('/api/admin/ui-config', {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ value: next, pin })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'Could not save');
      STATE.uiConfig = next;
      toast('Saved');
    } catch (e) {
      toast(e.message || 'Could not save Site & POS settings');
    }
  };
}
