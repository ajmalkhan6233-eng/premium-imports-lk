---
name: design-review-critique
description: Self-critique any newly built or edited screen against this project's full design skill set before calling the work done. Use this as a mandatory final pass after building or editing ANY POS, GRN, loans, or storefront screen — checkout flows, dashboards, forms, lists, modals — not as an optional nice-to-have and not only when the user asks for a review. If a screen touches visual hierarchy, touch targets, status color, branding, icons, workflow speed, error prevention, language/text, or loading/empty/error states, this skill's checklist applies before the work is reported as finished.
---

# Design Review & Critique

Building a screen and shipping it without checking it against the project's own design rules is how small, systematic violations creep in one at a time — a slightly-too-small button here, a reused status color there — each individually minor, cumulatively the difference between a system staff trust and one they fight with. This skill is the mandatory last step: don't call a screen done until it has been checked, deliberately and specifically, against every relevant design skill in this project — not just eyeballed for "does it look okay."

This is a process skill, not a style skill — it doesn't define new rules of its own. It defines the review pass that enforces the other nine.

## When to run this

Run this after building or meaningfully editing any user-facing screen, before reporting the work as complete. This includes new screens, redesigns, and even small edits (a new button, a new status badge, a new error state) — small changes are exactly where violations sneak in unnoticed, since a one-off addition often skips the scrutiny a full new screen gets.

## The review pass

Walk through each of the following in order, and for each, do the actual check — don't just assert compliance. If a skill doesn't apply to the screen at hand (e.g. a settings screen has no transaction total, so [[pos-visual-hierarchy]]'s "primary number" rule may not apply), say so explicitly rather than silently skipping it, so it's clear the omission was a judgment call and not an oversight.

1. **[[pos-visual-hierarchy]]** — Is there one clear primary number/element, sized and positioned to dominate? Does it correctly shift with transaction state (e.g. total due → change due)? Run the arm's-length squint test.
2. **[[pos-touch-target-ergonomics]]** — Do all tappable elements meet minimum size/spacing? Are destructive actions placed in the hard-to-reach zone, away from routine flow?
3. **[[pos-color-system-status]]** — Does every status indicator use the fixed five-color vocabulary, applied consistently with how it's used elsewhere in the app? Is color paired with icon/text, not used alone?
4. **[[retail-brand-theming]]** — Are brand values (color, logo, business name) pulled from theme config rather than hardcoded? Are status colors and layout sizing protected from being overridden by theming?
5. **[[pos-icon-language]]** — Does every icon match the project's standard action-to-icon mapping? Is every icon paired with a text label?
6. **[[speed-first-workflow-design]]** — Count the golden-path taps. Is every step earning its place, or does something exist only to confirm the obvious?
7. **[[error-prevention-design]]** — Are inputs bounded at the source? Does confirmation friction scale with the actual cost of being wrong, with the cost stated in the dialog?
8. **[[multi-language-ui-design]]** — Is every string pulled from the translation layer? Has layout been checked against the longest realistic string, not just English?
9. **[[empty-state-loading-design]]** — Does this screen have explicit loading, empty, and error states, each distinguishable from the others, each in plain language?

## What to do with findings

A finding here is not optional polish — it's a defect the same way a functional bug is. When the review surfaces a violation:

- **Fix it before reporting the screen as done**, if it's within scope of the current task.
- If a fix is out of scope (e.g. it would require a larger refactor, like introducing a translation layer that doesn't exist yet across the whole app), **say so explicitly** rather than silently shipping the violation — name the specific rule violated and why it wasn't fixed now, so the gap is a visible, tracked decision rather than something discovered later by surprise.
- Don't rationalize a violation as acceptable because "it's a small screen" or "it's just this one case" — the whole value of these skills is that they hold everywhere; an exception granted quietly here erodes the same consistency the next nine skills exist to protect.

## Keep it proportional

Not every screen needs the full nine-point pass at full depth — a tiny copy change to an existing, already-reviewed screen doesn't need re-litigating from scratch. Use judgment: the more a change touches transaction flow, money, destructive actions, or new UI elements, the more rigorously this checklist should be applied. A purely cosmetic tweak to an already-compliant screen can get a lighter pass, but should still be checked against the one or two rules it's actually touching.
