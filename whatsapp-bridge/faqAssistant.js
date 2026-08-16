/* "General" tier reply engine — deterministic keyword matching against
   real shop data, no AI model call, no API cost. This is the cheapest
   tier of the WhatsApp product concept: a shop that just needs hours/
   delivery/location/price answered without paying for or configuring an
   AI assistant. Same data shape (settings/products) as assistant.js's AI
   engine — index.js picks between the two per settings.whatsappTier, so
   a shop can be upgraded from General to Pro without changing anything
   else about the bridge.

   Deliberately NOT trying to be clever — no fuzzy matching, no attempt
   at conversation memory, no tool-use. If nothing matches, it says so and
   holds, same as the AI engine's own fallback, and the guards.js
   escalation check (index.js) still runs first regardless of tier. */

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const INTENTS = [
  { name: 'hours', keywords: ['hour', 'open', 'close', 'timing', 'time you'] },
  { name: 'delivery', keywords: ['deliver', 'delivery', 'shipping', 'ship'] },
  { name: 'location', keywords: ['location', 'address', 'where are you', 'where is', 'find you'] },
  { name: 'greeting', keywords: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'] },
  { name: 'thanks', keywords: ['thank', 'thanks', 'thank you', 'thx'] }
];

function detectIntent(text) {
  const lower = String(text || '').toLowerCase();
  for (const intent of INTENTS) {
    if (intent.keywords.some((kw) => lower.includes(kw))) return intent.name;
  }
  return null;
}

// Simple substring product lookup — a customer typing (part of) a product
// name gets its price/stock back, no AI needed for this either. Returns
// at most 3 matches so a vague query doesn't dump the whole catalog.
function findMatchingProducts(text, products) {
  const lower = String(text || '').toLowerCase();
  const words = lower.split(/\s+/).filter((w) => w.length >= 3);
  if (!words.length) return [];
  return products
    .filter((p) => (p.stock || 0) >= 0 && words.some((w) => p.name.toLowerCase().includes(w)))
    .slice(0, 3);
}

function generateSimpleReply({ settings, products, assistantName, incomingText, isFirstMessage }) {
  const shopName = settings.shopName || 'the shop';
  const name = assistantName || 'the team';
  const greetingPrefix = isFirstMessage ? `${timeOfDayGreeting()}! ` : '';

  const productMatches = findMatchingProducts(incomingText, products);
  if (productMatches.length) {
    const lines = productMatches.map((p) => {
      const stockNote = (p.stock || 0) > 0 ? `${p.stock} in stock` : 'currently out of stock';
      return `*${p.name}* — Rs. ${p.sellingPrice || 0} (${stockNote})`;
    });
    return `${greetingPrefix}${lines.join('\n')}`;
  }

  const intent = detectIntent(incomingText);
  if (intent === 'hours') {
    return settings.shopHours
      ? `${greetingPrefix}We're open ${settings.shopHours}.`
      : `${greetingPrefix}Let me check our hours and get back to you.`;
  }
  if (intent === 'delivery') {
    const dz = settings.deliveryZones || {};
    if (dz.zoneNotes || dz.freeDeliveryMin) {
      const min = dz.freeDeliveryMin ? ` Free delivery on orders over Rs. ${dz.freeDeliveryMin}.` : '';
      return `${greetingPrefix}${dz.zoneNotes || 'We do deliver — ask us about your area.'}${min}`;
    }
    return `${greetingPrefix}Let me check delivery to your area and get back to you.`;
  }
  if (intent === 'location') {
    const base = (settings.deliveryZones && settings.deliveryZones.homeBase) || '';
    return base
      ? `${greetingPrefix}We're based in ${base}.`
      : `${greetingPrefix}Let me get you our exact location.`;
  }
  if (intent === 'greeting') {
    return `${greetingPrefix}Thanks for messaging ${shopName}! How can we help?`;
  }
  if (intent === 'thanks') {
    return `You're welcome! 😊`;
  }
  return `${greetingPrefix}Thanks for your message — ${name} will get back to you shortly!`;
}

module.exports = { generateSimpleReply, detectIntent, findMatchingProducts, timeOfDayGreeting };
