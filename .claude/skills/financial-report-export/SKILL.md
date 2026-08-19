---
name: financial-report-export
description: Export clean, accountant-ready financial reports (CSV/PDF) suitable for handing to an external bookkeeper or for tax prep — every exported figure must trace back to a real recorded transaction, with no rounding or summarization that loses reconcilability. Use this whenever building or reviewing any export feature on Reports, Bills, or any other financial screen.
---

# Financial Report Export

An export's whole job is to leave this system and be trusted somewhere else — in an accountant's spreadsheet, in a tax filing, in a bank's hands. That means it has to survive scrutiny it won't get inside this app: someone cross-checking a CSV total against their own records, or tracing one line back to a specific sale. An export that summarizes away the detail needed for that check has failed at the one thing it exists to do, even if the top-line number is correct.

## What every export needs

- **Traceability**: where the report is transaction-level (a sales export, a bills list), one row should correspond to one real record — a real bill/GRN/expense ID, not a pre-aggregated bucket that can't be traced back to what it's made of. Where the report is genuinely a summary (a P&L, a category total), the summary must be built the same real-data-only way [[profit-loss-statement-generation]] requires, and ideally link to or be paired with the transaction-level export it was built from.
- **No silent rounding that changes reconciliation**: display rounding (Rs. 1,234.50 shown as "Rs. 1,235" in a UI card) is fine for a glance; an *export* meant for bookkeeping needs the real precision the underlying data has, so someone reconciling against a bank statement isn't fighting a rounding artifact this system introduced.
- **Accountant-standard structure**: clear column headers (date, reference/invoice number, customer/vendor, amount, category, payment type — whatever's relevant), one consistent date format, currency clearly labeled — the kind of shape a bookkeeper unfamiliar with this specific app can open and immediately understand, not a shape that only makes sense to someone who already knows this system's internal field names.
- **Voided records handled explicitly**: a voided bill either shouldn't appear in a "real sales" export at all, or should appear clearly marked as voided with its reversal visible — never silently included as if it were a normal sale, and never silently dropped without a trace that it existed and was reversed (an accountant reconciling against a bank statement that shows a refund needs to see that on this side too).

## PDF exports specifically

Anything meant to be printed or handed over as a formal document (not just opened in a spreadsheet) follows [[print-friendly-report-layout]] — clean pagination, no UI chrome, real contrast on paper, not just on screen.

## Verification checklist

- [ ] Every row/figure in an export traces to a real record — no invented subtotal, no interpolated gap
- [ ] Numeric precision in the export matches the underlying data, not a UI-rounded display value
- [ ] Column structure and labels are clear to someone outside this system, not internal jargon
- [ ] Voided/reversed transactions are either excluded cleanly or marked and traceable, never silently blended in as normal
- [ ] PDF-format exports follow print-friendly layout rules, not a straight screenshot of the on-screen view

Cross-check with [[expense-categorization]] (category drift breaks export groupings), [[cost-of-goods-sold-tracking]] (if an export includes margin/COGS), and [[print-friendly-report-layout]] for the PDF rendering rules.
