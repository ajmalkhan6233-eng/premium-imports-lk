const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { computeNetProfit } = require('./lib/reports');

const PORT = process.env.PORT || 3005;
const DATA_FILE = path.join(__dirname, 'data.json');
const TMP_FILE = path.join(__dirname, 'data.json.tmp');
const BACKUP_DIR = path.join(__dirname, 'backups');
const SECRETS_FILE = path.join(__dirname, 'secrets.json');
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');

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
      // WhatsApp product concept (whatsapp-bridge/) — 4-tier ladder:
      //   general  — keyword FAQ, no AI call (faqAssistant.js)
      //   light    — AI conversation, text only, no photos/payment plans
      //   standard — light + product photo showcase
      //   pro      — standard + payment-plan menu logic (today's PIL setup)
      // See assistant.js/index.js for where each tier's capability is
      // actually gated. Defaults to 'pro' so this shop's real behavior is
      // unchanged unless someone explicitly switches it in Settings.
      whatsappTier: 'pro',
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
    // SELF_SUSTAINING_ADMIN_COMMAND.md Phase 2 scaffold: storefront/POS
    // values an admin can change from the "Site & POS Editor" tab without a
    // code deploy. Deliberately starts narrow — only real, already-wired
    // values (the hero tagline and announcement banner shop.js already had
    // hardcoded, and the GRN Scan Photo button grn.js already renders
    // unconditionally) rather than speculative fields nothing reads yet.
    // Extend this shape + the two render/consume sites together as more
    // hardcoded UI values get moved in future sessions.
    uiConfig: {
      storefront: {
        heroTagline: "Authentic imports, at your door — not a guessing game.",
        announcementBanner: { active: false, text: '' }
      },
      pos: {
        features: { grnPhotoScan: true, heldSales: true, returnVoid: true },
        // Order = display order on the Sell screen; enabled = shown at all.
        // Reordered/toggled from the Site & POS Editor tab.
        paymentMethods: [
          { id: 'cash', label: 'Cash', enabled: true },
          { id: 'card', label: 'Card', enabled: true },
          { id: 'cheque', label: 'Cheque', enabled: true },
          { id: 'bank', label: 'Bank Transfer', enabled: true },
          { id: 'online', label: 'Online Transfer', enabled: true },
          { id: 'credit', label: 'Credit', enabled: true }
        ]
      }
    },
    products: [],
    customers: [],
    vendors: [],
    lenders: [],
    bills: [],
    grns: [],
    orders: [],
    waConversations: [],
    documents: [],
    expenses: []
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
  if (settings.whatsappTier === undefined) { settings.whatsappTier = d.whatsappTier; changed = true; }
  if (settings.shopHours === undefined) { settings.shopHours = d.shopHours; changed = true; }
  if (!settings.deliveryZones) { settings.deliveryZones = d.deliveryZones; changed = true; }
  if (!settings.paymentPlans) { settings.paymentPlans = d.paymentPlans; changed = true; }
  if (settings.agingThresholdDays === undefined) { settings.agingThresholdDays = d.agingThresholdDays; changed = true; }
  return changed;
}

// Same reasoning as backfillSettingsDefaults above, applied to uiConfig:
// Object.assign(defaultData(), parsed) is a shallow merge, so an existing
// data.json that predates this field (or predates a field added to it
// later) needs those pieces backfilled explicitly or they silently never
// appear.
function backfillUiConfigDefaults(db) {
  const d = defaultData().uiConfig;
  let changed = false;
  if (!db.uiConfig) { db.uiConfig = d; return true; }
  if (!db.uiConfig.storefront) { db.uiConfig.storefront = d.storefront; changed = true; }
  else {
    if (db.uiConfig.storefront.heroTagline === undefined) { db.uiConfig.storefront.heroTagline = d.storefront.heroTagline; changed = true; }
    if (!db.uiConfig.storefront.announcementBanner) { db.uiConfig.storefront.announcementBanner = d.storefront.announcementBanner; changed = true; }
  }
  if (!db.uiConfig.pos) { db.uiConfig.pos = d.pos; changed = true; }
  else {
    if (!db.uiConfig.pos.features) { db.uiConfig.pos.features = d.pos.features; changed = true; }
    else {
      if (db.uiConfig.pos.features.grnPhotoScan === undefined) { db.uiConfig.pos.features.grnPhotoScan = true; changed = true; }
      if (db.uiConfig.pos.features.heldSales === undefined) { db.uiConfig.pos.features.heldSales = true; changed = true; }
      if (db.uiConfig.pos.features.returnVoid === undefined) { db.uiConfig.pos.features.returnVoid = true; changed = true; }
    }
    if (!db.uiConfig.pos.paymentMethods) { db.uiConfig.pos.paymentMethods = d.pos.paymentMethods; changed = true; }
  }
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
  const uiConfigBackfilled = backfillUiConfigDefaults(merged);
  if (hadOldPins || backfilled || uiConfigBackfilled) fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2));
  return merged;
}

