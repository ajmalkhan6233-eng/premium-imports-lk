---
name: daily-cash-till-reconciliation
description: Formally reconcile expected cash against physically counted cash at close of day, and log any discrepancy explicitly — never round it away or silently absorb it. This feature doesn't exist in this system yet (it's listed in the handbook's "Coming soon"); this skill defines the discipline it must follow once built. Use this whenever building or reviewing an end-of-day till-reconciliation report or cash-close feature.
---

# Daily Cash Till Reconciliation

The whole point of a till reconciliation is catching the gap between what the books say should be in the drawer and what's physically there — a cash sale that was rung up wrong, a payout that wasn't logged, an honest miscount, or something worse. A reconciliation feature that quietly rounds a small mismatch to zero, or lets staff "true up" the count to match the expected figure without logging why, defeats the entire purpose: it makes the till look reconciled when the actual finding — a real discrepancy — never got recorded anywhere.

## The real formula

```
Expected cash = Opening float
               + sum(cash sales for the day, real bill records, paymentType 'cash')
               − sum(cash payouts/expenses paid from the till, if tracked)
```

**Counted cash** is a physical count entered by a human at close — never inferred, never skipped. The discrepancy is `Counted − Expected`, and it can be positive (over) or negative (short); both are real findings, not just the negative case.

## Never silently absorb a discrepancy

- **Every discrepancy gets logged**, even a small one (a few rupees) — the amount doesn't determine whether it's worth recording, since a pattern of small discrepancies over time is itself a meaningful signal that a single day's small number would hide.
- Do not let the close-of-day flow "adjust" the recorded cash-sales total to match the physical count — that's editing history to hide the very thing this feature exists to catch (see [[financial-audit-trail]]'s immutability rule).
- Do not offer an "explain away" dropdown that silently zeroes the discrepancy once a reason is picked (e.g. "till float error") — recording *both* the discrepancy amount *and* an optional note about a likely cause is fine and useful; making the discrepancy disappear from the total once explained is not.
- Discrepancies should be visible on a report the owner can review over time — a single day's small discrepancy is unremarkable, a repeating pattern from the same shift or same staff member is exactly what this feature should make easy to notice.

## Who closes the till

Like every other financial write in this system, the close should be attributed server-side to the authenticated session doing it (see [[financial-audit-trail]]), with a timestamp, not a client-editable "closed by" field.

## Verification checklist

- [ ] Expected cash is computed from real recorded cash sales for the period, never estimated
- [ ] Counted cash is a real physical entry by a human, never defaulted or skipped
- [ ] Every discrepancy, including small ones, is logged with its actual amount — never rounded to zero or silently absorbed
- [ ] No mechanism exists to retroactively adjust the recorded sales total to eliminate a discrepancy
- [ ] Discrepancy history is visible over time, not just as a single day's pass/fail

Cross-check with [[bank-reconciliation]] for the parallel discipline applied to non-cash payments, and [[financial-audit-trail]] for who/when on the close itself.
