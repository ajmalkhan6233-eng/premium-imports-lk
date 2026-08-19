/* ================= ONBOARDING SETUP WIZARD =================
   Answers a small set of "how does your shop operate" questions and
   turns them directly into real settings.* fields already used
   elsewhere in the app (Settings screen, Sell screen payment plans,
   WhatsApp assistant tier, delivery info, aging threshold) — nothing
   here invents a new feature, it's a faster on-ramp into existing ones.

   NOTE (2026-08-19): this question set is a first draft, mapped only to
   settings fields that already exist in this app's real schema — not
   Ajmal's own finalized business-onboarding requirements. Flagged for
   his review/edit, same as any other judgment call in this project.
   See HANDBOOK_EN.md/TA.md §18 and SESSION_LOG.md for the same note. */

const ONBOARDING_QUESTIONS = [
  { id: 'shopName', prompt: 'What is your shop’s name?', type: 'text', path: 'shopName', placeholder: 'e.g. Premium Imports LK' },
  { id: 'whatsappNumber', prompt: 'What WhatsApp number should customers reach you on?', type: 'text', path: 'whatsappNumber', placeholder: 'e.g. 94771234567' },
  { id: 'shopHours', prompt: 'What are your typical opening hours?', type: 'text', path: 'shopHours', placeholder: 'e.g. 9am - 8pm, every day' },
  { id: 'categories', prompt: 'What product categories do you sell? (comma-separated)', type: 'text', path: 'categories', placeholder: 'e.g. Chocolate, Wash Items, Other', isList: true },
  { id: 'offersCredit', prompt: 'Do you offer credit / pay-later sales to regular customers?', type: 'yesno' },
  { id: 'paymentPlans', prompt: 'What repayment windows do you offer? One per line, as "name = days" (0 = due immediately).', type: 'textarea', path: 'paymentPlans', placeholder: 'Pay in full = 0\n1 week = 7\n30 days = 30', isPlanList: true, skipIf: (a) => a.offersCredit === 'no' },
  { id: 'startingBillNumber', prompt: 'What number should your next bill start from? (e.g. continuing an old paper/system count)', type: 'number', path: 'startingBillNumber', placeholder: '1' },
  { id: 'deliveryBase', prompt: 'Do you deliver? If so, what’s your base delivery area?', type: 'text', path: 'deliveryZones.homeBase', placeholder: 'e.g. Thihariya junction (leave blank if you don’t deliver)' },
  { id: 'freeDeliveryMin', prompt: 'Is there a free-delivery minimum order amount? (Rs., 0 = no minimum / not applicable)', type: 'number', path: 'deliveryZones.freeDeliveryMin', placeholder: '0' },
  { id: 'deliveryNotes', prompt: 'Any delivery notes worth showing customers? (zones covered, extra charges, etc.)', type: 'textarea', path: 'deliveryZones.zoneNotes', placeholder: 'Optional' },
  { id: 'agingThresholdDays', prompt: 'After how many days of a product not selling should it be flagged as slow-moving / aging stock?', type: 'number', path: 'agingThresholdDays', placeholder: '30' },
  { id: 'whatsappTier', prompt: 'How should the WhatsApp assistant handle customer messages?', type: 'select', path: 'whatsappTier',
    options: [
      { value: 'general', label: 'Simple FAQ only — no AI, hours/delivery/price lookups' },
      { value: 'light', label: 'AI conversation — natural replies, text only' },
      { value: 'standard', label: 'AI conversation + product photos' },
      { value: 'pro', label: 'Full AI — photos + payment-plan menu' }
    ] },
  { id: 'assistantName', prompt: 'What name should the WhatsApp assistant introduce itself as?', type: 'text', path: 'assistantName', placeholder: 'e.g. Nushra' },
  { id: 'bankDetails', prompt: 'Bank account details for bank-transfer payments? (You can skip this and add it later in Settings.)', type: 'bank', path: 'bankDetails' },
  { id: 'notes', prompt: 'Anything else about how your shop runs that’s worth noting? (free text, optional)', type: 'textarea', path: 'onboardingNotes', placeholder: 'Optional' }
];

let obStep = 0; // -1 = welcome, 0..N-1 = questions, N = review
let obAnswers = {};
let obDraft = null; // deep-cloned settings, mutated as questions are answered

function obVisibleQuestions() {
  return ONBOARDING_QUESTIONS.filter((q) => !q.skipIf || !q.skipIf(obAnswers));
}
function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}
function parsePlanList(text) {
  return text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [name, daysStr] = line.split('=').map((s) => s.trim());
    return { name: name || 'Plan', days: parseInt(daysStr, 10) || 0 };
  });
}

