---
name: expense-categorization
description: Keep expense records categorized/tagged consistently over time so reports stay comparable and reliable — reuse the existing category list rather than letting free-text categories drift into a dozen near-duplicate labels. Use this whenever adding, editing, or reviewing the Expenses screen, expense entry forms, or any report that groups/sums expenses by category.
---

# Expense Categorization

A category list that drifts is a report that quietly stops meaning anything. If one expense is tagged "Utilities," the next "utility," and a third "Electricity Bill," a report grouping by category will show three small, wrong numbers instead of one real one — and nobody will notice until they're trying to reconcile against a bank statement and the totals don't line up with what a normal expense breakdown should look like. This is a narrower, quieter version of the same discipline as [[double-entry-bookkeeping]]: consistency now is what makes the number trustworthy later.

## Reuse the list, don't grow it silently

- Maintain expense categories the same way `settings.categories` works for products — a real, finite, admin-visible list, not a free-text field where every entry can be its own new category.
- When entering an expense, the category picker should show existing categories first (a dropdown/select, not a blank text box inviting a new string every time).
- Adding a *new* category should be a deliberate action (same pattern as products' "+ Add Category" flow, if one exists, or an explicit "add new category" affordance) — not an accidental byproduct of a typo creating a near-duplicate.
- If you're auditing existing expense data and find near-duplicate categories already in use ("Fuel" / "fuel" / "Petrol"), don't silently merge or rewrite historical records to "clean them up" — that's altering financial history. Flag the drift to the owner and let them decide the canonical set; only rename going forward once they've confirmed it.

## Categorization must never be a guess

If an expense's category is ambiguous or the entry doesn't make it clear which bucket it belongs in, that's a case for asking the person entering it, not for the system inferring a plausible-sounding category from the expense description. An auto-suggested category based on the description text is fine as a *suggestion* the human can accept or override — it should never save without the human confirming it, and it should never be presented as if the system determined the true category rather than guessed at one.

## Verification checklist

- [ ] Category selection is a bounded list (dropdown/select), not unconstrained free text, for every expense entry point
- [ ] Adding a new category is a deliberate, visible action, not implicit from typing a new string
- [ ] Existing near-duplicate categories in real data are flagged to the owner, never silently merged or rewritten
- [ ] Any auto-suggested category requires human confirmation before it's saved as the real value

Cross-check with [[financial-report-export]] (category drift breaks exported reports the same way) and [[profit-loss-statement-generation]] if expenses are broken out by category there. Include in [[design-review-critique]] whenever the Expenses entry form changes.
