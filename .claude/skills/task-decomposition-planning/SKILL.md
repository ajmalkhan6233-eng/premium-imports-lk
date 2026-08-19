---
name: task-decomposition-planning
description: Break a large or multi-part ask into an ordered, trackable task list before starting work, and don't stop until every item is checked off or explicitly flagged as blocked. Use this at the start of any task that has multiple distinct pieces, spans multiple files/screens/features, or was described in a single message but clearly implies several steps — even if the user phrased it as one sentence. This is the entry point for [[autonomous-build-loop]].
---

# Task Decomposition & Planning

A vague mental map of "the stuff I need to do" is how work quietly loses pieces — a sub-task gets done, the conversation moves on, and something from the original ask never gets circled back to. Writing the task list down first, as discrete trackable items, is what makes it possible to know with certainty that everything got done, rather than assuming it probably did.

## When to decompose before starting

Decompose first whenever a request implies more than roughly two or three independent pieces of work, spans more than one file/screen/feature, or mixes different kinds of work (e.g. "build the UI and wire it to the API and write tests" is three kinds of work even though it's one sentence). A single, clearly-scoped edit doesn't need this ceremony — use judgment, but default to decomposing when in doubt, since the cost of a written list is low and the cost of a silently-dropped sub-task is not.

## How to decompose well

- **Break by deliverable, not by mechanism.** Tasks should be things that can be verified as done ("checkout screen shows change due" not "think about checkout screen"), not vague activity descriptions.
- **Order by dependency, not by convenience.** If task B needs task A's output, A comes first in the list regardless of which feels more interesting to start with.
- **Size tasks so each is independently checkable.** If a task is too large to know whether it's actually finished, split it. If it's so small that tracking it adds more overhead than it saves, merge it upward.
- **Surface implicit sub-tasks the user didn't spell out.** If "build the payment screen" implicitly requires a loading state, an error state, and a confirmation flow, list those explicitly rather than letting them hide inside one big item — an item called "build the payment screen" can be marked done while quietly missing half of what it needed. This pairs directly with [[design-review-critique]] and [[self-testing-before-handoff]] — decomposition should produce items granular enough that both of those checks have something concrete to run against.

## Keep the list visible and current

Use this project's task-tracking mechanism (a todo list, tracked tasks, or equivalent) rather than only holding the plan in your own reasoning — an untracked plan degrades the moment the conversation gets long or context shifts. Update it as you go: mark items done as they're actually verified done (not as soon as code is written — see [[self-testing-before-handoff]] for the distinction), and add newly-discovered sub-tasks the moment they surface rather than making a mental note to "remember" them.

## Don't stop until the list is resolved

The list isn't done when the obvious/interesting parts are done — it's done when every item is either checked off or explicitly marked blocked with a stated reason (see [[blocker-escalation-protocol]] for what counts as a real blocker versus something to push through with a reasonable assumption). Silently leaving an item unaddressed and moving on is the exact failure mode this skill exists to prevent. This is the discipline that [[autonomous-build-loop]] relies on to keep working through a large task without needing the user to re-confirm scope at every step.

## Verification checklist

- [ ] The list breaks the ask into deliverable-sized, independently verifiable items
- [ ] Ordering respects real dependencies between items
- [ ] Implicit sub-tasks (edge cases, states, error handling) are listed explicitly, not folded silently into a bigger item
- [ ] The list lives in a visible, persistent tracker, not only in reasoning
- [ ] Every item ends the task either checked off (verified, not just written) or explicitly flagged blocked with a stated reason
