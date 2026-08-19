---
name: accounts-receivable-aging
description: Track and age outstanding customer credit/tab balances into real buckets (current, 30/60/90+ days overdue) using actual due dates recorded on credit sales — never estimate an age for a balance with no recorded due date. Feeds the Customers and Loans screens. Use this whenever building or reviewing customer balance/dues displays, credit aging reports, or anything that shows how overdue a customer's balance is.
---

# Accounts Receivable Aging

"How overdue is this?" is a question with a precise, computable answer as long as a real due date exists — `today − bill.dueDate`, bucketed. The failure mode this skill guards against is quieter than an outright fabrication: it's *rounding the question away*. A customer with `dues > 0` and no due date is not "current" and not "30 days overdue" — they're **unknown**, and collapsing that into either bucket for the sake of a tidy report misrepresents the real collection risk.

## Real buckets, real inputs

- Pull `bill.dueDate` from every open (not fully paid, not voided) credit bill for a customer. Each open bill ages independently — a customer can have one bill in the 0-30 bucket and another in 90+ at the same time; don't collapse a customer to a single age based on their oldest or newest bill unless the report is explicitly customer-level rather than bill-level.
- Standard buckets unless the owner specifies otherwise: **Current** (not yet due), **1-30**, **31-60**, **61-90**, **90+** days past `dueDate`.
- Sum `balanceDue` per bucket, not the original `total` — a partially-paid credit sale should only contribute its remaining balance to the aging report, and this system already tracks `balanceDue` separately from `total` for exactly this reason.

## The missing-due-date case

Not every credit balance in this system's real data will have a clean `dueDate` — older records, or a payment plan with `days: 0` (due immediately), need explicit handling:

- `days: 0` plans are correctly "due immediately" — their age starts from the sale date itself, not an undefined due date.
- A genuinely missing `dueDate` on an open credit balance must be shown as its own bucket ("no due date recorded"), never silently folded into "Current" (which understates risk) or an assumed-overdue bucket (which overstates it). Either is a guess dressed up as data.

## Never let aging drive an automatic action

An aging report is diagnostic, not enforcement. Don't have this feature auto-flag a customer as "blocked" or auto-adjust their credit limit based on age buckets without the owner's explicit rule for that — see [[loan-credit-ledger-management]] for where credit-limit warnings already exist in this system (Sell screen, shown but not auto-blocking) and keep that same "warn, don't decide for the owner" posture here.

## Verification checklist

- [ ] Aging buckets are computed per open bill from real `dueDate`/`balanceDue`, not estimated or averaged
- [ ] `days: 0` payment plans age from the sale date, correctly treated as immediately due
- [ ] Balances with no recorded due date get their own explicit bucket, never folded into Current or an assumed-overdue bucket
- [ ] Voided and fully-paid bills are excluded from the aging calculation entirely
- [ ] The report never auto-triggers a credit-limit or account-status change on its own

Cross-check with [[accounts-payable-aging]] for the vendor-side mirror of this, [[loan-credit-ledger-management]] for how this feeds Loans, and [[pos-color-system-status]] if aging buckets get a status-color treatment in the UI (amber for approaching due, red for genuinely overdue — never invent a sixth color for this).
