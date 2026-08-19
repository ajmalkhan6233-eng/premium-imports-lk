---
name: pos-visual-hierarchy
description: Order information by importance on POS/transaction screens so the single most critical number on screen (total due, or change due mid-payment) is always the most visually dominant element. Use this whenever building or reviewing any checkout, billing, invoice, GRN, or payment screen — cart views, receipt previews, payment modals, split-payment screens, refund screens. Also use it any time a screen shows more than one number and it's unclear which one the cashier's eye should land on first, even if the user didn't say "hierarchy" or "design."
---

# POS Visual Hierarchy

A cashier glances at the screen for a fraction of a second between handling cash, bagging items, and talking to a customer. In that glance, exactly one number matters: what does the customer owe right now. Every other element on a transaction screen — item list, tax breakdown, cashier name, receipt number — is context. If the layout doesn't make the important number visually inevitable, the cashier has to *read* the screen instead of *glance* at it, and reading is where mistakes and slowdowns come from (wrong change given, wrong amount collected).

This skill exists to make "what matters most" a designed property of the screen, not an accident of whatever order the fields were coded in.

## The core rule

**Rank every number and label on the screen by how costly it is to misread, then make visual weight follow that rank.** Visual weight = size + font weight + color + isolation (whitespace around it) + position. Nothing about database field order or the sequence a form was built in should influence this — hierarchy is decided by consequence, not by convenience.

For a standard sale screen, the rank is almost always:

1. **Primary — the number the transaction lives or dies on.** Total due before payment; change due after cash entered; balance remaining on a partial/split payment. There is exactly one primary number on screen at any moment.
2. **Secondary — supports the primary.** Line items, quantities, subtotal, discount applied, payment method selected. The cashier reads these to build confidence in the primary, but doesn't need them to complete the transaction.
3. **Tertiary — record-keeping, not decision-making.** Cashier name, timestamp, receipt/invoice number, table/order number, tax registration number. Necessary on the receipt, unnecessary to dominate the live screen.

## The primary number is state-dependent — not static

The "most important number" changes as the transaction progresses, and the layout must promote/demote accordingly:

- **Building the cart:** primary = running total.
- **Payment entry, cash:** primary = change due, the moment any amount is typed/tendered. Total due demotes to secondary — it's now just context for the change calculation. Getting this wrong (leaving "total due" dominant while change sits in small text) is one of the most common causes of wrong change given.
- **Payment entry, card/digital:** primary = amount to charge, stays dominant until confirmation.
- **Split payment:** primary = remaining balance still owed, not the original total.
- **Refund/void:** primary = amount being refunded/reversed, styled with the same weight rules but paired with the status-color system's danger color (see [[pos-color-system-status]]) so it also reads as "this is undoing something."

If a screen you're building shows a number that used to be primary sitting at the same visual weight after the state changed, that's a hierarchy bug even if nothing is technically wrong with the math.

## Concrete weight scale

Use this as a default; adapt proportionally if the design system's base sizes differ, but preserve the *ratios* — the jump between tiers is what creates hierarchy, not the absolute pixel values.

| Tier | Font size | Weight | Color | Notes |
|---|---|---|---|---|
| Primary (the number) | 40–64px | Bold/Black | One reserved accent color, used for nothing else on the screen | Never share this color with decorative UI elsewhere |
| Secondary (line items, subtotal) | 16–20px | Regular/Medium | Standard text color | Line items may use a slightly heavier weight than metadata, but must stay well below primary |
| Tertiary (metadata) | 12–14px | Regular, often muted/gray | Muted/secondary text color | Receipt number, timestamp, cashier — present, but visually quiet |

A useful sanity check: the primary number's font size should typically be **2.5–4x** the size of secondary text. If it's only 1.2x bigger, it isn't functioning as a hierarchy — it's just "also bold."

## Isolation matters as much as size

A big number crammed next to other UI reads as *part of* that UI, not as *the* answer. Give the primary number:

- Its own visual block, with padding that no other element intrudes on.
- A background treatment (card, contrasting panel, or fixed bar) that separates it from the scrolling item list, especially on tablets where the cart list can be long.
- A fixed/anchored position (commonly bottom bar or top-right) so staff build muscle memory for *where* to look — hierarchy that moves screen-to-screen defeats the "glance" goal even if each individual screen is well-ranked.

## Anti-patterns to catch in review

- **Multiple competing giants.** Subtotal, tax, and total all rendered at similar large size — the eye has nowhere to land. Only one number gets the top tier at a time.
- **Color used decoratively on the primary number's color.** If the brand accent color is also used for buttons, headers, and badges throughout the app, it's not reserved, and the primary number stops standing out. Reserve at least one property (usually color, sometimes size) exclusively for this purpose — see [[retail-brand-theming]] for how theming should carve out this exception.
- **Hierarchy that survives on a full-brightness demo screen but collapses under real light.** Test contrast and size against the "arm's length squint test" below, not just at your desk.
- **Metadata competing with content.** Timestamps, cashier names, or receipt IDs styled at a size close to line items. These are for the printed receipt and audit trail, not for the cashier's live glance.
- **Static primary across states.** See the state-dependent section above — the most common real-world bug is "total due" staying dominant after cash is tendered, when "change due" is what actually matters now.

## Verification: the arm's-length squint test

Before calling a transaction screen done, step back from the monitor (or blur your eyes, or shrink a screenshot to thumbnail size). The single number a cashier needs to act on should still be legible and identifiable as *the* number. If you can't tell which number matters from across the room, the hierarchy hasn't been built yet — it's just a layout with big text somewhere on it.

Run this check as part of [[design-review-critique]] before marking any transaction screen complete.
