---
name: self-testing-before-handoff
description: After every feature increment, write and run tests or manually verify end-to-end before marking it done — the user is not the QA team. Use this before reporting any code change, feature, or bug fix as complete, and especially before checking off an item in a [[task-decomposition-planning]] list. Applies to backend logic, API endpoints, and UI screens alike (for UI, this pairs with actually exercising the feature in a browser, not just type-checking it).
---

# Self-Testing Before Handoff

Reporting a task as "done" is a claim about verified behavior, not about code having been written. The gap between those two things is exactly where bugs reach the user — a change that compiles, type-checks, and looks right on read-through can still be wrong in ways only running it reveals. The user's time reviewing a change should be spent on judgment calls (does this match what they wanted), not on catching things that a basic test run would have caught first.

## What counts as verification

Verification means actually exercising the behavior, not inspecting the code and reasoning that it's probably correct:

- **Backend logic / API endpoints**: run the code path, with real or realistic inputs, and confirm the actual output — don't just read the function and conclude it looks right. For business logic with numeric edge cases (pricing, totals, loan interest, tax), test at least one boundary case (zero, negative where relevant, a large value) in addition to the typical case.
- **UI/frontend changes**: start the app and use the feature in a real browser — click through the golden path and at least one edge case. Type-checking and a test suite verify code *correctness*, not feature *correctness*; a screen can pass every type check and still be visually broken, misaligned, or wired to the wrong handler. If browser verification genuinely isn't possible in the current environment, say so explicitly rather than reporting success anyway — an unverified claim of "this works" is worse than an honest "I couldn't verify this end-to-end, here's what I checked instead."
- **Data-affecting changes** (anything touching `data.json` or equivalent persisted state in this project): verify against a backup or a copy, never as a first test against live data — see this project's `CLAUDE.md` guidance on `data.json`.

## Write tests when the codebase has a test suite to extend

If the project already has automated tests, add to them for new logic rather than relying solely on manual spot-checks — automated coverage is what keeps the next change from silently breaking this one. If there's no test suite in place for the relevant area, a thorough manual verification pass (with the specific steps taken stated to the user) is an acceptable substitute — don't block a small project on introducing a testing framework it doesn't have, but don't skip verification just because it isn't automated either.

## Test the failure paths, not just the happy path

A feature that only works when everything goes right isn't finished — check what happens with empty input, a network failure, an unauthorized action, or a boundary value, especially anywhere [[error-prevention-design]] or [[empty-state-loading-design]] apply. These are exactly the paths most likely to be skipped under time pressure and most likely to be the ones a real user actually hits.

## Only mark a task done after this, not before

In a [[task-decomposition-planning]] list, an item moves to "done" after verification, not after the code is written — "written" and "done" are different states, and collapsing them is how unverified work quietly accumulates across a long task. If verification surfaces a problem, that's not a detour from the task, it's the task catching a bug before the user has to.

## Verification checklist

- [ ] The changed behavior was actually run/exercised, not just read and reasoned about
- [ ] For UI changes: the feature was used in a real browser, golden path and at least one edge case
- [ ] For logic changes: at least one boundary/edge-case input was tested, not only the typical case
- [ ] Failure paths (empty input, error state, invalid input) were checked, not just the success path
- [ ] If verification wasn't possible in the current environment, that limitation is stated explicitly rather than implied to be covered
- [ ] The task is marked done only after verification, not at the moment code was written
