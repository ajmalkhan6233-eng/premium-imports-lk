---
name: retail-cosmic-brand-identity
description: A dark, premium "cosmic" visual language — near-black backgrounds, a single teal-glow + warm gold/amber accent duo, sparse dramatic particle/glow moments, bold high-contrast minimal type. STRICTLY SCOPED — read the Scope section before applying this anywhere. Use this only for the storefront hero/landing section, splash/loading screens, and WhatsApp assistant branding/avatar, and only when explicitly asked about "brand," "cosmic," "hero," "splash," or "dark mode" for those specific surfaces. Do NOT use this for the Sell/checkout screen or any admin data-entry screen even if the user's request sounds visual/aesthetic — check speed-first-workflow-design and error-prevention-design ownership first.
---

# Retail Cosmic Brand Identity

This is a marketing-moment aesthetic, not a system-wide theme — and the scope boundary below is not a footnote to the aesthetic, it *is* the skill. Applying a dark, glowing, dramatic visual language to a transactional screen a cashier reads fifty times a shift is a real error, not a stylistic preference: it fights [[pos-visual-hierarchy]]'s contrast requirements, it can visually compete with [[pos-color-system-status]]'s status colors, and "sparse dramatic accents" become "constant distracting motion" the instant they show up somewhere used all day under time pressure. Get the scope wrong and this skill actively works against the other ten already governing this project.

## Scope — applies ONLY to these surfaces

- **Storefront hero/landing section** (`/shop` — the top-of-page moment before someone scrolls to actually shop).
- **Splash/loading screens** (a brief branded moment while something loads, not a persistent working surface).
- **WhatsApp assistant branding/avatar** (the persona-facing identity, not the message content itself).
- **An optional dark-mode theme toggle**, if one is added, using this exact palette — and only where the user has opted in, never as a forced default that changes how a working screen looks without consent.

## Explicitly OUT of scope — never apply this here

- **The Sell/checkout screen.** Governed by [[pos-visual-hierarchy]], [[pos-touch-target-ergonomics]], [[error-prevention-design]], [[speed-first-workflow-design]] — stays clean, high-contrast, fast to scan, exactly as it is today. No glow, no particles, no dark-mode-by-default here even under an optional toggle unless those four skills' requirements are independently re-verified against the dark palette first.
- **Any admin data-entry screen** — Products, GRN, Bills, Customers, Vendors, Loans, Expenses, Reports, Settings. These are worked in for hours, not glanced at for a moment; the entire *point* of this aesthetic (drama, mood, a "wow" moment) is the opposite of what a data-entry screen needs, which is legibility and speed.
- Anywhere the storefront's own **product grid, cart, or checkout flow** lives — the hero can be cosmic; the moment a customer is trying to read a price or complete an order, the surface should already have transitioned to the storefront's normal legible design (already established in this project's Storefront Design Phase 2 work).

If a request sounds aesthetic/visual and touches a screen not on the explicit "applies to" list above, that's a case for [[blocker-escalation-protocol]]-style caution — flag it as a scope question rather than assuming the mood should extend, even if it would look striking there too.

## The palette and language, for the surfaces it does apply to

- **Background**: near-black, not pure `#000` — enough depth for the glow accents to read as light against something, not flatness.
- **Accent duo**: one teal-glow and one warm gold/amber, used as the *only* two accent colors — resist adding a third "just this once." This is a brand-identity palette, separate from and never overlapping [[pos-color-system-status]]'s status vocabulary (this teal/gold pair means nothing about paid/overdue/low-stock anywhere in the app; if either color starts being read as a status signal, that's a collision to fix, not tolerate).
- **Particle/glow accents**: sparse and dramatic, reserved for hero/splash moments specifically — a constant animated background (particles drifting permanently behind normal content) is the wrong use of this even within scope; the drama comes from a moment, not ambient motion. Respect `prefers-reduced-motion` the same way this project's existing storefront animations already do.
- **Typography**: bold, high-contrast, minimal — a few large confident statements, not dense paragraph text. This palette is not the place for a wall of copy; if a surface needs to communicate a lot of information, that's a signal it's drifting toward being a working screen rather than a brand moment, and probably shouldn't be fully in this skill's scope.

## Verification checklist

- [ ] Confirmed the target surface is on the explicit "applies to" list before writing any code — not inferred from "this could look cool here"
- [ ] Sell screen and every admin data-entry screen are untouched by this palette, confirmed by name, not by absence of complaint
- [ ] Teal/gold accents never double as a status signal anywhere [[pos-color-system-status]] already owns
- [ ] Particle/glow motion is confined to hero/splash moments, not ambient/constant, and respects `prefers-reduced-motion`
- [ ] Any dark-mode toggle is opt-in, never a forced default on a working screen

Include this scope check explicitly in [[design-review-critique]] any time this palette is proposed for a new surface — the review should name which list (in-scope or out-of-scope) the surface falls into, not just assess whether it looks good.
