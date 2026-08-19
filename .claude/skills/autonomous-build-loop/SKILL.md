---
name: autonomous-build-loop
description: Run a "build until actually done" loop for large or multi-part build requests — decompose the goal into a tracked task list up front, work through it without stopping for approval at every step, self-test each piece before checking it off, and only surface to the user at real milestones or genuine blockers. Use this whenever the user gives a large, multi-part, or open-ended build request and clearly wants it carried through to completion rather than confirmed step by step — phrases like "build out," "implement all of," "get this done," or a big feature list handed over in one message.
---

# Autonomous Build Loop

Some requests are best handled as a running conversation where the user reviews small pieces one at a time. Others — a large feature, a batch of related screens, "build out the whole X module" — are better handled by working through the whole thing and coming back with a finished, verified result, because stopping every few minutes to ask "should I continue?" on a task the user has already scoped just adds friction without adding real decision points. This skill defines that second mode: how to work through a large build autonomously without losing track of scope, without silently skipping verification, and without going quiet for so long the user can't tell if anything is happening.

This skill is an orchestration layer over three others — it doesn't redefine planning, testing, or escalation, it sequences them.

## The loop

1. **Decompose first.** Before writing any code, break the request into a tracked task list per [[task-decomposition-planning]]. This is not optional preamble — it's what makes "work without stopping at every step" safe, because the list itself is the record of what "done" means and what's still outstanding.
2. **Work through the list in dependency order**, without pausing to ask permission between ordinary items. The user handed over a large task specifically to avoid babysitting every step — respect that by actually using the autonomy, not by asking a clarifying or confirming question every few items out of caution.
3. **Self-test each piece before checking it off**, per [[self-testing-before-handoff]]. A task list where items get marked done as soon as code is written (rather than after verification) turns into a false sense of progress — the loop's integrity depends on "done" meaning actually verified, every time.
4. **Escalate only for real blockers**, per [[blocker-escalation-protocol]] — missing credentials/access, or a genuinely ambiguous business rule with no reasonable default. For anything else, make the most reasonable call, note it, and keep going. This is what lets the loop actually run autonomously instead of stalling at the first fork in the road.
5. **Surface at real milestones, not on a timer.** A milestone is a meaningfully complete, independently useful chunk of the work (a full feature working end-to-end, not "I wrote a function"). Give the user a short, concrete update at each one — what's done, what's next — so a long autonomous run stays legible even though it isn't interrupting them at every step. Silence for the entire duration of a large task is as much a failure mode as over-interrupting; the goal is fewer, better check-ins, not zero.
6. **Close the loop explicitly.** The task ends when every item in the list from step 1 is checked off (verified) or explicitly flagged blocked with a reason — not when the interesting parts feel finished. Do a final pass against the original list before reporting completion, since large autonomous runs are exactly where an early item can get quietly forgotten by the end.

## When not to use full autonomy

If the request is small, if the user is clearly iterating interactively (asking questions, reacting to each change), or if the very first step surfaces a real blocker per [[blocker-escalation-protocol]], don't force the autonomous-loop framing — just do the work or ask, as the situation actually calls for. This skill is for the specific shape of request where the user has handed over a large, bounded goal and wants it carried to completion — not a general license to avoid checking in.

## Verification checklist

- [ ] A tracked task list exists before implementation starts, covering the full scope of the request
- [ ] Ordinary items are worked through without pausing for per-item approval
- [ ] Every item is verified (per [[self-testing-before-handoff]]) before being marked done, not just written
- [ ] Escalations, if any, are limited to the two real-blocker categories, with everything else handled by reasonable, documented assumption
- [ ] The user receives concrete updates at real milestones during a long run, not silence followed by a single final report
- [ ] Completion is reported only after every item in the original task list is checked off or explicitly flagged blocked
