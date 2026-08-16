// AI-INTELLIGENCE-LAYER-v2-command.md Feature 2: swappable model backend.
// routes/ai-query.js only ever calls callModel() with a Claude-shaped
// {system, messages, tools} request and gets back a Claude-shaped
// {content, stop_reason} response — it never talks to a specific provider.
// MODEL_BACKEND=claude (default) proxies straight to the Anthropic Messages
// API, the same raw-fetch pattern server.js already uses for GRN/bill scan.
// MODEL_BACKEND=local targets an OpenAI-compatible /chat/completions
// endpoint (Ollama/LM Studio) at LOCAL_MODEL_URL, translating both
// directions so the rest of the app stays backend-agnostic.
const MODEL_BACKEND = process.env.MODEL_BACKEND || 'claude';
// Keep in sync with GRN_SCAN_MODEL in server.js if that's ever changed.
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5';

async function callClaude({ apiKey, system, messages, tools, maxTokens }) {
  if (!apiKey) throw new Error('Anthropic API key is not configured (secrets.json anthropicApiKey).');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens || 1024,
      system,
      messages,
      tools: tools && tools.length ? tools : undefined
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error: ${errText.slice(0, 500)}`);
  }
  return response.json(); // already {role, content: [...], stop_reason, ...}
}

function toOpenAiMessages(m) {
  if (typeof m.content === 'string') return [{ role: m.role, content: m.content }];
  if (m.role === 'assistant') {
    const textBlock = m.content.find((c) => c.type === 'text');
    const toolCalls = m.content.filter((c) => c.type === 'tool_use').map((c) => ({
      id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.input) }
    }));
    return [{ role: 'assistant', content: textBlock ? textBlock.text : null, tool_calls: toolCalls.length ? toolCalls : undefined }];
  }
  // user role: tool_result blocks -> one OpenAI "tool" message each; plain
  // text blocks -> a user message. m.content is always an array here.
  return m.content.map((c) => {
    if (c.type === 'tool_result') {
      return { role: 'tool', tool_call_id: c.tool_use_id, content: typeof c.content === 'string' ? c.content : JSON.stringify(c.content) };
    }
    return { role: 'user', content: c.text || '' };
  });
}

function fromOpenAiResponse(data) {
  const msg = ((data.choices || [])[0] || {}).message || {};
  const content = [];
  if (msg.content) content.push({ type: 'text', text: msg.content });
  (msg.tool_calls || []).forEach((tc) => {
    let input = {};
    try { input = JSON.parse(tc.function.arguments || '{}'); } catch (e) { /* leave empty, model sent malformed JSON */ }
    content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
  });
  return { role: 'assistant', content, stop_reason: (msg.tool_calls && msg.tool_calls.length) ? 'tool_use' : 'end_turn' };
}

async function callLocal({ localUrl, system, messages, tools, maxTokens }) {
  const oaMessages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    ...messages.flatMap(toOpenAiMessages)
  ];
  const oaTools = (tools || []).map((t) => ({
    type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema }
  }));
  const response = await fetch(`${localUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.LOCAL_MODEL_NAME || 'local-model',
      max_tokens: maxTokens || 1024,
      messages: oaMessages,
      tools: oaTools.length ? oaTools : undefined
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Local model error: ${errText.slice(0, 500)}`);
  }
  return fromOpenAiResponse(await response.json());
}

async function callModel(opts) {
  if (MODEL_BACKEND === 'local') {
    if (!process.env.LOCAL_MODEL_URL) throw new Error('LOCAL_MODEL_URL is not set (required when MODEL_BACKEND=local).');
    return callLocal(Object.assign({ localUrl: process.env.LOCAL_MODEL_URL }, opts));
  }
  return callClaude(opts);
}

module.exports = { callModel, MODEL_BACKEND };
