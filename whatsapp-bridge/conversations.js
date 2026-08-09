/* Conversation log: reads/writes waConversations via the main server's API
   (see dataClient.js). Conversations are keyed by phone number. */
const { getData, putData } = require('./dataClient');

const SOURCE_PHRASES = [
  { source: 'facebook', phrase: 'i saw this on facebook' },
  { source: 'tiktok', phrase: 'i saw this on tiktok' }
];

function detectSource(firstMessageText) {
  const lower = String(firstMessageText || '').toLowerCase();
  const hit = SOURCE_PHRASES.find((s) => lower.includes(s.phrase));
  return hit ? hit.source : 'direct';
}

function matchCustomerId(phone, customers) {
  const digits = String(phone || '').replace(/\D/g, '');
  const match = customers.find((cu) => cu.phone && cu.phone.replace(/\D/g, '') === digits);
  return match ? match.id : null;
}

async function loadConversations() {
  return getData('waConversations');
}

async function saveConversations(list) {
  await putData('waConversations', list);
}

function findOrCreateConversation(list, phone, firstMessageText, customers) {
  let conv = list.find((c) => c.phone === phone);
  if (conv) return conv;
  conv = {
    id: phone,
    phone,
    customerId: matchCustomerId(phone, customers),
    source: detectSource(firstMessageText),
    humanHandled: false,
    handoffReason: null,
    awaitingPlanChoice: false,
    planChoice: null,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  list.push(conv);
  return conv;
}

function logMessage(conv, from, text) {
  conv.messages.push({ from, text, timestamp: new Date().toISOString() });
  conv.updatedAt = new Date().toISOString();
}

module.exports = { loadConversations, saveConversations, findOrCreateConversation, logMessage, detectSource, matchCustomerId };
