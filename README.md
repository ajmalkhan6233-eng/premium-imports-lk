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

## Running automatically on boot (Windows)

1. Double-click `start.bat` to start the server manually any time — it
   opens a console window that must stay open while you're using the
   system. Closing that window stops the server.
2. To have it start automatically when the computer turns on:
   - Press `Win + R`, type `shell:startup`, press Enter.
   - Copy a **shortcut** to `start.bat` into that folder.
   - The server will now start automatically on every boot, as long as
     the computer stays on.

If you later want it to run silently in the background (no console
window, restarts itself if it crashes), look into
[PM2](https://pm2.keymetrics.io/) — this is a future upgrade, not set up
here.

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