// AUTH_COMMAND.md Step 5: the WhatsApp bridge is a separate Node process
// (not in-process, not under PM2 — see server.js's other comments) that
// calls this server's own /api/data/:key over HTTP, same as every other
// client. It gets a static, generated-on-first-run service credential
// here (serviceToken) instead of a staff login — see serviceTokenValid().
function loadSecrets() {
  let parsed = {};
  let existed = fs.existsSync(SECRETS_FILE);
  if (existed) {
    try { parsed = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8')); } catch (e) { parsed = {}; }
  }
  let changed = !existed;
  if (parsed.anthropicApiKey === undefined) { parsed.anthropicApiKey = ''; changed = true; }
  if (!parsed.serviceToken) { parsed.serviceToken = crypto.randomBytes(24).toString('hex'); changed = true; }
  if (changed) fs.writeFileSync(SECRETS_FILE, JSON.stringify(parsed, null, 2));
  return {
    anthropicApiKey: parsed.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '',
    serviceToken: parsed.serviceToken
  };
}

// AUTH_COMMAND.md Step 2: lightweight, persisted, opaque-token session
// store (no JWT/session library added — this is a single-location LAN
// app, a signed random token in a small JSON file is enough and is easy
// to reason about). Persisting to disk means sessions survive a server
// restart instead of logging everyone out every time server.js is edited,
// which happens often on this project (see CLAUDE.md).
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // ~12h, matching a shop shift
function loadSessions() {
  if (!fs.existsSync(SESSIONS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8')); } catch (e) { return {}; }
}
let sessions = loadSessions();
function saveSessions() {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}
function purgeExpiredSessions() {
  const now = Date.now();
  let changed = false;
  Object.keys(sessions).forEach((token) => {
    if (sessions[token].expiresAt < now) { delete sessions[token]; changed = true; }
  });
  if (changed) saveSessions();
}
function createSession(user, role) {
  purgeExpiredSessions();
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = { user, role, issuedAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS };
  saveSessions();
  return token;
}
function getSession(token) {
  if (!token) return null;
  const s = sessions[token];
  if (!s) return null;
  if (s.expiresAt < Date.now()) { delete sessions[token]; saveSessions(); return null; }
  return s;
}
function destroySession(token) {
  if (token && sessions[token]) { delete sessions[token]; saveSessions(); }
}
function tokenFromReq(req) {
  const h = req.headers['authorization'] || '';
  const m = /^Bearer (.+)$/.exec(h);
  return m ? m[1] : null;
}
function sessionFromReq(req) {
  return getSession(tokenFromReq(req));
}
function serviceTokenValid(req) {
  const token = req.headers['x-service-token'];
  return !!token && token === loadSecrets().serviceToken;
}
// Every protected route needs this to pass before any handler logic runs
// — see AUTH_COMMAND.md Step 2 ("no exceptions for writes"). Role checks
// beyond "is there a valid session at all" are done per-key/per-route
// where needed (see ADMIN_ONLY_WRITE_KEYS below), since which keys are
// admin-only doesn't map to a single blanket rule — see the Step 1 inventory.
function requireSession(req, res) {
  const session = sessionFromReq(req);
  if (!session) { res.status(401).json({ error: 'unauthorized', message: 'Sign in required.' }); return null; }
  return session;
}

// AUTH_COMMAND.md Step 3: the narrow public read surface. Only the exact
// fields the storefront (public/shop/shop.js) actually reads — see the
// Step 1 inventory in SESSION_LOG.md. Everything else in `settings`
// (plaintext user PINs above all) and `products` (costPrice, priceHistory,
// internal notes) never leaves this server for an unauthenticated or
// service-credentialed caller.
// Added deliveryZones.freeDeliveryMin so the storefront can actually show
// customers "free delivery over Rs. X" — that setting already existed
// (used only by the WhatsApp assistant's answers) but was never in this
// list, so shop.js had no way to read it. homeBase/zoneNotes come along
// with it (same object) but aren't currently rendered anywhere public.
const PUBLIC_SETTINGS_FIELDS = ['shopName', 'whatsappNumber', 'bankDetails', 'categories', 'deliveryZones'];
function publicSettingsView(settings) {
  const out = {};
  PUBLIC_SETTINGS_FIELDS.forEach((f) => { out[f] = settings[f]; });
  return out;
}
// Full settings minus `users` (plaintext PINs) — what a logged-in staff
// (non-admin) session gets; also what the WhatsApp bridge's service
// credential gets, since it needs deliveryZones/paymentPlans/assistantName/
// shopHours for the AI assistant but never needs anyone's PIN.
function staffSettingsView(settings) {
  const out = Object.assign({}, settings);
  delete out.users;
  return out;
}
const PUBLIC_PRODUCT_FIELDS = ['id', 'name', 'category', 'sellingPrice', 'stock', 'photo'];
function publicProductsView(products) {
  return products.map((p) => {
    const out = {};
    PUBLIC_PRODUCT_FIELDS.forEach((f) => { out[f] = p[f]; });
    return out;
  });
}
// Keys where the UI's write actions are wholly admin-only today (Settings
// tab; Products add/edit/delete) — see the Step 1 inventory.
const ADMIN_ONLY_WRITE_KEYS = new Set(['settings', 'products']);
// The WhatsApp bridge's service credential is scoped to exactly the keys
// it reads/writes (Step 1 inventory) — not a blanket bypass of auth.
const SERVICE_READABLE_KEYS = new Set(['settings', 'products', 'customers', 'waConversations']);
const SERVICE_WRITABLE_KEYS = new Set(['customers', 'waConversations']);

let db = loadData();
loadSecrets(); // ensures secrets.json exists (API key + service token) on first run
purgeExpiredSessions();
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

// Fix #2 (AUDIT_REPORT.md finding 1.3 / exec summary #2): bank account
// details feed the payment QR code shown to real customers, so a write to
// them is gated behind a PIN even though the rest of the data API isn't yet
// (full API auth is out of scope for this pass). Reuses the same plaintext
// PIN-compare already used for login (app.js) — no new auth scheme.
function bankDetailsChanged(oldSettings, newSettings) {
  const oldBD = (oldSettings && oldSettings.bankDetails) || {};
  const newBD = (newSettings && newSettings.bankDetails) || {};
  const fields = ['accountName', 'accountNumber', 'bankName', 'branch'];
  return fields.some((f) => (oldBD[f] || '') !== (newBD[f] || ''));
}
function pinMatchesAnyUser(pin, settings) {
  const users = (settings && settings.users) || [];
  return !!pin && users.some((u) => u.pin === pin);
}

// Fix #4 (AUDIT_REPORT.md findings 2.1/2.2/2.3 / exec summary #4): bill/GRN/
// order numbers used to be generated client-side and persisted with a full
// read-modify-write PUT of the whole array, so two near-simultaneous saves
// could compute the same "next" number, or one save could silently overwrite
// the other. Below, number generation + the array append + the save all
// happen inside a single synchronous critical section on the server, so two
// concurrent requests can never observe the same "current" counter/array —
// Node runs one to completion before starting the next. `withWriteLock` also
// serializes these explicitly via a promise chain, so the guarantee holds
// even if this code is ever changed to do async work in between.
let writeQueue = Promise.resolve();
function withWriteLock(fn) {
  const run = writeQueue.then(() => fn());
  writeQueue = run.then(() => undefined, () => undefined);
  return run;
}
function reserveNumber(counterKey, prefix, startAt) {
  db.settings.counters = db.settings.counters || {};
  const next = (db.settings.counters[counterKey] || 0) + 1;
  db.settings.counters[counterKey] = next;
  const base = (parseInt(startAt, 10) || 1) - 1;
  return `${prefix}-${String(base + next).padStart(4, '0')}`;
}
function nowTimeStamp() {
  return new Date().toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' });
}
function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + (parseInt(days, 10) || 0));
  return d.toISOString().slice(0, 10);
}
function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 9999)}`;
}

const app = express();
app.use(express.json({ limit: '30mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// AUTH_COMMAND.md Step 2/3: login, session check, and the public,
// PIN-free list of user names the login screen's picker needs (this is
// the only thing about settings.users that's safe and necessary to show
// before anyone has signed in — see SESSION_LOG.md for why).
app.post('/api/login', (req, res) => {
  const { name, pin } = req.body || {};
  if (!name || !pin) return res.status(400).json({ error: 'bad_request', message: 'Pick a user and enter a PIN.' });
  const user = (db.settings.users || []).find((u) => u.name === name);
  if (!user || user.pin !== String(pin)) {
    return res.status(401).json({ error: 'invalid_credentials', message: 'Wrong PIN.' });
  }
  const token = createSession(user.name, user.role);
  res.json({ ok: true, token, user: user.name, role: user.role });
});
app.post('/api/logout', (req, res) => {
  destroySession(tokenFromReq(req));
  res.json({ ok: true });
});
app.get('/api/session', (req, res) => {
  const session = sessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'unauthorized' });
  res.json({ ok: true, user: session.user, role: session.role });
});
app.get('/api/login-users', (req, res) => {
  res.json({ users: (db.settings.users || []).map((u) => u.name) });
});

app.get('/api/data/:key', (req, res) => {
  const key = req.params.key;
  if (!(key in db)) {
    return res.status(404).json({ error: `Unknown key: ${key}` });
  }
  const session = sessionFromReq(req);
  if (session) {
    if (key === 'settings' && session.role !== 'admin') return res.json({ key, value: staffSettingsView(db.settings) });
    return res.json({ key, value: db[key] });
  }
  if (serviceTokenValid(req) && SERVICE_READABLE_KEYS.has(key)) {
    const value = key === 'settings' ? staffSettingsView(db.settings) : db[key];
    return res.json({ key, value });
  }
  // No session, no valid service credential: only the narrow public views
  // survive — everything else in the data API now requires signing in.
  if (key === 'settings') return res.json({ key, value: publicSettingsView(db.settings) });
  if (key === 'products') return res.json({ key, value: publicProductsView(db.products) });
  return res.status(401).json({ error: 'unauthorized', message: 'Sign in required.' });
});

app.put('/api/data/:key', (req, res) => {
  const key = req.params.key;
  if (!(key in db)) {
    return res.status(404).json({ error: `Unknown key: ${key}` });
  }
  if (!('value' in req.body)) {
    return res.status(400).json({ error: 'Missing value in body' });
  }
  const session = sessionFromReq(req);
  if (session) {
    if (ADMIN_ONLY_WRITE_KEYS.has(key) && session.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden', message: 'Admin access required.' });
    }
  } else if (serviceTokenValid(req) && SERVICE_WRITABLE_KEYS.has(key)) {
    // Scoped service credential (WhatsApp bridge) — allowed for this key only.
  } else {
    return res.status(401).json({ error: 'unauthorized', message: 'Sign in required.' });
  }
  if (key === 'settings' && bankDetailsChanged(db.settings, req.body.value)) {
    if (!pinMatchesAnyUser(req.body.pin, db.settings)) {
      return res.status(403).json({ error: 'invalid_pin', message: 'A valid PIN is required to change bank details.' });
    }
  }
  db[key] = req.body.value;
  saveData();
  res.json({ ok: true });
});

// SELF_SUSTAINING_ADMIN_COMMAND.md Phase 2: uiConfig gets its own routes
// rather than riding the generic /api/data/:key pattern, per the command's
// own instruction — that pattern's per-key auth rules (ADMIN_ONLY_WRITE_KEYS,
// SERVICE_*_KEYS, publicSettingsView-style narrowing) don't have a slot for
// "PIN required on every write, admin-only, but also has a separate
// unauthenticated public subset" without special-casing uiConfig inside
// that route anyway — clearer as its own small route group.
//
// GET is any logged-in session (staff need pos.features to render Sell/GRN
// correctly, not just admins). PUT is admin + PIN, mirroring the bank-
// details PIN-gate above (server.js bankDetailsChanged/pinMatchesAnyUser) —
// same reasoning: this feeds customer-facing storefront content, a wrong or
// malicious edit shouldn't be one accidental staff click away.
app.get('/api/admin/ui-config', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  res.json({ value: db.uiConfig });
});
app.put('/api/admin/ui-config', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  if (session.role !== 'admin') return res.status(403).json({ error: 'forbidden', message: 'Admin access required.' });
  const { value, pin } = req.body || {};
  if (!value || typeof value !== 'object') return res.status(400).json({ error: 'bad_request', message: 'Missing value' });
  if (!pinMatchesAnyUser(pin, db.settings)) {
    return res.status(403).json({ error: 'invalid_pin', message: 'A valid PIN is required to change Site & POS settings.' });
  }
  withWriteLock(() => {
    db.uiConfig = value;
    saveData();
  }).then(() => res.json({ ok: true })).catch((e) => res.status(500).json({ error: 'server_error', message: e.message }));
});
// Unauthenticated, narrow — exactly what public/shop/shop.js needs (hero
// tagline, announcement banner), same "only what the storefront actually
// reads" boundary as publicSettingsView/publicProductsView above. pos.*
// never leaves this endpoint.
app.get('/api/public/ui-config', (req, res) => {
  res.json({ value: (db.uiConfig && db.uiConfig.storefront) || defaultData().uiConfig.storefront });
});

// Fix #3 (AUDIT_REPORT.md finding 3.2 / exec summary #3): storefront orders
// used to be built entirely client-side (including price) and PUT as a full
// array. Order creation now happens here: item names/prices are always
// re-derived from db.products (the authoritative source), never from the
// request. If the client sent a different price, it's logged and discarded.
// This endpoint also reserves the order number atomically (Fix #4).
app.post('/api/orders', (req, res) => {
  withWriteLock(() => {
    const { customerName, phone, address, items, paymentMethod, notes } = req.body || {};
    if (!customerName || !String(customerName).trim()) return res.status(400).json({ error: 'bad_request', message: 'Name is required' });
    if (!phone || !String(phone).trim()) return res.status(400).json({ error: 'bad_request', message: 'Phone is required' });
    if (!address || !String(address).trim()) return res.status(400).json({ error: 'bad_request', message: 'Address is required' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'bad_request', message: 'Cart is empty' });

    const resolvedItems = [];
    for (const it of items) {
      const product = db.products.find((p) => p.id === it.productId);
      if (!product) return res.status(400).json({ error: 'bad_request', message: `Unknown product: ${it.productId}` });
      const qty = parseInt(it.qty, 10);
      if (!qty || qty <= 0) return res.status(400).json({ error: 'bad_request', message: `Invalid quantity for ${product.name}` });
      const authoritativePrice = product.sellingPrice || 0;
      if (it.price !== undefined && it.price !== null && Number(it.price) !== authoritativePrice) {
        console.warn(`[price-mismatch] ${new Date().toISOString()} order item "${product.name}" (${product.id}) — client sent Rs. ${it.price}, authoritative price Rs. ${authoritativePrice}. Using authoritative price.`);
      }
      resolvedItems.push({ productId: product.id, name: product.name, qty, price: authoritativePrice });
    }
    const total = resolvedItems.reduce((s, it) => s + it.qty * it.price, 0);
    const number = reserveNumber('order', 'ORD');
    const order = {
      id: newId('O'), number, date: todayStamp(),
      customerName: String(customerName).trim(), phone: String(phone).trim(), address: String(address).trim(),
      items: resolvedItems, total, paymentMethod: paymentMethod === 'bank' ? 'bank' : 'cod',
      status: 'pending', notes: notes ? String(notes).trim() : ''
    };
    db.orders.push(order);
    saveData();
    res.json({ ok: true, order });
  }).catch((e) => res.status(500).json({ error: 'server_error', message: e.message }));
});

// Fix #4: bill creation (POS sale, and "Confirm & Bill" of an online order)
// now happens server-side in one atomic step — number reservation, stock
// deduction, and (for credit sales) the customer ledger update all happen
// inside the same write-locked, synchronous critical section, so two
// concurrent sales can never collide on the same invoice number or clobber
// each other's stock/ledger changes. Per-line price is still trusted from
// the caller here (unlike /api/orders) — staff intentionally override price
// at the POS (documented in AUDIT_REPORT.md finding 3.4), that's unchanged.
app.post('/api/bills', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  withWriteLock(() => {
    const { type, customerId, isCashSale, customerName, items, discountType, discountValue, paymentType, paymentPlanIdx, paymentRef, source } = req.body || {};
    // `by` is the authenticated session's own user, never trusted from the
    // client — otherwise a logged-in staff account could attribute a sale
    // to someone else just by sending a different name in the request body.
    const by = session.user;
    const isQuote = type === 'quote';
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'bad_request', message: 'Cart is empty' });

    let customer = null;
    if (customerId && !isCashSale) {
      customer = db.customers.find((c) => c.id === customerId);
      if (!customer) return res.status(400).json({ error: 'bad_request', message: 'Unknown customer' });
    }
    if (!customer && !isCashSale) return res.status(400).json({ error: 'bad_request', message: 'Select a customer or Cash Sale first' });
    if (!isQuote && paymentType === 'credit' && !customer) return res.status(400).json({ error: 'bad_request', message: 'Select a named customer for credit sales' });

    const resolvedItems = [];
    for (const it of items) {
      const product = db.products.find((p) => p.id === it.productId);
      if (!product) return res.status(400).json({ error: 'bad_request', message: `Unknown product: ${it.productId}` });
      const qty = parseInt(it.qty, 10);
      if (!qty || qty <= 0) return res.status(400).json({ error: 'bad_request', message: `Invalid quantity for ${product.name}` });
      if (!isQuote && qty > (product.stock || 0)) return res.status(409).json({ error: 'insufficient_stock', message: `Not enough stock for ${product.name}` });
      const price = Number(it.price);
      resolvedItems.push({ productId: product.id, name: product.name, qty, price: (isNaN(price) || price < 0) ? 0 : price, cost: product.costPrice || 0 });
    }

    const subtotal = resolvedItems.reduce((s, it) => s + it.qty * it.price, 0);
    const rawDiscount = discountType === 'percent' ? subtotal * ((parseFloat(discountValue) || 0) / 100) : (parseFloat(discountValue) || 0);
    const discountAmount = Math.max(0, Math.min(subtotal, rawDiscount));
    const total = subtotal - discountAmount;
    const number = isQuote ? reserveNumber('quote', 'QUO') : reserveNumber('bill', 'INV', db.settings.startingBillNumber);
    const isCredit = !isQuote && paymentType === 'credit';
    const plan = isCredit ? (db.settings.paymentPlans || [])[paymentPlanIdx] : null;
    const dueDate = plan ? addDaysISO(plan.days) : null;

    const bill = {
      id: newId('B'), number, type: type || 'bill',
      date: todayStamp(), time: nowTimeStamp(),
      customerId: customer ? customer.id : null,
      customerName: customer ? customer.name : (customerName ? String(customerName).trim() : (isCashSale ? 'Cash Sale' : 'Walk-in')),
      items: resolvedItems, subtotal, discountType: discountType || 'fixed', discountValue: parseFloat(discountValue) || 0, discountAmount, total,
      paymentType: isQuote ? null : paymentType,
      paymentRef: (!isQuote && paymentRef) ? String(paymentRef).trim().slice(0, 100) : null,
      paid: isQuote ? 0 : (paymentType === 'credit' ? 0 : total),
      balanceDue: isQuote ? 0 : (paymentType === 'credit' ? total : 0),
      paymentPlan: plan ? plan.name : null, dueDate,
      by: by || null, source: source || 'in-store'
    };
    db.bills.push(bill);
    if (!isQuote) {
      resolvedItems.forEach((it) => {
        const p = db.products.find((x) => x.id === it.productId);
        if (p) p.stock -= it.qty;
      });
      if (paymentType === 'credit' && customer) {
        customer.dues = (customer.dues || 0) + total;
        customer.ledger = customer.ledger || [];
        customer.ledger.push({ id: newId('L'), type: bill.type, date: bill.date, amount: total, balanceAfter: customer.dues, ref: bill.number, note: '', dueDate, by: by || null });
      }
    }
    saveData();
    res.json({ ok: true, bill });
  }).catch((e) => res.status(500).json({ error: 'server_error', message: e.message }));
});

// APP_MODERNIZATION_COMMAND.md Phase 2, feature 1 (Void/Return): reverses a
// completed bill's real-world effects — restores each line's stock, and if
// it was a credit sale, reverses the customer's dues via a new ledger entry
// (append-only, same pattern as every other ledger write in this file —
// never mutates the original bill/ledger history). Same write-locked,
// synchronous critical section as bill creation, so a void can never race a
// concurrent sale of the same stock.
app.post('/api/bills/:id/void', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  withWriteLock(() => {
    const bill = db.bills.find((b) => b.id === req.params.id);
    if (!bill) return res.status(404).json({ error: 'not_found', message: 'Bill not found' });
    if (bill.type === 'quote') return res.status(400).json({ error: 'bad_request', message: "Quotations can't be voided — they never affected stock or dues." });
    if (bill.status === 'voided') return res.status(400).json({ error: 'already_voided', message: 'This bill is already voided.' });
    const { reason } = req.body || {};
    const by = session.user;

    (bill.items || []).forEach((it) => {
      const p = db.products.find((x) => x.id === it.productId);
      if (p) p.stock = (p.stock || 0) + it.qty;
    });
    if (bill.paymentType === 'credit' && bill.customerId) {
      const customer = db.customers.find((c) => c.id === bill.customerId);
      if (customer) {
        customer.dues = Math.max(0, (customer.dues || 0) - bill.total);
        customer.ledger = customer.ledger || [];
        customer.ledger.push({
          id: newId('L'), type: 'void', date: todayStamp(), amount: bill.total,
          balanceAfter: customer.dues, ref: bill.number,
          note: reason ? `Bill voided: ${reason}` : 'Bill voided', by: by || null
        });
      }
    }
    bill.status = 'voided';
    bill.voidedAt = new Date().toISOString();
    bill.voidedBy = by || null;
    bill.voidReason = reason ? String(reason).trim() : '';
    saveData();
    res.json({ ok: true, bill });
  }).catch((e) => res.status(500).json({ error: 'server_error', message: e.message }));
});

// Fix #4: GRN save — same pattern as /api/bills. Number reservation, stock
// increment, cost-price update, and vendor ledger update all happen in one
// write-locked, synchronous critical section.
app.post('/api/grns', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  withWriteLock(() => {
    const { vendorId, invoiceNumber, items, discount, attachment } = req.body || {};
    const by = session.user;
    if (!vendorId) return res.status(400).json({ error: 'bad_request', message: 'Select a vendor' });
    const vendor = db.vendors.find((v) => v.id === vendorId);
    if (!vendor) return res.status(400).json({ error: 'bad_request', message: 'Unknown vendor' });
    if (!invoiceNumber || !String(invoiceNumber).trim()) return res.status(400).json({ error: 'bad_request', message: 'Invoice number is required' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'bad_request', message: 'No items' });

    const resolvedItems = [];
    for (const it of items) {
      const product = db.products.find((p) => p.id === it.productId);
      if (!product) return res.status(400).json({ error: 'bad_request', message: `Unknown product: ${it.productId}` });
      resolvedItems.push({ productId: product.id, name: product.name, category: product.category, qty: it.qty, cost: it.cost });
    }
    const subtotal = resolvedItems.reduce((s, it) => s + it.qty * it.cost, 0);
    const disc = parseFloat(discount) || 0;
    const total = Math.max(0, subtotal - disc);
    const number = reserveNumber('grn', 'GRN');

    const grn = {
      id: newId('G'), number, date: todayStamp(),
      vendorId, vendorName: vendor.name, invoiceNumber: String(invoiceNumber).trim(),
      items: resolvedItems, subtotal, discount: disc, total, by: by || null,
      attachment: (attachment && attachment.dataUrl) ? {
        filename: String(attachment.filename || 'attachment').slice(0, 200),
        dataUrl: attachment.dataUrl,
        mediaType: attachment.mediaType || ''
      } : null
    };
    db.grns.push(grn);
    resolvedItems.forEach((it) => {
      const p = db.products.find((x) => x.id === it.productId);
      if (p) { p.stock = (p.stock || 0) + it.qty; p.costPrice = it.cost; }
    });
    vendor.purchased = (vendor.purchased || 0) + total;
    vendor.balance = (vendor.purchased || 0) - (vendor.paid || 0);
    vendor.ledger = vendor.ledger || [];
    vendor.ledger.push({ id: newId('L'), type: 'grn', date: todayStamp(), amount: total, ref: grn.number, note: '', balanceAfter: vendor.balance, by: by || null });
    saveData();
    res.json({ ok: true, grn });
  }).catch((e) => res.status(500).json({ error: 'server_error', message: e.message }));
});

// Voiding a GRN — same reasoning/pattern as /api/bills/:id/void: reverses
// the real-world effects (stock added, vendor balance increased) via a
// new reversing ledger entry, never mutates or deletes the original GRN
// record. Stock is clamped at 0 (same clamp customer.dues void already
// uses) since some of the received stock may have already been sold by
// the time a mistaken GRN is caught — going negative would be a worse
// display than "0 and flagged", not a truer number. costPrice is
// deliberately left as this GRN set it: reverting it to some prior value
// would need real price history tracking, not built here — flagged, not
// silently faked.
app.post('/api/grns/:id/void', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  withWriteLock(() => {
    const grn = db.grns.find((g) => g.id === req.params.id);
    if (!grn) return res.status(404).json({ error: 'not_found', message: 'GRN not found' });
    if (grn.status === 'voided') return res.status(400).json({ error: 'already_voided', message: 'This GRN is already voided.' });
    const { reason } = req.body || {};
    const by = session.user;

    (grn.items || []).forEach((it) => {
      const p = db.products.find((x) => x.id === it.productId);
      if (p) p.stock = Math.max(0, (p.stock || 0) - it.qty);
    });
    const vendor = db.vendors.find((v) => v.id === grn.vendorId);
    if (vendor) {
      vendor.purchased = Math.max(0, (vendor.purchased || 0) - grn.total);
      vendor.balance = (vendor.purchased || 0) - (vendor.paid || 0);
      vendor.ledger = vendor.ledger || [];
      vendor.ledger.push({
        id: newId('L'), type: 'void', date: todayStamp(), amount: grn.total,
        balanceAfter: vendor.balance, ref: grn.number,
        note: reason ? `GRN voided: ${reason}` : 'GRN voided', by: by || null
      });
    }
    grn.status = 'voided';
    grn.voidedAt = new Date().toISOString();
    grn.voidedBy = by || null;
    grn.voidReason = reason ? String(reason).trim() : '';
    saveData();
    res.json({ ok: true, grn });
  }).catch((e) => res.status(500).json({ error: 'server_error', message: e.message }));
});

app.get('/api/grn-scan/status', (req, res) => {
  if (!requireSession(req, res)) return;
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
  if (!requireSession(req, res)) return;
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
  if (!requireSession(req, res)) return;
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

// AI-INTELLIGENCE-LAYER-v2-command.md Feature 1/2: dependency-injected
// routers so they share the exact same db/session/write-lock machinery as
// every route above, instead of re-implementing it or requiring server.js
// (which would create a circular require).
app.use('/api/expenses', require('./routes/expenses')({ db, saveData, withWriteLock, newId, requireSession, todayStamp }));
app.use('/api', require('./routes/ai-query')({ db, requireSession, loadSecrets, todayStamp }));

// AI-INTELLIGENCE-LAYER-v2-command.md Feature 3: Daily Net Profit. Reuses
// the same logic the ai-query "computeNetProfit" tool calls (lib/reports.js)
// so the dashboard card and the AI's answer can never disagree with each
// other. Gated behind a session like every other report-ish read (Home tab
// is visible to staff and admin alike, same as the existing Profit stat).
// Owner-triggerable full backup — server.js already backs up data.json
// automatically once a day (maybeBackup()), but that's invisible to a
// non-technical shop owner and lives only on this machine. This lets an
// admin grab a copy themselves (e.g. before a risky change, or just to
// keep off-machine) without needing a developer involved. Admin-only,
// same reasoning as the ui-config/settings write gates — this is the
// entire database, including plaintext PINs.
app.get('/api/admin/backup', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  if (session.role !== 'admin') return res.status(403).json({ error: 'forbidden', message: 'Admin access required.' });
  res.setHeader('Content-Disposition', `attachment; filename="premium-imports-lk-backup-${todayStamp()}.json"`);
  res.json(db);
});

app.get('/api/reports/net-profit', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const date = req.query.date || todayStamp();
  const from = req.query.from || date;
  const to = req.query.to || date;
  res.json(computeNetProfit(db, { from, to }));
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
