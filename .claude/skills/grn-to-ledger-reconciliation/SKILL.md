---
name: grn-to-ledger-reconciliation
description: Verify every GRN entry correctly reflects in both inventory (product.stock) and the ledger (vendor.balance/ledger) — catch drift between the two rather than trusting either in isolation. Use this whenever building or reviewing GRN creation, GRN void, stock-adjustment logic, or any audit/reconciliation feature that checks whether inventory and vendor balances actually agree with the GRN history that's supposed to explain them.
---

# GRN-to-Ledger Reconciliation

Every unit of stock in this system got there through a GRN, and every rupee a vendor is owed got there the same way — they're the two effects of the same event (see [[double-entry-bookkeeping]]). Drift between them means something touched one side without the other: a manual stock edit that bypassed GRN, a partial code path that updated inventory but not the vendor ledger (or the reverse), or a void that didn't fully reverse both sides. This skill is about *detecting* that drift, not assuming it can't happen just because the normal code path handles it correctly.

## What "in sync" actually means here

For a given product, at any point in time:

```
product.stock  ==  sum(active GRN receipts for this product)
                  − sum(qty sold across all non-voided bills for this product)
                  + sum(qty restored by voided bills)
                  − sum(qty from voided GRNs, already excluded from "active GRN receipts" above)
```

For a given vendor:

```
vendor.balance  ==  sum(active GRN totals from this vendor)
                    − sum(vendor payments recorded in vendor.ledger)
                    (voided GRNs contribute 0, having been reversed via their own ledger entry)
```

If a reconciliation check computes these independently from the raw `grns`/`bills`/`vendor.ledger` arrays and compares them against the live `product.stock`/`vendor.balance` values, any mismatch is real drift — not a rounding artifact to explain away.

## When drift is found

- **Never auto-correct** `product.stock` or `vendor.balance` to match the recomputed value. The drift itself is the finding — silently "fixing" it destroys the evidence of what actually went wrong and could paper over a real bug or a real unauthorized edit.
- Report the drift with enough detail to investigate: which product/vendor, the live value, the recomputed value, and ideally which GRN/bill/void records were used to recompute it, so a human can trace exactly where the two diverged.
- If the same drift keeps appearing after a specific type of operation (e.g. every time a GRN with an orphaned/deleted vendor is voided — see SESSION_LOG's 2026-08-16 entry on exactly this case), that's a signal for a real code fix in the write path, not something this skill's reconciliation check should paper over by adjusting its own expected formula to match the buggy behavior.

## Verification checklist

- [ ] Reconciliation recomputes expected stock/vendor-balance independently from raw GRN/bill/void records, never trusts the live value as ground truth
- [ ] Any mismatch is reported with enough detail to trace its source, never silently corrected
- [ ] Voided GRNs and voided bills are both correctly excluded/reversed in the recomputation, matching how the real void endpoints behave
- [ ] Recurring drift patterns are treated as a code-path bug to fix, not tolerated as expected noise

Cross-check with [[double-entry-bookkeeping]] for the paired-write principle this enforces, [[cost-of-goods-sold-tracking]] for how GRN cost data feeds COGS, and [[financial-anomaly-detection]] if drift-detection gets folded into a broader anomaly report.