function renderOnboardingWizard() {
  const c = document.getElementById('pageContent');
  document.getElementById('sellTotalBarRoot').innerHTML = '';
  if (obStep === -1) { obAnswers = {}; obDraft = JSON.parse(JSON.stringify(STATE.settings)); }
  const visible = obVisibleQuestions();

  if (obStep === -1) {
    c.innerHTML = `
      <div class="card" style="max-width:640px">
        <h2>\u{1F4CB} Shop Setup Wizard</h2>
        <p class="sub" style="font-size:0.95rem;line-height:1.5">
          ${visible.length} quick questions about how your shop operates.
          Nothing is changed until you review and confirm at the end —
          answer as much or as little as you like, and skip anything
          that doesn’t apply.
        </p>
        <button class="btn" id="ob-start">Start</button>
      </div>`;
    document.getElementById('ob-start').onclick = () => { obStep = 0; renderOnboardingWizard(); };
    return;
  }

  if (obStep >= visible.length) {
    renderOnboardingReview(c);
    return;
  }

  const q = visible[obStep];
  const current = q.path ? getPath(obDraft, q.path) : obAnswers[q.id];
  c.innerHTML = `
    <div class="card" style="max-width:640px">
      <div class="sub" style="margin-bottom:6px">Question ${obStep + 1} of ${visible.length}</div>
      <h3 style="margin-bottom:12px">${escapeHtml(q.prompt)}</h3>
      ${obQuestionInputHtml(q, current)}
      <div class="modal-actions" style="margin-top:16px">
        ${obStep > 0 ? '<button class="btn secondary" id="ob-back">Back</button>' : '<button class="btn secondary" id="ob-cancel">Cancel</button>'}
        <button class="btn" id="ob-next">${obStep === visible.length - 1 ? 'Review' : 'Next'}</button>
      </div>
    </div>`;
  obWireQuestionInput(q);
  const backBtn = document.getElementById('ob-back');
  if (backBtn) backBtn.onclick = () => { obStep--; renderOnboardingWizard(); };
  const cancelBtn = document.getElementById('ob-cancel');
  if (cancelBtn) cancelBtn.onclick = () => { if (confirm('Cancel setup? Nothing will be changed.')) goTab('settings'); };
  document.getElementById('ob-next').onclick = () => { obSaveCurrentAnswer(q); obStep++; renderOnboardingWizard(); };
}

