// AI-INTELLIGENCE-LAYER-v2-command.md Feature 2: AI Query Endpoint.
//
// The model gets READ-ONLY tool functions that read straight from the live
// `db` object (in-process, no HTTP round-trip) — it never sees a write/
// delete route and can't invent a figure it wasn't handed by a tool result.
// Guardrails: tools are read-only by construction (runTool only ever reads
// db.*, never assigns into it or calls saveData); every tool returns an
// explicit "no data" signal instead of an empty result so the model has
// something unambiguous to relay rather than a blank to fill in; every
// query (including its tool calls) is logged; and only one request runs at
// a time (inFlight) since this is a single small LAN box, not a service
// meant to field concurrent AI calls.
const express = require('express');
const fs = require('fs');
const path = require('path');
const { callModel, MODEL_BACKEND } = require('../lib/model-backend');
const { computeNetProfit } = require('../lib/reports');

const LOG_FILE = path.join(__dirname, '..', 'logs', 'ai-query-log.json');
const MAX_ROWS = 50; // cap tool result size so one broad query can't flood the model's context
const MAX_TURNS = 6; // ceiling on tool-call round-trips per question (e.g. "compare this month to last")

function loadLog() {
  if (!fs.existsSync(LOG_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch (e) { return []; }
}
// Same atomic tmp-then-rename pattern as saveData() in server.js, so a
// crash mid-write can't leave the log file half-written/corrupt.
function appendLog(entry) {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const log = loadLog();
  log.push(entry);
  const tmp = LOG_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(log, null, 2));
  fs.renameSync(tmp, LOG_FILE);
}

const TOOLS = [
  {
    name: 'getSales',
    description: 'Get sales revenue and line items in a date range, optionally filtered by product name (substring) or exact category.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'YYYY-MM-DD, inclusive' },
        to: { type: 'string', description: 'YYYY-MM-DD, inclusive' },
        product: { type: 'string' },
        category: { type: 'string' }
      },
      required: ['from', 'to']
    }
  },
  {
    name: 'getExpenses',
    description: 'Get logged business expenses in a date range, optionally filtered by exact category (rent, salaries, transport, utilities, packaging, misc).',
    input_schema: {
      type: 'object',
      properties: { from: { type: 'string' }, to: { type: 'string' }, category: { type: 'string' } },
      required: ['from', 'to']
    }
  },
  {
    name: 'getGRN',
    description: 'Get goods-received (stock purchase) entries in a date range, optionally filtered by vendor name (substring).',
    input_schema: {
      type: 'object',
      properties: { from: { type: 'string' }, to: { type: 'string' }, vendor: { type: 'string' } },
      required: ['from', 'to']
    }
  },
  {
    name: 'getVendorLedger',
    description: "Get a vendor's ledger history and current balance, by vendor name (substring match).",
    input_schema: { type: 'object', properties: { vendor: { type: 'string' } }, required: ['vendor'] }
  },
  {
    name: 'getStockLevel',
    description: 'Get current stock levels, optionally filtered by product name (substring).',
    input_schema: { type: 'object', properties: { product: { type: 'string' } } }
  },
  {
    name: 'computeNetProfit',
    description: 'Compute revenue, cost of goods sold, expenses, and net profit for a date range.',
    input_schema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, required: ['from', 'to'] }
  }
];

