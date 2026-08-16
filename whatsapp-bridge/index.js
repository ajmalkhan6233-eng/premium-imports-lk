/* WhatsApp bridge — separate process from the main server (run with
   `npm run whatsapp`, keep it running alongside `npm start`). First run
   prints a QR code here; scan it from the shop's phone under WhatsApp >
   Linked Devices > Link a Device. The session is then saved under
   whatsapp-bridge/auth/ so it reconnects automatically after that. */
const path = require('path');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const { getData, putData, loadAnthropicKey } = require('./dataClient');
const { loadConversations, saveConversations, findOrCreateConversation, logMessage } = require('./conversations');
const { checkEscalation, HOLDING_REPLY, isWakePhrase } = require('./guards');
const { checkPaymentPlanIntent, formatPlanMenu, parsePlanChoice } = require('./paymentPlan');
const { generateReply } = require('./assistant');
const { generateSimpleReply } = require('./faqAssistant');
const ledger = require('./ledger');

const AUTH_DIR = path.join(__dirname, 'auth');
const QR_FILE = path.join(__dirname, 'qr.png');
// Message IDs the bridge itself sent, so an incoming fromMe event can be
// told apart from something Nushra typed herself on her own phone.
const sentMessageIds = new Set();
// Pending ledger actions awaiting a "yes" from the same sender, keyed by
// phone. In-memory only (lost on restart) — a lost pending action just
// means retyping the command, never a wrong write.
const pendingLedgerActions = new Map();

async function handleLedgerCommand(sock, jid, phone, text, customers) {
  const cmd = ledger.parseCommand(text);
  if (!cmd) {
    await sendReply(sock, jid, ledger.USAGE);
    return;
  }
  if (cmd.type === 'invalid') {
    await sendReply(sock, jid, "Couldn't read that amount. " + ledger.USAGE);
    return;
  }
  const cu = ledger.findOrCreateAgent(customers, phone, `Agent ${phone}`);

  if (cmd.type === 'bill' || cmd.type === 'paid') {
    pendingLedgerActions.set(phone, cmd);
    const verb = cmd.type === 'bill' ? 'Log' : 'Log payment of';
    await sendReply(sock, jid, `${verb} ${ledger.money(cmd.amount)} for ${cu.name}? Reply YES to confirm.`);
    return;
  }
  if (cmd.type === 'confirm') {
    const pending = pendingLedgerActions.get(phone);
    if (!pending) { await sendReply(sock, jid, 'Nothing pending to confirm.'); return; }
    pendingLedgerActions.delete(phone);
    const entry = ledger.applyLedgerEntry(cu, pending.type, pending.amount);
    await putData('customers', customers);
    const verb = pending.type === 'bill' ? 'Logged' : 'Logged payment of';
    await sendReply(sock, jid, `${verb} ${ledger.money(entry.amount)}. New balance: ${ledger.money(cu.dues)}.`);
    return;
  }
  if (cmd.type === 'reject') {
    pendingLedgerActions.delete(phone);
    await sendReply(sock, jid, 'Cancelled.');
    return;
  }
  if (cmd.type === 'ledger') {
    await sendReply(sock, jid, ledger.formatLedger(cu));
    return;
  }
  if (cmd.type === 'receipt') {
    await sendReply(sock, jid, ledger.formatReceipt(cu));
    return;
  }
}

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

function dataUrlToBuffer(dataUrl) {
  const match = /^data:[^;]+;base64,(.+)$/.exec(dataUrl || '');
  return match ? Buffer.from(match[1], 'base64') : null;
}

// Photo + a short promo line + the real price (looked up here, never taken
// from the model) — this is what actually sells over a text-only list.
async function sendProductPhoto(sock, jid, product, blurb) {
  const priceLine = `Rs. ${product.sellingPrice || 0}`;
  const caption = [blurb, priceLine].filter(Boolean).join('\n');
  const buffer = dataUrlToBuffer(product.photo);
  if (!buffer) return sendReply(sock, jid, `*${product.name}*\n${caption}`);
  const sent = await sock.sendMessage(jid, { image: buffer, caption });
  if (sent && sent.key && sent.key.id) sentMessageIds.add(sent.key.id);
  return sent;
}

