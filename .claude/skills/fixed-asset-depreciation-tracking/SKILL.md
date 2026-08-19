---
name: fixed-asset-depreciation-tracking
description: Track depreciation of shop equipment/fixtures for accurate books — this system has no fixed-asset records at all today, so there is nothing to depreciate yet. Use this whenever asked to build or review fixed-asset tracking or depreciation reporting, and treat the missing asset register as a real gap to name, not a reason to invent placeholder assets.
---

# Fixed Asset Depreciation Tracking

Depreciation is a calculation performed *on* a real asset record — a purchase date, a cost, a useful-life assumption the owner has actually chosen. This system currently has no concept of a fixed asset anywhere in its schema; there's no equipment/fixture list, no purchase records for anything beyond resaleable inventory (which is a completely different category — `product.costPrice` is what a *sellable item* costs, not shop equipment). This skill's main job, until that changes, is the same as [[payroll-calculation]]'s and [[tax-filing-preparation]]'s: name the gap plainly rather than fabricate something to compute against.

## What would need to exist first

A real fixed-asset register needs, per asset, from the owner: what it is, when it was acquired, what it actually cost, and which depreciation method and useful-life estimate they want applied (straight-line is the common default for a small retail shop, but it's still a real choice the owner should confirm, not one this skill should silently assume on their behalf). None of that exists in `data.json` today.

## Do not do any of the following

- Do not infer a list of "likely" shop assets (a till, shelving, a fridge) and start tracking depreciation on invented placeholder entries — that's fabricating financial records wholesale, the most direct possible violation of the 100.1g rule.
- Do not repurpose `costPrice`/inventory data as a stand-in for asset value — inventory is meant to be sold, not depreciated, and conflating the two categories would corrupt both COGS ([[cost-of-goods-sold-tracking]]) and any future asset reporting.
- Do not pick a depreciation method or useful-life default on the owner's behalf and present its output as if it were their chosen policy.

## If this feature is genuinely requested

Treat it as a real schema-and-feature addition: a new `assets` collection (acquisition date, cost, method, useful life, all owner-provided), a screen to enter/edit assets the same disciplined way Products are entered, and depreciation calculated purely from those real fields once they exist. This is new-feature work requiring the owner's explicit sign-off on the data model and the depreciation method, not something to bolt onto an existing screen quietly.

## Verification checklist

- [ ] No fixed-asset record is invented, inferred, or estimated in the absence of real owner-provided data
- [ ] Inventory/`costPrice` data is never repurposed as fixed-asset data
- [ ] Depreciation method and useful-life assumptions, if this feature is built, are the owner's explicit, confirmed choice — never a silent default
- [ ] A request for "depreciation" or "asset tracking" with no real asset register present results in naming the gap, not computing a number anyway

Cross-check with [[cost-of-goods-sold-tracking]] for why inventory cost and asset cost must stay separate categories, and [[profit-loss-statement-generation]] for how real depreciation would eventually factor into net profit once the underlying data exists.
