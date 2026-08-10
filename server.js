const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3005;
const DATA_FILE = path.join(__dirname, 'data.json');
const TMP_FILE = path.join(__dirname, 'data.json.tmp');
const BACKUP_DIR = path.join(__dirname, 'backups');
const SECRETS_FILE = path.join(__dirname, 'secrets.json');

// Vision-capable model used for the optional photo-scan features: GRN scan (4A)
// and Sell-screen "Scan Old Bill". Change here if a newer vision model should be used instead.
const GRN_SCAN_MODEL = 'claude-sonnet-5';

function defaultData() {
  return {
    settings: {
      shopName: 'Premium Imports LK',
      whatsappNumber: '94771226621',
      bankDetails: { accountName: '', accountNumber: '', bankName: '', branch: '' },
      categories: ['Chocolate', 'Wash Items', 'Other'],
      users: [
        { name: 'AJMAL', pin: '1234', role: 'admin' },
        { name: 'NUSHRA', pin: '1234', role: 'staff' }
      ],
      startingBillNumber: 1,
      logo: null,
      assistantName: 'Nushra',
      shopHours: '',
      deliveryZones: {
        homeBase: 'Thihariya junction',
        freeDeliveryMin: 2000,
        zoneNotes: ''
      },
      paymentPlans: [
        { name: 'Pay in full', days: 0 },
        { name: '5 days', days: 5 },
        { name: '1 week', days: 7 }
      ],
      agingThresholdDays: 30
    },
    products: [],
    customers: [],
    vendors: [],
    lenders: [],
    bills: [],
    grns: [],
    orders: [],
    waConversations: [],
    documents: []
  };
}

// One-time migration: older data files stored logins as settings.pins
// ({ NAME: pin }) with no roles. Convert to settings.users, treating
// AJMAL as the (only) admin and everyone else as staff.
function migrateUsers(settings) {
  if (settings.users && settings.users.length) return settings;
  if (settings.pins) {
    settings.users = Object.keys(settings.pins).map((name) => ({
      name, pin: settings.pins[name], role: name === 'AJMAL' ? 'admin' : 'staff'
    }));
    delete settings.pins;
  } else {
    settings.users = defaultData().settings.users;
  }
  return settings;
}

// Existing settings objects are a full replacement under Object.assign (it's
// a shallow merge), so any settings field added after someone's data.json
// was first created needs to be explicitly backfilled here or it silently
// never appears for them.
function backfillSettingsDefaults(settings) {
  const d = defaultData().settings;
  let changed = false;
  if (settings.assistantName === undefined) { settings.assistantName = d.assistantName; changed = true; }
  if (settings.shopHours === undefined) { settings.shopHours = d.shopHours; changed = true; }
  if (!settings.deliveryZones) { settings.deliveryZones = d.deliveryZones; changed = true; }
  if (!settings.paymentPlans) { settings.paymentPlans = d.paymentPlans; changed = true; }
  if (settings.agingThresholdDays === undefined) { settings.agingThresholdDays = d.agingThresholdDays; changed = true; }
  return changed;
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const fresh = defaultData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  const hadOldPins = !!(parsed.settings && parsed.settings.pins);
  const merged = Object.assign(defaultData(), parsed);
  merged.settings = migrateUsers(merged.settings);
  const backfilled = backfillSettingsDefaults(merged.settings);
  if (hadOldPins || backfilled) fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2));
  return merged;
}

function loadSecrets() {
  if (!fs.existsSync(SECRETS_FILE)) {
    fs.writeFileSync(SECRETS_FILE, JSON.stringify({ anthropicApiKey: '' }, null, 2));
    return { anthropicApiKey: process.env.ANTHROPIC_API_KEY || '' };
  }
  try {
    const raw = fs.readFileSync(SECRETS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return { anthropicApiKey: parsed.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '' };
  } catch (e) {
    return { anthropicApiKey: process.env.ANTHROPIC_API_KEY || '' };
  }
}

let db = loadData();
loadSecrets(); // ensures secrets.json exists with a blank key on first run
let lastBackupDate = null;

function todayStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function maybeBackup() {
  const stamp = todayStamp();
  if (lastBackupDate === stamp) return;
  if (!fs.existsSync(DATA_FILE)) return;
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const backupPath = path.join(BACKUP_DIR, `data-${stamp}.json`);
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(DATA_FILE, backupPath);
  }
  lastBackupDate = stamp;
}

function saveData() {
  maybeBackup();
  fs.writeFileSync(TMP_FILE, JSON.stringify(db, null, 2));
  fs.renameSync(TMP_FILE, DATA_FILE);
}

