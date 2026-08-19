---
name: dashboard-data-density-balance
description: Balance information density against scanability on admin/reports screens — a dashboard packed with every number available is a wall nobody can act on at a glance, and a dashboard stripped too thin hides things the owner actually needs. Use this whenever building or reviewing the Home dashboard, Reports screen, or any other screen showing multiple metrics/summary cards at once.
---

# Dashboard Data Density Balance

A dashboard's job is to answer "how's the business doing, right now, at a glance" — which means every number added to it has a real cost even when it's accurate: it competes for the owner's attention with every other number already there. This skill isn't about hiding data (nothing here should keep real figures from the owner — [[error-prevention-design]] and this project's whole 100.1g discipline are about the opposite problem) — it's about *ordering and grouping* real data so the important things are still findable once there are a dozen of them.

## Rank before you add

Before adding a new card/stat to a dashboard, ask where it sits in genuine priority: does the owner need this in the first three-second glance (net profit, low stock, dues owed — the things that change what they do next), or is it a number they'd look for deliberately when asked (a specific category breakdown, a historical trend)? [[pos-visual-hierarchy]]'s ranking discipline (primary/secondary/tertiary, ranked by consequence not convenience) applies here at the dashboard level, not just within a single transaction screen.

## Concrete moves that preserve density without becoming a wall

- **Summary card, then drill-down** — a card shows one clear number (Net Profit: Rs. X) with the ability to tap through for the real breakdown behind it, rather than putting the breakdown's five sub-numbers on the dashboard itself. This system's dashboard already does this (tap a summary card to see full detail) — extend that pattern to any new card rather than adding raw detail directly to the top-level view.
- **Group related numbers visually**, don't scatter them — dues/receivables-adjacent numbers together, stock-health numbers together, so the owner's eye can chunk them by meaning rather than parsing a flat grid of unrelated figures.
- **Empty/zero states stay quiet, not alarming** — a stat at zero (no low-stock items, no overdue dues) is good news; don't give it the same visual weight as a real concern just because it's a number on the same grid (see [[pos-color-system-status]] — zero/healthy states use the neutral or green vocabulary, not a loud treatment that trains the eye to ignore alerts because everything looks equally urgent).
- **Real thresholds for what counts as "worth a card"** — a number that's almost always zero or almost never changes for this specific shop's real usage pattern is a candidate to move behind a drill-down rather than occupy permanent top-level space; don't decide this from a generic assumption about what dashboards "should" show, look at how this shop's real data actually behaves.

## Verification checklist

- [ ] Every top-level card earns its place by real decision-relevance, not just because the data exists
- [ ] Detailed breakdowns live behind a tap-through, not crammed onto the summary view itself
- [ ] Related numbers are grouped so the eye can chunk them by meaning
- [ ] Healthy/zero states are visually quiet, not competing for attention with real alerts
- [ ] The arm's-length squint test (borrowed from [[pos-visual-hierarchy]]) still finds the single most important number first, even with everything else on screen

Include this check in [[design-review-critique]] for any dashboard/Reports change, alongside [[pos-visual-hierarchy]].
