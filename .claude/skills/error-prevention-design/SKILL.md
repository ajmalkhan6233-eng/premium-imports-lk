---
name: error-prevention-design
description: Prevent costly mistakes (wrong price, accidental void, wrong quantity, wrong customer charged) through UI constraints and calibrated confirmation patterns, not just error messages after the fact. Use this whenever designing or reviewing any input field, destructive action, price/quantity override, or confirmation dialog on POS, GRN, loans, or storefront admin screens — and any time a flow could let a mistake reach completion before anyone notices it.
---

# Error Prevention Design

An error message after the fact tells a cashier they already made a mistake — the sale already went through at the wrong price, the item was already voided. By then the cost is usually already real: money handed to a customer, a customer already walked out, an owner finding a discrepancy at end of day. This skill is about stopping the mistake from being possible or from being cheap to make in the first place, rather than relying on catching it afterward.

## Constrain input at the source, before validation even runs

The cheapest way to prevent an error is to make the wrong input structurally unavailable, rather than allowed-then-flagged:

- A quantity field should not be able to go negative or, in most retail contexts, to zero via typing — use bounds on the input itself, not just a validation message after submit.
- A price override should not be an easily-mistaken inline edit sitting next to the normal price display (where a stray tap edits the live price of an item). It should require a distinct, deliberately separate action — a dedicated "override price" control, often gated by a permission level — so it can't happen by accident during normal cart interaction.
- A discount field should have a sane upper bound (e.g. can't accidentally apply 100% off by a typo) unless an explicit elevated action authorizes it.

The theme across all of these: **make the costly action require a different motion than the routine action**, so a rushed or imprecise tap can't slide from routine into costly.

## Calibrate confirmation to the cost of being wrong

Confirmation dialogs are not free — see [[speed-first-workflow-design]], which argues for cutting friction on routine actions. The two skills are in tension on purpose; the resolution is to scale confirmation to consequence rather than applying it uniformly:

- **Cheap and reversible** (add item, adjust quantity by one, apply a standard pre-approved discount): no confirmation needed. If it's wrong, it's trivially fixed in the next second.
- **Expensive or hard to reverse** (void a completed sale, delete a customer/vendor record, apply a large custom discount, refund): confirm, and make the confirmation *state the cost*, not just ask yes/no. "Void this Rs. 15,000 sale?" is a real check a cashier can evaluate in half a second; "Are you sure?" is not — it trains staff to tap through without reading, which defeats the purpose entirely.
- **Irreversible and high-stakes** (deleting historical financial records, permanently removing a loan record): consider a higher bar than a single confirm — e.g. requiring a reason/note, or restricting the action to an admin role — proportional to how bad an accidental trigger would be.

## Prefer undo over always-interrupting confirmation, where the action is reversible

For actions that are reversible but not quite "cheap enough to skip confirming," an undo window (a visible "Undo" affordance for a few seconds after the action) is often better UX than a confirm dialog: it doesn't interrupt the flow when the action was correct (the common case), but gives an easy escape hatch when it wasn't. Reserve hard confirmation dialogs for actions that truly can't be undone once committed (e.g. once a payment has actually been processed by an external gateway).

## Make the danger zone visually distinct

Destructive or high-stakes controls should look different, not just be placed differently. Combine this with:
- [[pos-color-system-status]]'s danger color for the control itself or its confirmation state
- [[pos-touch-target-ergonomics]]'s guidance to place destructive actions in the hard-to-reach zone, separated from the routine flow by real spacing, not just by being "the last button in a row"

A void button styled identically to a hold button, sitting right next to it, is a design invitation for the exact mistake this skill exists to prevent.

## Verification checklist

- [ ] Numeric inputs (quantity, discount, price override) have real bounds, not just post-hoc validation messages
- [ ] Price overrides and large discounts require a distinct, deliberate action — not an easily-mistaken inline edit
- [ ] Confirmation friction scales with cost: none for cheap/reversible, explicit-cost confirmation for expensive/hard-to-reverse, extra friction for irreversible/high-stakes
- [ ] Confirmation dialogs state the actual cost/consequence (amount, item, customer) rather than a generic "Are you sure?"
- [ ] Reversible-but-not-trivial actions offer an undo window instead of (or in addition to) a confirm dialog where practical
- [ ] Destructive controls are visually distinct (color, placement, spacing) from routine controls, not just adjacent siblings in the same style

Include this check in [[design-review-critique]] for any screen with destructive actions, overrides, or free-form numeric input.
