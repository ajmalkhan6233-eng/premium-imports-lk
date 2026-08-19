---
name: budget-vs-actual-variance
description: Compare a real, owner-provided budget figure against real recorded spend/revenue and flag the variance plainly — never smooth over, average out, or explain away a variance to make performance look closer to plan than it was. Use this whenever building or reviewing any budget-tracking feature or "vs. target" comparison.
---

# Budget vs. Actual Variance

The value of a variance report is entirely in showing the gap honestly — the moment a report starts rounding a 40% overspend down to "close enough" or quietly adjusting the budget line after the fact to match what actually happened, it stops telling the owner anything they didn't already know from looking at the raw numbers. This skill is short because the rule is simple: two real inputs, one honest subtraction, no editorializing.

## The two inputs must both be real

- **Budget** — a figure the owner actually entered as their plan (a monthly expense budget, a category target, a revenue goal). Never invent a budget from historical averages and present it as "the budget" — an auto-suggested target based on past spending is fine to *offer* the owner as a starting point when they're setting a budget, but it must be their confirmed choice before it's treated as the budget being compared against.
- **Actual** — real recorded transactions for the same period and category, computed the same way [[profit-loss-statement-generation]] and [[expense-categorization]] require (real records, consistent categories, no estimation).

## Report the gap, don't manage the message

- Variance = Actual − Budget (or the inverse, whichever direction reads naturally for the metric — expense overrun should read as a positive/bad number, revenue shortfall similarly clear).
- Show both the absolute amount and the percentage — a Rs. 500 overrun on a Rs. 1,000 budget (50%) and a Rs. 500 overrun on a Rs. 50,000 budget (1%) are very different findings and either number alone can mislead.
- Large variances should be visually distinct (not necessarily alarming, but not buried at the same visual weight as a 2% variance) — see [[pos-color-system-status]] for reusing the existing amber/red status vocabulary rather than inventing a new one for "over budget."
- Never retroactively adjust a period's budget figure to reduce a variance after the period has closed. If the original budget was wrong, that's a real finding about planning accuracy, not something to erase.

## Verification checklist

- [ ] Budget figures are the owner's real, confirmed input — never auto-generated and presented as the target without confirmation
- [ ] Actual figures follow the same real-data-only rules as every other financial report in this project
- [ ] Variance is shown as both amount and percentage, not one without the other
- [ ] No variance is smoothed, capped, or hidden to make performance look closer to plan
- [ ] Historical budget figures are never edited after the fact to reduce a reported variance

Cross-check with [[profit-loss-statement-generation]] for the actual-side inputs and [[financial-anomaly-detection]] if large variances should also feed an anomaly-flagging feature.
