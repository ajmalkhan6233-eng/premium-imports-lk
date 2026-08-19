# Premium Imports LK — System Handbook (English Edition)

*This handbook describes the system as it actually works today. A few
items are still being built (see the "Coming Soon" box below) — this
document says so plainly wherever that applies, rather than describing
something that doesn't exist yet.*

---

## 0. Start Here — What Is This?

**Premium Imports LK's system is one program that runs the whole shop**:
ringing up sales, tracking stock, recording what customers and vendors
owe, keeping goods-received records, and showing the owner exactly how
the business is doing — all from one screen, updated the instant
something happens.

**What it can do, in one list:**
- Ring up a sale and print/share the bill in under a minute
- Know exactly how much of everything is in stock, right now, without
  counting shelves
- Know exactly who owes the shop money, and who the shop owes
- Keep a permanent, unchangeable record of every sale, every void, every
  payment — who did it and when
- Show the owner today's profit, not just today's sales, automatically
- Talk to customers on WhatsApp and keep a record of what was said
- Run the public online storefront from the same stock numbers as the
  counter, so what's shown online is never out of sync with what's on
  the shelf

**Why it's better than paper, a notebook, or a spreadsheet:**

| Paper / spreadsheet | This system |
|---|---|
| Stock counts are a guess until you physically count | Stock updates itself the instant a sale or GRN happens |
| A voided sale can just be scratched out or lost | Every void is permanently logged — who, when, why — and can't be silently erased |
| "How much did we make today" means adding up a notebook by hand | Net profit is calculated and shown automatically, every day |
| Customer credit is tracked in someone's memory or a separate book | Every customer has a running ledger the system keeps automatically |
| Only works if the person who wrote the notebook is there to read it | Anyone with a login can look anything up in seconds |
| One copy — lost or damaged, it's gone | Automatic daily backups, plus a downloadable backup any time |

> **Coming soon (in active development, not yet available):**
> barcode scanning at checkout, splitting one sale between cash and
> card, an end-of-day till-reconciliation report, logging in from
> outside the shop's WiFi, offline sale capture on a phone with
> auto-sync when it reconnects, and the 15-question setup wizard for
> new business accounts. This handbook will be updated with real
> instructions for each of these the moment they're built — not before.

---

## 1. How the System Works (Big Picture)

- **One computer, one program.** The system runs on a computer at the
  shop. All the shop's data — products, customers, vendors, bills,
  everything — lives in a single data file on that computer.
- **Two things it runs:**
  1. **The counter/admin app** (`/app`) — what staff and the owner use
     to ring up sales, manage stock, and see reports.
  2. **The public storefront** (`/shop`) — what customers browse online.
     It always shows the same stock numbers as the counter, live.
- **Accounts and roles.** Everyone signs in with their name and a PIN.
  There are two levels today: **Admin** (full access, including
  Settings, Reports, and the Site & POS Editor) and **Staff** (day-to-day
  work — Sell, Products view, Customers, Bills, etc. — without access to
  shop settings or financial reports).
- **It only runs while the shop computer is on.** Right now this is a
  local system — reachable only from the shop's own WiFi. Remote access
  from outside is being built (see the Coming Soon note above); once
  it's live, the setup steps used will be documented here in the
  "Setup & Remote Access" section below, with the exact commands run.

---

## 2. Signing In

When you open the app, you'll see a list of names — pick yours, enter
your PIN, and tap **Sign In**. You stay signed in until you tap
**Sign out** (top right) or don't use the app for about 12 hours, after
which you'll be asked to sign in again automatically — this is a safety
measure so a phone or tablet left logged in overnight isn't a wide-open
door to the system the next morning.

If you forget your PIN, an Admin can reset it for you from
**Settings → Manage Users**.

---

## 3. Sell — the screen you'll use most

This is the checkout screen. It opens by default when you sign in
because it's used dozens of times a day.

- **Bill / Credit Memo / Quotation** (top toggle) — choose what kind of
  document you're creating. **Bill** is a normal sale. **Credit Memo**
  records a return/adjustment without a full sale. **Quotation** is a
  price estimate to hand or send to a customer — it does **not** touch
  stock or take payment.
- **Held Sales** — if a customer steps away mid-sale, tap this to save
  the cart and come back to it later without losing the items.
- **Return / Void a Bill** — look up a past bill to void it or process a
  return against it.
- **Category rail** (left side) — tap a category to filter the product
  grid instead of scrolling through everything.
- **Search box** — type a product name or item code; the grid filters as
  you type. This is faster than tapping through categories for a
  specific item.
- **Product tiles** — tap a product to add one to the cart. Each tile
  shows the price and how many are left in stock; a red "left" badge
  means it's low.
- **Cart panel (right side)** — every item you've added, with quantity
  +/- buttons, a price you can override per line if needed, and a
  remove (✕) button per line.
- **Customer field** — optional for a walk-in cash sale. Search by name
  or phone to attach a sale to a customer's record (needed for credit
  sales, useful for everything else so purchase history builds up).
- **Discount** — enter a fixed Rs. amount or a percentage; the toggle
  switches between the two.