const app = express();
app.use(express.json({ limit: '30mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get('/api/data/:key', (req, res) => {
  const key = req.params.key;
  if (!(key in db)) {
    return res.status(404).json({ error: `Unknown key: ${key}` });
  }
  res.json({ key, value: db[key] });
});

app.put('/api/data/:key', (req, res) => {
  const key = req.params.key;
  if (!(key in db)) {
    return res.status(404).json({ error: `Unknown key: ${key}` });
  }
  if (!('value' in req.body)) {
    return res.status(400).json({ error: 'Missing value in body' });
  }
  db[key] = req.body.value;
  saveData();
  res.json({ ok: true });
});

app.get('/api/grn-scan/status', (req, res) => {
  const secrets = loadSecrets();
  res.json({ configured: !!secrets.anthropicApiKey });
});

const GRN_SCAN_PROMPT = `You are reading a photo taken during goods receiving at a small import/retail shop (invoice, packing slip, or the products themselves). List every distinct product you can identify.

Respond with ONLY a JSON array, no other text, no markdown fences. Each element must have exactly these fields:
[{"name": string, "quantity": number|null, "costPrice": number|null}]

Rules:
- "name" should always be your best reading of the product name/description, even if imperfect.
- If you cannot confidently read a quantity or a cost price for a line, set that field to null. Do NOT guess a number you can't actually read.
- If nothing readable is found, respond with an empty array: []`;

app.post('/api/grn-scan', async (req, res) => {
  const secrets = loadSecrets();
  if (!secrets.anthropicApiKey) {
    return res.status(400).json({
      error: 'not_configured',
      message: `Photo scan needs an Anthropic API key first. Add it to ${SECRETS_FILE} (the "anthropicApiKey" field), then restart the server.`
    });
  }
  const { imageBase64, mediaType } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: 'bad_request', message: 'Missing imageBase64' });
  }
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': secrets.anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: GRN_SCAN_MODEL,
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: GRN_SCAN_PROMPT }
          ]
        }]
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: 'anthropic_error', message: errText.slice(0, 500) });
    }
    const data = await response.json();
    const textBlock = (data.content || []).find((c) => c.type === 'text');
    const raw = textBlock ? textBlock.text : '[]';
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    let lines = [];
    try {
      lines = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch (e) {
      return res.status(502).json({ error: 'parse_error', message: 'Could not parse the model response as JSON.' });
    }
    res.json({ ok: true, lines });
  } catch (e) {
    res.status(502).json({ error: 'request_failed', message: e.message });
  }
});

const BILL_SCAN_PROMPT = `You are reading a photo of an existing paper sales bill from a small import/retail shop (handwritten or printed). List every distinct product line item on it.

Respond with ONLY a JSON array, no other text, no markdown fences. Each element must have exactly these fields:
[{"name": string, "quantity": number|null, "price": number|null}]

Rules:
- "name" should always be your best reading of the product name/description, even if imperfect.
- "price" is the sale price per unit shown on the bill, not a cost price.
- If you cannot confidently read a quantity or a price for a line, set that field to null. Do NOT guess a number you can't actually read.
- If nothing readable is found, respond with an empty array: []`;

app.post('/api/bill-scan', async (req, res) => {
  const secrets = loadSecrets();
  if (!secrets.anthropicApiKey) {
    return res.status(400).json({
      error: 'not_configured',
      message: `Photo scan needs an Anthropic API key first. Add it to ${SECRETS_FILE} (the "anthropicApiKey" field), then restart the server.`
    });
  }
  const { imageBase64, mediaType } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: 'bad_request', message: 'Missing imageBase64' });
  }
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': secrets.anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: GRN_SCAN_MODEL,
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: BILL_SCAN_PROMPT }
          ]
        }]
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: 'anthropic_error', message: errText.slice(0, 500) });
    }
    const data = await response.json();
    const textBlock = (data.content || []).find((c) => c.type === 'text');
    const raw = textBlock ? textBlock.text : '[]';
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    let lines = [];
    try {
      lines = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch (e) {
      return res.status(502).json({ error: 'parse_error', message: 'Could not parse the model response as JSON.' });
    }
    res.json({ ok: true, lines });
  } catch (e) {
    res.status(502).json({ error: 'request_failed', message: e.message });
  }
});

// No-cache on the app/shop static files: this is a local business tool that
// gets edited and restarted often, and a stale cached .js file after an
// update looks exactly like "the fix didn't work" to whoever is testing it.
const noCache = { setHeaders: (res) => res.setHeader('Cache-Control', 'no-store') };
app.use('/lib', express.static(path.join(__dirname, 'public', 'lib'), noCache));
app.use('/shop', express.static(path.join(__dirname, 'public', 'shop'), noCache));
app.use('/', express.static(path.join(__dirname, 'public', 'app'), noCache));

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('=========================================');
  console.log('  Premium Imports LK - server running');
  console.log('=========================================');
  console.log(`On this computer:      http://localhost:${PORT}`);
  console.log(`On this computer (shop): http://localhost:${PORT}/shop`);
  console.log('');
  const nets = os.networkInterfaces();
  const addrs = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addrs.push(net.address);
      }
    }
  }
  if (addrs.length) {
    console.log('On phones/tablets on the same WiFi:');
    addrs.forEach((ip) => {
      console.log(`  App:  http://${ip}:${PORT}`);
      console.log(`  Shop: http://${ip}:${PORT}/shop`);
    });
  } else {
    console.log('No LAN IPv4 address found (check WiFi connection).');
  }
  console.log('=========================================');
  console.log('');
});
