---
name: empty-state-loading-design
description: Design thoughtful empty, loading, and error states so the system never feels broken to non-technical retail staff. Use this whenever building or reviewing any screen that displays data that could take time to load, could legitimately be empty, or could fail to load — order lists, cart, product search, customer/vendor lists, loan lists, WhatsApp message history, dashboards. Also use it any time a screen currently renders a blank area with no explicit handling for "no data yet," "still loading," or "something went wrong."
---

# Empty, Loading, and Error State Design

Non-technical staff don't have a mental model for "the app is fetching data" or "the request failed but the UI didn't handle it." What they see is a screen that used to show something and now shows nothing, and their reasonable conclusion is that the system is broken. Every place data is displayed needs three states designed on purpose — not just the "happy path with data" state — or the system will feel unreliable even when it's working correctly.

## The three states, and why each one is a distinct design problem

1. **Loading** — data is being fetched, nothing to show yet, but it's coming.
2. **Empty** — the fetch succeeded, and there's genuinely nothing there (no sales today, no matching search results, no messages yet).
3. **Error** — the fetch failed; there may or may not be something to show, but the system couldn't get it.

Collapsing any two of these into the same blank/placeholder treatment is where staff lose trust in the system — an empty list and a broken list must not look identical, because the correct staff response to each is completely different (one needs no action, the other needs a retry or a call for help).

## Loading state

- Show something within roughly 300–500ms of a data request starting — a skeleton screen or spinner. Below that threshold, showing nothing is fine (avoids flicker on fast loads); above it, an unindicated wait reads as a freeze, and staff will start double-tapping buttons or navigating away, which can trigger duplicate actions (see [[error-prevention-design]] for why duplicate actions are worth preventing at the source, not just tolerated).
- Prefer skeleton placeholders that hint at the eventual layout (e.g. gray bars where list rows will appear) over a generic spinner when the wait might be more than a second or two — it reduces the perceived wait and reassures staff the right screen loaded.
- Never let a loading state block or hide the [[pos-visual-hierarchy]] primary total/number if it's already known — only show loading indicators for the parts of the screen that are actually still fetching.

## Empty state

- Always explain *why* it's empty and, where relevant, *what to do next*, in plain language a non-technical reader understands immediately. "No sales yet today" beats a blank list; "No results for '...' — try a different name or SKU" beats a blank search results panel.
- Distinguish a **true empty** (nothing has happened yet — first use of the day, brand-new customer with no order history) from a **filtered empty** (there is data, but the current filter/search excludes all of it) — the message and the recovery action differ. A filtered empty state should offer to clear the filter; a true empty state shouldn't suggest a fix for something that isn't broken.
- Keep empty-state copy free of technical jargon ("no records found matching query" reads as a system message; "No customers match that search" reads as a plain answer to what the staff member just did).

## Error state

- Never surface a raw error code, stack trace, or technical message (e.g. "Error 500" or a raw network exception) to retail staff — translate it into what happened and what to do: "Couldn't connect — check the WiFi and try again."
- Always pair an error state with a visible retry action. Staff shouldn't have to know to refresh the page or restart the app — give them a button that does it.
- If the error affects only part of a screen (e.g. one widget on a dashboard failed to load while the rest succeeded), don't blank the entire screen — isolate the failure to the affected component so staff can still work with everything else that did load.

## Verification checklist

- [ ] Every data-displaying view has an explicit design for loading, empty, and error — not just the happy path
- [ ] Loading indicators appear promptly enough that staff never wonder if the app has frozen
- [ ] Empty states explain why and, when relevant, what to do next — never just a blank area
- [ ] True-empty and filtered-empty states are distinguished, with a "clear filter" recovery path on the latter
- [ ] Error states use plain language, never a raw code or stack trace, and always offer a retry
- [ ] A partial failure (one widget/section) doesn't take down the whole screen

Include this check in [[design-review-critique]] for any screen that fetches or displays data.
