---
name: loan-credit-ledger-management
description: Track customer/vendor credit terms, repayment schedules, and aging — this is the Loans tab's actual core logic in this system. Use this whenever building or reviewing the Loans screen, customer credit limits, payment plans, or any feature involving money lent, borrowed, or extended as credit.
---

# Loan & Credit Ledger Management

The Loans tab and customer credit both boil down to the same shape: a balance that moves in known directions (lent/given increases it, repaid decreases it), with every movement logged and the current balance always a pure function of that log, never a number edited independently of it. This skill names the rules already implicit in this system's real Loans/Customers behavior, so they stay intact as those screens evolve.

## The balance is derived, not authoritative on its own

`customer.dues`, `vendor.balance`, and lender loan balances all exist as denormalized current-balance fields for fast reads — but the *ledger* (the append-only list of entries) is the source of truth. Any feature that lets someone edit a balance field directly, without a corresponding ledger entry explaining the change, breaks that relationship and makes [[grn-to-ledger-reconciliation]]-style drift inevitable. Every balance change must come from pushing a new ledger entry with the resulting `balanceAfter`, never a direct field overwrite.

## Repayment schedules and payment plans

`settings.paymentPlans` (name + days) defines the real repayment terms this shop actually offers — a payment plan chosen at sale time sets `bill.dueDate`. Anything that computes "when is this due" must use that real, chosen plan, never assume a default term for a credit sale that didn't explicitly pick one. This is the same underlying data [[accounts-receivable-aging]] buckets by.

## Credit limits: warn, never silently block or override

This system's existing pattern (Sell screen) is to show a clear warning when a sale would put a customer over their credit limit, but still let the sale complete — the cashier sees the risk and decides, the system doesn't make that call unilaterally. Keep that posture for any new credit-limit logic: surfacing the number and letting a human decide is correct here; silently blocking the sale, or silently allowing it with no warning, are both worse than the current behavior for different reasons (one removes the owner's control, the other hides a real risk).

## "Loan given" needs the same rigor as repayment

This system's own audit history flagged that "loan given" entries are recorded directly with no separate source record, the same class of gap as an unrecordable repayment — meaning a mis-entered loan amount has no independent record to check it against. Any improvement here (a formal "loan agreement" record, a required note field, etc.) should close that gap rather than just adding more direct-entry ledger pushes on top of it.

## Verification checklist

- [ ] Every balance change (customer, vendor, loan) is driven by a new ledger entry, never a direct field edit
- [ ] Due dates come from the real payment plan chosen at sale time, never an assumed default term
- [ ] Credit-limit warnings inform the human and let them decide — never silently block or silently allow with no warning
- [ ] "Loan given" entries get the same audit rigor as repayments, not treated as lower-risk because money is leaving rather than arriving

Cross-check with [[accounts-receivable-aging]] (customer-side aging), [[accounts-payable-aging]] (vendor-side), [[financial-audit-trail]] (who recorded each entry), and [[error-prevention-design]] for the confirmation-cost calibration on loan/payment actions.
