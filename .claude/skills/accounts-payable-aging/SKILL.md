---
name: accounts-payable-aging
description: Track and age outstanding vendor/supplier balances the same disciplined way accounts-receivable-aging handles customer balances — from real GRN/vendor-ledger data only, never an assumed payment term. Use this whenever building or reviewing vendor balance displays, payable aging reports, or anything showing how much is owed to suppliers and for how long.
---

# Accounts Payable Aging

This is the mirror of [[accounts-receivable-aging]], applied to what the shop owes its vendors instead of what customers owe the shop — same discipline, but with one real, important difference in this system today: **vendor payables here have no recorded due date at all.** A GRN increases `vendor.balance` at the moment stock arrives, with no payment-term field captured anywhere in the schema. That's not a bug this skill should paper over — it's the actual current state, and the aging report has to be honest about it.

## What can be computed honestly right now

- **Total outstanding per vendor** — `vendor.balance`, straightforward, already tracked.
- **Age since the obligation was created** — this system *can* honestly compute "days since this GRN was received" (real `grn.date`/`createdAt`), even without a due date. That's a legitimate, real figure: "owed for 45 days" is true regardless of whether a formal term exists.
- What it **cannot** honestly compute is "days overdue" in the receivables sense, because there's no recorded due date to be overdue *against*. Don't invent a default term (e.g. "assume Net 30 for every vendor") to make the report look like its AR counterpart — that's presenting a guess as the vendor's actual agreed terms, which the owner alone knows and hasn't recorded.

## If payment terms get added later

If this system's schema is ever extended to capture a real per-vendor or per-GRN payment term (e.g. a `paymentTermsDays` field the owner explicitly sets), *then* this skill's aging buckets can mirror AR's exactly (Current/1-30/31-60/61-90/90+ against the real due date). Until that field exists and is populated with the owner's actual agreed terms, keep the report scoped to "age since received," clearly labeled as such, not disguised as a due-date-based aging report.

## Verification checklist

- [ ] The report is honest about which figure it's showing: "age since received" vs. a true "days overdue" — never conflates the two
- [ ] No default/assumed payment term (Net 30, Net 15, etc.) is invented for a vendor that doesn't have one recorded
- [ ] Voided GRNs' vendor-balance contributions are correctly excluded (the void reversal already handles this at the data level — the report must not double-count before or after a void)
- [ ] If/when a real payment-terms field is added to the schema, this skill gets revisited before the report silently starts showing "overdue" language it can't yet back up

Cross-check with [[grn-to-ledger-reconciliation]] for the underlying vendor-balance mechanics, [[accounts-receivable-aging]] for the parallel receivables discipline, and [[cash-flow-forecasting]]'s explicit note that payables without a real due date can't be placed on a forecast timeline either.
