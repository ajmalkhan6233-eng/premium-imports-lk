---
name: blocker-escalation-protocol
description: Defines the ONLY conditions where autonomous work should stop and ask the user — missing credentials/access, or a genuinely ambiguous business rule with no reasonable default. Everything else should get a reasonable, documented assumption and continued work, not a check-in. Use this whenever running a multi-step or autonomous task (especially under [[autonomous-build-loop]] or [[task-decomposition-planning]]) and deciding whether something is worth interrupting the user for.
---

# Blocker Escalation Protocol

Stopping to ask the user is expensive — it breaks their flow, and if it happens for things that didn't really need their input, they learn to distrust the "the agent is asking for a reason" signal, which makes the times it's actually necessary less effective too. The default posture for autonomous or semi-autonomous work should be: make the most reasonable decision available, write down what was decided and why, and keep moving. Escalation is reserved for a narrow, specific set of situations where continuing without the user genuinely isn't possible or genuinely risks a decision only they can make.

## The only two real blockers

1. **Missing credentials, access, or an unavailable external dependency.** Work genuinely cannot proceed — a required API key isn't set, a service account isn't authorized, a file/system referenced doesn't exist and there's no reasonable way to infer or create it, a login is required and unavailable. This is a hard stop because no amount of reasonable assumption-making substitutes for something that's simply not accessible.
2. **A genuinely ambiguous business rule with no reasonable default.** Not "there are two plausible ways to implement this and one is slightly more idiomatic" — that's a judgment call, not a blocker (see below). This is reserved for cases where the choice materially changes business outcomes and there's no sane default to fall back on — e.g. "should overdue loan interest compound daily or monthly" for a shop that has never specified this, where guessing wrong means real numbers are wrong on real customer accounts. If a reasonable default exists and getting it wrong is cheap to correct later, it's not this category.

Everything that isn't one of these two should not stop the work. That includes: uncertainty about implementation approach, minor UI judgment calls, edge cases with an obvious sensible handling, formatting/naming choices, and anything where "pick the most reasonable option and move on" is genuinely fine.

## What "make a reasonable assumption and keep going" looks like

- **State the assumption where the work records itself** — commit message, session log, code comment only if the *why* is genuinely non-obvious, or a summary to the user at the next natural check-in. The point isn't to hide the decision, it's to not let it block progress while still keeping it visible and reversible.
- **Prefer the assumption that's cheapest to undo.** When two reasonable defaults exist and one is easy to change later while the other locks in something costly (e.g. a data migration, a customer-facing financial calculation), pick the reversible one even if it's not the objectively "best" choice — reversibility lets you proceed now without betting on being right.
- **Look for the answer before assuming one is needed.** Check existing code, `HANDOFF.md`, `AUDIT_REPORT.md`, `SESSION_LOG.md`, or the equivalent project context before treating something as ambiguous — many "ambiguous" business rules already have a documented answer sitting in the repo; escalating without checking first is itself a failure of this protocol.

## What escalating well looks like, when it's real

When one of the two real blockers hits, stop cleanly rather than working around it in a way that masks the problem (e.g. don't fabricate a placeholder credential, don't silently guess at a financial business rule and bury the guess). State plainly: what's blocked, why it's genuinely a blocker under this protocol (not just a preference), and what's needed to unblock it. Then pause that specific thread — other, independent parts of a decomposed task list ([[task-decomposition-planning]]) can usually keep progressing even while one item is blocked; a blocker on one task is not a license to stop all work.

## Verification checklist

- [ ] Before escalating, confirm the situation is actually one of the two categories (missing access, or genuinely ambiguous business rule with no reasonable default) — not just "there are multiple valid approaches"
- [ ] Existing project docs/code were checked for an existing answer before treating something as ambiguous
- [ ] Every non-blocking assumption made along the way is stated somewhere visible, not silently baked in
- [ ] When a real blocker occurs, it's named specifically (what's needed, why it's needed) rather than a vague "I need more info"
- [ ] Unrelated, unblocked work continues rather than the whole task list stalling on one blocked item
