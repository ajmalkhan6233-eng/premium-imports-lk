/* Thin client for the main server's existing generic /api/data/:key
   endpoints — the bridge is just another client of the same API the
   internal app and storefront already use, so there's one writer path
   for data.json (the main server process) and no risk of two Node
   processes racing to write the same file. */
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3005';
const SECRETS_FILE = path.join(__dirname, '..', 'secrets.json');

async function getData(key) {
  const res = await fetch(`${BASE_URL}/api/data/${key}`);
  if (!res.ok) throw new Error(`GET /api/data/${key} failed: ${res.status}`);
  const json = await res.json();
  return json.value;
}

async function putData(key, value) {
  const res = await fetch(`${BASE_URL}/api/data/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value })
  });
  if (!res.ok) throw new Error(`PUT /api/data/${key} failed: ${res.status}`);
  return res.json();
}

function loadAnthropicKey() {
  try {
    const raw = fs.readFileSync(SECRETS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '';
  } catch (e) {
    return process.env.ANTHROPIC_API_KEY || '';
  }
}

module.exports = { getData, putData, loadAnthropicKey, BASE_URL };