function obQuestionInputHtml(q, current) {
  if (q.type === 'yesno') {
    const val = obAnswers[q.id] || 'yes';
    return `<div class="toggle-group"><button data-yn="yes" class="${val === 'yes' ? 'active' : ''}">Yes</button><button data-yn="no" class="${val === 'no' ? 'active' : ''}">No</button></div>`;
  }
  if (q.type === 'select') {
    return `<select id="ob-input">${q.options.map((o) => `<option value="${o.value}" ${current === o.value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}</select>`;
  }
  if (q.type === 'textarea') {
    const val = q.isPlanList && Array.isArray(current) ? current.map((p) => `${p.name} = ${p.days}`).join('\n') : (current || '');
    return `<textarea id="ob-input" rows="4" placeholder="${escapeHtml(q.placeholder || '')}">${escapeHtml(val)}</textarea>`;
  }
  if (q.type === 'bank') {
    const b = current || {};
    return `
      <div class="field"><label>Account Name</label><input id="ob-bank-name" value="${escapeHtml(b.accountName || '')}"></div>
      <div class="field"><label>Account Number</label><input id="ob-bank-acc" value="${escapeHtml(b.accountNumber || '')}"></div>
      <div class="field"><label>Bank</label><input id="ob-bank-bank" value="${escapeHtml(b.bankName || '')}"></div>
      <div class="field"><label>Branch</label><input id="ob-bank-branch" value="${escapeHtml(b.branch || '')}"></div>`;
  }
  const val = q.isList && Array.isArray(current) ? current.join(', ') : (current !== undefined && current !== null ? current : '');
  return `<input id="ob-input" type="${q.type === 'number' ? 'number' : 'text'}" value="${escapeHtml(String(val))}" placeholder="${escapeHtml(q.placeholder || '')}">`;
}
function obWireQuestionInput(q) {
  if (q.type === 'yesno') {
    document.querySelectorAll('[data-yn]').forEach((b) => {
      b.onclick = () => { obAnswers[q.id] = b.dataset.yn; document.querySelectorAll('[data-yn]').forEach((x) => x.classList.toggle('active', x === b)); };
    });
  }
}
function obSaveCurrentAnswer(q) {
  if (q.type === 'yesno') { if (!obAnswers[q.id]) obAnswers[q.id] = 'yes'; return; }
  if (q.type === 'bank') {
    setPath(obDraft, q.path, {
      accountName: document.getElementById('ob-bank-name').value.trim(),
      accountNumber: document.getElementById('ob-bank-acc').value.trim(),
      bankName: document.getElementById('ob-bank-bank').value.trim(),
      branch: document.getElementById('ob-bank-branch').value.trim()
    });
    return;
  }
  const raw = document.getElementById('ob-input').value;
  if (q.isList) { setPath(obDraft, q.path, raw.split(',').map((s) => s.trim()).filter(Boolean)); return; }
  if (q.isPlanList) { setPath(obDraft, q.path, parsePlanList(raw)); return; }
  if (q.type === 'number') { setPath(obDraft, q.path, raw === '' ? 0 : (parseFloat(raw) || 0)); return; }
  setPath(obDraft, q.path, raw);
}

function obDiffSummary() {
  const rows = [];
  ONBOARDING_QUESTIONS.forEach((q) => {
    if (!q.path) return;
    const before = getPath(STATE.settings, q.path);
    const after = getPath(obDraft, q.path);
    const beforeStr = JSON.stringify(before);
    const afterStr = JSON.stringify(after);
    if (beforeStr === afterStr) return;
    rows.push({ label: q.prompt, before, after });
  });
  return rows;
}
function fmtDiffVal(v) {
  if (v === undefined || v === null || v === '') return '<span class="sub">(blank)</span>';
  if (Array.isArray(v)) return escapeHtml(v.map((x) => (typeof x === 'object' ? `${x.name} (${x.days}d)` : x)).join(', ')) || '<span class="sub">(none)</span>';
  if (typeof v === 'object') return escapeHtml(Object.values(v).filter(Boolean).join(', ')) || '<span class="sub">(blank)</span>';
  return escapeHtml(String(v));
}
// Mirrors server.js's own bankDetailsChanged() check — the generic
// PUT /api/data/settings route requires a PIN whenever bank details
// change (same gate Settings' own "Bank Details" card goes through), so
// the wizard needs to collect one too instead of silently failing the
// whole save because one of fifteen answers touched a protected field.
function obBankDetailsChanged() {
  const before = (STATE.settings && STATE.settings.bankDetails) || {};
  const after = (obDraft && obDraft.bankDetails) || {};
  return ['accountName', 'accountNumber', 'bankName', 'branch'].some((f) => (before[f] || '') !== (after[f] || ''));
}
function renderOnboardingReview(c) {
  const rows = obDiffSummary();
  const needsPin = rows.length > 0 && obBankDetailsChanged();
  c.innerHTML = `
    <div class="card" style="max-width:720px">
      <h3>Review changes</h3>
      ${rows.length === 0 ? '<p class="sub">No changes from your current settings — nothing to apply.</p>' : `
        <p class="sub" style="margin-bottom:10px">Nothing is saved yet. Check this against your actual shop details, then Apply.</p>
        ${rows.map((r) => `
          <div class="list-row" style="cursor:default;flex-direction:column;align-items:stretch;gap:2px">
            <div class="title">${escapeHtml(r.label)}</div>
            <div class="sub">${fmtDiffVal(r.before)} → <strong style="color:var(--ink)">${fmtDiffVal(r.after)}</strong></div>
          </div>`).join('')}
        ${needsPin ? `<div class="field" style="margin-top:10px"><label>Bank details changed — enter your PIN to confirm</label><input id="ob-confirm-pin" type="password" inputmode="numeric" maxlength="4"></div>` : ''}
      `}
      <div class="modal-actions" style="margin-top:16px">
        <button class="btn secondary" id="ob-review-back">Back</button>
        ${rows.length > 0 ? '<button class="btn" id="ob-apply">Apply These Settings</button>' : '<button class="btn secondary" id="ob-review-close">Close</button>'}
      </div>
    </div>`;
  document.getElementById('ob-review-back').onclick = () => { obStep = obVisibleQuestions().length - 1; renderOnboardingWizard(); };
  const closeBtn = document.getElementById('ob-review-close');
  if (closeBtn) closeBtn.onclick = () => goTab('settings');
  const applyBtn = document.getElementById('ob-apply');
  if (applyBtn) applyBtn.onclick = () => obApplySettings(needsPin);
}
async function obApplySettings(needsPin) {
  const btn = document.getElementById('ob-apply');
  const pin = needsPin ? document.getElementById('ob-confirm-pin').value.trim() : undefined;
  if (needsPin && !pin) { toast('Enter your PIN to confirm the bank details change'); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Applying...'; }
  const prevSettings = STATE.settings;
  STATE.settings = obDraft;
  try {
    const res = await fetch('/api/data/settings', {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ value: obDraft, pin })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || 'Could not save');
    toast('Settings updated from the setup wizard');
    goTab('settings');
  } catch (e) {
    STATE.settings = prevSettings;
    toast(e.message || 'Could not save — check the connection and try again');
    if (btn) { btn.disabled = false; btn.textContent = 'Apply These Settings'; }
  }
}
