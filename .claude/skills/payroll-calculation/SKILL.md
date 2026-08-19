---
name: payroll-calculation
description: Compute staff pay — hours, overtime, deductions — strictly from real recorded clock/attendance data. This system has no time-clock or attendance feature today, so there is no real data this skill can compute from yet; treat that as a hard stop, never a rounded guess. Use this whenever asked to build or review any payroll, staff-hours, or wage-calculation feature.
---

# Payroll Calculation

Payroll is money leaving the business into a specific person's hands, based on hours that person actually worked — there is no more direct a place for a fabricated number to become a real, unfair harm than here. This system today has `settings.users` (name, PIN, role) and nothing else about staff — no clock-in/clock-out records, no shift schedule, no hourly rate field. That means, as of right now, **payroll cannot be honestly computed at all**, and this skill's primary job is to say so clearly rather than let a plausible-looking number get built anyway.

## The hard stop

If asked to "calculate this week's payroll" or build a payroll feature:

- Check for real attendance/hours data first. If none exists in the schema, **stop and say so** — this is exactly the missing-data case [[blocker-escalation-protocol]] calls a genuine blocker, not a case for a reasonable default. There is no reasonable default for "how many hours did someone work" — a rounded/typical/assumed figure here directly determines what someone gets paid.
- Do not substitute a flat assumed schedule ("assume everyone works 8 hours a day, 6 days a week") even as a placeholder or starting point — a placeholder payroll number has a way of getting used for real once it exists on screen.
- Do not infer hourly rate from role (admin vs. staff) or any other proxy — actual pay rate is a real fact only the owner has, the same category of fact as bank details or a PIN.

## What would need to exist first

Real payroll calculation needs, at minimum, from the owner or a real attendance system: each staff member's actual clock-in/out records (or an owner-confirmed fixed schedule they explicitly state, clearly recorded as their input, not inferred), their actual agreed pay rate and overtime terms, and any real deductions (loan repayments via the existing Loans feature, if a staff member is also a borrower, would need to cross-reference real loan-ledger data — not be estimated either).

## If a time-clock feature gets built later

Once real attendance data exists in the schema, this skill's job becomes: sum recorded hours per pay period, apply the *recorded* rate and overtime rule, cross-reference recorded deductions — the same "compute from real records, flag gaps, never estimate" pattern as every other skill in this set. Until then, this skill's answer to "run payroll" is a direct explanation of what's missing, not an attempt to approximate it.

## Verification checklist

- [ ] No hours, rate, or schedule figure is ever assumed, rounded, or inferred in the absence of real recorded data
- [ ] A request for payroll with no attendance data present results in a clear explanation of the gap, not a computed number anyway
- [ ] If real attendance/rate data is added to the schema in the future, it's the owner's explicit input, not a default this skill or any other code chose

Cross-check with [[financial-audit-trail]] if payroll writes are ever built (who approved a payroll run, when) and [[loan-credit-ledger-management]] if staff loan deductions are ever cross-referenced.
