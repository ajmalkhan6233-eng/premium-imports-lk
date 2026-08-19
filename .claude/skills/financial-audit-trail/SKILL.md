---
name: financial-audit-trail
description: Every financial write in this system must carry who/what/when, recorded server-side and never trusted from the client — prefer append-only/immutable logging (new reversing entries) over any editable history. Use this whenever adding or reviewing any code path that writes a bill, GRN, payment, void, or any other financial record, and any time a "by" or "who did this" field is being set.
---

# Financial Audit Trail

"Who did this, and when" is the question every financial dispute eventually comes down to, and it's only answerable if the answer was captured at the moment of the write, by a source the person doing the write can't fake. This system already gets this right in its newest, most-audited paths — bills and GRN both derive `by` from `session.user` server-side, never from the request body, specifically because "a logged-in staff account could attribute a sale to someone else just by sending a different name in the request body" (that's the actual comment in `server.js`). This skill exists to make sure that discipline is applied *everywhere* money moves, not just where it happened to get built first.

## A known, real gap — the canonical example to check against

As of this writing, `customers.js`/`vendors.js`/`loans.js` build payment and void ledger entries **client-side** (`ledger.push({..., by: STATE.user})`) and save them via the generic `PUT /api/data/:key` — which means `by` on those entries is client-supplied, spoofable, and not actually trustworthy, unlike bills/GRN. This was found and logged (see `SESSION_LOG.md`, `SECURITY_HARDENING_COMMAND.md` Phase 7) and deliberately left unfixed at the time because closing it properly means moving those writes to dedicated server routes — new write-path architecture, correctly judged out of scope for a "logging only" pass. **Use this exact gap as the test case whenever auditing a financial code path**: if `by` (or any other audit field) is set anywhere in client-side JS and merely passed through to a generic write endpoint, that's the same unfixed pattern, and it should be flagged the same way, not repeated in new code.

## What every financial write needs

- **Who**: derived from the authenticated session server-side (`session.user`), never accepted from the request body.
- **What**: the actual before/after or delta — not just "a change happened," but what the change was (amount, direction, resulting balance where applicable).
- **When**: server-generated timestamp, not client-supplied (a client clock can be wrong or deliberately altered).
- **Immutability**: once written, a financial record's history should never be edited or deleted — corrections are new, reversing entries (see [[double-entry-bookkeeping]]), exactly like this system's existing bill/GRN void pattern.

## Building a new write path

If you're adding a new screen or feature that writes money-adjacent data (a new payment type, a new adjustment flow), the bar is: does `by` get set by a dedicated server route reading the session, the same way `POST /api/bills` and `POST /api/grns/:id/void` already do? If the only available mechanism is the generic `PUT /api/data/:key`, that's a signal the feature needs its own server route before it should be considered done, not a reason to accept a client-supplied `by` "for now."

## Verification checklist

- [ ] `by`/`who` on every financial write is server-derived from the session, never read from the request body
- [ ] Timestamps on financial writes are server-generated, not client-supplied
- [ ] Corrections are new reversing entries, never edits or deletions of the original record
- [ ] Any write path found using the generic `PUT /api/data/:key` for money-adjacent data is flagged as the known-gap pattern, not treated as acceptable precedent for new code

Cross-check with [[double-entry-bookkeeping]] (the paired-write discipline this trail records) and [[error-prevention-design]] for the UI-side confirmation patterns around who's authorizing a financial action.
