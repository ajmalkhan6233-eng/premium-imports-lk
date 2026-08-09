/* WhatsApp bridge — separate process from the main server (run with
   `npm run whatsapp`, keep it running alongside `npm start`). First run
   prints a QR code here; scan it from the shop's phone under WhatsApp >
   Linked Devices > Link a Device. The session is then saved under
   whatsapp-bridge/auth/ so it reconnects automatically after that. */
const path = require('path');
const qrcodeTerminal = require('qrcode-terminal');
const { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const { getData, loadAnthropicKey } = require('./dataClient');
const { loadConversations, saveConversations, findOrCreateConversation, logMessage } = require('./conversations');
const { checkEscalation, HOLDING_REPLY } = require('./guards');
const { checkPaymentPlanIntent, formatPlanMenu, parsePlanChoice } = require('./paymentPlan');
const { generateReply } = require('./assistant');

const AUTH_DIR = path.join(__dirname, 'auth');
// Message IDs the bridge itself sent, so an incoming fromMe event can be
// told apart from something Nushra typed herself on her own phone.
const sentMessageIds = new Set();

function unwrapMessage(m) {
  if (!m) return null;
  if (m.ephemeralMessage) return unwrapMessage(m.ephemeralMessage.message);
  if (m.viewOnceMessage) return unwrapMessage(m.viewOnceMessage.message);
  if (m.viewOnceMessageV2) return unwrapMessage(m.viewOnceMessageV2.message);
  return m;
}
function extractText(msg) {
  const m = unwrapMessage(msg.message);
  if (!m) return null;
  return m.conversation
    || (m.extendedTextMessage && m.extendedTextMessage.text)
    || (m.imageMessage && m.imageMessage.caption)
    || (m.videoMessage && m.videoMessage.caption)
    || null;
}
function isIgnorableJid(jid) {
  return !jid || jid.endsWith('@g.us') || jid.endsWith('@newsletter') || jid === 'status@broadcast';
}

async function sendReply(sock, jid, text) {
  const sent = await sock.sendMessage(jid, { text });
  if (sent && sent.key && sent.key.id) sentMessageIds.add(sent.key.id);
  return sent;
}

async function handleIncoming(sock, msg) {
  const jid = msg.key.remoteJid;
  if (isIgnorableJid(jid)) return;
  const phone = jid.split('@')[0];

  // Barge-in: Nushra sending something herself from her real phone shows up
  // as fromMe too, exactly like our own sent replies do. Anything fromMe
  // that we didn't send ourselves means she just took over this chat.
  if (msg.key.fromMe) {
    if (msg.key.id && sentMessageIds.has(msg.key.id)) return;
    const text = extractText(msg);
    if (!text) return;
    const customers = await getData('customers');
    const list = await loadConversations();
    const conv = findOrCreateConversation(list, phone, text, customers);
    conv.humanHandled = true;
    conv.handoffReason = 'manual';
    conv.awaitingPlanChoice = false;
    logMessage(conv, 'nushra', text);
    await saveConversations(list);
    console.log(`[handoff] ${phone}: replied manually — assistant stepping back for this chat.`);
    return;
  }

  const text = extractText(msg);
  if (!text) return;

  const [settings, products, customers] = await Promise.all([getData('settings'), getData('products'), getData('customers')]);
  const list = await loadConversations();
  const conv = findOrCreateConversation(list, phone, text, customers);
  logMessage(conv, 'customer', text);

  if (conv.humanHandled) {
    // Already handed off — log it so there's a full record, but stay quiet.
    await saveConversations(list);
    return;
  }

  const assistantName = settings.assistantName || 'Nushra';

  // 1. Hard escalation guard — deterministic, runs before the AI ever sees it.
  const { escalate, matchedKeyword } = checkEscalation(text);
  if (escalate) {
    conv.humanHandled = true;
    conv.handoffReason = 'escalation';
    await sendReply(sock, jid, HOLDING_REPLY);
    logMessage(conv, 'assistant', HOLDING_REPLY);
    await saveConversations(list);
    console.log(`[escalate] ${phone}: matched "${matchedKeyword}" — flagged for a human, assistant stopped.`);
    return;
  }

  // 2. Payment-plan structured menu (known customers only).
  if (conv.awaitingPlanChoice) {
    const plan = parsePlanChoice(text, settings.paymentPlans || []);
    if (plan) {
      conv.planChoice = plan.name;
      conv.awaitingPlanChoice = false;
      const ack = `Got it, ${plan.name} it is! We'll set that up properly when your order's processed. 😊`;
      await sendReply(sock, jid, ack);
      logMessage(conv, 'assistant', ack);
      await saveConversations(list);
      return;
    }
    // Not a recognized number — fall through and let the AI respond normally.
  }
  if (checkPaymentPlanIntent(text) && conv.customerId) {
    const menu = formatPlanMenu(settings.paymentPlans || []);
    conv.awaitingPlanChoice = true;
    await sendReply(sock, jid, menu);
    logMessage(conv, 'assistant', menu);
    await saveConversations(list);
    return;
  }

  // 3. Normal AI reply, as the assistant persona.
  const apiKey = loadAnthropicKey();
  if (!apiKey) {
    const holding = "Sorry, give me a bit and I'll get back to you!";
    await sendReply(sock, jid, holding);
    logMessage(conv, 'assistant', holding);
    await saveConversations(list);
    console.warn('[assistant] No Anthropic API key configured in secrets.json — sent a holding reply instead of a real one.');
    return;
  }
  try {
    const history = conv.messages.slice(0, -1); // exclude the customer message just logged; generateReply appends it itself
    const reply = await generateReply({ apiKey, settings, products, assistantName, history, incomingText: text });
    await sendReply(sock, jid, reply);
    logMessage(conv, 'assistant', reply);
  } catch (e) {
    console.error('[assistant] reply generation failed:', e.message);
    const fallback = 'Sorry, having a bit of trouble on my end — give me a moment!';
    await sendReply(sock, jid, fallback);
    logMessage(conv, 'assistant', fallback);
  }
  await saveConversations(list);
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const sock = makeWASocket({
    auth: state,
    browser: Browsers.appropriate('Chrome')
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log("\nScan this QR code with the shop's WhatsApp (Settings > Linked Devices > Link a Device):\n");
      qrcodeTerminal.generate(qr, { small: true });
    }
    if (connection === 'close') {
      const statusCode = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      console.log(`Connection closed (${statusCode || 'unknown'}).${loggedOut ? ' Logged out — delete whatsapp-bridge/auth/ and restart to re-link.' : ' Reconnecting...'}`);
      if (!loggedOut) start();
    } else if (connection === 'open') {
      console.log('\n=========================================');
      console.log('  WhatsApp bridge connected and running');
      console.log('  Keep this running alongside the main server.');
      console.log('=========================================\n');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      try {
        await handleIncoming(sock, msg);
      } catch (e) {
        console.error('[bridge] error handling message:', e);
      }
    }
  });
}

if (require.main === module) {
  start().catch((e) => {
    console.error('WhatsApp bridge failed to start:', e);
    process.exit(1);
  });
}

module.exports = { handleIncoming, extractText, unwrapMessage, isIgnorableJid };
