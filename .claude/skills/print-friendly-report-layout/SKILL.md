---
name: print-friendly-report-layout
description: Ensure any report, invoice, bill, or GRN receipt meant to be printed actually renders cleanly on paper, not just on screen — real margins, real contrast, no clipped columns or cut-off totals. Use this whenever building or reviewing anything with a Print button or PDF export, including Bills' receipt printing, Reports exports, and GRN paperwork.
---

# Print-Friendly Report Layout

A screen and a printed page are different mediums with different failure modes, and a layout that looks perfect on a monitor can be genuinely unusable on paper — a sidebar nav bar printed across every page, a table column truncated at the page edge, light-gray text that photocopies to nothing, a total that lands split across a page break. This system already prints real documents that leave the building (bill receipts, potentially GRN paperwork for a vendor) — this skill is about the pass that catches those failures before a cashier hands a customer a receipt with the total cut off.

## What breaks specifically between screen and paper

- **Navigation/chrome must not print.** The top nav, side buttons, "Complete Sale"/action buttons — anything that's app UI rather than the document itself needs a print-specific style (`@media print`) that hides it. `window.print()` on a page that still shows the full app shell produces a receipt with a nav bar on it.
- **Color that only works on a lit screen fails on paper.** Light text on a dark background, subtle gray-on-white low-contrast text, and color-only status indicators (see [[pos-color-system-status]]'s "never rely on color alone" rule — doubly true here, since a black-and-white printer or photocopy drops color entirely) all need a high-contrast, print-safe fallback: real black text, borders instead of subtle background tints, icon/text pairing instead of color alone for anything status-bearing.
- **Tables must not silently truncate.** A wide table (line items with several columns) needs to either fit the print width or wrap sensibly — never let a column run off the printable page area with no indication anything's missing.
- **The total must never land on a page break.** For any multi-page report, check that the summary/total section isn't split across two pages — force a page-break-before on the totals block if the content above it is long enough to risk it.
- **Real margins.** Content flush to the very edge of the page prints unreliably across different printers — standard margins, not a UI layout that assumes a full-bleed screen.

## Format-specific notes

- **Direct `window.print()` (bill receipts)**: style the printable area specifically (this system already isolates `#receiptPrintArea` for this) and verify the print preview, not just the on-screen modal, before calling it done.
- **PDF export**: same rules apply, plus verify the PDF renders correctly at actual print size (A4/Letter, whichever this shop's market expects), not just readable when zoomed in on a screen.

## Verification checklist

- [ ] App chrome (nav, buttons, non-document UI) is hidden in print/PDF output via a dedicated print style, not just visually similar to the screen version
- [ ] All text has real contrast against a white/light background — no color-only status indicators, no low-contrast gray-on-white
- [ ] Tables fit the printable width or wrap cleanly — nothing silently clipped at the page edge
- [ ] Totals/summary sections don't split across a page break
- [ ] Verified in an actual print preview (or generated PDF opened at real size), not just eyeballed on screen

Cross-check with [[financial-report-export]] for the data-accuracy side of exports, and [[pos-color-system-status]] for the color-with-icon/text pairing this doubly depends on. Include in [[design-review-critique]] for Bills, Reports, and GRN whenever their print/export paths change.
