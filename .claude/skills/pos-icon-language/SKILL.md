---
name: pos-icon-language
description: Apply one consistent icon set for POS actions (void, refund, hold, split, discount, and similar) that reads clearly regardless of the staff member's literacy level or preferred language. Use this whenever adding, choosing, or reviewing an icon for any action button, toolbar, or menu item on POS, GRN, loans, or storefront admin screens — not only when the user explicitly asks about icons.
---

# POS Icon Language

Not every staff member reads fluently in every language the UI might be set to, and under time pressure nobody wants to read a label anyway — they want to recognize a shape. A well-designed icon language lets staff work by shape recognition, the same way they'd recognize a stop sign without reading "STOP." But an icon language only works if it's actually a *language* — the same shape always means the same action, everywhere, forever — not a set of one-off illustrations chosen per-screen.

## Two rules that make or break this

1. **One icon, one meaning, everywhere.** The icon used for "void" on the POS screen must be the exact same icon used for "void" on the GRN screen and anywhere else void appears. Never reuse a shape for a second, different action elsewhere in the app (e.g. the icon used for "hold" must not also be used for "pause" if pause means something different) — that's the fastest way to turn a recognizable language into a guessing game.
2. **Icon + label together, always, at least until staff have memorized it.** Pure icon-only buttons are a literacy and language bet that isn't worth making in a retail floor context. Pair every action icon with a short text label (in the active UI language) beside or below it. The icon is the fast-recognition layer; the label is the safety net for anyone still learning the system or unsure. This also protects against a second problem: icons alone are genuinely ambiguous (a "split" icon and a "discount" icon can look similar at a glance) — the label resolves ambiguity instantly.

## Standard action-to-icon mapping

Use this table as the canonical mapping for this project. If a new action is needed, choose a universally recognizable pictogram (not an abstract or culture-specific symbol) and add it here rather than letting each screen invent its own.

| Action | Icon concept | Notes |
|---|---|---|
| Add item | Plus (+) in a circle or box | Universal "add" convention |
| Remove item | Minus (–) or trash/bin | Use trash only for permanent removal; use minus for quantity decrement |
| Void | Circle with a diagonal slash (⊘) or bold X in a stop-shape | Pair with the danger status color from [[pos-color-system-status]] |
| Refund | Arrow curving backward/left (↩) | Distinct from "undo" in styling — refund always shows an amount alongside it |
| Hold | Pause symbol (⏸) or a bookmark/clock | "Hold" = parked for later, not cancelled — must look clearly different from void |
| Split | Two arrows diverging, or a bill splitting into two | Used for split payment or split order |
| Discount | Percent symbol (%) or a price tag with a corner folded | Avoid a coin/money icon here — reserve money icons for payment actions |
| Cash payment | Banknote/cash icon | |
| Card payment | Card icon | |
| Search | Magnifying glass | |
| Print receipt | Printer icon | |
| Edit quantity | Pencil, or +/– stepper (prefer stepper for quantity specifically — see [[pos-touch-target-ergonomics]]) | |

## Choosing new icons

When an action isn't in the table above:

- Prefer widely-recognized pictograms already established by common OS/UI conventions (the kind of icon a person would recognize from any smartphone) over inventing something novel — novelty defeats the goal of instant recognition.
- Avoid icons whose meaning depends on cultural or regional convention (e.g. hand gestures, region-specific symbols) since staff and future clients may come from different backgrounds — see [[multi-language-ui-design]] for the broader localization context this sits inside.
- Avoid text-inside-icon graphics (a tiny "%" rendered as an image is fine; a tiny word rendered as an image is not — it can't be translated and won't read at small sizes).
- Once chosen, add the action to the table above so it becomes part of the fixed language rather than a one-off.

## Sizing and consistency with touch targets

Icon buttons follow the same hit-area rules as any other control — see [[pos-touch-target-ergonomics]]. A small glyph is fine; a small *tappable area* around a small glyph is not. Keep icon stroke weight and visual style (outline vs. filled, corner radius) consistent across the whole icon set — a mix of styles reads as inconsistent even if every individual icon is legible.

## Verification checklist

- [ ] Every action icon matches its entry in the standard mapping table (or has been added to it, not invented ad hoc for one screen)
- [ ] No icon shape is reused for two different actions anywhere in the app
- [ ] Every action icon is paired with a visible text label, not icon-only
- [ ] New icons avoid culture-specific symbolism and text-in-icon graphics
- [ ] Icon hit areas meet [[pos-touch-target-ergonomics]] minimums regardless of glyph size

Include this check in [[design-review-critique]] whenever a screen introduces a new icon or action.