- **Payment method buttons** (Cash / Bank / Credit, or whatever your
  shop has configured) — choose how this sale is being paid.
  - **Cash**: enter what the customer handed over in **Cash Tendered**
    (optional) and the screen shows **Change due** — or, in red, how
    much short the tendered amount is, so a mistake is visible before
    the sale is completed, not after.
  - **Bank**: shows a QR code and your bank details for the customer to
    pay by transfer.
  - **Credit**: choose a **Payment Plan** (how many days until it's
    due). If this sale would put the customer over their credit limit,
    you'll see a clear warning — you can still complete the sale, but
    you won't do it by accident without knowing.
- **Total bar (bottom, always visible)** — the single most important
  number on the screen: what's owed. It's deliberately the biggest,
  boldest thing on screen so it's never in doubt what to collect. Next to
  it: **Hold** (park this sale) and **Complete Sale** / **Generate
  Quotation**.

---

## 4. Home (Dashboard)

The first thing an Admin sees after Sell-adjacent screens — a
at-a-glance view of the business:

- **Summary cards** — Net Profit, Low Stock count, Stock Value, Total
  Customer Dues, Total Loans Outstanding. Tap any card to see the full
  breakdown behind the number, not just the total.
- **Your Business Agent (Ask AI)** — type a plain-language question
  about the business ("what sold best last week?") and get an answer
  pulled from the shop's real data.
- **Documents** — a place to store and retrieve general business
  documents (upload/download), separate from bills and GRNs.

---

## 5. Products

The master list of everything the shop sells.

- **+ Add Product** (Admin only) — create a new product: name, item
  code, category, cost price, selling price, starting stock.
- **Edit / Delete** (Admin only) — change details or remove a product.
  Staff can view the list (to check stock/price) but not change it —
  this is deliberate: pricing mistakes are expensive, so only Admins can
  make them.

---

## 6. GRN (Goods Received Note)

This is how new stock gets recorded when it arrives from a vendor —
"GRN" is the paperwork term for "goods received note."

- **Attach Photo / PDF** — attach a photo of the vendor invoice/delivery
  note to the GRN for your own records.
- **📷 Scan Photo** (if enabled) — photograph an invoice and the system
  reads it and suggests line items (product, quantity, cost) for you to
  review before adding — you always check the AI's suggestion before it
  becomes real stock, it never adds stock silently.
- **+ Add Line** — manually add a line item (product, quantity, cost)
  instead of/alongside scanning.
- **Save GRN** — commits the goods received: stock goes up for every
  line item, and the vendor's balance (what the shop owes them) goes up
  by the total cost.
- **Recent GRNs** — history of past goods-received entries.
- **Void GRN** (Admin only) — reverses a GRN: stock and the vendor
  balance are rolled back. Used when a GRN was entered by mistake.

---

## 7. Bills

The full history of every bill the shop has issued.

- Tap a bill to open it: **Reprint**, **Duplicate** (start a new sale
  pre-filled with the same items), or **Void / Return** (Admin,
  reverses the sale — restores stock, reverses any customer balance
  change — and is permanently logged with who voided it and why).

---

## 8. Customers

Every customer the shop has on file, with their purchase history and
balance.

- **+ Add Customer** — name, phone, credit limit if they're allowed to
  buy on credit.
- **📊 Purchase Insights** — three automatically-generated lists:
  **Frequent buyers** (3+ purchases in 90 days — your regulars),
  **Gone quiet** (used to buy regularly, haven't in 30+ days — worth a
  check-in message), and **Category preferences** (who mostly buys
  what). Each row has a **Draft message** button that writes a WhatsApp
  message for that customer, ready to send or copy.
- **Customer detail** — the ledger (every bill, payment, and credit
  memo affecting their balance, running total after each), plus
  **Record Payment** (they pay down what they owe) and a **WhatsApp**
  shortcut to message them directly.
- **Edit / Delete** (Admin only).

---

## 9. Vendors

Every supplier the shop buys from, with what's owed to them.

- **+ Add Vendor**, **Edit / Delete** (Admin only).
- **Vendor detail** — **Record Payment** (paying the vendor down),
  **Export CSV / PDF** (a full statement), a balance-over-time chart, the
  full ledger, and GRN history (every goods-received entry from this
  vendor).
- Payments can be voided (Admin only) if entered by mistake — the
  balance recalculates correctly, and the void is logged.

---

## 10. Loans

Money the business has borrowed (or lent), tracked per lender.

- **+ Add Loan**, **+ New Lender**, **Edit / Delete Lender**
  (Admin only).
- **Lender detail** — **Record Payment**, balance-over-time chart, and
  the full ledger. Payments can be voided (Admin only), logged the same
  way as everywhere else.

---

## 11. Expenses

Day-to-day business expenses, separate from vendor bills.

- **+ Add Expense** — what it was, how much, when.
- **Running Total** shown at the top of the list.
- **Void** (Admin only) — for an expense entered by mistake; logged, not
  silently deleted.

---

## 12. Messages

A log of WhatsApp conversations with customers, so there's a record of
what was discussed even if it happened on someone's phone.

---

## 13. Reports (Admin only)

Pre-built exports for when you need the numbers outside the app:

