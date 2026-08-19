---
name: cost-of-goods-sold-tracking
description: Calculate cost of goods sold from real GRN/inventory cost data captured in this system — never a modeled, averaged, or industry-typical cost. Use this whenever computing COGS for a P&L, margin report, or any figure that needs to know what a sold item actually cost this shop.
---

# Cost of Goods Sold Tracking

COGS is the input every profitability number depends on, which makes it the single most damaging place to guess. A modeled or averaged cost doesn't just produce one wrong number — it silently corrupts every margin calculation, every P&L, every "is this product worth stocking" decision built on top of it. This system already captures real cost data at two points; the discipline is using the *right* one for the question being asked, not inventing a third.

## The two real cost sources, and when each applies

- **`bill.items[].cost`** — the product's `costPrice` as it was *at the moment of that sale*, captured directly on the bill line (see `server.js`'s bill-creation code: `cost: product.costPrice || 0`). This is the correct source for **historical COGS** — what this specific past sale actually cost the shop, regardless of what the product costs today.
- **`product.costPrice`** (current) — the product's cost *right now*, most recently set by a GRN or a manual edit. This is the correct source for **forward-looking margin questions** ("if I sell one more of this today, what's my margin") — never for re-deriving what a past sale cost.

Using current `costPrice` to compute COGS for past sales is a subtle but real violation of this rule: it silently substitutes today's cost for what actually happened, which is a model, not a record — even though it looks like real data because the number came from somewhere in `data.json`.

## When cost is genuinely unknown

A bill line with `cost: 0` (or missing) because the product's `costPrice` was never set at sale time is not "free" — it's **unknown**. Report it as `0` if the report is purely arithmetic, but do not let a `0`-cost line pass silently through a margin report as if it were a real, verified zero-cost item; that overstates margin. Flag it the same way [[profit-loss-statement-generation]] requires — a visible caveat, not a hidden assumption.

## GRN cost changes over time

A product's cost can change between GRNs (a vendor raises prices, a different vendor is used). Never average multiple GRN costs into a single "typical cost" for COGS purposes unless the system actually tracks cost lots/batches (it currently doesn't — `product.costPrice` is a single current value, overwritten by whatever the most recent GRN or edit set it to). Until real cost-lot tracking exists, COGS accuracy is bounded by that reality — say so if asked to build something that implies FIFO/weighted-average costing this system doesn't actually support yet, rather than quietly pretending it does.

## Verification checklist

- [ ] Historical COGS (past sales, P&L for a closed period) uses `bill.items[].cost`, never current `product.costPrice`
- [ ] Forward-looking margin questions use current `product.costPrice`, clearly distinguished from historical COGS
- [ ] Zero/missing cost is visibly flagged wherever it feeds a margin or profit figure, never silently treated as a true zero
- [ ] No FIFO/weighted-average/lot-based costing is implied or computed unless the underlying data actually supports it

Cross-check with [[profit-loss-statement-generation]] (COGS is one of its three real inputs) and [[grn-to-ledger-reconciliation]] (where `costPrice` actually gets set/updated).
