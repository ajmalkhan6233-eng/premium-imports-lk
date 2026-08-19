---
name: pos-touch-target-ergonomics
description: Size, space, and place tap targets on POS/retail screens for fast, error-free input under real conditions — quick taps, imprecise fingers, gloves, low light, tablets held one-handed. Use this whenever building or reviewing any touch UI element on this project — buttons, numeric keypads, list rows, icon toolbars, quantity steppers, payment method selectors — not just when the user explicitly says "touch target" or "ergonomics." Any tappable element on the POS, GRN, loans, or storefront admin screens should pass through this skill.
---

# POS Touch-Target Ergonomics

Desk-tested UI often looks fine and fails on the shop floor. A cashier is tapping quickly, one-handed, sometimes with a partial view of the screen because they're also handing over change or bagging goods. Small, tightly-packed, or hover-dependent controls that work fine with a mouse cursor become mis-tap machines in that environment. This skill translates "make it usable on a tablet" into concrete, checkable sizing and spacing rules, tuned for the failure modes retail staff actually hit.

## Why size and spacing are the real defect surface

A button that's too small doesn't just look cramped — it produces a specific, expensive failure: the cashier taps, the wrong adjacent control fires (wrong discount applied, wrong item removed, a void triggered instead of a hold), and now there's a correction to make in front of a customer. Every rule below exists to prevent a specific version of that mis-tap, not to satisfy an abstract aesthetic guideline.

## Minimum sizes

| Element | Minimum size | Why this number |
|---|---|---|
| Standard tappable control (buttons, list-row actions, toggle) | 48×48dp (Android/Material baseline) | Below this, adult fingertip contact area routinely overlaps neighboring elements |
| Primary action (Pay, Complete Sale, Confirm) | 56–64px height, full-width or near-full-width | It's tapped every single transaction — make it impossible to miss, and big enough to hit without looking |
| Numeric keypad keys | 56–64px per key, square-ish | Highest-frequency input surface in the whole app; undersized keypad keys compound error rate faster than any other element |
| Icon-only buttons | Visible icon can be small, but the *hit area* (padding included) must still meet the 48px minimum — pad invisibly if the icon itself is smaller | Users tap the visual center of an icon; shrinking the hit area to match a small icon is a common, avoidable bug |

## Minimum spacing

- **8px minimum** between the edges of two adjacent tappable targets. Under 8px, a fingertip reliably straddles both.
- Increase to **12–16px** for any pairing where one of the two targets is destructive (delete line item next to edit quantity, void next to hold) — the extra gap is intentional friction, not wasted space.
- List rows (cart items, order lists, product lists) need a minimum **44–48px row height** with a visible separator (border or alternating background), not just padding — separators help the eye parse rows as quickly as the finger needs to tap them.

## Thumb-zone placement

On a handheld or counter-mounted tablet, map the screen into reach zones based on how the device is actually held, and place controls by frequency and cost:

- **Easy-reach zone** (bottom third / thumb arc from wherever the device is typically gripped): the actions used on nearly every transaction — add to cart, pay, confirm quantity.
- **Reachable-but-deliberate zone** (middle of screen): secondary actions — apply discount, hold, switch payment method.
- **Hard-to-reach zone** (far top corner, opposite the natural grip): rare and irreversible actions — void, delete order, clear cart. This isn't laziness in layout, it's deliberate: making a destructive action slightly less convenient to reach is a cheap, real reduction in accidental hits. Pair this with [[error-prevention-design]] for the confirmation-cost side of the same problem.

If the screen is a fixed counter-mounted tablet rather than handheld, thumb-zone placement matters less than raw size/spacing — prioritize those instead, and put frequent actions where the cashier's eyes already are (near the item list or primary total), not spread across the full screen.

## Design for gloves, glare, and bad light

Sri Lankan retail floors are not climate-controlled, well-lit design studios. Assume at least some of the time:

- **No hover states exist.** Don't rely on hover-to-reveal for anything functional (a delete icon that only appears on hover has no equivalent on touch — it must always be visible or reachable via a visible affordance).
- **No gesture-only interactions.** Swipe-to-delete, long-press-to-edit, and similar gestures must always have a visible tappable alternative (an explicit delete button, an explicit edit icon) — gestures are undiscoverable and unreliable with imprecise or gloved fingers, and they leave no visible target for someone learning the system.
- **High contrast, not just adequate contrast.** Buttons need a visible boundary (fill, border, or shadow) even under glare — don't rely on subtle color-only distinctions between a button and its background.

## Verification checklist

Before marking a screen with tappable elements as done, check:

- [ ] Every tappable element's hit area is ≥48×48dp, including icon-only buttons (measure the hit area, not just the visible glyph)
- [ ] Adjacent targets have ≥8px gap; destructive-next-to-common pairs have ≥12–16px
- [ ] The primary action for the screen is the largest, easiest-to-reach control on it
- [ ] Destructive/rare actions (void, delete, clear) are placed away from the high-frequency flow
- [ ] Nothing on the screen requires hover to be discovered or usable
- [ ] No gesture is the *only* way to perform an action — a visible button exists too
- [ ] The numeric keypad (if present) has been sized and spaced as carefully as any other element — it's the highest-traffic surface on the screen

Run this alongside [[pos-visual-hierarchy]] (does the biggest, easiest-to-hit target correspond to the most important action?) and as part of [[design-review-critique]] before calling any screen complete.
