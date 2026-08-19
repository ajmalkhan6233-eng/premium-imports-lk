---
name: multi-language-ui-design
description: Build UI text and layout so the system supports English and Tamil cleanly, with room to add more languages (e.g. Sinhala) later without a rebuild. Use this whenever adding, editing, or reviewing any user-facing text, label, button, or layout on POS, GRN, loans, or storefront screens — and any time a hardcoded English string shows up in component code instead of going through a translation layer, even on a screen that isn't explicitly "the language settings screen."
---

# Multi-Language UI Design

Sri Lankan retail staff may work more comfortably in Tamil, English, or switch between both depending on who they're serving. A system that hardcodes English strings into components isn't just missing a "nice to have" — for a Tamil-preferring staff member it's a system they have to mentally translate on every screen, all day. Getting this right from the start also matters because retrofitting translation support into a codebase full of hardcoded strings is a much bigger job than building it in from day one, even though only two languages ship now.

## No hardcoded strings in components

Every piece of user-facing text — button labels, status text, error messages, empty-state copy, receipt headers — must be pulled from a translation key/lookup system, not typed literally into a component. This is the single most important rule in this skill: it's the difference between "add a language" being a translation file edit versus a code change. When writing or reviewing any component, treat a literal English string sitting in JSX/HTML as a red flag, even for something as small as a placeholder or a tooltip.

## Design for text expansion, not just text swap

Tamil text commonly runs 20–30% longer than the equivalent English string, and can wrap or render differently. A button sized to fit "Pay" precisely will visibly break when the Tamil equivalent is longer. Concretely:

- Don't fix button/label widths to the English string's length — let containers size to content with reasonable min/max bounds, or reserve extra horizontal room.
- Test critical UI (especially [[pos-visual-hierarchy]]'s primary elements and [[pos-touch-target-ergonomics]]'s buttons) with the longest realistic string in each supported language, not just the English default, before calling a screen done.
- Avoid text truncation on anything safety-critical (a truncated "Void" vs "Voi..." is a minor readability issue; a truncated total-due amount or status label is not acceptable under any circumstance).

## Font support

Pick and verify a font stack that actually renders Tamil script correctly (proper glyph shaping, not just "doesn't crash") — not every system font does this well, and a font that silently falls back to boxes/tofu characters for Tamil is a shipped failure, not an edge case to catch later. Confirm the chosen font (or fallback stack) renders correctly in whatever browser/webview environment the POS actually runs in, not just in a design tool.

## Locale-aware formatting, not just translated labels

Numbers, currency, and dates need locale-correct formatting alongside translated text — a screen that translates every label to Tamil but still shows dates or currency in a format unfamiliar to the reader hasn't actually localized anything. Keep currency formatting (LKR / Rs.) consistent and correct regardless of UI language, since financial display accuracy matters more than perfect locale-matching here — this connects directly to [[pos-visual-hierarchy]]'s emphasis on the primary total-due number being unambiguous.

## Make language switching easy to reach

Staff may alternate languages depending on who's working a shift or who they're serving. The language switcher should be reachable without deep navigation — not buried three menus down — because a setting only used once during onboarding defeats the purpose if the real use case is switching between customers or shifts.

## Build for a third (and future) language now, even though only two ship

Structure the translation system (key-based lookups, a per-language file/table, not per-language conditional code branches) so that adding Sinhala or any future language later is "add a translation file," not "restructure how text works." A translation architecture that hardcodes an assumption of exactly two languages (e.g. an `isEnglish ? x : y` ternary scattered through components instead of a lookup keyed by active language) will need to be redone the moment a third language is added — avoid that trap now while the surface area is still small.

## Verification checklist

- [ ] No user-facing string is hardcoded directly in component code — all route through a translation key system
- [ ] Buttons and labels have been checked against the longest realistic string in each supported language, not just English
- [ ] The chosen font stack renders Tamil glyphs correctly in the actual runtime environment, not just in design tooling
- [ ] Numbers, currency, and dates are formatted correctly regardless of active UI language
- [ ] The language switcher is reachable in a couple of taps, not buried in deep settings
- [ ] Translation lookups are keyed by language (extensible to N languages), not written as two-way conditionals assuming exactly English/Tamil

Include this check in [[design-review-critique]] for any screen with new or changed text.
