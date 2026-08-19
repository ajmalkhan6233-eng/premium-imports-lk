---
name: invoice-generation
description: Generate accurate, sequentially-numbered, audit-safe invoices for wholesale/credit customers, matching this system's existing bill-numbering and void discipline — never skip, reuse, or silently renumber an invoice number, and never let a correction delete history instead of reversing it. Use this whenever building or reviewing invoice generation, numbering, or any wholesale/credit-specific billing flow.
---

# Invoice Generation

This system already gets the hard part right for normal bills: `reserveNumber()` atomically reserves the next sequential number server-side, under a write lock, so two near-simultaneous sales can never collide on the same invoice number (see `AUDIT_REPORT.md` findings 2.2/2.3, fixed). This skill exists to make sure any *new* invoice-generation surface — a wholesale-specific format, a batch-invoice feature, anything beyond the existing Sell-screen bill flow — inherits that same discipline rather than reinventing numbering from scratch and reintroducing the exact race condition that was already fixed once.

## Numbering rules that must hold, always

- **One sequence, reserved server-side, atomically.** Never generate an invoice number client-side and trust it — that's exactly the pattern this system's own audit history flagged as a real collision risk.
- **Never reuse a number**, even for a voided/cancelled invoice. A void reverses the invoice's *effects* (stock, dues) — it doesn't free up the number for reissue. The gap in the sequence where a voided invoice sits is itself part of the audit trail; closing it by reusing the number destroys that.
- **Never renumber an already-issued invoice**, even to "fix" an out-of-order sequence. If numbering genuinely went wrong, that's a finding to flag, not something to quietly correct by rewriting history.

## Corrections happen through void, not deletion or edit

If a wholesale invoice needs correcting after issue, the correct mechanism is the same one this system already uses for regular bills: void it (with a reason, admin-only, reversing stock/dues via a *new* ledger entry — see [[double-entry-bookkeeping]]) and issue a fresh invoice if the sale is still happening. Never make an issued invoice's line items, total, or customer editable in place — an editable "final" invoice isn't actually final, and undermines the entire point of sequential, audit-safe numbering.

## What belongs on the invoice itself

Whatever the wholesale-specific format needs beyond the standard bill (payment terms, PO reference, etc.), the core fields must still trace to real recorded data the same way every other financial document in this system does: real product/price/qty from the actual sale, real customer record, real date/time, real `by` (server-derived from the session, never client-supplied — see [[financial-audit-trail]]). Don't add a field to an invoice template that isn't backed by a real value the system actually has.

## Verification checklist

- [ ] Any new invoice-numbering path reserves numbers atomically, server-side, under the same write-lock discipline as the existing bill flow
- [ ] Voided invoice numbers are never reissued
- [ ] Issued invoices are never edited in place — corrections go through void + reissue
- [ ] Every field on the invoice traces to a real, recorded value, with `by` server-derived, not client-supplied

Cross-check with [[print-friendly-report-layout]] for how the invoice should render on paper, and [[financial-audit-trail]] for the who/what/when discipline on every write involved.
