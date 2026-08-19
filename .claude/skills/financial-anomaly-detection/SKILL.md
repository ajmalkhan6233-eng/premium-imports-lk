---
name: financial-anomaly-detection
description: Flag transactions that deviate from historical patterns for owner review — flag only, never auto-correct, auto-reverse, or auto-block. Use this whenever building or reviewing any feature that surfaces unusual bills, discounts, prices, or payments (below-cost sales, outlier discounts, odd-hour transactions, repeated voids) for the owner's attention.
---

# Financial Anomaly Detection

An anomaly detector's entire value is in surfacing something a human should look at — the moment it starts *acting* on what it finds (auto-voiding a suspicious bill, auto-blocking a customer, auto-adjusting a price it thinks is wrong), it's no longer a detection tool, it's an unaccountable decision-maker touching real money without the owner's judgment in the loop. This system already has real examples of the correct posture: the discount-over-20% confirmation on the Sell screen doesn't block a large discount, it makes the cashier explicitly confirm the actual cost before proceeding — informing and gating human action, not overriding it.

## What's worth flagging in this system, concretely

- **Below-cost sales** — a bill line where `price < cost` (already a known, logged, deliberately-unaddressed finding in `AUDIT_REPORT.md` 3.4: "cart line price is freely editable with no floor relative to cost price... consider a soft warning"). This skill is the natural place that soft warning belongs, if built.
- **Outlier discounts** — beyond the existing >20% confirm-at-sale-time gate, a *pattern* of large discounts from one staff account, or discounts unusually large even by this shop's own history, is a distinct signal worth a periodic owner-facing report, separate from the single-transaction gate.
- **Repeated voids** — an unusual concentration of voided bills/GRNs from one account or in a short window.
- **Odd-hour or off-pattern activity** — a real sale recorded outside the shop's normal `shopHours`, if that's ever worth flagging for review.
- **GRN/vendor drift** — see [[grn-to-ledger-reconciliation]]; a mismatch it finds is itself an anomaly worth routing through this same "flag for review" surface.

## What "flag" means in practice

- A visible list/report the owner can review and dismiss, not a popup that blocks work.
- Each flag states *why* it was raised (which rule/threshold triggered it) and links to the actual record, so the owner can verify against real data rather than trusting the flag itself — the flag is a pointer to evidence, not a verdict.
- Dismissing a flag should be logged (see [[financial-audit-trail]]) but must never permanently suppress that *category* of check going forward — dismissing one below-cost sale doesn't mean the next one shouldn't also be flagged.

## What this skill must never do

Auto-reverse a transaction, auto-adjust a price or discount, auto-lock an account, or silently drop stock/ledger writes because they look anomalous. Every one of those is a real, consequential action taken without the owner's judgment — exactly the failure mode [[bank-reconciliation]] and [[grn-to-ledger-reconciliation]] already guard against in their own narrower domains. This skill is the general version of that same rule.

## Verification checklist

- [ ] Every anomaly check only flags/reports — no automatic reversal, correction, or account action ever fires from it
- [ ] Each flag states the specific rule that triggered it and links to the real underlying record
- [ ] Thresholds (discount %, below-cost, etc.) match or extend this system's own existing real thresholds, not invented industry-standard numbers with no connection to this shop's actual data
- [ ] Dismissing one flagged instance never suppresses future checks of the same category

Cross-check with [[bank-reconciliation]] and [[grn-to-ledger-reconciliation]] for domain-specific versions of this same flag-don't-fix principle, and [[pos-color-system-status]] for how flags should be color-coded (amber for "needs review," never a new ad-hoc color).
