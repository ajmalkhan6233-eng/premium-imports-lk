---
name: profit-loss-statement-generation
description: Generate profit & loss statements strictly from real recorded transaction data in this system — bills, cost data, and expenses that actually exist in data.json — never estimate, smooth, or backfill a missing figure to make a P&L look complete. Use this whenever building, editing, or reviewing any profit/revenue/net-income reporting, the Home dashboard's Net Profit card, or the Reports screen's Net Profit report.
---

# P&L Statement Generation

A profit and loss statement is only useful if every line traces back to a real record. The moment one line is quietly estimated — "costPrice was probably around X," "assume a 30% margin where cost is missing" — the whole statement stops being trustworthy, because nobody reading it can tell which numbers are real and which are guesses. This skill exists to keep that line uncrossable: report exactly what the data shows, including its gaps, rather than a smoothed number that hides them.

## The three real inputs, and nothing else

- **Revenue** — sum of `bill.total` for non-voided, non-quote bills in the period. Quotations never contributed revenue; voided bills' effects are already reversed, don't double-count or double-subtract them.
- **COGS** — sum of `qty × cost` across `bill.items[]` for the same bill set. `cost` is captured on the bill line at sale time (`product.costPrice` as it was then) — use that recorded value, not today's `product.costPrice`, since cost can change and a historical sale should reflect what it actually cost *then*.
- **Expenses** — sum of non-voided `expenses` entries in the period, by category if the report breaks out categories.

Net profit = Revenue − COGS − Expenses. That's it. Nothing else belongs in the formula unless it's a real recorded figure with its own source in `data.json`.

## When a required figure is missing or zero

This will happen — a product with `costPrice: 0` because it was never set, a bill line with no `cost` field because it predates that being captured. The correct move is **never** to substitute an assumed margin, an average cost from other products, or a "reasonable" estimate. Instead:

- Report the line as computed from whatever's actually there (cost `0` genuinely means the system doesn't know the cost, so COGS for that line is `0` — don't hide that behind a rounder inflated number).
- Surface it: a P&L that silently treats "unknown cost" as "zero cost" is misleading in the *other* direction (it overstates profit). If you're building a UI for this, flag lines/products with `costPrice: 0` or missing `cost` visibly (e.g. a footnote count: "3 items sold with no recorded cost — COGS may be understated") rather than letting the number pass as authoritative with no caveat.
- Never backfill `costPrice` yourself to make the report look cleaner. That's real business data belonging to the owner (see the 100.1g rule this project already applies to inventory) — the same discipline applies to cost data.

## Periods and comparisons

If a report compares this month to last month, or shows a trend, both periods must be built from the same real-data method above — never interpolate a missing month or extrapolate a partial one to look like a full period. A partial period should say so ("data through the 14th") rather than being silently scaled up to look like a full month's number.

## Verification checklist

- [ ] Every figure in the statement traces to a real `bills`/`expenses` record, not a formula involving an assumption
- [ ] COGS uses the cost captured at sale time, not current `product.costPrice`
- [ ] Voided bills/quotes are correctly excluded, not double-counted or double-reversed
- [ ] Missing/zero cost data is visibly flagged, never silently treated as an accurate zero without a caveat
- [ ] No period is scaled, interpolated, or extrapolated to appear complete when it isn't

Cross-check with [[cost-of-goods-sold-tracking]] for the COGS methodology in more detail, [[cash-flow-forecasting]] for the boundary between "recorded P&L" and "projected," and [[dashboard-data-density-balance]] if this feeds a dashboard card.
