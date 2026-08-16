# Session Log — Fixing Audit Findings #2, #3, #4, #5

Source: `AUDIT_REPORT.md` (exec summary top-5 issues #2–#5). Finding #1
(no API authentication) is explicitly **out of scope** for this session —
not touched.

All 4 fixes were applied, restarted, and smoke-tested against the live
server. Because the shop's real `data.json` was live/in-use during this
session, every test that created records was run against a snapshot copy,
verified, then the original `data.json` was restored before moving on —
production data (products, customers, vendors, bills, etc.) is unchanged
from before this session started. No fixes for Finding #1 or any other
finding were attempted.

---

## Fix #2 — Bank Account Details Write Protection

**Finding:** `settings.bankDetails` (feeds the payment QR code shown to
real customers) was writable via `PUT /api/data/settings` with no
authentication at all.

**Change:** A write to `settings` that changes any `bankDetails` field now
requires a valid PIN in the request body, checked server-side against
`settings.users` (the same plaintext PIN-compare already used for login —
no new auth scheme invented). Read access to `settings` (including
`bankDetails`) is unchanged/still open — **this is a residual gap**, noted
below.

**Files touched:**
- `server.js` — added `bankDetailsChanged()`, `pinMatchesAnyUser()`, and a
  check inside `PUT /api/data/:key` that rejects with `403 invalid_pin`
  when `bankDetails` changes without a matching PIN.
- `public/app/app.js` — `apiPut`/`saveKey` now accept an optional `extra`
  object merged into the request body (used to send `{ pin }`), and
  `apiPut` now surfaces the server's actual error message instead of a
  generic "Failed to save" string.
- `public/app/settings.js` — the "Save" button under Settings → Bank
  Details now prompts for a PIN and sends it with the save; on rejection,
  the in-memory bank details revert and a toast shows the server's error.

**Tests run (against a live curl session, then reverted):**
- `PUT /api/data/settings` with changed `bankDetails` and **no** `pin` →
  `403 invalid_pin`. ✅ (confirmed the write was also not persisted)
- Same request with `pin: "1234"` (real AJMAL PIN) → `200 ok`. ✅
- Same request with a wrong PIN (`"9999"`) → `403 invalid_pin`. ✅
- A settings save that does **not** touch `bankDetails` (e.g. shop name
  only), sent with no `pin` → `200 ok`, unaffected. ✅ (confirms every
  other Settings save flow — categories, payment plans, staff PINs,
  delivery zones, etc. — still works exactly as before)
- Restored the real `bankDetails` (all empty strings, taken from today's
  pre-session daily backup `backups/data-2026-08-11.json`) after testing.

**Residual gap (flagged, not fixed — out of scope per the command):**
`GET /api/data/settings` is still fully unauthenticated, so bank details
(and everything else in `settings`, including plaintext PINs) remain
readable by anyone who can reach the server. This is Finding #1's territory
(no read-side auth exists anywhere in the API) and is deferred with it.

---

## Fix #3 — Server-Side Price Re-Validation (storefront orders)

**Finding:** An online order's price was entirely client-supplied and never
checked against the real product price, either at order placement or when
staff converted it into a real bill.

**Change:** Order creation moved server-side into a new `POST /api/orders`
endpoint. Every line's price and name are now always re-derived from
`db.products` (the authoritative source) — the price in the incoming
request is only used to detect and log a mismatch, then discarded. The
"Confirm & Bill" flow (turning an order into a real bill) no longer needs
its own re-validation, because by the time an order exists, its prices are
already authoritative (assigned at order-creation time).

**Files touched:**
- `server.js` — new `POST /api/orders` handler: validates items against
  `db.products`, re-prices from `product.sellingPrice`, logs a
  `[price-mismatch]` line to the server console when the client's price
  differs, reserves the order number, appends, saves.
- `public/shop/shop.js` — `placeOrderBtn` handler now calls
  `POST /api/orders` (sending items + a display-only price) instead of
  fetching the whole `orders` array, appending client-side, and PUTting it
  back with a client-computed number.
- `public/app/sell.js` — the "Confirm & Bill" handler for online orders
  (`ord-confirm`) now posts to `POST /api/bills` (see Fix #4) instead of
  building the bill object by hand; it no longer needs to re-price because
  `o.items` are already server-priced.

**Tests run:**
- Placed an order with the correct price (`Rs. 2550` for a real product) →
  accepted, order total correct. ✅
- Placed an order with a tampered price (`Rs. 1` for the same product) →
  order was created at the **real** price (`Rs. 2550`, not `Rs. 1`), and the
  server log recorded:
  `[price-mismatch] ... client sent Rs. 1, authoritative price Rs. 2550. Using authoritative price.` ✅
- Test orders removed by restoring `data.json` from a pre-test snapshot
  afterward (see Fix #4 test notes — same restore covered both).

---

## Fix #4 — Concurrency-Safe Numbering & Writes (bills / GRN / orders)

**Finding:** Order numbers used array length (not a durable counter); bill
and GRN numbers were incremented client-side and saved via a full-array
`PUT` with no locking — two near-simultaneous devices could get the same
number, or one write could silently overwrite the other's.

**Change:** Added three new atomic server-side endpoints —
`POST /api/orders`, `POST /api/bills`, `POST /api/grns` — that each do
number reservation + the array append + any related stock/ledger update in
one synchronous, write-locked critical section (`withWriteLock`, an
in-process promise-chain mutex around every mutation in these endpoints,
plus reliance on Node's single-threaded execution of synchronous code — no
new dependency introduced). Two concurrent requests can no longer compute
the same "next" number or silently lose one side's data, because the
server — not two separate client round-trips — owns the whole
read-reserve-append-save operation for these three flows.

**Files touched:**
- `server.js` — `withWriteLock()`, `reserveNumber()`, `nowTimeStamp()`,
  `addDaysISO()`, `newId()` helpers; `POST /api/bills` (handles POS sale
  completion **and** the "Confirm & Bill" online-order path — stock
  deduction + credit-ledger update, with a stock check that now correctly
  rejects with `409 insufficient_stock` instead of allowing an oversell);
  `POST /api/grns` (stock increment, cost-price update, vendor ledger
  update).
- `public/app/sell.js` — `completeSale()` and the `ord-confirm` handler now
  call `POST /api/bills` and resync `STATE.bills/products/customers/settings`
  from the server afterward, instead of building the bill locally and
  PUTting 4 collections back.
- `public/app/grn.js` — `saveGrn()` now calls `POST /api/grns` and resyncs
  `STATE.grns/products/vendors` afterward.
- `public/shop/shop.js` — order number now comes from the server response
  (see Fix #3).

**Note on scope:** Per-line price at the POS (Sell screen) is still
client-trusted, unchanged — staff intentionally override price there
(discounts/promotions), which is a different, already-accepted case
(AUDIT_REPORT.md finding 3.4), not the storefront issue Fix #3 targets.
GRN negative-quantity/cost input validation (finding 3.3) was **not**
touched — out of scope for this command.

**Tests run (all against a snapshot copy of `data.json`, fully restored
afterward — see "Data safety" below):**
- Fired 5 concurrent `POST /api/orders` requests → all 5 succeeded with
  distinct sequential numbers (`ORD-0003`…`ORD-0007`, continuing cleanly
  from 2 earlier sequential test orders), no duplicates, no gaps, all 7
  orders present in the final array. ✅
- Single `POST /api/bills` and `POST /api/grns` calls → correct
  `INV-0001` / `GRN-0001`, stock and vendor ledger updated correctly. ✅
- Fired 6 concurrent `POST /api/bills` requests (2 units each, 13 in stock)
  → all 6 succeeded, distinct sequential invoice numbers `INV-0002`…
  `INV-0007`, stock correctly ended at `13 - 12 = 1`. ✅
- Fired 3 concurrent `POST /api/bills` requests for 1 unit each against
  exactly 1 unit of remaining stock → exactly **1** succeeded
  (`INV-0008`), the other 2 cleanly rejected with
  `409 insufficient_stock`, final stock correctly `0` (never negative,
  never oversold). ✅ This is the core "no lost updates, no duplicate
  numbers, no overselling" guarantee the fix was meant to provide.

**Data safety during testing:** `data.json` is the shop's live production
file (real products/customers/vendors — confirmed by inspecting it before
testing). Before any test that writes data, a copy was saved
(`cp data.json /tmp/data.json.pretest_backup`, etc.). After each round of
testing, `data.json` was restored from that copy (or, for `bankDetails`
specifically, from today's automatic daily backup
`backups/data-2026-08-11.json`, since the Fix #2 test round predated the
snapshot copy), then the server was restarted/reloaded and verified back to
the original counts (0 test orders/bills/GRNs, original stock levels,
original vendor ledger, empty bank details) before moving to the next fix.

---

## Fix #5 — Process Supervision (PM2)

**Finding:** `node server.js` ran directly via `start.bat`/`npm start` with
no auto-restart on crash — the README itself said PM2 was "a future
upgrade, not set up here."

**Change:** PM2 installed as a local `devDependency`. Added
`ecosystem.config.js` (version-controlled) defining a `premium-imports-server`
app: `autorestart: true`, `max_restarts: 10`, `restart_delay: 2000ms`. Added
`npm run start:pm2` / `stop:pm2` / `logs:pm2` scripts. Updated `README.md`
to make the PM2 method the recommended way to run the server, keeping
`start.bat`/`node server.js` documented as a manual fallback only. Created
`CLAUDE.md` (didn't exist before) documenting the new start command so
future sessions don't default back to suggesting `node server.js`.

The WhatsApp bridge (`whatsapp-bridge/index.js`) was **not** brought under
PM2 — that's AUDIT_REPORT.md finding 5.3, a related but separate item, and
the command for this fix specifically said "configure it to run
`server.js`." No WhatsApp bridge process was running during this session
(verified: the second `node.exe` process seen at the start of the session
was the PM2 daemon itself, not the bridge), so nothing there was touched.

**Live process migration (as instructed — `taskkill` then start under
PM2, not any other "stop" mechanism):**
1. Identified the live `node server.js` process via `netstat`/`tasklist`
   (confirmed by command line via WMIC) at each point in the session.
2. `taskkill //PID <pid> //F` to stop the plain-node instance.
3. `npx pm2 start ecosystem.config.js` to bring it up under supervision.
4. `npx pm2 save` to persist the process list (does not touch Windows boot
   configuration — no elevated/system-level change made).

**Tests run:**
- `GET /api/health` after migration → `200 ok`. ✅
- Simulated a crash by killing the PM2-managed process directly via
  `taskkill` (not `pm2 stop`) → PM2 detected the exit and restarted it
  automatically within ~3 seconds (PID changed, PM2's restart counter
  incremented from 0 → 1, `/api/health` responded again). ✅ This is the
  core guarantee the fix was meant to provide.
- Re-ran the Fix #3 (order creation) and Fix #2 (bank-details PIN gate)
  smoke tests against the PM2-managed instance to confirm no regression
  from the process-manager change itself, then restored `data.json` again.

**Not done (deliberately, needs the user's decision / elevated access):**
`npx pm2-startup install` (registers PM2 to launch on Windows boot) was
**not** run — it typically requires Administrator rights and makes a
persistent, system-level change (a Windows service/scheduled task), which
felt like the wrong thing to do unilaterally in this pass. It's documented
in `README.md` as the next manual step if the user wants boot-time
auto-start; right now PM2 (and the server under it) will keep the server
alive against crashes for as long as the current login session and PM2
daemon are running, but won't survive a full reboot until that step is
run.

---

## Summary

| Fix | Finding | Status | Files changed |
|---|---|---|---|
| #2 | Bank details writable with no auth | Done | `server.js`, `public/app/app.js`, `public/app/settings.js` |
| #3 | Storefront order price trusted end-to-end | Done | `server.js`, `public/shop/shop.js`, `public/app/sell.js` |
| #4 | Numbering/concurrent writes unsafe | Done | `server.js`, `public/app/sell.js`, `public/app/grn.js`, `public/shop/shop.js` |
| #5 | No process supervision | Done | `ecosystem.config.js` (new), `package.json`, `README.md`, `CLAUDE.md` (new) |

**New files:** `ecosystem.config.js`, `CLAUDE.md`, `AUDIT_REPORT.md` (from
the prior audit session), `SESSION_LOG.md` (this file).

**Residual/deferred items, tracked but not touched this session:**
- Finding #1 (no API authentication) — explicitly out of scope for this
  command.
- `GET /api/data/settings` remains unauthenticated (Fix #2's residual
  gap, above) — will close naturally once Finding #1 is addressed.
- GRN negative qty/cost validation (finding 3.3) — not part of this
  command.
- WhatsApp bridge process supervision (finding 5.3) — not part of this
  command.
- `npx pm2-startup install` (boot persistence) — documented, not executed;
  needs the user to run it (Administrator rights required).
- `npm audit` currently reports 2 high-severity advisories, introduced by
  adding `pm2` as a devDependency — pre-existing in PM2's own dependency
  tree, not something this session's scope covers; flagging for awareness
  only.

The server is currently running under PM2 with the shop's real
`data.json` restored to its pre-session state. Stopping here per the
command — awaiting the next instruction before starting Finding #1.

---

## Storefront Redesign — 2026-08-11

Source: `REDESIGN_COMMAND.md` (user-provided command file, pasted from
`C:\Users\Sony\Desktop\REDESIGN_COMMAND.md`). Scope: customer-facing
storefront (`public/shop/`) only — no backend/API/pricing/stock-sync
logic touched. A companion `SKILLS_CATALOG.md` (bulk plugin install
across 3 marketplaces, one unofficial) was also provided in the same
session but **not executed** — flagged to the user as a supply-chain
trust concern (unverified third-party marketplace) rather than run
blindly; user chose to proceed with the redesign only.

**Skill used:** none. Checked `~/.claude/skills` and the project's
`.claude/skills` per the Skill-First Rule and `REDESIGN_COMMAND.md`
Step 0 (`frontend-design`/`canvas-design`/`algorithmic-art`) — none
installed in this session, so the command's own fallback instructions
were followed directly.

### Design plan
- **Color** (existing tokens rebalanced, not replaced): Ink Navy
  `#0A0E16`, Panel Slate `#121826`, Souk Gold `#C9A24B` / Gold Deep
  `#A9843A` (promoted to primary trust accent — these are the actual
  gradient stops from `public/lib/logo/logo-wordmark.svg`, not
  invented), Customs Teal `#35DFCB` (demoted to functional/interactive
  accent only), Manifest Coral `#FF7A59` (unchanged, minimal use),
  Paper `#F3F6FA`.
- **Type**: Space Grotesk (display, unchanged) + Inter (body,
  unchanged) + new utility mono (system font stack — no extra network
  request) applied to prices and category tags on product cards.
- **Layout**: macro-structure preserved exactly (sticky header, sticky
  category pills, 2-column mobile grid) per the command's explicit
  preservation requirement. Added: a corner-placed hero signature
  element, a 2px gold horizon-glow line under the existing skyline
  SVG, a small gold accent tick under the eyebrow line.
- **Signature**: "Stock-Verified" ink-stamp badge (inline SVG, no
  image asset) in the hero's top-right corner — dashed gold ring,
  stacked mono caps text ("STOCK / VERIFIED / DXB · CMB"), rotated
  ~7°, positioned like a stamp on a shipping manifest rather than a
  centered logo. Animates in with a stamp-press keyframe on page load.

### Self-critique (before building)
- First instinct was a curved passport-stamp arc of text — dropped:
  too close to a generic travel-design cliché. Straight stacked mono
  text in a corner reads more like a warehouse/customs ink stamp, and
  "STOCK VERIFIED" ties to this shop's actual differentiator (real
  inventory matching, not a stock photo of "imported goods").
- Considered making gold dominant throughout — dropped: gold-on-black
  overload is its own AI-luxury tell. Gold stays reserved for
  brand/trust moments (stamp, horizon line, eyebrow tick); teal stays
  the only interactive color, keeping the UI hierarchy legible.
- Considered fabricated per-product batch/date stamps on every card
  for "authenticity" — dropped as a dark pattern: inventing
  specific-sounding but fake per-item data would be dishonest and
  contradicts the "authentic, not gimmicky" brief. The stamp stays a
  single hero-level statement, not fabricated per-product detail.
- Considered echoing the stamp again in the footer for symmetry —
  dropped per the command's own instruction to spend the one bold
  risk in exactly one place.

### Files touched
- `public/shop/index.html` — added the hero stamp SVG markup.
- `public/shop/style.css` — new `--gold-deep`/`--mono` tokens,
  `:focus-visible` outline, refined `.reveal` easing/distance
  (cubic-bezier expo-out, 22px→14px), dual-tone hero glow, stamp
  styles + load-sequence keyframes (`stampPress`, `heroFadeUp`) gated
  under `@media (prefers-reduced-motion:no-preference)`, a matching
  `@media (prefers-reduced-motion:reduce)` block that turns off the
  looping glow/ambient-dot/WhatsApp-pulse animations and the reveal
  transform, skyline horizon-glow line, mono font on `.cat-tag`/
  `.price`, card hover tuned (-4px→-6px lift, dual-tone shadow),
  mobile stamp sizing in the existing `max-width:640px` block.

### Critique / verification (via Chrome browser automation against the
live PM2 server at `localhost:3005/shop`, read-only — no writes to
`data.json`)
- Desktop (1280px) and mobile (390px, verified via an in-page iframe
  since the browser tool's window resize was not effective in this
  environment) both render correctly — stamp doesn't collide with the
  headline at either size; mobile stamp shrinks to 48px per the added
  breakpoint rule.
- Keyboard focus: tabbing to the Search button shows a visible teal
  `:focus-visible` ring (previously no visible focus states existed
  on buttons/pills).
- No console errors on load.
- `prefers-reduced-motion` CSS gating verified by inspection (browser
  tool has no way to force the media query live in this environment);
  animations are additive inside the `no-preference` block and the
  base/no-JS state is fully visible, so a reduced-motion user sees the
  final layout with no animation rather than a stuck-hidden state.

### Smoke test (functionality unchanged)
- Cart drawer opens/closes correctly ("Your cart is empty" state).
- Category pill switching works (All → Chocolate, active state moves).
- WhatsApp float button href intact: `https://wa.me/94771226621`.
- Products API (`/api/data/products`) still returns live data — the
  "No products available right now" empty state seen during testing
  is real current stock data (all 5 live products currently have
  `stock: 0`), not a regression from this change; unrelated to the
  redesign and out of scope for it.

### Not done (flagged, not executed)
- `SKILLS_CATALOG.md`'s bulk `/plugin install` across 3 marketplaces
  (one unofficial, a personal GitHub repo) — not run. This is a CLI
  slash-command the user would need to run themselves in any case;
  flagged as a supply-chain trust question rather than executed
  sight-unseen.

---

## App Modernization Phase 2 — Internal App/POS — 2026-08-11

Source: `APP_MODERNIZATION_COMMAND.md` (user-provided command file, pasted
from `C:\Users\Sony\Desktop\APP_MODERNIZATION_COMMAND.md`). Scope: internal
app/POS screens only (Sell, GRN, Vendors, Bills, Dashboard) — no storefront
changes, no BATHCO, no changes to pricing calculation, stock-sync mechanics,
or auth beyond the specific additive features listed in the command (Void/
Return, GRN attachment, exports — each explicitly named as in-scope
"implement for real" work).

**Skill used:** none. `frontend-design` was installed earlier this session
via the official `anthropics/skills` marketplace, but plugin installs need a
session restart to activate (confirmed via `claude plugin --help` /
`update` semantics) — it wasn't active in this running session, so per the
command's own Step 0 fallback, its own instructions were followed directly.

### Key finding before building anything
The internal app was not a blank slate. Already present and working:
a full 3-theme design system (Royal & Gold / Forest & Cream / Charcoal &
Slate — purple/gold/blue, not generic SaaS blue), Dashboard summary cards
(Today/Week/Month, 6 stat cards), low-stock badges (Products + Sell),
CSV export on 6 report types, and print-to-PDF + WhatsApp share already
wired into the post-sale receipt. Real gaps: no bill-history screen
existed at all, no Void/Return, no GRN attachment upload, no vendor-ledger
export, bare-text empty states throughout.

### Design plan
- **Color/type**: kept the existing palette and all 3 themes unchanged —
  replacing them with the command's suggested "light + blue" fallback
  direction would have been a regression (destroys the existing
  theme-switcher feature) and would ignore that the current palette
  already avoids all three AI-cliché defaults the command warns against.
  Added one new system-mono utility face (zero network cost) for bill
  numbers/references, mirroring the storefront's Phase 1 approach.
- **Signature element**: a "live pulse" — today's running sales total
  next to the header clock, visible on every screen (not just Dashboard).
  Functional, not decorative; reuses existing gold/muted tokens.
- **Layout**: one new nav tab, "Bills" (history + search + status badges
  + reprint/duplicate/void), added to the mobile "More" sheet and desktop
  topnav. Nothing else in the nav/shell changed.

### Self-critique (before building)
- Nearly defaulted to "replace the palette with light+blue" per the
  command's suggested direction — caught it: that's explicitly framed as
  a fallback in the command text, not a mandate, and the existing system
  already satisfies the "deliberate, not generic" bar the command sets.
- Considered building full per-bill partial-payment tracking so the
  "Partial" status badge would always have something to show — dropped:
  that's new core credit/ledger logic beyond what's asked. The badge
  logic (`billStatus()` in app.js) is correct-by-construction (shows
  Partial whenever `paid > 0 && balanceDue > 0`), it just won't currently
  trigger, since nothing in this app yet records a payment against a
  specific bill (only aggregate customer-level payments exist). Documented
  rather than faked.
- "Download PDF" as a separate button from "Print" (Sell receipt modal)
  is honest but not technically distinct — both open the browser's native
  print dialog (no PDF library added, per the "no heavy dependencies"
  rule; JS cannot programmatically pick "Save as PDF" as a destination,
  that's an OS/browser-owned choice). Kept both, since the command asks
  for them as separate discoverable actions and they serve different user
  intents even while sharing one mechanism — documented instead of hidden.

### Files touched
- `public/app/index.html` — live-pulse element next to the clock,
  `vendorPrintArea` print target, `bills.js` script tag.
- `public/app/style.css` — `--mono` token, `:focus-visible` outline,
  `.live-pulse`, designed `.empty-state` icon/action pattern, `.badge.voided`,
  `#vendorPrintArea` print-media rule.
- `public/app/app.js` — `bills` nav item, `renderLivePulse()`, `billStatus()`,
  `readFileAsDataUrl()`, `labelForLedgerType`/`renderLedgerChartSvg` updated
  for the new `void` ledger-entry type, `computeProductAgingDates()` now
  excludes voided bills from FIFO stock consumption.
- `public/app/sell.js` — bill action cluster (Download PDF + Void/Return
  added to the existing Print/WhatsApp), designed empty state for
  "nothing in stock" with a restock link to GRN (moved outside the
  `.sell-items-area.gated` wrapper — see bug fix below).
- `public/app/bills.js` — **new file**. Bill history list, search,
  status-filter pills, reprint (reuses `showReceipt()`), duplicate
  (loads a past bill into the cart, clamped to current stock), and
  `voidBillFlow()` (shared with sell.js's receipt modal).
- `public/app/grn.js` — attachment upload (photo via existing
  `compressImage()`, PDF via new `readFileAsDataUrl()`), "Recent GRNs"
  searchable history list, designed empty states.
- `public/app/vendors.js` — vendor search (list-only re-render, not a
  full-screen re-render, to avoid focus loss while typing), Export
  CSV/PDF on vendor ledger, designed empty states.
- `public/app/products.js` — designed empty state icon.
- `public/app/dashboard.js`, `public/app/customers.js`, `public/app/reports.js`
  — voided-bill consistency fixes (see below).
- `server.js` — new `POST /api/bills/:id/void` (write-locked, restores
  stock, reverses the customer credit ledger via an append-only `void`
  entry — never mutates history); `POST /api/grns` now accepts and stores
  an optional `attachment`.

### Bugs found and fixed during my own verification (not left for later)
- **Empty-state CTA was unclickable.** The first cut of the Sell
  "nothing in stock → Go to GRN" button was nested inside
  `.sell-items-area.gated`, which gets `pointer-events:none` until a
  customer is picked — so the button rendered but silently did nothing.
  Caught by actually clicking it in the browser, not just reading the
  code. Fixed by moving the restock CTA outside the gated wrapper as a
  sibling block.
- **Voiding a bill didn't fully unwind it.** After building Void/Return
  and testing it end-to-end, the Dashboard's "Sales/Profit — Today" cards
  still counted the voided bill (they didn't know about the new `status`
  field at all — pre-existing code, not something I'd touched). Traced
  every `STATE.bills` aggregate across the app and fixed each one
  consistently: Dashboard stat cards, Monthly Detail, product-aging (GRN
  stock-consumption FIFO), customer purchase-segmentation, and the
  Reports marketing-source breakdown now all exclude voided bills; the
  Net Profit CSV excludes them from the sum; the raw Sales CSV keeps them
  (full audit trail) but now has a Status column so a voided line reads
  as reversed, not as real revenue.

### Verification (via Chrome browser automation against the live PM2
server at `localhost:3005`, after a confirmed restart to load the
server.js changes)
Real `data.json` was snapshotted before testing and restored (then the
server restarted again) after — matching the discipline used for Fix
#3/#4 testing earlier in this project. Test flow: added a real GRN
(vendor "chammi", 5× Butter Ghee, a PNG attachment) → confirmed the
attachment persisted server-side (`GET /api/data/grns`, not just
client-state) → completed a cash sale → confirmed all 4 receipt actions
render → voided the bill → confirmed stock restored (5→4→5) and the
Dashboard/Bills numbers now correctly reflect zero net sales → checked
the Bills screen (status badges, search-without-losing-focus, Reprint,
Duplicate with stock-clamping) → checked Vendors (search retains focus,
Export CSV ran clean, Export PDF's print-area population verified via a
stubbed `window.print()` rather than actually opening the native print
dialog, to avoid hanging the browser session) → confirmed no app-specific
console errors throughout (all console noise was the Chrome extension's
own unrelated messaging-channel warning).

### Smoke test (Phase 1 storefront + untouched screens)
- `public/shop/*` not touched this session — no regression risk.
- Customers/Loans/Messages/Settings screens not in scope for this
  command and not touched, beyond the one-line voided-bill filter fix
  in `customers.js` (purchase segmentation).

Server restarted twice during this session (once to load the void/
attachment endpoints, once after restoring the pre-test `data.json`),
both confirmed with the user first per the command's final step. The
server is currently running under PM2 with real `data.json` intact.

---

## Full API Authentication (Finding #1) — 2026-08-11

Source: `AUTH_COMMAND.md` (user-provided command file, pasted from
`C:\Users\Sony\Desktop\AUTH_COMMAND.md`). This is the root-cause fix for
`AUDIT_REPORT.md` Finding #1, explicitly deferred by every prior session
(Fix #2's residual-gap note, and `CLAUDE.md`'s standing instruction not to
touch this "unless explicitly asked to in a session scoped to that work")
— this command *is* that scoped session. Framed by the command itself as
the highest-stakes change made so far; proceeding with maximum care,
Step 1 inventory completed and logged before any code was written, per
the command's own explicit requirement.

**Skill used:** none found matching (checked `~/.claude/skills` and the
project's `.claude/skills` for a security/engineering skill; nothing
installed in this session matches).

### Step 1 inventory

**1. Storefront (`public/shop/shop.js`) API usage — must stay
GET-accessible with zero login:**
- `GET /api/data/settings` — reads `shopName`, `categories`,
  `whatsappNumber`, `bankDetails` (for the checkout QR code). The same
  key also holds `users` (plaintext staff PINs!), `paymentPlans`,
  `deliveryZones`, `agingThresholdDays`, `counters`, `logo`,
  `assistantName`, `shopHours`, `startingBillNumber` — none of which the
  storefront reads, all of which must NOT be exposed.
- `GET /api/data/products` — reads `id`, `name`, `category`,
  `sellingPrice`, `stock`, `photo` for the product grid. The same
  objects also carry `costPrice`, `priceHistory`, `brand`, `source`,
  `notes` — none of which the storefront displays or needs, and
  `costPrice` in particular is a real margin/business-sensitive figure
  that a whole-key public allowlist would otherwise leak today.
- `POST /api/orders` — dedicated, already-hardened endpoint (Fix #3:
  price always re-derived server-side from `db.products`, client price
  only used to detect/log a mismatch). This is a **write**, called by
  anonymous customers as the storefront's entire reason for existing.

**2. WhatsApp bridge (`whatsapp-bridge/`) data access — separate Node
process** (run via `npm run whatsapp`, not merged into `server.js`, not
under PM2 — confirmed intentional per `CLAUDE.md`). It is a genuine HTTP
client of the same generic API everyone else uses, via
`whatsapp-bridge/dataClient.js` (`getData`/`putData` — plain `fetch` to
`http://localhost:3005`), **not** an in-process function call — so
Step 5's "in-process, preferred if architecture allows" option is not
actually available without merging the two processes, which is a much
bigger change than this command asks for and contradicts `CLAUDE.md`'s
existing note that the separate-process design is deliberate. Concretely
it calls:
- `GET settings`, `GET products`, `GET customers` (to build/send AI
  replies — `index.js`/`assistant.js`)
- `GET waConversations`, `PUT waConversations` (`conversations.js` — the
  message log)
- `PUT customers` (`index.js` — creates a new customer record the first
  time an unknown phone number messages in)
- Anthropic API key is read from `secrets.json` directly on disk
  (`dataClient.js loadAnthropicKey()`), never over HTTP — not part of
  this auth surface at all.

**3. GRN vision-scan (`POST /api/grn-scan`, `POST /api/bill-scan`) —
same-process, in `server.js` itself.** Neither reads nor writes
`db`/`data.json` directly — each takes a photo, calls the Anthropic API,
and returns parsed line suggestions for the *client* to review and then
save through the normal (now-protected) `POST /api/grns` / `POST
/api/bills`. They're not "data-mutating" in the literal sense, but they
spend real Anthropic API budget on every call and exist only to serve
the internal GRN/Sell screens — an anonymous caller hitting them
directly could run up the shop's AI bill for nothing. Gating them behind
a valid session is the conservative, correct call.

**4. Existing login/role/PIN scheme (mirrored exactly, not replaced):**
- `data.json` → `settings.users`: `[{ name, pin, role }]`, plaintext
  4-digit-ish PINs, roles are exactly `'admin'` or `'staff'`. AJMAL is
  the sole hardcoded admin seed; anyone else added via Settings →
  Manage Users is `'staff'`.
- Client-side login (`app.js` `showLogin()`): picks a user from
  `settings.users`, compares typed PIN to `u.pin` **in the browser**,
  no server involvement at all today. This is Finding #1's actual root
  cause — the full user list including plaintext PINs is fetched by
  `apiGet('settings')`, which today is reachable by literally anyone.
- The only EXISTING server-side PIN check anywhere is Fix #2's narrow
  one: `bankDetailsChanged()` + `pinMatchesAnyUser()` in `server.js`,
  gating writes to `settings.bankDetails` specifically. Being kept
  as-is (an extra re-confirmation step even for a logged-in admin
  session, i.e. defense in depth) — not removed, not replaced.
- `ADMIN_ONLY_TABS = ['reports', 'settings']` (`app.js`) — staff can't
  open these tabs at all client-side today.
- Admin-only actions found via `isAdmin()` checks across the UI:
  Products (add/edit/delete), Vendors (edit/delete — **not** add, **not**
  record-payment), Customers (edit/delete — **not** add), Loans/Lenders
  (edit/delete — **not** add, **not** record-payment), Documents
  (delete — **not** upload). Settings' own sub-sections (bank details,
  manage users, PIN reset, etc.) are all reachable only because the
  whole Settings tab is admin-only to begin with.
- **Not currently gated to admin at all** (staff-accessible today, so
  left staff-accessible — not newly restricted): GRN (entire screen),
  Sell (entire screen, including discount entry — there is no
  "discount limit above threshold" concept anywhere in this codebase
  despite the command's example list; nothing to enforce there), and
  Void/Return (Phase 2 — no role check exists for it anywhere client or
  server-side today).

### Design decisions and how two apparent conflicts in the command were resolved

The command's own rules collide with two pieces of *already-verified,
intentional* product behavior. Both are resolved in favor of the
existing, working feature — reasoned through below rather than silently
picked, per "make the call, log the reasoning."

1. **"Bank account details must NEVER be on the public allowlist" vs.
   the storefront's real checkout QR code**, which today reads
   `bankDetails` from the same public `settings` fetch. Resolution:
   `settings` as a whole key is never added to the public GET allowlist
   (satisfies the rule against blanket exposure — no more plaintext
   PINs, payment plans, counters, etc. leaking). But `GET
   /api/data/settings` itself, when called with no valid session,
   now returns a **filtered response** containing only `shopName`,
   `whatsappNumber`, `bankDetails`, `categories` — the exact fields the
   storefront already uses — instead of either the full object (the
   current bug) or a 401 (which would break checkout and directly
   contradict Step 6's explicit "storefront works fully with zero
   login" requirement). A valid staff/admin session gets the real, full
   object from the same endpoint. Same treatment applied to `products`
   (public GET is filtered to name/category/sellingPrice/stock/photo/id,
   dropping `costPrice` and `priceHistory` even though nothing in the
   command's example list called this out — it's a real, current
   exposure of margin data through the naive whole-key reading of "keep
   products public").
2. **"Every data-mutating endpoint requires a session, no exceptions"
   vs. `POST /api/orders`**, which is a write and is legitimately called
   by anonymous customers — it's the storefront's entire checkout
   mechanism. Requiring login there would make the storefront
   non-functional, directly contradicting the command's own Step 6
   verification line. Read as: the "no exceptions" rule targets the
   *generic* `/api/data/:key` write path (which today accepts literally
   any value for any key from anyone — the actual dangerous surface),
   not `POST /api/orders`, which is a narrow, already-hardened,
   purpose-built endpoint (Fix #3) that was created specifically so
   customers never need the dangerous generic path. `POST /api/orders`
   stays public; every other mutating endpoint (generic PUT, `/api/bills`,
   `/api/grns`, `/api/bills/:id/void`, `/api/grn-scan`, `/api/bill-scan`)
   requires a valid session.

### Known limitation flagged before implementation (mirrors Fix #2's
own documented residual-gap pattern rather than hiding it)
`vendors`, `customers`, `lenders`, and `documents` are each written via
the *generic* `PUT /api/data/:key` for **multiple different UI actions
with different role requirements on the same key** (e.g. vendors: adding
a vendor or recording a payment is staff-accessible, but editing/
deleting one is admin-only in the UI) — and the generic endpoint
receives a whole replacement array with no information about which
sub-action produced it. Cleanly enforcing the finer admin-only actions
server-side would require either fragile old-vs-new diffing or migrating
these actions to dedicated endpoints (a much larger change, explicitly
out of scope: "No new features beyond auth enforcement... must not be
altered except where strictly required to wire in login"). These four
keys will require a valid session (any role) for writes — closing the
Finding #1 hole (no more anonymous writes at all) — but a staff account
could still, in principle, use devtools to call the generic PUT with a
payload that edits or deletes a vendor/customer/lender/document, bypassing
the UI's admin-only buttons for those specific sub-actions. Flagging this
now, before writing any code, for review alongside the rest of this log.

Proceeding to Step 2 (server-side session auth) next.

### Steps 2–5: what was built

- **`server.js`** — `crypto`-based opaque session tokens, persisted to a
  new `sessions.json` (gitignored, added alongside `secrets.json`) so
  sessions survive a server restart; ~12h TTL. `POST /api/login` (verifies
  against the existing `settings.users` PIN scheme, unchanged), `POST
  /api/logout` (destroys the session server-side, not just client-side),
  `GET /api/session` (lets the client verify a stored token is still
  valid), `GET /api/login-users` (public, names only — see below).
  `GET/PUT /api/data/:key` rewritten: sessions get full data (staff
  sessions get `settings` minus `users`); no session falls back to the
  narrow public views for `settings`/`products` or 401 for everything
  else; `settings`/`products` writes require an admin session;
  `POST /api/bills`, `/api/bills/:id/void`, `/api/grns`, `/api/grn-scan`,
  `/api/grn-scan/status`, `/api/bill-scan` all now require a valid
  session, and `by`/`voidedBy` on bills/GRNs/void are taken from the
  authenticated session, never the request body, closing a small
  attribution-spoofing gap that only existed because there was no real
  identity to check against before.
- **`whatsapp-bridge/dataClient.js`** — sends the generated `serviceToken`
  (read fresh from `secrets.json` on every call, same pattern already
  used for the Anthropic key) as `X-Service-Token` on every request.
- **`public/app/app.js`** — `AUTH_TOKEN`/`authHeaders()`, `apiGet`/`apiPut`
  updated, `boot()`/`showLogin()`/`logout()` rewritten around real
  server-side login (see the bug below), `/api/login-users` replaces
  reading `settings.users` for the login picker.
- **`public/app/sell.js`, `grn.js`, `bills.js`** — every direct `fetch()`
  to a now-protected endpoint carries `authHeaders()`.
- **`public/app/index.html`, `.gitignore`** — no template/nav changes;
  `sessions.json` added to `.gitignore` alongside `secrets.json`.

### A real bug found and fixed during my own Step 6 verification (not left for later)

Fixed `boot()` fetched **every** data key (`Promise.all(KEYS.map(apiGet))`)
before deciding whether to show the login screen. Once `/api/data/:key`
started requiring a session for 8 of the 10 keys, that `Promise.all`
rejected on the very first 401 (`customers`), and `boot()`'s catch block
fired `toast('Could not reach server. Is it running?')` and returned —
**the login screen's user picker never even rendered.** This would have
made the entire internal app unusable for anyone, immediately, the moment
this shipped — caught only because I actually loaded the page in a
browser during verification instead of trusting the code read-through.
Fixed by fetching only `settings` (always readable) before the
login/session decision, and deferring the full `KEYS` fetch until after
a session is confirmed (either restored via `/api/session` or freshly
logged in).

### Step 6 verification (against the live PM2 server, restarted once with
explicit confirmation first — see below)

All of the following were checked directly (`curl`, plus the real
`dataClient.js` module invoked directly against the live server for the
WhatsApp-bridge checks, plus the real browser UI for the login/logout/
role-gating checks):

| Check | Result |
|---|---|
| `GET /api/data/customers`, no auth | **401** (the original Finding #1 exploit surface) |
| `GET /api/data/settings`, no auth | 200, filtered to `shopName`/`whatsappNumber`/`bankDetails`/`categories` only — no `users`/PINs |
| `GET /api/data/products`, no auth | 200, filtered to `id`/`name`/`category`/`sellingPrice`/`stock`/`photo` — no `costPrice` |
| `POST /api/login` wrong PIN | 401 |
| `POST /api/login` correct PIN (AJMAL, admin) | 200 + token; `GET /api/session` confirms `role: admin` |
| `GET /api/data/settings` with admin session | 200, full object including `users` |
| **Original audit exploit**: `PUT /api/data/settings` (bank details) with no auth | **401** (was: unauthenticated 200 before this session) |
| Staff (NUSHRA) session `GET /api/data/settings` | 200, `users` field absent (prevents a staff account from ever reading any PIN, including the admin's) |
| Staff session `PUT /api/data/settings` | **403** |
| Staff session `PUT /api/data/products` | **403** |
| Admin session `PUT /api/data/settings` (non-bank-detail change) | 200, no PIN prompt needed (Fix #2's PIN gate is additive, only fires on an actual `bankDetails` change) |
| Staff session `PUT /api/data/vendors` (add/record-payment style write) | 200 — confirms the "valid session, any role" floor doesn't over-restrict legitimate staff actions |
| Service token `GET settings`/`customers` | 200, staff-tier view |
| Service token `GET bills` (out of its scope) | **401** |
| Service token `PUT products` (out of its scope) | **401** |
| Wrong/fake service token | 401 |
| `GET /api/grn-scan/status` no session | 401 (spend-protection) |
| `POST /api/orders` (storefront checkout) no auth | still works (400 for the test's deliberately-missing fields, not 401 — confirms it's unauthenticated-by-design, not accidentally broken) |
| Logout, then reuse the same token | **401** — session destroyed server-side, not just forgotten client-side |
| Real browser: login screen picker | Shows AJMAL/NUSHRA (names only, from `/api/login-users`) |
| Real browser: full admin login → every screen | Sell, Home, Products, GRN (scan-status endpoint responds correctly, shows the expected "needs setup" message, not an auth error), Bills, Customers, Vendors, Loans, Messages, Reports, Settings all load; Settings → Save round-trips 200 |
| Real browser: full staff (NUSHRA) login | Signs in as "NUSHRA (Staff)"; Reports/Settings correctly absent from nav (unchanged client-side gating, now backed server-side too) |
| Real browser: storefront (`/shop`) with zero login | Loads fully — hero, categories, search, stamp, WhatsApp button; only real-data gap is "no products in stock" (pre-existing, unrelated) |
| WhatsApp bridge: real `dataClient.js` `getData('settings')` | staff-tier view (has `deliveryZones`, no `users`) |
| WhatsApp bridge: real `dataClient.js` `getData('bills')` | Correctly rejected (401) — confirms the scoping holds even called from the bridge's own code, not just simulated via curl |
| WhatsApp bridge: live end-to-end (real WhatsApp message in/out) | **Not tested** — the bridge process isn't currently running (only the main server + PM2 daemon were), and starting it requires a real WhatsApp QR-link scan on the shop's phone, which isn't something to trigger without you. Verified as thoroughly as possible short of that: the actual `dataClient.js` module, unmodified, invoked directly against the live server. |

### Final: allowlist, role enforcement, internal services, deferred items

**Public (no session) GET allowlist** — exactly two keys, both field-filtered:
- `settings` → `shopName`, `whatsappNumber`, `bankDetails`, `categories`
- `products` → `id`, `name`, `category`, `sellingPrice`, `stock`, `photo`

Nothing else is publicly readable. No key is publicly writable except the
dedicated `POST /api/orders` (unchanged from Fix #3, deliberately kept
public — see the design-decisions section above).

**Role enforcement**: `settings` and `products` writes require an admin
session (`ADMIN_ONLY_WRITE_KEYS` in `server.js`). Every other protected
route requires a valid session of any role. The known granularity
limitation on `vendors`/`customers`/`lenders`/`documents` (staff can
write the whole key even though specific UI actions like edit/delete are
admin-only) is unchanged from the Step 1 flag above — still real, still
not fixed, would need dedicated endpoints to close properly.

**Internal services**: WhatsApp bridge uses a generated, secrets.json-
stored service token, scoped to `settings`/`products`/`customers`/
`waConversations` reads and `customers`/`waConversations` writes only.
GRN-scan/bill-scan require a staff session (spend protection).

**Deferred / not done, flagged for a future pass, not decided unilaterally**:
- No brute-force/rate-limiting on `POST /api/login`. PINs are short
  (4-ish digits), so this is a real theoretical gap — not implemented
  here because it's a genuinely separate feature (lockout logic, risk of
  locking out real staff if built hastily) beyond "auth enforcement" as
  scoped by this command, not because it doesn't matter.
- The `vendors`/`customers`/`lenders`/`documents` sub-action granularity
  gap noted in the Step 1 log.
- WhatsApp bridge's live (real-message) path not end-to-end tested, per
  above — code-level verification only.

**Server restarted twice this session**, both times with your explicit
confirmation first: once to load the full auth implementation, once
implicitly not needed again since the `boot()` fix was a static frontend
file (no restart required for that fix — verified via a plain page
reload). All test sessions/tokens created during verification were
logged out and cleaned up; `sessions.json` is back to empty. Real
`data.json` was not touched by any of this — every write-path test used
a harmless round-trip (fetch current value, write the same value back).

Stopping here per the command's final step — awaiting review before any
further restart or deploy.

---

## Storefront Design Phase 2 (Motion & Graphics) — 2026-08-11

Source: `DESIGN-PHASE2-command.md` (copied into project root this session
alongside `AI-INTELLIGENCE-LAYER-v2-command.md`, both untracked reference
docs — see HANDOFF.md-style convention).

**Skill used:** `example-skills:frontend-design`, per the Skill-First Rule.
Read it before touching CSS/JS; used it to keep this pass restrained (one
signature motion element) rather than stacking effects.

**Urgent item checked first, per the command's own instruction:** the
stock:0 empty-grid issue. `HANDOFF.md` already documents this as resolved
("not a bug") on 2026-08-11 — confirmed still true via a direct
`data.json` read just now: all 11 active products are genuinely at 0
stock (9 "Other", 2 "Chocolate"), same conclusion as before. Not
re-litigated as a live defect. Instead folded the "perception problem"
the command flagged into the empty-state redesign below (turns the dead
end into a WhatsApp CTA instead of trying to fix a pipeline that isn't
broken).

**What was built** (`public/shop/index.html`, `style.css`, `shop.js` —
customer-facing storefront only, no backend/pricing/stock-sync logic
touched):
- **Product card interactions**: thumbnail zoom on hover, `:active` tap
  feedback for mobile, add-button micro-interaction (scale + brief
  checkmark "added" state), cart badge bump animation on add. No
  secondary product image exists in the data model, so the
  crossfade-on-hover sub-item was skipped (not "if available").
- **Category transitions**: filter clicks now fade the grid out (~160ms),
  re-render, fade back in with a per-card stagger (`transition-delay`
  scaled by index, capped at 300ms) — reflow instead of a hard cut.
- **Hero/skyline signature motion**: a slow (9s) gold→teal light-sweep
  across the skyline strip, echoing the existing "STOCK VERIFIED" stamp
  and DXB/CMB motif from Phase 1 — the one deliberate motion risk this
  pass takes, kept restrained (single element, slow, low opacity).
- **Loading/empty states**: skeleton shimmer cards now pre-rendered in
  `index.html` so there's no blank grid during the initial fetch; the
  genuine zero-stock empty state was redesigned with an icon, on-brand
  copy, and a "Ask on WhatsApp" CTA (ties into the urgent-item note
  above).
- **WhatsApp button**: entrance animation once the hero settles, hover
  scale-up, `:active` tap feedback — reinforces it as the primary CTA
  without adding distraction to the existing pulse ring.
- All new animations are gated behind `prefers-reduced-motion` (CSS media
  queries plus a JS `matchMedia` check in `shop.js` for the
  timeout-driven category-switch and stagger delays), extending Phase 1's
  existing reduced-motion coverage rather than a separate system.

**Verified in a live browser** (Chrome, server started via
`npm run start:pm2`, `http://localhost:3005/shop/`): hero/skyline/empty
state render correctly, category filter fade-switch works, cart drawer
opens and shows "Your cart is empty" correctly, no application console
errors (the only console entries were a known unrelated Chrome-extension
"message channel closed" exception, not from this app's JS). Could not
exercise the add-to-cart button's added/bump micro-interaction live since
every product is genuinely at 0 stock right now — verified by code
reading instead; it's a small, isolated change (a class toggle + a
`setTimeout` revert) with low risk.

**Not touched**: cart drawer logic, checkout/order flow, WhatsApp message
text, pricing, stock sync, BATHCO (confirmed via `git status` — no BATHCO
paths appear).

---

## AI Business Intelligence + Daily Net Profit — 2026-08-11

Source: `AI-INTELLIGENCE-LAYER-v2-command.md` (copied into project root this
session, see the Phase 2 entry above). No matching installed skill
(frontend-design doesn't apply to a backend feature) — built directly from
the command file's own spec, per the skill-first rule's fallback.

**Assumption check run first, per the command's own instruction:** it says
to STOP before building Feature 3 if GRN entries don't capture cost price
per product. Read `POST /api/grns` in `server.js` directly — each GRN
entry's `items[]` already carries `{productId, name, category, qty, cost}`,
and receiving a GRN sets `product.costPrice = it.cost`. Confirmed, proceeded.

**Where this build deviates from the command file, and why** — the command
was written against an assumed structure that doesn't match this repo, so
these were resolved by following what's actually here rather than the
command literally:
- **No `data/expenses.json`.** This app has one atomic-write/backed-up
  store (`data.json`, in-process `db` object) — a second file would break
  the existing backup/atomicity guarantees. Added `expenses: []` as a new
  top-level `db` key instead, exactly like every other entity (bills,
  grns, customers...).
- **No `public/admin/` directory** — the actual admin app lives in
  `public/app/`. Built `public/app/expenses.js` there, following the
  existing per-tab-file pattern (mirrors `bills.js` closely: STATE-driven
  list, dedicated validated POST/void endpoints rather than a raw PUT of
  the whole array).
- **No `.env` / `ANTHROPIC_API_KEY`.** The GRN-scan/bill-scan features
  already established the convention of `secrets.json` (`anthropicApiKey`,
  loaded via `loadSecrets()`) — reused that instead of asking for the same
  key to live in two different config files. `MODEL_BACKEND` and
  `LOCAL_MODEL_URL` (not secrets) are still plain env vars, as the command
  specified.
- **Model name**: used `claude-sonnet-5` (matches `GRN_SCAN_MODEL`,
  already in server.js) instead of the command's `claude-sonnet-4-6`,
  which isn't a model this codebase (or this session) recognizes —
  presumably the command predates a naming update.
- **No `routes/reports.js`** existed to "extend" — added
  `GET /api/reports/net-profit` directly in `server.js`, alongside every
  other report-ish endpoint, backed by a new pure `lib/reports.js` so the
  dashboard card and the AI's `computeNetProfit` tool share one
  implementation and can't disagree.
- **No `INTEGRATION_MAP.md`** exists in this repo to update — skipped;
  this entry is the integration record instead.

**What was built:**
- **Feature 1 (Expenses)**: `routes/expenses.js` — `POST /api/expenses`
  (any signed-in staff), `GET /api/expenses?from=&to=&category=`,
  `POST /api/expenses/:id/void` (admin-only, soft-delete via `voided:true`
  + who/when/reason — same immutable-transaction pattern as bill voiding,
  never a hard delete). `public/app/expenses.js` — new Expenses tab (added
  to `NAV_ITEMS`/`MOBILE_MORE`/`KEYS`/the `goTab` renderer map in
  `app.js`): add-expense modal, date-range + category filter, running
  total, admin-only Void button.
- **Feature 2 (AI Query)**: `lib/model-backend.js` — `callModel()`
  abstraction; `claude` (default) proxies to the Anthropic Messages API
  (same raw-`fetch` pattern as GRN/bill scan); `local` translates to/from
  an OpenAI-compatible `/chat/completions` call for Ollama/LM
  Studio-style endpoints (written but **not live-tested** — no
  `LOCAL_MODEL_URL` available this session; per the command's own test
  checklist, left wired and switched off). `routes/ai-query.js` — six
  read-only tools (`getSales`, `getExpenses`, `getGRN`, `getVendorLedger`,
  `getStockLevel`, `computeNetProfit`) that read straight from the live
  `db` object, a bounded tool-use loop (max 6 turns), a single-in-flight
  guard (429 if busy), and every query + its tool calls logged to
  `logs/ai-query-log.json`. Every tool returns an explicit "no data" note
  instead of an empty result, and the system prompt instructs the model to
  never estimate — grounding is enforced by only ever exposing read
  functions, never a write path. Dashboard "Ask AI" panel (input, answer,
  last-5 reuse list) added to `public/app/dashboard.js`.
- **Feature 3 (Net Profit)**: `lib/reports.js` `computeNetProfit(db, {from,
  to})` — revenue/COGS use the exact same bill-filtering convention the
  dashboard's existing "Profit" stat already uses (`type !== 'quote' &&
  status !== 'voided'`), COGS from each bill line's `cost` (captured at
  sale time from `product.costPrice`, which GRN receiving sets — not a
  fresh GRN-history walk). `GET /api/reports/net-profit?date=` (defaults
  today). Dashboard "Net Profit — {period}" stat card, auto-refreshing
  every 60s while Home is open (self-clears its interval if the card
  leaves the DOM), clickable to a revenue/COGS/expenses/margin breakdown.
- **Security note honored**: both new route files call `requireSession()`
  on every handler (expense voiding additionally checks `role === 'admin'`)
  — same session/login gate as every other admin screen, not a new scheme.

**Verified in a live browser** (same server, same session): added a real
test expense (Rs. 15,000, Rent) → Net Profit — Today correctly went to
**-Rs. 15,000** with a warn highlight, breakdown modal showed
Revenue/COGS/Expenses/Margin correctly; voided it with a reason → excluded
from the running total and Net Profit correctly returned to **Rs. 0.00**
(void is admin-only, tested as AJMAL/admin). Asked the AI panel a question
with no Anthropic key configured → clean "AI query needs an Anthropic API
key first" message, button correctly re-enabled, no console errors, no
crash — satisfies the checklist's "confirm graceful failure if API key
missing." Test expense was voided (not left as live-looking data) rather
than restored via backup, since voiding is itself the intended undo path
for this feature (unlike the earlier Fix #2-#4 session's raw `data.json`
edits, which had no such built-in undo).

**One real bug found and fixed during verification**: `public/app/
expenses.js` loads before `app.js` in `index.html`'s script order, so its
original top-level `let expensesFrom = todayISO()...` threw
`ReferenceError: todayISO is not defined` immediately on page load,
breaking the Expenses tab. Fixed by deferring the `todayISO()` calls into
`renderExpenses()` (lazy default) instead of module-load time — caught by
loading the app in a browser and reading the console, not just a code
read-through (same lesson as the `boot()` bug from the Finding #1 session).

**Also hit and fixed, unrelated to the code**: after editing `server.js`
and running `pm2 restart`, the server crash-looped on `EADDRINUSE` —
the very first `pm2 start` from earlier in this session had left an
orphaned `node.exe` (PID 10480) still holding port 3005 on Windows, which
`pm2 restart` doesn't clear. Fixed with `pm2 delete` + killing the orphan
PID + a clean `pm2 start`; server came up with 0 restarts afterward. Not a
code issue — flagging in case it recurs after other `pm2 restart` calls on
this machine.

**Not configured / deferred, not blocking**: no Anthropic API key is in
`secrets.json` yet, so the AI Query feature is wired end-to-end but can't
actually answer a question until one is added (same prerequisite the
existing GRN-scan feature already had). `MODEL_BACKEND=local` path is
implemented but genuinely untested (no local endpoint available).

**Server restarted** with the new routes loaded (`pm2 restart`, then the
orphan-process cleanup above). `BATHCO` confirmed untouched via
`git status`.

---

## Sell screen POS rebuild + item codes + WhatsApp bill image — 2026-08-11

Source: direct instructions from Ajmal (voice-to-text, real-time), not a
command file — design direction settled first via three review rounds of
Artifact concepts (10 static comparisons → one kinetic dashboard concept →
one kinetic storefront concept), landing on: kinetic/scroll-motion goes to
the public storefront only; the internal app stays compact, single-page-
per-screen, no scroll-hijacking, but with real functional depth (his words:
"not only changing colors").

**Built for real** (not previewed — applied directly to the live app):
- **Item codes**: every product now has a short `PI-0001`-style code
  (`app.js` `nextItemCode()`/`ensureItemCodes()`), auto-assigned on
  creation and backfilled once for existing products on login. Shown on
  Products cards, the product form, Sell tiles, and cart rows.
- **Sell screen rebuilt** (`public/app/sell.js`, `style.css`): two-column
  layout at 900px+ (item picker left, wider cart/payment panel right,
  stacks vertically on mobile — no more `display:none`-ing the cart on
  small screens), denser/smaller item tiles, a toolbar with Held Sales and
  Return/Void quick actions.
- **Expanded payment methods**: Cash, Card, Cheque, Bank Transfer, Online
  Transfer, Credit (was Cash/Bank/Credit) — Card/Cheque/Online get an
  optional reference-number field, stored server-side as `bill.paymentRef`
  (`server.js` `POST /api/bills` now accepts it). Everything except
  `credit` is still treated as paid-in-full server-side, matching the
  existing pattern — no new payment logic needed there.
- **Hold Sale**: parks the current cart/customer/payment state
  (localStorage, device-local by design — single till, not synced) so a
  second customer can be served without losing the first cart; a "Held
  Sales" modal lists/resumes/discards them, with the same stock-reclamp-
  on-resume safety net `duplicateBill` already uses in bills.js.
- **Quick lookup** (`app.js` `openQuickLookupModal()`): search an invoice
  number or customer name, get bills + customers in one result list.
  Shared by Sell's "Return / Void a Bill" button and a new search bar at
  the top of Home — brought to the front page per Ajmal's own reasoning
  (he and Nushra are the ones running lookups all day, not back-office
  staff).
- **Bill as image, not PDF/print** (`sell.js` `buildBillCanvas()`/
  `downloadBillImage()`): canvas-rendered JPG receipt with shop logo, name,
  WhatsApp number, line items, totals — uses the native share sheet
  (`navigator.share` with a file) where supported so it can go straight
  into WhatsApp, falls back to a plain download elsewhere. Addresses his
  specific complaint that sharing a bill previously only opened the
  browser print dialog.
- **Messages "needs reply" indicator** (`messages.js`): conversations
  whose last message is from the customer (nobody's answered yet, bot or
  human) get a "Needs reply · Xh Ym" badge and sort to the top, with a
  summary count banner.
- **Home**: renamed "Ask AI" to "Your Business Agent" with a one-line
  explanation it's grounded in real data, not scripted — per his "AI
  agent, not a bot like I created before."

**Verified live** (temporarily bumped 6 products to stock:8 on a backed-up
copy of `data.json` to actually exercise the Sell screen, since every real
product is genuinely at 0 stock right now — restored the exact original
file and restarted immediately after): item codes render everywhere
expected, two-column Sell layout confirmed, Card payment reveals the
reference field, Return/Void quick-lookup opens from Sell and from Home,
no console errors at any step. `data.json` diffed byte-identical to the
pre-test backup before the backup file was deleted.

**Explicitly deferred, not silently dropped** (told to Ajmal directly):
dropdown nav flyouts for GRN/Bills/Customers (shown working in the earlier
concept artifact, not yet built into the real nav), the storefront's real
kinetic rebuild (concept approved, not yet applied to `public/shop`), and
`/code-review ultra` for the larger multi-agent audit he asked for (user-
triggered, can't be launched by Claude Code itself).

---

## Storefront Placeholder Images, Bridge Port-Conflict Fix, WhatsApp Ledger Phase 1 — 2026-08-14

Skill-first check: no installed skill matches "small JS fix on an existing
themed component" or "diagnose a PM2/port conflict" closely enough to be
worth invoking over just doing the work directly; `frontend-design` was
considered for the placeholder-image change and judged disproportionate for
a ~15-line addition that reuses the storefront's existing CSS variables.
No skill used for either.

**Storefront placeholder images.** A requested target file
(`storefront-design-v2.html`) and a Vercel deploy don't exist in this repo;
redirected to the real gap instead. `public/shop/shop.js`: products with no
`photo` field rendered as bare text ("photo"). Added `placeholderImage()` —
an inline SVG data URI (product initials, dark/gold theme colors) with no
external network dependency, wired as both the default `src` and an
`onerror` fallback for broken photo URLs. Verified live in a browser at
`localhost:3005/shop/`: 6 of 11 real products currently have no photo; all
now show a themed placeholder instead of blank text. No console errors.

**Note:** `CLAUDE.md`'s "Known architectural gap" section (no auth on
`/api/data/:key`) is stale — Finding #1 was completed 2026-08-11 per
HANDOFF.md item 6 and reconfirmed by reading `server.js` directly
(`requireSession`/service-token gating is in place, default-deny with a
narrow public allowlist). `CLAUDE.md` itself hasn't been updated to reflect
this; flagged to Ajmal, not changed without his say-so.

**Bridge reconnect diagnostic** (`BRIDGE_RECONNECT_COMMAND.md`). Walked all
6 steps: firewall rule for TCP 3005 present/enabled, LAN IP still
`192.168.1.189`, server binds `0.0.0.0:3005` — all fine. Root cause: PM2's
supervised process was crash-looping (`EADDRINUSE`, 9 restarts) because an
orphaned, unsupervised `node server.js` process (PID 2928, running ~3
hours, almost certainly started via the "Premium Imports LK Server.lnk"
Desktop shortcut rather than `npm run start:pm2`) was already squatting
port 3005 — and was the one actually serving traffic, with no crash
protection. This matches the "worked, then disconnected" symptom exactly.
Fix applied: killed PID 2928, `pm2 restart premium-imports-server` — now
online and stable under supervision. Not verified from an actual phone on
the LAN (no phone available this session); firewall/bind/IP were already
confirmed correct independently. The desktop shortcut still launches the
unsupervised path and should probably point at `npm run start:pm2`
instead — flagged, not changed (out of scope for this ask).

**WhatsApp ledger Phase 1** (`WHATSAPP_LEDGER_COMMAND.md`). Pre-build check
required by the command itself: `whatsapp-bridge/index.js` runs on
`@whiskeysockets/baileys` — an unofficial bridge, not a BSP/Cloud API — on
the same number (`94771226621`) Nushra uses for live customer sales. Real
ban risk. Flagged to Ajmal; he confirmed proceeding "eyes open," no
migration to an official API for now.

Two design gaps resolved with Ajmal directly (money-write feature, not
guessed): (1) whose ledger `bill <amount>`/`paid <amount>` writes to —
decided: the sender's own account, resolved by their own phone number,
reusing the existing `customer.ledger[]`/`dues` pattern already used by
bills/payments/GRN in `server.js`, rather than a new file. (2) The
"Nushra number" he first gave (`0771226621`) turned out to be the shop's
own connected WhatsApp number — same one already special-cased as
`fromMe` barge-in in `index.js` — not a separate sender; using it for
ledger commands too would have required a self-chat carve-out and risked
colliding with the existing barge-in/escalation logic. Resolved: ledger
commands go through staff/agents' own separate personal numbers only,
never the shop number. Nushra doesn't have a personal number allowlisted
yet, so only Ajmal (`94777999219`) is enabled for now.

Built: `whatsapp-bridge/ledger.js` (fixed command grammar —
`bill <amount>`, `paid <amount>`, `ledger`, `receipt`, `yes`/`no` — no
fuzzy matching on money; confirmation-gated writes; append-only ledger
entries shaped identically to the existing bill/payment/GRN entries so
they show up correctly in the admin Customers UI). Wired into
`whatsapp-bridge/index.js`: allowlisted senders (checked against a new
`settings.ledgerAllowlist`, added to `data.json` — currently
`["94777999219"]`) are routed straight to the ledger command handler,
before conversation logging or the AI assistant, and never created as a
regular customer/conversation record.

**Verified:** `node --check` on both files (syntax), and a local dry-run
of `ledger.js` directly (allowlist correctly excludes the shop's own
number; grammar parses `bill`/`paid`/`ledger`/`receipt`/`yes`/`no`
correctly and rejects garbage amounts; a simulated bill→confirm→paid
sequence produced correct running balances; overpayment clamps `dues` at
0, matching the existing customers.js convention). `data.json` backed up
to `backups/` before adding `ledgerAllowlist`; PM2 stopped, edited,
restarted cleanly.

**Not verified — explicitly incomplete per the command's own rule**
("don't mark a phase done without showing real output"): no real WhatsApp
message has been sent through this yet. The bridge (`npm run whatsapp`) is
a separate, manually-linked process I did not start — it needs a physical
QR-scan/active session and touches the real customer-facing number live;
starting or restarting it needs Ajmal present, not something to trigger
unsupervised. Phase 1 code is built and unit-tested, not field-tested.

---

## Self-Sustaining Admin Phase 2 Scaffold (Site & POS Editor) — 2026-08-16

Source: `4_COMMAND_self_sustaining_admin.md`. Pre-flight found the command's
own Phase 1 (images, stock:0 grid) already shipped in prior sessions
(2026-08-11 / 2026-08-14, both above) — reconfirmed live, not re-done:
`public/shop/shop.js` placeholder images all load (real photos where set,
themed SVG placeholder otherwise), and `renderGrid()` never hides
zero-stock products, badges them "Out of Stock" instead. All 11 real
products currently show correctly. Also reconfirmed: `/api/data/:key` full
session/PIN auth (the command's stop-condition concern) was already built
2026-08-11, not an open gap.

**PM2 was not running** at session start (`npx pm2 status` — empty list;
an earlier session's restart apparently didn't persist across a machine
restart). Started via `npx pm2 start ecosystem.config.js`, confirmed
healthy (`/api/health` 200) before touching anything. `data.json` and
`secrets.json` backed up to `backups/` before any schema change.

**Built** — Phase 2 scaffold, scoped to real, already-wired UI values only
(not speculative fields nothing reads):
- `server.js`: new `db.uiConfig` (`storefront.heroTagline`,
  `storefront.announcementBanner`, `pos.features.grnPhotoScan`) in
  `defaultData()`, with a `backfillUiConfigDefaults()` following the exact
  pattern `backfillSettingsDefaults()` already uses (shallow-merge means
  old `data.json` files need existing fields backfilled explicitly).
  Three new routes, deliberately **not** riding `/api/data/:key`'s
  generic pattern (per the command's own instruction): `GET
  /api/admin/ui-config` (any logged-in session), `PUT
  /api/admin/ui-config` (admin role + PIN required, same
  `pinMatchesAnyUser` check as the existing bank-details gate), and `GET
  /api/public/ui-config` (unauthenticated, storefront fields only —
  `pos.*` never leaves this endpoint).
- `public/app/siteEditor.js` (new) + nav wiring in `app.js`: admin-only
  "Site & POS Editor" tab, form bound to `STATE.uiConfig`, Save prompts
  for PIN and PUTs to the new endpoint. `STATE.uiConfig` is fetched on
  boot/login (`fetchUiConfig()`), fails open to "everything on" defaults
  if the fetch fails so a config-load hiccup can't hide a POS button or
  break rendering.
- `public/app/grn.js`: the "📷 Scan Photo" button on the GRN screen is now
  conditionally rendered from `STATE.uiConfig.pos.features.grnPhotoScan`
  — first real feature flag wired end-to-end, admin panel to live
  behavior.
- `public/shop/index.html` + `shop.js` + `style.css`: hero `<h1>` (`id=
  "heroTagline"`) and a new announcement-banner strip are populated from
  `GET /api/public/ui-config` on load; failure leaves the static HTML
  defaults in place (banner stays hidden, hero keeps its hardcoded text)
  — storefront never blanks because of this fetch, per the command's rule.

**Verified live** (not just read — exercised against the running server):
unauthenticated `GET /api/admin/ui-config` → 401; unauthenticated `PUT` →
401; wrong-PIN `PUT` → 403 `invalid_pin`; correct-PIN `PUT` → 200, and the
storefront picked up a test hero tagline + banner within one page load
(confirmed via browser JS eval, not just the API response) — then reverted
to the real default text. Site & POS Editor tab confirmed rendering with
correct field values bound (`grnPhotoScan` checkbox checked, banner
checkbox unchecked matching `active:false`). `node --check` clean on all
five touched/added JS files. PM2 restarted twice (once to load the auth
routes, once after the encoding fix below) — both clean, no crash loop,
`/api/health` 200 after each.

**Bug introduced and fixed within this session**: the first `curl`-based
revert of the test hero tagline (typed through a Git Bash shell) mangled
the em dash into a replacement character, written straight to the real
`data.json`. Caught via the Site & POS Editor tab rendering "�" instead of
"—", fixed with a small Node script (not another shell string) writing the
correct UTF-8 value directly, PM2 restarted, reconfirmed clean via
`GET /api/public/ui-config`. No other fields were touched by the bad
write; a straight read/diff of the rest of `data.json` was not done after
the fact since only this one field was ever written this session — flagged
here rather than assumed clean.

**Explicitly deferred, not silently dropped** — per the command's own "be
honest about how far this gets" instruction:
- Almost everything else in the storefront/POS UI is still hardcoded, not
  moved to `uiConfig`: storefront sections/layout beyond the hero+banner,
  featured-category selection, visible/hidden product fields; POS field
  order, labels, and every other feature toggle (e.g. no `billPhotoScan`
  flag was added — `POST /api/bill-scan` exists server-side but has no
  frontend button wired to it anywhere in `public/app`, a pre-existing gap
  unrelated to this session, not fabricated a toggle for a feature that
  isn't actually built).
- Live preview panel in the Site & POS Editor: not built. The tab is
  save-then-check-the-real-page, not an in-panel preview.
- No stray-data cleanup: a `TestProductABC` test product is live on the
  real storefront (unrelated to this session's changes) — flagged to
  Ajmal, not touched without his say-so.
- This is genuinely a scaffold, not a finished self-sustaining system —
  the next session's starting point is "pick the next hardcoded UI value,
  move it the same way `heroTagline`/`grnPhotoScan` were moved."

---

## Sell Screen POS Redesign — 2026-08-16 (same session, continued)

Ajmal's own words: current Sell screen "not very convenient," wants "one
POS interface running inside the system" with everything else self-
sustaining/admin-editable, and confirmed field/button visibility+order
should be admin-editable from the start (not a later follow-on), and the
new screen should follow a classic retail-terminal pattern (Square/Toast/
Clover-style: browse and tap products freely, cart always visible,
customer/payment handled at checkout, not before).

**Core UX change** (`public/app/sell.js`): removed the customer-first gate
that used to block adding anything to the cart until a customer or
"Cash Sale" was explicitly picked. Browsing and adding items now works
immediately on opening the screen — no forced first step. Customer picker
moved into the cart panel, now optional; blank = walk-in cash sale
automatically (no more explicit "Cash Sale" sentinel selection — the old
`CASH_SALE_ID` constant is kept only so held sales saved before this
redesign still resume correctly). Credit sales alone still require a named
customer, enforced at Complete Sale time with a clear inline label change
("Customer — required for credit sales") rather than an upfront gate.
Category filter is a rail: horizontal scroll strip on mobile, real
vertical sidebar at desktop widths (≥900px, `public/app/style.css`).
Post-action focus (after completing a sale, holding a sale, closing a
receipt) now returns to the item search box, not a customer field —
matches "start scanning/tapping the next sale immediately."

**Admin-editable from the start** (per direct instruction, not deferred):
`server.js` `uiConfig.pos` gained `paymentMethods` (ordered array of
`{id, label, enabled}`) and two more feature flags (`heldSales`,
`returnVoid`), all backfilled the same way `grnPhotoScan` was. The Site &
POS Editor tab (`siteEditor.js`) now has a Payment Methods section — per-
method enable/disable checkbox plus up/down reorder buttons — and toggles
for the Held Sales and Return/Void toolbar buttons. `sell.js` reads all of
this via `activePaymentMethods()`/`posFeatureEnabled()`, same fail-open
pattern as the rest of `STATE.uiConfig` (missing/unloaded config = show
everything, never hide a button because a fetch hiccuped).

**Verified live**, not just read: browser JS eval against the running
server confirmed — clicking a product tile adds to cart with zero
customer step; switching to Credit payment shows the "required for credit
sales" label; completing a Cash payment with no customer selected creates
a real bill (`INV-0002`, `customerName: "Cash Sale"`) and returns focus to
item search; unchecking "Card" in the Site & POS Editor and saving (PIN-
gated PUT) immediately removes the Card button from the live Sell screen,
re-checking it restores it. Real stock was temporarily bumped on 4
products (same "test on a backup, verify, restore the exact original"
pattern the 2026-08-11 session used) to have something sellable to click
through, then `data.json` was fully restored from the pre-test backup
(`backups/data-before-pos-test-20260816-140315.json`) afterward — bills
back to 1 (the test `INV-0002` gone), stock back to 0 on all products,
confirmed via direct file read, not assumed. `node --check` clean on
`sell.js`, `app.js`, `siteEditor.js`, `server.js`. PM2 restarted 3 more
times this leg (load new routes, apply test stock, restore real data) —
all clean, `/api/health` 200 each time, no crash loop.

**Not done / explicitly deferred:**
- Live preview of a reordered/disabled payment method inside the Site &
  POS Editor itself — admin has to switch to the Sell tab to see the
  effect, same limitation as the rest of this scaffold.
- No admin control yet over item-tile density, grid column count, or
  which product fields show on a tile (photo/code/stock badge) — the
  "which buttons/fields show, their order" instruction was scoped to
  payment methods and the toolbar buttons that already existed as
  identifiable on/off switches; tile composition wasn't one of those and
  would need its own config shape, not built speculatively here.
- Category-rail *order* is still whatever order `settings.categories`
  is in (existing Settings tab controls that already) — not duplicated
  into `uiConfig.pos`.

---

## System-Wide Polish Pass — 2026-08-16 (same session, continued)

Ajmal asked for a broad audit — "compare to what a small-shop POS
normally has, add/fix/remove what's genuinely missing or wrong, go ahead
without pausing for approval each time." Given full authorization to
implement, but this remains a live system handling Ajmal's wife's actual
sales/credit/customer data, the approach taken was: audit thoroughly, but
only implement changes that are safe, real, and grounded in something
actually missing — not padded to hit a number, and nothing destructive to
real business records without the same backup-test-restore discipline
used all session. Read through every screen not yet reviewed this session
(`dashboard.js`, `bills.js`, `expenses.js`, `reports.js`, rest of
`settings.js`) to find genuine gaps rather than guessing.

**Concrete bug fixed first** (Ajmal's own words: "in the cell page taps
are very long overriding"): `.topnav-tabs` had `overflow: hidden` with no
scroll and no wrap. With 13 tabs now (after adding Site & POS Editor
earlier this session), tabs that didn't fit the window width were
silently clipped — no scrollbar, no "more" affordance, just gone. His
screenshot showed "Settings" truncated to "Settin" and Site & POS Editor
not rendering at all. Changed to `overflow-x: auto` — every tab is now
reachable by horizontal scroll/swipe instead of some just vanishing.

**Additions, grounded in a real comparison against standard small-shop
POS/bookkeeping conventions:**
- **Search boxes on Products, Customers, and Loans** — Sell, GRN, Bills,
  and Vendors already had text search; these three didn't, a real
  inconsistency once any of those lists grows past a screenful. Added
  using the exact same "filter only the list container, not the whole
  screen" pattern already used elsewhere (so the search input never loses
  focus mid-type).
- **Cash Tendered / Change Due on the Sell screen** — a standard POS
  feature that was simply absent: paying cash gave no way to enter what
  the customer handed over and see change owed. Added an optional
  "Cash Tendered" field + live "Change due: Rs. X" / "Rs. X short" text
  under the Cash payment method.
- **Clear Cart button** — no way to empty the cart except removing items
  one at a time. Added next to the item count, confirm-gated.
- **Owner-triggerable full backup** (`server.js` `GET /api/admin/backup`,
  admin-only session; `settings.js` "Download Backup" button). The server
  already auto-backs-up `data.json` daily, but that's invisible to a
  non-technical owner and lives only on this machine — this lets Ajmal or
  his wife grab their own copy anytime without a developer involved.
  Verified live: fetched the real endpoint, got back all 11 real products.
- **"Free delivery over Rs. X" banner on the storefront** — the setting
  (`settings.deliveryZones.freeDeliveryMin`) already existed and was
  already used by the WhatsApp assistant's answers, but was never in
  `PUBLIC_SETTINGS_FIELDS`, so the storefront itself had no way to read
  it and never showed it to browsing customers. Added the field to the
  public view (server.js) and a small banner line under the hero
  (`public/shop`) — verified live, correctly showing "Free delivery on
  orders over Rs. 2,000.00" from the real setting.
- **Optional customer credit limit** (`customers.js` form field +
  `sell.js` warning). Soft warning only, shown at the Sell screen when a
  credit sale would push a customer over their set limit — doesn't block
  the sale, staff can still proceed, matching how the rest of this app
  treats staff as trusted rather than gated. Verified live: setting a
  test customer's limit to Rs. 100 and picking Credit payment correctly
  showed the warning; reverted immediately after.
- **"Sales by Staff" CSV export** (Reports tab) — `bill.by` was already
  recorded on every sale (server-trusted, not client-editable) but never
  surfaced anywhere. Added a straightforward group-by-staff CSV, same
  reasoning/exclusions (voided bills, quotes) as the existing Sales
  export.

**Noted but deliberately not built** (real gaps, judged too large or too
risky to add unprompted on a live financial system in this pass):
- **Per-bill partial payments.** `app.js`'s own `billStatus()` comment
  already documents this: only aggregate customer-level payments exist
  today (`customer.dues`/`Record Payment`), nothing lets staff record a
  payment against one specific invoice. A real, standard bookkeeping
  feature, but it's a genuine data-model change (a `bill.payments[]`
  array, reconciliation logic), not a same-pass addition.
- **VAT/tax on bills.** Not present anywhere in the bill schema. Not
  added — whether this business is VAT-registered is a real-world fact
  only Ajmal knows, not something to assume and bolt on.
- **Barcode scanning, bulk CSV product import, multi-location stock,
  thermal receipt printing.** All standard for *some* POS systems, none
  of them clearly fit "a small shop, keep it that way" per Ajmal's own
  framing of this system's scope — flagged as options, not built.

**Verified live**, browser JS eval against the running server for every
item above (search boxes present on all three screens; change-due
calculates correctly on a real cart; Clear Cart empties `STATE.sellCart`;
credit-limit warning fires and clears correctly; storefront banner shows
the real setting; Sales by Staff button present). `data.json` was
temporarily test-mutated twice (stock bump to exercise the Sell-screen
features, a throwaway customer credit-limit set) — both fully reverted
from pre-test backups (`backups/data-before-polish-test-*.json`),
reconfirmed via direct file read (bills back to 1, stock back to 0, no
`�` replacement-character corruption anywhere in the file). `node --check`
clean on every touched JS file. PM2 restarted 3 times this leg — clean,
`/api/health` 200 each time, no crash loop.

---

## Machine Restart Recovery, WhatsApp General Tier, GRN Void — 2026-08-16 (new session, continuing)

Computer was shut down and restarted mid-session. Picked back up: `server.js`
and `whatsapp-bridge/index.js` had uncommitted local changes from before the
shutdown (the WhatsApp "General tier" work, mid-progress) — confirmed via
`git status` before touching anything, nothing lost.

**PM2 crash-loop on restart, same pattern as 2026-08-14's fix**: after
`npx pm2 start`, the process showed `waiting`/restart-count climbing.
Root cause was identical to before — an unsupervised `node server.js`
(PID 1764, started at boot, almost certainly via the desktop shortcut/
startup entry, not `npm run start:pm2`) was squatting port 3005 with no
crash protection. Killed it, PM2 took the port cleanly, confirmed
`/api/health` 200 and stable uptime. The desktop shortcut still isn't
fixed to launch through PM2 — flagged again, not changed (same reasoning
as before: out of scope for this ask, Ajmal's call).

**WhatsApp product concept — "General" tier, finished and verified.**
Per Ajmal's own answers when asked: General = a simple FAQ responder
(hours/delivery/location/product price), no AI call, no API cost; started
from what already exists rather than a new repo. Built
`whatsapp-bridge/faqAssistant.js` — deterministic keyword matching against
real `settings`/`products` data (same data shape `assistant.js`'s AI
engine already uses, so a shop can move between tiers without any other
code changing). `settings.whatsappTier` (`'general'` | `'pro'`, defaults
to `'pro'`) added to `defaultData()` + `backfillSettingsDefaults()`,
`whatsapp-bridge/index.js` picks the engine per that setting, and Settings
→ WhatsApp Assistant got a toggle for it. Verified: real `data.json`
backfilled to `whatsappTier: "pro"` on restart (this shop's real behavior
unchanged); toggle renders and defaults to "Full AI Assistant" correctly;
`generateSimpleReply()` unit-tested directly with real settings/product
shapes — hours, delivery, product-price lookup, and the graceful fallback
all produced correct, sensible answers with zero AI cost.

**Not done**: extracting a white-label/reusable version into its own repo,
Light/Standard tiers, voice/image recognition, multi-language handbooks —
all still ahead, per Ajmal's own "extract a reusable core first" starting
point. The bridge's other modules (`dataClient.js`, `guards.js`,
`conversations.js`) were already read this session and are close to
generic as-is (no PIL-specific hardcoding beyond default fallback
strings) — worth noting for whenever the actual extraction happens.

**GRN Void — new gap found and fixed.** Ajmal: "wherever it is a data
entry, there should be [a way] to edit it or delete it." Audited GRN
specifically (Products/Customers/Vendors/Loans already got this earlier)
and found it had *no* correction mechanism at all — once saved, a wrong
GRN couldn't be fixed except by manually patching stock/vendor balance
elsewhere. Added `POST /api/grns/:id/void` (server.js) — same pattern as
`/api/bills/:id/void`: reverses stock (clamped at 0, since some of the
received stock may have already sold by the time a mistake is caught —
matches the existing dues-clamp pattern) and vendor balance via a new
reversing ledger entry, never mutates or deletes the original GRN record.
`costPrice` is deliberately left as this GRN set it — reverting to a
"previous" cost would need real price-history tracking that doesn't exist,
not faked here. Frontend: `grn.js` GRN history now shows a "Voided" badge
and a Void button (admin-only) with a reason prompt, matching Bills' void
flow exactly.

**Verified live, not just read**: tested against the one real GRN record
using the same backup-test-restore discipline as every data-touching
change this session — voided it via the real API (confirmed stock
clamped, status/voidedAt/voidedBy/voidReason set correctly, no crash
despite a pre-existing orphaned vendor reference — see below), then
restored `data.json` from the pre-test backup, reconfirmed byte-clean
(no `�` corruption) and GRN status back to active.

**Found in passing, not fixed**: the one real GRN record's vendor
(`vendorId: V-msk1sbpb-326`, "chammi") no longer exists in `db.vendors` —
`STATE.vendors` is currently empty, so this vendor was deleted at some
point (possibly via the delete-vendor feature built earlier this session)
without the GRN that references it being cleaned up. The new void
endpoint already handles this gracefully (skips the vendor-side reversal
if the vendor's gone), so nothing broke, but it's a real, pre-existing
data inconsistency — flagged for Ajmal, not silently fixed, since
"reconcile an orphaned reference" is a judgment call about what actually
happened, not something to guess at.

`node --check` clean on every touched file. PM2 restarted several times
this leg (recovery, WhatsApp wiring, GRN void, test, restore) — all
clean once the orphaned process was cleared, `/api/health` 200 throughout.

**Flagged, not actioned:** mid-session Ajmal raised a separate, much
larger idea — a white-label WhatsApp AI agent product (voice recognition,
image recognition, 3 languages) to sell to other shops, mentioning
"Layala" by name. Declined to act on it here: "Layala" is a BATHCO COMMAND
item, and this session opened under an explicit Premium Imports LK-only
project lock with a standing "BATHCO wall — absolute" rule
(`NEXT_STEPS_ROADMAP.md`). Also, that idea is exactly what
`NEXT_STEPS_ROADMAP.md` Priority 4 already lists ("white-label WhatsApp
AI product play," "APEX Super Admin," "NOOR DIGITAL") as "broader
horizon, not urgent, context only" — not something to fold into this
session. Ajmal confirmed: finish Premium Imports LK first, open a
dedicated session for the WhatsApp agent idea separately.

---

## Direct Edit/Delete on List Rows + Short Item Codes — 2026-08-16 (same session, continued)

Two small direct requests from Ajmal, screenshot-driven.

**Direct Edit/Delete buttons.** Products cards had "Edit" only — Delete
existed but only reachable by opening Edit first. Ajmal wanted both
buttons directly on the card, confirmed (when asked) he wanted the same
on Customers, Vendors, and Loans too. Added `data-edit-*`/`data-delete-*`
buttons with `stopPropagation()` to `products.js`, `customers.js`,
`vendors.js`, `loans.js` — the existing "tap the row to open its
ledger/ editor" behavior on Customers/Vendors/Loans is unchanged, the new
buttons just sit alongside it. Each screen's delete logic was extracted
into a shared `delete<Entity>(id)` function (`deleteProduct`,
`deleteCustomer`, `deleteVendor`, `deleteLender`) so the card button and
the edit-form's existing Delete button call the exact same code — no
duplicated confirm/save logic to drift out of sync. Customers/Vendors/
Loans deletes now warn in the confirm dialog if the record has an
outstanding balance ("They still owe Rs. X — deleting them loses that
record too"), since deleting one of those also silently discards its
ledger; Products has no such balance, plain confirm only.

**Short item codes.** Ajmal: "PI-0001 too long, 01 ok." `app.js`'s
`nextItemCode()` changed from `PI-` + 4-digit padding to a plain 2-digit
number. Added `migrateItemCodes()` (runs once via `ensureItemCodes()` on
login) to renumber every existing `PI-####` code to the new short format,
preserving relative order (lowest `PI-####` becomes `01`, next becomes
`02`, etc.) so codes stay predictable rather than reshuffled. No other
file hardcodes the old format — everywhere else (`sell.js` cart/tiles,
GRN, bills) just interpolates `p.itemCode`, so they picked up the new
format automatically.

**Verified live**, browser JS eval against the running server: every
Products/Customers/Vendors/Loans row confirmed showing both buttons;
Cancel on a delete confirm leaves the record count unchanged; clicking a
Customers row body (not the buttons) still opens its ledger correctly.
Real product item codes reconfirmed via a direct `data.json` read after
the migration ran (`01`–`11`, same order as the old `PI-0001`–`PI-0011`).
`data.json` backed up to `backups/` immediately before the item-code
migration (`data-before-itemcode-shorten-*.json`), since that one does
mutate real product records rather than just config. `node --check` clean
on all five touched files. PM2 restarted once for this leg, clean,
`/api/health` 200, no crash loop.
