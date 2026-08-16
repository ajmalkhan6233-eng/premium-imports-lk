/* Thin client for the main server's existing generic /api/data/:key
   endpoints — the bridge is just another client of the same API the
   internal app and storefront already use, so there's one writer path
   for data.json (the main server process) and no risk of two Node
   processes racing to write the same file. */
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3005';
const SECRETS_FILE = path.join(__dirname, '..', 'secrets.json');

// AUTH_COMMAND.md Step 5: the main server now requires either a staff
// session or this service credential on every /api/data/:key request
// (scoped server-side to exactly the keys this bridge needs — settings,
// products, customers, waConversations reads; customers, waConversations
// writes). server.js generates and persists this token into secrets.json
// on its own first run, so there's nothing to configure here beyond
// reading the same file this bridge already reads the Anthropic key from.
function loadServiceToken() {
  try {
    const raw = fs.readFileSync(SECRETS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.serviceToken || '';
  } catch (e) {
    return '';
  }
}

async function getData(key) {
  const res = await fetch(`${BASE_URL}/api/data/${key}`, {
    headers: { 'X-Service-Token': loadServiceToken() }
  });
  if (!res.ok) throw new Error(`GET /api/data/${key} failed: ${res.status}`);
  const json = await res.json();
  return json.value;
}

async function putData(key, value) {
  const res = await fetch(`${BASE_URL}/api/data/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Service-Token': loadServiceToken() },
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