async function handleIncoming(sock, msg) {
  const jid = msg.key.remoteJid;
  if (isIgnorableJid(jid)) return;
  const phone = jid.split('@')[0];

  // Barge-in: Nushra sending something herself from her real phone shows up
  // as fromMe too, exactly like our own sent replies do. Anything fromMe
  // that we didn't send ourselves means she just took over this chat — the
  // assistant then stays silent until "bot on" is typed into that same chat.
  if (msg.key.fromMe) {
    if (msg.key.id && sentMessageIds.has(msg.key.id)) return;
    const text = extractText(msg);
    if (!text) return;
    const customers = await getData('customers');
    const list = await loadConversations();
    const conv = findOrCreateConversation(list, phone, text, customers);

    if (isWakePhrase(text)) {
      if (conv.humanHandled) {
        conv.humanHandled = false;
        conv.handoffReason = null;
        logMessage(conv, 'nushra', text);
        await saveConversations(list);
        console.log(`[wake] ${phone}: wake phrase received — assistant resuming.`);
      }
      return;
    }

    // First time someone actually talks to this number over WhatsApp: save
    // them to the customer database (phone is what makes them findable —
    // the name is a placeholder until the shop fills in the real one).
    if (!conv.customerId) {
      const newCustomer = { id: `C${Date.now()}${Math.random().toString(36).slice(2, 6)}`, name: `WhatsApp ${phone}`, phone, address: '', dues: 0, ledger: [] };
      customers.push(newCustomer);
      await putData('customers', customers);
      conv.customerId = newCustomer.id;
      console.log(`[customer] ${phone}: added to customer database.`);
    }

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

  // Allowlisted staff/agent numbers only: fixed ledger command grammar,
  // never the AI assistant, never logged as a customer conversation (see
  // WHATSAPP_LEDGER_COMMAND.md and ledger.js).
  if (ledger.isAllowlisted(phone, settings)) {
    await handleLedgerCommand(sock, jid, phone, text, customers);
    return;
  }

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

  // 3. Reply — which engine depends on settings.whatsappTier (WhatsApp
  // product concept: "general" is the deterministic, no-AI-cost tier;
  // anything else (default, unset) keeps today's AI-grounded behavior so
  // existing shops/tests don't change without an explicit switch.
  if (settings.whatsappTier === 'general') {
    const reply = generateSimpleReply({ settings, products, assistantName, incomingText: text, isFirstMessage: conv.messages.length <= 1 });
    await sendReply(sock, jid, reply);
    logMessage(conv, 'assistant', reply);
    await saveConversations(list);
    return;
  }

  // 3b. Full AI reply, as the assistant persona ("pro" tier).
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
    const { text: replyText, productShowcases } = await generateReply({ apiKey, settings, products, assistantName, history, incomingText: text });

    for (const item of productShowcases) {
      const product = products.find((p) => p.name.toLowerCase() === String(item.name || '').toLowerCase() && (p.stock || 0) > 0);
      if (!product) continue; // model named something not actually in stock — skip rather than show a wrong item
      await sendProductPhoto(sock, jid, product, item.blurb || '');
      logMessage(conv, 'assistant', `[photo: ${product.name}] ${item.blurb || ''}`.trim());
    }

    if (replyText) {
      await sendReply(sock, jid, replyText);
      logMessage(conv, 'assistant', replyText);
    } else if (!productShowcases.length) {
      const fallback = "Sorry, give me a moment and I'll get back to you!";
      await sendReply(sock, jid, fallback);
      logMessage(conv, 'assistant', fallback);
    }
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
      QRCode.toFile(QR_FILE, qr, { width: 320 })
        .then(() => console.log(`(Also saved as an image: ${QR_FILE} — easier to view/scan than the terminal version above.)`))
        .catch((e) => console.error('Could not save QR image:', e.message));
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
