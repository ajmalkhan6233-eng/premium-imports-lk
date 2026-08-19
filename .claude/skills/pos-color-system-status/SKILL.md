---
name: pos-color-system-status
description: Apply one consistent, fixed color language for order status, payment status, and stock/inventory alerts so staff read system state at a glance without reading text. Use this whenever building or reviewing any UI element that shows a state — order status badges, payment status (paid/partial/overdue), stock levels (in-stock/low/out), loan status, GRN status, WhatsApp message status. Also use it whenever choosing ANY color for a status-bearing element, even a single badge, to keep it consistent with every other status indicator across POS, GRN, loans, and storefront.
---

# POS Color System for Status

Staff scan screens, they don't read them. A cashier checking whether an order is ready, a warehouse worker checking stock, and the owner checking which loans are overdue are all doing the same thing: pattern-matching on color before their brain parses any text. That only works if color means exactly one thing everywhere in the system. The moment red means "overdue" on the loans screen but "featured item" on the storefront, the shortcut breaks and staff have to fall back to reading — which is slower and more error-prone, defeating the entire point of a status color system.

This skill defines the fixed vocabulary and the rule that protects it.

## The fixed vocabulary

Use this palette family across every module (POS, GRN, loans, storefront, WhatsApp bridge). Treat the *meaning* as fixed even if the exact hex values are later adjusted to match brand theming — see the note on theming below.

| Meaning | Color family | Used for |
|---|---|---|
| Complete / Good / Paid / In stock | Green | Paid invoices, completed orders, healthy stock levels, successful sync |
| Pending / Partial / Needs attention / Low stock | Amber / Orange | Partial payments, orders in progress, low-stock warnings, pending WhatsApp replies |
| Problem / Overdue / Failed / Out of stock / Void | Red | Overdue loans, failed payments, out-of-stock items, voided transactions, errors |
| Informational / Draft / Not yet started | Blue or neutral | Draft GRNs, unsent quotes, informational banners |
| Inactive / Cancelled / Archived | Gray | Cancelled orders, archived customers, disabled products |

Five meanings, five colors, used the same way everywhere. Resist the temptation to add a sixth "special" color for a one-off feature — if something doesn't cleanly map to one of these five, it's not a status and doesn't belong in this system (use ordinary UI color instead).

## The one rule that matters most

**A color's status meaning must never be reused for anything else in the interface.** If red means "overdue/failed/void," it cannot also be the color of a "sale" ribbon on the storefront, a "hot deal" badge, or a decorative accent in a banner. Every reuse chips away at the color's reliability as a signal. When in doubt, keep status colors *out* of decorative/marketing surfaces entirely and give those surfaces their own palette from [[retail-brand-theming]].

This also means status colors should be defined once, as shared tokens (e.g. `status-success`, `status-warning`, `status-danger`, `status-info`, `status-neutral`), and every module should reference the token — not pick a similar-looking green independently. If POS "paid" green and storefront "in stock" green are two different hardcoded values, that's a bug even if a user can't consciously tell the difference, because it signals the system wasn't built with one status language.

## Never rely on color alone

Some staff are colorblind, some screens are viewed in bright sunlight or poor lighting, and some information (printed receipts, black-and-white printouts) drops color entirely. Every status must be legible without color:

- **Pair color with an icon or shape.** A checkmark for success, a triangle/exclamation for warning, an X or stop-shape for danger — shape carries meaning even if color is indistinguishable.
- **Pair color with a text label**, at least on first appearance in a view (a compact list can use color + icon only if a legend or an expanded/detail view spells it out in text).
- **Never encode meaning in color intensity alone** (e.g. "darker red = more overdue") — use a text value (days overdue) alongside it.

## Status color and brand theming don't mix

[[retail-brand-theming]] lets each client customize their brand colors (logo, primary/accent color, header). The status color system is explicitly **not** part of that customization surface — a client's brand purple must never leak into meaning "paid" or "overdue." Treat status tokens as protected/reserved, separate from theme tokens, even though both live in the same visual system. Document this boundary clearly if you build the theming layer, so a future theming pass doesn't accidentally overwrite status semantics with a client's brand palette.

## Verification checklist

- [ ] Every status-bearing element (badge, row highlight, icon) maps to one of the five fixed meanings above
- [ ] The same status token/color is used for the same meaning in every module it appears in (POS, GRN, loans, storefront)
- [ ] No status color is reused elsewhere in the UI for a non-status purpose (marketing badges, decorative accents)
- [ ] Every status is also conveyed by icon/shape and/or text, not color alone
- [ ] New statuses added to the system are mapped onto the existing five meanings rather than inventing a new color

Cross-check with [[pos-icon-language]] when pairing icons to status, and include this check in [[design-review-critique]].
