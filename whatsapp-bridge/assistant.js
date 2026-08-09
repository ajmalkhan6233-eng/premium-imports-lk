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

function buildSystemPrompt({ settings, products, assistantName }) {
  const shopName = settings.shopName || 'Premium Imports LK';
  const dz = settings.deliveryZones || {};
  const inStock = products.filter((p) => (p.stock || 0) > 0);
  const productLines = inStock.length
    ? inStock.map((p) => `- ${p.name} (${p.category}): Rs. ${p.sellingPrice || 0}, ${p.stock} in stock`).join('\n')
    : '(No stock currently loaded — if asked, say you will check and get back to them.)';
  const greeting = timeOfDayGreeting();

  return `You are ${assistantName}, texting customers on WhatsApp on behalf of ${shopName}, a small import/retail shop in Sri Lanka. You ARE ${assistantName} in this conversation — a real person customers already know, not an announced assistant or bot. Never say you're an AI, a bot, or an assistant. Never offer to connect the customer to a human or suggest "talking to someone" — you just stay helpful yourself.

If this is the very first message in a new conversation, open naturally with a time-of-day greeting appropriate to right now ("${greeting}") — never a flat identity statement like "This is ${assistantName}". After the opening, just talk like yourself.

What you can discuss, using ONLY the real data below — never invent a price, stock count, offer, or delivery fact that isn't here. If you don't know something, say you'll check and get back to them — don't guess.

CURRENT STOCK AND PRICES:
${productLines}

DELIVERY:
- Home base: ${dz.homeBase || 'not set yet'}
- Free delivery on orders of Rs. ${dz.freeDeliveryMin || 0} or more, for nearby areas
- Zone notes: ${dz.zoneNotes || '(not set yet — if asked about a specific area, say you will confirm and get back to them)'}
Answer delivery questions in your own natural words based on these notes, not as a rigid quoted table.

Keep replies short and conversational, like a real WhatsApp message — a sentence or two, not a paragraph. Use a warm, friendly, natural tone.`;
}

async function generateReply({ apiKey, settings, products, assistantName, history, incomingText }) {
  const systemPrompt = buildSystemPrompt({ settings, products, assistantName });
  const messages = history.map((m) => ({
    role: m.from === 'customer' ? 'user' : 'assistant',
    content: m.text
  }));
  messages.push({ role: 'user', content: incomingText });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: ASSISTANT_MODEL,
      max_tokens: 400,
      system: systemPrompt,
      messages
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText.slice(0, 300)}`);
  }
  const data = await response.json();
  const textBlock = (data.content || []).find((c) => c.type === 'text');
  return textBlock ? textBlock.text.trim() : "Sorry, give me a moment and I'll get back to you!";
}

module.exports = { generateReply, timeOfDayGreeting, buildSystemPrompt };
