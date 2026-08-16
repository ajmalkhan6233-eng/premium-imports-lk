# Premium Imports LK

A local web system for a small import/retail business in Sri Lanka. Two
connected apps sharing one data file, run entirely from one laptop, no
cloud, no database server, no build step.

- **Internal app** (`/`) — billing, GRN (purchases), products, customers,
  vendors, loans, reports, settings. PIN-gated (AJMAL / NUSHRA).
- **Public storefront** (`/shop`) — Premium Imports LK, browse → cart →
  checkout, no login required.

## Setup

Requires [Node.js](https://nodejs.org/) (any recent LTS version).

```
npm install
npm start
```

The server prints the URLs to open, for example:

```
On this computer:      http://localhost:3005
On this computer (shop): http://localhost:3005/shop

On phones/tablets on the same WiFi:
  App:  http://192.168.1.23:3005
  Shop: http://192.168.1.23:3005/shop
```

Open the "On this computer" links on the shop laptop/touchscreen. On a
phone or tablet on the **same WiFi network**, open the LAN address shown
under "On phones/tablets on the same WiFi". This only works while the
server is running and both devices are on the same network.

Default PINs are `1234` for both AJMAL and NUSHRA — change them from
Settings once you're in.

## Running the server (recommended: PM2)

The server now runs under [PM2](https://pm2.keymetrics.io/) (installed as a
local dev dependency, configured in `ecosystem.config.js`), which restarts
it automatically if it ever crashes — no console window needs to stay open.

```
npm install
npm run start:pm2      # starts server.js under PM2 supervision
```

Other useful commands:

```
npm run logs:pm2       # tail the server's logs
npm run stop:pm2       # stop it
npx pm2 status          # see whether it's running
npx pm2 restart premium-imports-server   # restart after a code change
```

To have PM2 (and the server) start automatically when the computer turns
on, run this once (as Administrator, in the project folder):

```
npx pm2 start ecosystem.config.js
npx pm2 save
npx pm2-startup install
```

`pm2-startup install` registers PM2 itself to launch on boot; `pm2 save`
records that `premium-imports-server` should come back up when it does. If
`pm2-startup` isn't available, `npx pm2-installer` or a scheduled task that
runs `npx pm2 resurrect` at login are the usual Windows fallbacks.

### Manual / fallback method

`start.bat` still works if you'd rather run the server directly without PM2
(e.g. for a quick one-off check) — it opens a console window that must stay
open while you're using the system, with no auto-restart on crash:

1. Double-click `start.bat` to start the server manually any time.
2. To have *this* method start automatically on boot instead of PM2: press
   `Win + R`, type `shell:startup`, press Enter, and copy a **shortcut** to
   `start.bat` into that folder.

Prefer the PM2 method above for day-to-day use — it's what keeps the shop
online if the process ever crashes unattended.

## Data & backups

- All data lives in a single file, `data.json`, created automatically the
  first time the server runs. It is **never committed to git** — it holds
  real customer, financial, and loan data.
- Every write is atomic (written to `data.json.tmp` then renamed) so a
  crash mid-write can't corrupt your data.
- A dated backup copy is saved to `backups/` automatically on the first
  write of each day (e.g. `backups/data-2026-08-07.json`).
- **Back up `data.json` (or the whole `backups/` folder) regularly**
  yourself too — copy it to a USB drive or cloud folder every so often.
  This system does not do off-computer backups on its own.

## First-time setup checklist

Nothing is pre-filled with sample data — the system starts completely
empty on purpose. Before using it day to day:

1. **Settings → Shop** — confirm the shop name and WhatsApp number.
2. **Settings → Bank Details** — fill in account name/number, bank, and
   branch. This is what the QR code (shown at checkout and on bank-payment
   bills) encodes, so it must be filled in before relying on it.
3. **Settings → Categories** — edit the starter list (Chocolate, Wash
   Items, Other) to match what you actually sell.
4. **Settings → Change PIN** — set your own PIN instead of the default
   `1234`.
5. Add real products via **Products** or as you receive stock via **GRN**.

## GRN photo scan (optional)

The GRN screen has a "📷 Scan Photo" button that reads a photo of an
invoice, packing slip, or the products themselves, and drafts line items
for you to check — it never saves anything on its own, you still review
and tap **Save GRN** yourself, same as typing lines in by hand.

This feature costs a small amount per photo (roughly a few cents) and
needs an Anthropic API key:

1. Get a key from [console.anthropic.com](https://console.anthropic.com)
   (requires adding billing there first).
2. Open `secrets.json` in the project folder (it's created automatically
   the first time the server runs) and paste the key between the quotes:
   ```
   { "anthropicApiKey": "your-key-here" }
   ```
3. Restart the server (`Ctrl+C` in the console window, then run
   `start.bat` again, or `npm start`).

`secrets.json` is never committed to git — it's in `.gitignore` alongside
`data.json`, since it holds a real API key.

Until a key is added, the "Scan Photo" button still shows but explains
what's needed instead of failing — manual GRN entry (search-to-add, or
"+ Add new product" inline) works exactly the same either way and isn't
blocked by this.

## Notes

- Everything runs from plain HTML/CSS/JS in `public/app` and
  `public/shop` — no build step, ever. Edit a file, refresh the browser,
  done.
- The only npm dependency is `express`. The QR code library
  (`public/lib/qrcode.js`, MIT licensed, by Kazuhiko Arase) is vendored as
  a static file, not an npm package.
