---
name: cash-flow-forecasting
description: Project near-term cash position from real recorded transactions and known, contracted obligations only — never invent a projected sales trend or an assumed future expense to fill out a forecast. Use this whenever building or reviewing any cash-position projection, "cash in N days" feature, or anything that shows the owner what their cash balance will look like in the future rather than what it is right now.
---

# Cash Flow Forecasting

A forecast is trusted precisely because it looks authoritative — a number on a screen with a date next to it reads as a fact, even when it's actually a guess. That makes forecasting the highest-risk place in this whole skill set to violate the 100.1g rule: it's the one report type whose entire job is to talk about the future, which is exactly where "just estimate something reasonable" feels natural and is exactly wrong. This skill draws a hard line between what's *known* and what's *speculative*, and refuses to blur them.

## What counts as "known" in this system — project these

- **Scheduled credit repayments**: `bill.dueDate` for outstanding credit sales, with the exact `balanceDue` — this is a real, contracted future cash inflow with a real date.
- **Loan repayment obligations**: any recorded loan with a known schedule/due date.
- **Vendor payables with a known term**: only if the vendor/GRN record actually carries a due date or agreed term — see [[accounts-payable-aging]] for the note that this system doesn't currently capture vendor payment terms explicitly, which means most vendor payables *cannot* be placed on a forecast timeline honestly; they can only be listed as "owed, no known due date."
- **Cash already in hand**: current till/bank balance if that's tracked, as the starting point.

## What does NOT belong in a forecast — never project these from assumption

- Future sales volume. This system has no seasonality model, no trend-fitting, and building one from a handful of real transactions would be presenting a guess as a number. If the owner wants a sales-based projection, that requires an input *from them* (their own estimate), clearly labeled as their assumption, not the system's inference.
- Future discretionary expenses that haven't been recorded or scheduled anywhere.
- An "average day's revenue" extrapolated forward as if it were guaranteed.

## How to present the boundary honestly

If a forecast screen or report exists, structure it as two visually and textually distinct sections, never blended into one number:

1. **Known cash movements** — what will happen because it's already contracted (due credit sales, loan payments), each traceable to a real record.
2. **Everything else** — either omitted, or explicitly labeled as the owner's own input if they choose to add a manual assumption (e.g. "expected sales this week: [owner enters a number]"), never a system-generated guess presented with the same visual weight as the known figures.

If asked to "just show projected cash for next month" with no real data to back most of it, say so plainly rather than fabricating a plausible-looking number — this is exactly the situation [[blocker-escalation-protocol]] means by a case with no reasonable default: inventing a sales trend from insufficient data isn't a defensible default, it's a fabrication with a chart around it.

## Verification checklist

- [ ] Every number in the forecast traces to a real record with a real date, or is explicitly labeled as a manual owner input
- [ ] Known/contracted amounts are visually and textually separated from anything speculative — never combined into a single blended total without that distinction
- [ ] No future sales trend, seasonality, or "typical week" figure is fabricated by the system itself
- [ ] Vendor payables without a real due date are shown as "owed, timing unknown," not placed on a forecast timeline

Cross-check with [[accounts-receivable-aging]] and [[accounts-payable-aging]] for the underlying real obligations this pulls from, and [[profit-loss-statement-generation]] for the parallel discipline applied to past performance instead of future projection.
