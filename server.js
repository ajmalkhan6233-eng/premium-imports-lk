const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3005;
const DATA_FILE = path.join(__dirname, 'data.json');
const TMP_FILE = path.join(__dirname, 'data.json.tmp');
const BACKUP_DIR = path.join(__dirname, 'backups');

function defaultData() {
  return {
    settings: {
      shopName: 'Premium Imports LK',
      whatsappNumber: '94771226621',
      bankDetails: { accountName: '', accountNumber: '', bankName: '', branch: '' },
      categories: ['Chocolate', 'Wash Items', 'Other'],
      pins: { AJMAL: '1234', NUSHRA: '1234' },
      logo: null
    },
    products: [],
    customers: [],
    vendors: [],
    lenders: [],
    bills: [],
    grns: [],
    orders: []
  };
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const fresh = defaultData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  const merged = Object.assign(defaultData(), parsed);
  return merged;
}

let db = loadData();
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
app.use(express.json({ limit: '15mb' }));

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

app.use('/lib', express.static(path.join(__dirname, 'public', 'lib')));
app.use('/shop', express.static(path.join(__dirname, 'public', 'shop')));
app.use('/', express.static(path.join(__dirname, 'public', 'app')));

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