module.exports = function ({ db, requireSession, loadSecrets, todayStamp }) {
  const router = express.Router();
  let inFlight = false;

  function runTool(name, input) {
    input = input || {};
    switch (name) {
      case 'getSales': {
        const items = [];
        (db.bills || [])
          .filter((b) => b.type !== 'quote' && b.status !== 'voided' && b.date >= input.from && b.date <= input.to)
          .forEach((b) => {
            (b.items || []).forEach((it) => {
              if (input.product && !it.name.toLowerCase().includes(String(input.product).toLowerCase())) return;
              if (input.category && it.category && it.category !== input.category) return;
              items.push({ date: b.date, bill: b.number, name: it.name, category: it.category, qty: it.qty, price: it.price });
            });
          });
        if (items.length === 0) return { totalRevenue: 0, count: 0, note: 'No matching sales found for this range/filter.' };
        return { totalRevenue: items.reduce((s, it) => s + it.qty * it.price, 0), count: items.length, items: items.slice(0, MAX_ROWS) };
      }
      case 'getExpenses': {
        let list = (db.expenses || []).filter((e) => !e.voided && e.date >= input.from && e.date <= input.to);
        if (input.category) list = list.filter((e) => e.category === input.category);
        if (list.length === 0) return { totalAmount: 0, count: 0, note: 'No matching expenses found for this range/filter.' };
        return {
          totalAmount: list.reduce((s, e) => s + (e.amount || 0), 0), count: list.length,
          items: list.slice(0, MAX_ROWS).map((e) => ({ date: e.date, category: e.category, description: e.description, amount: e.amount }))
        };
      }
      case 'getGRN': {
        let list = (db.grns || []).filter((g) => g.date >= input.from && g.date <= input.to);
        if (input.vendor) list = list.filter((g) => (g.vendorName || '').toLowerCase().includes(String(input.vendor).toLowerCase()));
        if (list.length === 0) return { totalCost: 0, count: 0, note: 'No matching GRN entries found for this range/filter.' };
        return {
          totalCost: list.reduce((s, g) => s + (g.total || 0), 0), count: list.length,
          items: list.slice(0, MAX_ROWS).map((g) => ({ date: g.date, number: g.number, vendor: g.vendorName, total: g.total }))
        };
      }
      case 'getVendorLedger': {
        const vendor = (db.vendors || []).find((v) => v.name.toLowerCase().includes(String(input.vendor || '').toLowerCase()));
        if (!vendor) return { note: `No vendor found matching "${input.vendor}".` };
        return { vendor: vendor.name, balance: vendor.balance || 0, ledger: (vendor.ledger || []).slice(-MAX_ROWS) };
      }
      case 'getStockLevel': {
        let list = db.products || [];
        if (input.product) list = list.filter((p) => p.name.toLowerCase().includes(String(input.product).toLowerCase()));
        if (list.length === 0) return { count: 0, note: `No products found matching "${input.product}".` };
        return { count: list.length, items: list.slice(0, MAX_ROWS).map((p) => ({ name: p.name, category: p.category, stock: p.stock || 0 })) };
      }
      case 'computeNetProfit':
        return computeNetProfit(db, { from: input.from, to: input.to });
      default:
        return { note: `Unknown tool: ${name}` };
    }
  }

  function systemPrompt() {
    return `You are a business-data assistant for Premium Imports LK, a small import/retail shop in Sri Lanka. Answer questions about sales, expenses, GRN/purchases, vendors, stock, and profit using ONLY the tools provided — never estimate, guess, or invent a number. Every figure in your answer must come directly from a tool result. If a tool result has count: 0 or a "note" saying nothing was found, say plainly that there's no data for that instead of making up a plausible-sounding figure. Today's date is ${todayStamp()}. Keep answers short and direct, in plain language, quoting the actual numbers (Rs.) from the tool results.`;
  }

  router.post('/ai-query', async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    if (inFlight) return res.status(429).json({ error: 'busy', message: 'Another question is being answered — try again in a moment.' });
    const { question } = req.body || {};
    if (!question || !String(question).trim()) return res.status(400).json({ error: 'bad_request', message: 'Ask a question first.' });
    const secrets = loadSecrets();
    if (MODEL_BACKEND === 'claude' && !secrets.anthropicApiKey) {
      return res.status(400).json({ error: 'not_configured', message: 'AI query needs an Anthropic API key first (secrets.json "anthropicApiKey").' });
    }
    inFlight = true;
    const dataUsed = [];
    const messages = [{ role: 'user', content: [{ type: 'text', text: String(question).trim() }] }];
    try {
      let finalText = '';
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const result = await callModel({
          apiKey: secrets.anthropicApiKey, system: systemPrompt(), messages, tools: TOOLS, maxTokens: 1024
        });
        messages.push({ role: 'assistant', content: result.content });
        const toolUses = (result.content || []).filter((c) => c.type === 'tool_use');
        if (!toolUses.length || result.stop_reason !== 'tool_use') {
          const textBlock = (result.content || []).find((c) => c.type === 'text');
          finalText = textBlock ? textBlock.text : '';
          break;
        }
        const toolResults = toolUses.map((tu) => {
          const output = runTool(tu.name, tu.input);
          dataUsed.push({ tool: tu.name, input: tu.input, output });
          return { type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(output) };
        });
        messages.push({ role: 'user', content: toolResults });
      }
      if (!finalText) finalText = "I couldn't work out a confident answer from the available data — try rephrasing the question.";
      appendLog({ timestamp: new Date().toISOString(), user: session.user, question: String(question).trim(), backend: MODEL_BACKEND, dataUsed, answer: finalText });
      res.json({ answer: finalText, dataUsed });
    } catch (e) {
      res.status(502).json({ error: 'model_error', message: e.message });
    } finally {
      inFlight = false;
    }
  });

  router.get('/ai-query/recent', (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const mine = loadLog().filter((l) => l.user === session.user).slice(-5).reverse();
    res.json({ recent: mine.map((l) => ({ question: l.question, answer: l.answer, timestamp: l.timestamp })) });
  });

  return router;
};
