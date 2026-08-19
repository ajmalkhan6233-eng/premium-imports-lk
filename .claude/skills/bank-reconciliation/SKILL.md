---
name: bank-reconciliation
description: Match this system's recorded transactions against real bank statement entries and flag discrepancies for a human to resolve — never auto-adjust the ledger to force a match. Use this whenever building or reviewing any bank-reconciliation feature, statement-import flow, or anything that compares recorded bank-transfer/online-payment bills against an actual bank statement.
---

# Bank Reconciliation

Reconciliation exists to catch the cases where the books and the bank disagree — a missed deposit, a duplicate entry, a payment that bounced. The entire point breaks if the tool's response to a mismatch is to quietly force the numbers to agree. A reconciliation feature that "fixes" a discrepancy by adjusting the recorded transaction to match the bank statement (or vice versa) isn't reconciling anything — it's erasing the evidence that something needs a human's attention.

## Match, don't merge

- Compare recorded bank/online-transfer bills (`bill.paymentType === 'bank'` or `'online'`) against real statement lines by amount, date (with a reasonable tolerance window for bank processing delays), and reference number if one was captured (`bill.paymentRef`).
- A clean match is informational only — mark it reconciled, move on.
- Anything that doesn't match cleanly (amount off by any amount, no corresponding statement line, a statement line with no recorded bill) goes into a **discrepancy list**, not a silent auto-correction. The discrepancy list is the actual deliverable of this feature — it's where the owner's attention should go.

## Never do any of the following automatically

- Never adjust a recorded bill's amount to match a bank line that's close but not exact.
- Never create a new bill/expense record to "explain" an unmatched bank line — that's inventing a transaction that was never actually entered into the system, which is a direct 100.1g violation dressed up as a convenience feature.
- Never mark something reconciled based on a probabilistic/fuzzy match without the human confirming it — a fuzzy match is a *suggestion* for the human to accept, exactly like [[expense-categorization]]'s auto-suggested categories.
- Never delete or hide a discrepancy once flagged just because a later import "resolved" it silently — if it resolves, show *how* (the actual matching line), don't just make the flag disappear with no explanation.

## What a discrepancy entry needs

Every unmatched item needs enough context for a human to actually investigate it: the recorded-side amount/date/reference (if any), the bank-side amount/date/reference (if any), and which side has no counterpart. This mirrors [[financial-anomaly-detection]]'s "flag only, never auto-correct" principle — reconciliation is a specialized case of anomaly detection where the anomaly is "these two independent records of the same reality disagree."

## Verification checklist

- [ ] Matching logic never mutates a recorded transaction's amount/date to force agreement with a bank line
- [ ] Every unmatched bank line or recorded transaction is surfaced in a discrepancy list, not silently dropped
- [ ] No new transaction is auto-created to explain an unmatched bank line
- [ ] Fuzzy/probable matches require explicit human confirmation before being marked reconciled
- [ ] Resolved discrepancies show what resolved them, not just disappear

Cross-check with [[financial-audit-trail]] (who confirmed a match, and when) and [[daily-cash-till-reconciliation]] for the cash-side equivalent of this same discipline.
