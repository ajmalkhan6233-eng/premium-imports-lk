---
name: speed-first-workflow-design
description: Design every POS/retail flow to minimize taps, clicks, and steps needed to complete a sale or task — this is the core doctrine for this project, not a nice-to-have. Use this whenever designing or reviewing any multi-step flow (checkout, GRN entry, loan repayment, customer lookup, discount application) and any time a flow has more than one screen or more than a couple of interactions, even if the user didn't explicitly ask about speed or efficiency.
---

# Speed-First Workflow Design

Every extra tap in the checkout flow is a tax paid on every single sale, forever, by a cashier who is standing in front of a customer. Retail staff don't experience a flow once — they experience it hundreds of times a day. A three-tap savings per transaction compounds into real minutes of queue time and real staff fatigue over a shift. This is why speed isn't a polish pass applied at the end — it's a constraint that should shape the flow's structure from the first draft.

## Treat every avoidable tap as a defect

When designing a flow, literally count the taps/clicks required for the golden path (the most common case, not the edge case). If a step can be removed, defaulted, combined, or skipped without removing information the cashier actually needs to see or confirm, removing it is a real improvement — not a cosmetic one. Ask of every step: "does the cashier need to *decide* something here, or is the system just making them confirm what's already obvious?" Steps that only exist to confirm the obvious are the first candidates to cut.

## Concrete techniques

- **Default to the common case.** If cash is the dominant payment method for this shop, cash should be pre-selected, not requiring a tap to choose among equally-weighted options. If a customer is walk-in 95% of the time, don't force a "select customer type" step before every sale — make walk-in the default and let staff opt into attaching a customer record when it matters.
- **Prefer input methods that skip taps entirely.** A barcode scan that adds an item and updates the total in one action beats a search-then-tap-then-confirm sequence every time. Wherever a scanner, keyboard shortcut, or single-field entry can replace a multi-tap selection flow, prefer it.
- **Combine steps that are always done together.** If "select item" is always immediately followed by "confirm quantity 1," don't force a separate quantity-confirmation tap for the default case — let quantity be adjustable *after* the item lands in the cart instead of gating entry on it.
- **Avoid modal confirmations on non-destructive, common actions.** A confirm dialog on "add item to cart" or "apply a standard discount" adds a tap to every single instance of a routine action to guard against a mistake that isn't actually costly. Reserve confirmation friction for the genuinely costly and irreversible — see [[error-prevention-design]] for how to calibrate that tradeoff; the two skills pull in opposite directions on purpose and the right balance is decided per-action by cost, not by defaulting to "always confirm" or "never confirm."
- **Keep frequent actions in easy physical reach.** This is where speed and ergonomics overlap directly — see [[pos-touch-target-ergonomics]] for thumb-zone placement. A fast flow that requires stretching across the screen isn't actually fast.

## Set a tap budget per flow

For any flow worth designing deliberately, state an explicit target: "completing a standard cash sale with 3 items should take no more than N taps after the items are scanned/added." Having a number forces a real design decision instead of a vague aspiration, and gives [[design-review-critique]] something concrete to check the finished screen against. When a flow blows its budget, that's a specific, fixable finding — not a vague sense that something feels slow.

## Don't sacrifice correctness for speed

Speed-first does not mean skipping information the cashier needs to catch a mistake before it's final (see [[error-prevention-design]]), and it does not mean shrinking or hiding the [[pos-visual-hierarchy]] primary number to save space. The goal is removing *friction*, not removing *signal*. A flow that's one tap faster but makes it easier to charge the wrong amount is a net loss, not a win.

## Verification checklist

- [ ] The golden-path tap count for this flow has been counted, not estimated
- [ ] Every step in the flow requires either a real decision or genuinely new information — no step exists purely to "confirm the obvious"
- [ ] The most common choice at each decision point is the pre-selected default
- [ ] Barcode/scanner or keyboard-first input is used wherever it can replace a multi-tap selection
- [ ] No confirmation dialog sits in front of a routine, low-cost, common action
- [ ] Frequent actions are placed in the easy-reach zone per [[pos-touch-target-ergonomics]]

Include this check in [[design-review-critique]] for any multi-step flow.
