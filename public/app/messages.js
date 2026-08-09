/* ================= MESSAGES (WhatsApp assistant log) ================= */
function sourceBadgeLabel(source) {
  return { facebook: 'Facebook', tiktok: 'TikTok', website: 'Website', direct: 'Direct' }[source] || 'Direct';
}
function renderMessages() {
  const c = document.getElementById('pageContent');
  const convos = [...(STATE.waConversations || [])].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  c.innerHTML = `
    <p class="sub">The WhatsApp assistant replies as ${escapeHtml(STATE.settings.assistantName || 'Nushra')}. Every message is logged here so you can see what it said and step in any time — just message the customer from your own phone and it hands off automatically.</p>
    ${convos.length === 0 ? `<div class="empty-state">No conversations yet. Run the WhatsApp bridge (see whatsapp-bridge/README.md) and scan the QR code to link the shop's WhatsApp number — conversations will appear here once customers start messaging.</div>` :
      convos.map((conv) => {
        const last = conv.messages[conv.messages.length - 1];
        const cu = conv.customerId ? STATE.customers.find((x) => x.id === conv.customerId) : null;
        return `<div class="list-row" data-id="${conv.id}">
          <div><div class="title">${escapeHtml(cu ? cu.name : conv.phone)}</div><div class="sub">${last ? escapeHtml(last.text.slice(0, 60)) : ''}</div></div>
          <div style="text-align:right">
            <span class="badge">${sourceBadgeLabel(conv.source)}</span>
            ${conv.humanHandled ? '<div class="sub" style="margin-top:4px">🧑 handled by you</div>' : ''}
          </div>
        </div>`;
      }).join('')}
  `;
  c.querySelectorAll('.list-row[data-id]').forEach((el) => {
    el.onclick = () => openConversationModal(el.dataset.id);
  });
}
function openConversationModal(id) {
  const conv = (STATE.waConversations || []).find((x) => x.id === id);
  if (!conv) return;
  const cu = conv.customerId ? STATE.customers.find((x) => x.id === conv.customerId) : null;
  openModal(`
    <h3>${escapeHtml(cu ? cu.name : conv.phone)}</h3>
    <div class="sub">${escapeHtml(conv.phone)} · ${sourceBadgeLabel(conv.source)}${conv.humanHandled ? ' · 🧑 handled by you' : ''}</div>
    <div style="max-height:50vh;overflow-y:auto;margin-top:10px">
      ${conv.messages.map((m) => `
        <div style="margin-bottom:10px;text-align:${m.from === 'customer' ? 'left' : 'right'}">
          <div class="sub" style="font-size:0.75rem">${m.from === 'customer' ? escapeHtml(cu ? cu.name : conv.phone) : m.from === 'nushra' ? 'You' : escapeHtml(STATE.settings.assistantName || 'Nushra')} · ${new Date(m.timestamp).toLocaleString('en-LK')}</div>
          <div class="card" style="display:inline-block;text-align:left;max-width:85%;background:${m.from === 'customer' ? 'var(--white)' : 'var(--cream-2)'}">${escapeHtml(m.text)}</div>
        </div>
      `).join('')}
    </div>
    <button class="btn secondary block" style="margin-top:10px" id="conv-close">Close</button>
  `);
  document.getElementById('conv-close').onclick = closeModal;
}
