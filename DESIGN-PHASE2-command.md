# COMMAND: Premium Imports LK — Storefront Design Phase 2 (Motion & Graphics)

## FIRST — READ BEFORE STARTING
Check SESSION_LOG.md for the "Phase 1" redesign entry completed earlier today (Aug 11).
Phase 1 already shipped: monospace utility type for prices/category tags, refined
scroll-reveal easing, orchestrated hero load-in sequence, keyboard focus rings, full
prefers-reduced-motion support. Do NOT redo these. This is Phase 2 — build on top.

## URGENT — CHECK THIS FIRST, BEFORE ANY DESIGN WORK
Phase 1 flagged a stock:0 empty-grid issue: when a category or the full catalog has
zero in-stock items, customers may see "No products available right now" instead of
the real catalog. This is a live customer-facing bug, not a design task — verify
current stock data, confirm whether real customers are hitting this right now, and
fix it. This takes priority over everything else in this file.

## SCOPE GUARD (non-negotiable)
- Customer-facing storefront (HTML/CSS/JS) for Premium Imports LK only.
- DO NOT touch BATHCO COMMAND under any circumstance.
- DO NOT change backend logic, pricing calculation, or stock sync — visual layer only.
- Preserve all verified functionality: cart drawer, category tabs, WhatsApp button,
  live stock sync, LAN accessibility.
- No clarifying questions — decide, log reasoning in SESSION_LOG.md, proceed.

## STEP 0 — CHECK INSTALLED SKILLS
Before implementing, check ~/.claude/skills and project .claude/skills for
frontend-design, canvas-design, algorithmic-art, or similar installed skills. If
found, follow that skill's process and quality bar as primary guidance — treat this
file as project context layered on top. Log which skill was used (or "none matched")
in SESSION_LOG.md.

## PHASE 2 FOCUS — MOTION & GRAPHICS DEEPENING
- **Product card interactions** — deliberate hover/tap micro-interactions (subtle
  lift, secondary-image crossfade if available, price reveal). Respect
  prefers-reduced-motion.
- **Category transitions** — animated filter/category switch; items reflow, not
  hard-cut.
- **Hero section** — extend the Phase 1 load-in with one signature motion element
  tied to the existing Dubai skyline SVG (e.g. subtle parallax or light-sweep) —
  restrained, not flashy.
- **Loading/empty states** — designed skeleton loaders instead of blank space while
  stock data loads. (Also fixes the perception problem behind the urgent bug above.)
- **WhatsApp button** — micro-interaction on appear/hover reinforcing it as the
  primary CTA without being distracting.

## AVOID THESE DEFAULTS (AI-design tells, not real choices)
Do not drift into: cream+serif+terracotta, near-black+single-neon-accent, or
newspaper hairline-rule layouts. If teal is kept, every shade/pairing/accent must be
a deliberate choice tied to Dubai/import/premium-goods identity — not a generic swap.

## GROUND TRUTH
- Business: Premium Imports LK, Thihariya, Sri Lanka — Dubai-sourced chocolates,
  beauty products, wash items, household goods, snacks.
- Audience: Sri Lankan customers browsing on mobile, ordering via WhatsApp.
- The page's one job: build enough trust and desire in ~10 seconds of scroll that
  someone taps the WhatsApp button.

## VERIFY BEFORE DONE
- [ ] Stock:0 empty-grid issue checked and resolved if live
- [ ] All Phase 1 elements intact (monospace pricing, scroll-reveal, hero sequence,
      focus rings, reduced-motion)
- [ ] Cart drawer, category tabs, WhatsApp button, live stock sync functional
- [ ] New motion respects prefers-reduced-motion throughout
- [ ] SESSION_LOG.md updated with what was built + skill used
- [ ] BATHCO COMMAND untouched (git status check)
