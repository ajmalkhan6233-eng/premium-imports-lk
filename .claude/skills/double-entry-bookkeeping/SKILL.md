---
name: double-entry-bookkeeping
description: Maintain balanced debit/credit ledger entries for every transaction in this system — never write a financial fact to only one side of the books. Use this whenever adding, editing, or reviewing any code path that touches bills, GRN, customer/vendor/loan ledgers, or expenses, and any time a "quick fix" would touch a balance on one side without touching its counterpart on the other.
---

# Double-Entry Bookkeeping

A one-sided write is how books quietly stop reconciling. If a credit sale increases `customer.dues` but the corresponding revenue/receivable relationship isn't equally represented somewhere traceable, the system has recorded half a fact — it looks like a customer owes money, but there's no way to prove *why* without trusting a single unverified number. Every real transaction has two effects that must move together: an asset goes up as a liability goes up, or one asset converts into another. This skill is about keeping those two effects paired, always, in this specific codebase's actual ledger shapes.

## What "balanced" means in this system

This app doesn't use formal debit/credit columns — it uses paired records that must stay consistent with each other. Treat each of these as a double-entry pair, and never let one side move without the other in the same atomic write:

| Event | Side A | Side B |
|---|---|---|
| Credit sale (`POST /api/bills`, `paymentType: 'credit'`) | `bill.balanceDue` set to the sale total | `customer.dues` increased by the same total, `customer.ledger` gets a matching entry with `balanceAfter` |
| Customer payment | `customer.dues` decreased | `customer.ledger` gets a `type: 'payment'` entry with the exact amount and the resulting `balanceAfter` |
| GRN received | `product.stock` increased by qty | `vendor.balance` (what's owed) increased by `qty × cost`, with a matching vendor ledger entry |
| GRN void | `product.stock` reversed (clamped at 0) | vendor balance reversed via a *new* ledger entry — never by mutating the original |
| Bill void | stock restored for every line item | customer dues reversed via a new ledger entry if it was a credit sale |
| Loan given/repaid | loan balance moves | a ledger entry records the same amount, direction, and resulting balance |

If you're writing code that changes one side of a pair, the other side's write belongs in the *same* function, ideally the same write-locked critical section — not a "I'll add that next" follow-up. Half-written pairs are exactly how `grn-to-ledger-reconciliation` drift gets created in the first place.

## Never invent the missing half

If you're asked to build a feature that touches money and you can't find where its counterpart entry should live, that's a real design question, not a gap to paper over with a guess. Flag it and ask, or use [[blocker-escalation-protocol]]'s "genuinely ambiguous business rule" carve-out — don't invent a plausible-sounding offsetting entry just to make the numbers balance on paper. A fabricated counterpart is worse than a visible imbalance, because it looks correct.

## Verification checklist

- [ ] Every write that changes a balance (dues, vendor balance, loan balance, stock) has its paired write in the same transaction/critical section
- [ ] Every paired write includes a ledger entry with the amount, resulting balance, `by`, and timestamp — not just the balance mutation itself
- [ ] Reversals (void) create new offsetting entries, never mutate or delete the original record
- [ ] No new financial code path was built with only one side of its effect implemented "for now"

Cross-check with [[financial-audit-trail]] (the ledger entry itself needs who/what/when) and [[grn-to-ledger-reconciliation]] (the specific GRN⇄stock⇄vendor triangle). Run this alongside [[error-prevention-design]] for any UI that lets a human trigger one of these paired writes.
