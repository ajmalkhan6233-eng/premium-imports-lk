/* ================= MESSAGES (WhatsApp assistant log) ================= */
function sourceBadgeLabel(source) {
  return { facebook: 'Facebook', tiktok: 'TikTok', website: 'Website', direct: 'Direct' }[source] || 'Direct';
}
// Minutes since the last message, only when that last message is from the
// customer (i.e. nobody — bot or human — has answered it yet). Requested
// by Ajmal: "remind you did not reply for this customer."
function minutesAwaitingReply(conv) {
  const msgs = conv.messages || [];
  if (msgs.length === 0) return null;
  const last = msgs[msgs.length - 1];
  if (last.from !== 'customer') return null;
  return Math.max(0, Math.round((Date.now() - new Date(last.timestamp).getTime()) / 60000));
}
function fmtElapsed(mins) {
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}
function renderMessages() {
  const c = document.getElementById('pageContent');
  const convos = [...(STATE.waConversations || [])]
    .map((conv) => Object.assign({ _waitMins: minutesAwaitingReply(conv) }, conv))
    .sort((a, b) => {
      if ((a._waitMins !== null) !== (b._waitMins !== null)) return a._waitMins !== null ? -1 : 1;
      if (a._waitMins !== null && b._waitMins !== null) return b._waitMins - a._waitMins;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
  const waitingCount = convos.filter((c2) => c2._waitMins !== null).length;
  c.innerHTML = `
    <p class="sub">The WhatsApp assistant replies as ${escapeHtml(STATE.settings.assistantName || 'Nushra')}. Every message is logged here so you can see what it said and step in any time — just message the customer from your own phone and it hands off automatically.</p>
    ${waitingCount > 0 ? `<div class="card" style="border-color:var(--red);margin-bottom:12px"><strong>${waitingCount} conversation${waitingCount === 1 ? '' : 's'} waiting on a reply</strong></div>` : ''}
    ${convos.length === 0 ? `<div class="empty-state">No conversations yet. Run the WhatsApp bridge (see whatsapp-bridge/README.md) and scan the QR code to link the shop's WhatsApp number — conversations will appear here once customers start messaging.</div>` :
      convos.map((conv) => {
        const last = conv.messages[conv.messages.length - 1];
        const cu = conv.customerId ? STATE.customers.find((x) => x.id === conv.customerId) : null;
        return `<div class="list-row" data-id="${conv.id}">
          <div><div class="title">${escapeHtml(cu ? cu.name : conv.phone)}</div><div class="sub">${last ? escapeHtml(last.text.slice(0, 60)) : ''}</div></div>
          <div style="text-align:right">
            <span class="badge">${sourceBadgeLabel(conv.source)}</span>
            ${conv._waitMins !== null ? `<div class="badge due" style="margin-top:4px">Needs reply · ${fmtElapsed(conv._waitMins)}</div>` : ''}
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