- **Sales**, **Sales by Staff**, **Stock**, **Customer Dues**,
  **Loans**, **Net Profit**, and **Where customers come from**
  (marketing source breakdown) — every one of these has an
  **Export CSV** button that gives you the raw numbers to open in Excel
  or send to an accountant.

---

## 14. Settings (Admin only)

Shop-wide configuration:

- **Appearance** — visual theme.
- **Shop** — business name and details shown across the app and on
  receipts.
- **Bank Details** — the account info used to generate the payment QR
  code shown to customers. Changing this requires your PIN as a second
  confirmation, since it's the account customers will be sending money
  to — a mistake here is expensive, so it's deliberately harder to
  change by accident.
- **Categories** — the product categories used throughout Sell and
  Products (add, rename, remove).
- **Payment Plans** — the credit terms offered (e.g. "due in 30 days")
  that show up as choices on the Sell screen's Credit option.
- **WhatsApp Assistant** — configuration for the automated WhatsApp
  side of the business.
- **Delivery Zones**, **Marketing Links** — storefront-related settings.
- **Billing** — the starting bill number sequence.
- **Inventory** — aging-days threshold (how long stock has to sit before
  it's flagged as slow-moving).
- **Backup** — **Download Backup** gives you an immediate copy of the
  entire shop's data file, on top of the automatic daily backups the
  system already keeps.
- **Change PIN** — change your own sign-in PIN.
- **Manage Users** — **+ Add Staff** (create a new login), **Reset PIN**
  and **Remove** for existing users. This is where new staff accounts
  get created, with staff-level (not admin-level) access by default.

---

## 15. Site & POS Editor (Admin only)

Controls what the public storefront and the Sell screen look like and
which optional features are switched on — announcement banners, hero
text, which payment methods appear (and in what order) on the Sell
screen, and feature toggles like the GRN photo-scan assistant, Held
Sales, and Return/Void.

---

## 16. Setup & Remote Access

**Running the system today (local, LAN-only):**

```
npm run start:pm2       # start under process supervision — auto-restarts on crash
npx pm2 restart premium-imports-server   # after any code change
npm run logs:pm2        # view live logs
npm run stop:pm2        # stop the server
```

The system currently only responds on the shop's own WiFi network —
by design, and intentionally, up to this point. **Remote access from
outside the shop is being built now.** Once it's working and tested,
this section will be replaced with the exact steps that were actually
run to set it up — not a generic tutorial, but this shop's real
configuration — so you can reproduce or troubleshoot it yourself.

**Auto-start on boot:** also part of the same in-progress work, so the
server comes up automatically when the shop computer starts and stops
cleanly when it shuts down, with no manual step required day to day.

---

## 17. Troubleshooting & FAQ

**The screen looks frozen / nothing happens when I tap something.**
Wait a couple of seconds first — some actions (saving a sale, loading a
report) take a moment. If it's genuinely stuck, close and reopen the
app. This isn't losing your work in most cases: a sale isn't recorded
until you tap Complete Sale.

**I can't see Settings, Reports, or Site & POS Editor.**
Those are Admin-only. If you need something changed there, ask an Admin
(currently AJMAL/NUSHRA) — or ask to be made Admin if that's the right
long-term setup for your role.

**A number looks wrong (stock, a customer's balance, profit).**
Check whether a recent bill, payment, or GRN was voided — voids
correctly change these numbers, and it's easy to forget a void happened
a few minutes earlier. If it still looks wrong after checking that,
that's worth reporting rather than working around.

**I made a mistake on a sale after completing it.**
Don't edit around it — use **Void / Return** on that bill from the Bills
screen (or the Sell screen's "Return / Void a Bill" button). This keeps
a clean, honest record instead of a sale that quietly doesn't match what
happened.

**Can I use this on my phone?**
Yes, on the shop's WiFi today. Off-WiFi use (and offline sale capture)
is part of the in-progress work described in the "Coming Soon" box at
the top of this handbook.

**Is my data safe if the computer breaks?**
Automatic daily backups run already, and you can pull a manual backup
any time from **Settings → Backup → Download Backup**. Keep a copy of
that download somewhere off the shop computer (a cloud drive, an email
to yourself) periodically — a backup that lives only on the machine that
might break isn't a real backup.

---

## 18. The Onboarding Questionnaire

*This section will be written once the 15-question list is provided and
the in-app flow is built. In short: any brand-new business account will
answer 15 questions about how the shop operates (pricing style,
inventory detail needed, whether credit accounts are offered, receipt
format, and more), and the system will use those answers to switch on
sensible defaults automatically instead of asking every setting one by
one. This document will explain each question and exactly which
setting(s) it changes, once that's real.*

---

## 19. How This Handbook Grows

This handbook is written in numbered, self-contained sections on
purpose, so that:
- adding a **third language edition** later means writing that
  language's version of the same section numbers — not restructuring
  this document or the English one;
- adding a **new screen or feature** to the app means adding one new
  numbered section here, without touching the others;
- the **in-app Help screen** pulls a condensed version of this same
  structure, so the short version in the app and the full version here
  never drift into contradicting each other.
