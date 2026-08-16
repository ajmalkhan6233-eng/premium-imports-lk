/* The AI assistant's reply generation. Replies AS the named person
   (settings.assistantName, default "Nushra") — not an announced bot, and
   never offers to hand off to a human. Only real, live shop data goes into
   the prompt; the model is told never to invent prices/stock/facts. */
const ASSISTANT_MODEL = 'claude-sonnet-5';

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Lets the model signal "show a photo of this" instead of only replying in
// text — the bridge does the actual sending (real photo, real price looked
// up from data) so a price can never be invented inside a caption.
const SHOW_PRODUCTS_TOOL = {
  name: 'show_products',
  description: 'Show the customer photo(s) of specific in-stock products, each with a short one-line promotional caption. Use this whenever the customer asks what you have / what\'s available, or asks about specific item(s) by name — a photo sells far better than a text list. Do not use it for questions that aren\'t about browsing/choosing a product (e.g. delivery, hours, order status).',
  input_schema: {
    type: 'object',
    properties: {
      products: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Exact product name, copied exactly from CURRENT STOCK AND PRICES' },
            blurb: { type: 'string', description: 'One short, warm, natural promotional line about this product — no price and no facts beyond what\'s given, the system adds the real price after your caption' }
          },
          required: ['name', 'blurb']
        }
      }
    },
    required: ['products']
  }
};

// Tier ladder (WhatsApp product concept — see whatsapp-bridge/index.js
// for the 'general' no-AI tier, handled entirely outside this file):
//   light    — natural AI conversation grounded in real data, text only.
//              No product photos, no payment-plan intelligence. Cheapest
//              AI tier: no tool-use round trip.
//   standard — light + the show_products tool (real photo + real price
//              sent for items the customer asks about) — "a photo sells
//              better than a text list."
//   pro      — standard + payment-plan menu logic (handled in index.js,
//              gated there by tier, not here) and whatever's added next.
// Deliberately implemented as one engine with escalating capability, not
// three separate prompt files — the shop-specific grounding (products,
// hours, delivery) is identical at every tier, only what the model is
// allowed to DO changes.
function buildSystemPrompt({ settings, products, assistantName, tier }) {
  const shopName = settings.shopName || 'Premium Imports LK';
  const dz = settings.deliveryZones || {};
  const inStock = products.filter((p) => (p.stock || 0) > 0);
  const productLines = inStock.length
    ? inStock.map((p) => `- ${p.name} (${p.category}): Rs. ${p.sellingPrice || 0}, ${p.stock} in stock${p.photo ? ', has a photo' : ', no photo on file'}`).join('\n')
    : '(No stock currently loaded — if asked, say you will check and get back to them.)';
  const greeting = timeOfDayGreeting();
  const canShowPhotos = tier === 'standard' || tier === 'pro';

  return `You are ${assistantName}, texting customers on WhatsApp on behalf of ${shopName}, a small import/retail shop in Sri Lanka. You ARE ${assistantName} in this conversation — a real person customers already know, not an announced assistant or bot. Never say you're an AI, a bot, or an assistant. Never offer to connect the customer to a human or suggest "talking to someone" — you just stay helpful yourself.

If this is the very first message in a new conversation, open naturally with a time-of-day greeting appropriate to right now ("${greeting}") — never a flat identity statement like "This is ${assistantName}". After the opening, just talk like yourself.

What you can discuss, using ONLY the real data below — never invent a price, stock count, offer, or delivery fact that isn't here. If you don't know something, say you'll check and get back to them — don't guess.

OPENING HOURS: ${settings.shopHours || '(not set yet — if asked, say you will confirm and get back to them)'}

CURRENT STOCK AND PRICES:
${productLines}

DELIVERY:
- Home base: ${dz.homeBase || 'not set yet'}
- Free delivery on orders of Rs. ${dz.freeDeliveryMin || 0} or more, for nearby areas
- Zone notes: ${dz.zoneNotes || '(not set yet — if asked about a specific area, say you will confirm and get back to them)'}
Answer delivery questions in your own natural words based on these notes, not as a rigid quoted table.

${canShowPhotos ? `SHOWING PRODUCTS: when a customer asks what's available, or asks about a specific item that has a photo on file, call the show_products tool with the exact product name(s) — customers respond far better to a photo than a text list. Keep any accompanying text reply short since the photo+caption is doing the selling. Only ever name products that are actually in CURRENT STOCK AND PRICES.` : `When a customer asks what's available or about a specific item, describe it and its price in your reply text — you don't have a way to send photos on this plan.`}

Keep replies short and conversational, like a real WhatsApp message — a sentence or two, not a paragraph. Use a warm, friendly, natural tone — a little persuasive/sales-minded is good, but never dishonest or pushy.`;
}

async function generateReply({ apiKey, settings, products, assistantName, history, incomingText, tier }) {
  const canShowPhotos = tier === 'standard' || tier === 'pro';
  const systemPrompt = buildSystemPrompt({ settings, products, assistantName, tier });
  const messages = history.map((m) => ({
    role: m.from === 'customer' ? 'user' : 'assistant',
    content: m.text
  }));
  messages.push({ role: 'user', content: incomingText });

  const body = {
    model: ASSISTANT_MODEL,
    max_tokens: 500,
    system: systemPrompt,
    messages
  };
  if (canShowPhotos) body.tools = [SHOW_PRODUCTS_TOOL];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText.slice(0, 300)}`);
  }
  const data = await response.json();
  const content = data.content || [];
  const text = content.filter((c) => c.type === 'text').map((c) => c.text.trim()).filter(Boolean).join('\n\n');
  const productShowcases = content
    .filter((c) => c.type === 'tool_use' && c.name === 'show_products')
    .flatMap((c) => (c.input && Array.isArray(c.input.products)) ? c.input.products : []);
  return { text, productShowcases };
}

module.exports = { generateReply, timeOfDayGreeting, buildSystemPrompt, SHOW_PRODUCTS_TOOL };
