---
name: tax-filing-preparation
description: Prepare VAT/sales-tax figures for filing strictly from real recorded sales data in this system — never assume a tax rate, a registration status, or invent a tax calculation this system doesn't currently support. Use this whenever asked to build tax reporting, VAT summaries, or any filing-prep feature, and any time a report needs to mention tax at all.
---

# Tax Filing Preparation

This system, as it stands today, has **no tax field anywhere in its schema** — no VAT rate on products, no tax line on bills, no registration status recorded for the business. That absence is not an oversight this skill should quietly fill in; it's a real fact about the business that only the owner knows (is the shop VAT-registered? at what rate? on which product categories, if any are exempt?) and SESSION_LOG already documents this exact judgment call being made correctly once before: tax was deliberately not added because "whether this business is VAT-registered is a real-world fact only Ajmal knows, not something to assume and bolt on." This skill exists to keep that same discipline in place for every future tax-adjacent request.

## What this skill can honestly do right now

- **Export real sales totals** cleanly enough that an owner or accountant can apply the correct tax treatment themselves outside the system — total revenue by period, by category, with enough line-item detail (see [[financial-report-export]]) to support manual tax calculation. This is legitimate and valuable without the system knowing anything about tax rates.
- **Flag the gap explicitly** if asked to produce a "VAT report" or similar: state plainly that tax rate/registration isn't captured in this system yet, and that filing-ready tax figures require that information from the owner before anything can be computed — don't approximate with a commonly-assumed rate (e.g. a country's standard VAT rate) as a placeholder, since presenting an assumed rate's output looks identical to a real filing figure to anyone who doesn't read the caveat closely.

## If tax fields get added later

Should the owner explicitly ask for real tax support (a `taxRate` on settings/products, a tax line on bills), that becomes a genuine schema change requiring their explicit sign-off on the exact mechanism — not something to infer from "well, most shops charge tax" during an unrelated task. Once real tax data exists and is being populated by the business's own confirmed rate, this skill's job becomes straightforward arithmetic from real recorded values, following the same "never estimate a missing input" discipline as every other skill here.

## Verification checklist

- [ ] No tax rate, registration status, or exemption category is assumed anywhere in generated output
- [ ] Any tax-labeled report either uses real tax fields that actually exist in the schema, or clearly states that tax data isn't captured and can't be computed
- [ ] Sales totals/exports used to support manual tax prep are traceable to real bills, not summarized in a way that loses the detail a filing needs
- [ ] Adding real tax fields to the schema is treated as a business decision requiring the owner's explicit input, never inferred or defaulted

Cross-check with [[financial-report-export]] for the export mechanics, and [[profit-loss-statement-generation]] for the same "real data only" discipline applied to profit rather than tax.
