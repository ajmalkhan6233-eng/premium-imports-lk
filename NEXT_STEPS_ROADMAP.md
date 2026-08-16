# NEXT STEPS ROADMAP — Premium Imports LK

Read after HANDOFF.md. Prioritized, not just listed — work top to bottom unless Ajmal directs otherwise.

## PRIORITY 1 — Verify or complete (ALL RESOLVED 2026-08-11 — see HANDOFF.md)
1. ~~Confirm Finding #1 (full API auth) status.~~ **DONE.** Implemented, verified (401/403 checks, storefront-with-zero-login, WhatsApp bridge, GRN scanning all confirmed working), logged in SESSION_LOG.md.
2. ~~Confirm Findings #2 and #3 status.~~ **CONFIRMED** — both independently re-verified by reading `server.js` directly, still intact.
3. ~~Investigate the stock:0 empty-grid issue.~~ **RESOLVED as "not a bug"** — genuine real stock state, confirmed via direct data inspection. Business/inventory question (restock via GRN), not an engineering problem.

## PRIORITY 2 — Deferred from original scope (Premium Imports LK)
- Vendors credit/debit ledger chart
- Loans chart
- Dashboard time-period labels with PDF download/upload
- Messages section review
- Reports section enhancements
- Railway hosting — explicitly optional/later, not currently needed (LAN-only is intentional)

## PRIORITY 3 — Recommended but not yet installed
These skills were recommended but NOT included in the earlier bulk install — add if relevant work comes up:
- Accessibility/lighthouse-audit skill — contrast, tap-target size, screen-reader checks
- Image-optimization skill — matters for product photos on Sri Lankan mobile data speeds
- PWA/offline-first skill — directly relevant to the NOOR DIGITAL spec (offline-first PWA), worth having before that build starts
- SEO-basics skill — only relevant if discoverability beyond WhatsApp/word-of-mouth becomes a goal
- Performance-profiling skill — check if Phase 1/2 motion and new features added any real load-time cost

## PRIORITY 4 — Broader horizon (not urgent, context only)
- APEX Super Admin (multi-tenant SaaS platform) — not started
- NOOR DIGITAL (white-label ERP) — full spec exists (NOOR_DIGITAL_SPEC.md), not started
- Flutter mobile app — not started
- BATHCO COMMAND pending items (LAYLA supplier cleanup, security hardening, 30 June 2026 data integrity correction) — separate project, separate context, never mixed with Premium Imports LK sessions

## STANDING REMINDERS
- Small, incremental changes by default (see Usage Discipline in HANDOFF.md)
- BATHCO wall — absolute
- Sign-off required before any live deploy touching auth, money, or customer data
