---
name: retail-brand-theming
description: Build and maintain a white-label theming system so each retail client's install can carry their own branding (logo, colors, business name) without touching core code or forking the codebase. Use this whenever adding a new client/tenant, changing how colors or logos are configured, touching CSS variables/theme tokens, or any time hardcoded brand values (colors, business name, logo paths) show up inside component code instead of a config layer. Relevant to POS, storefront, receipts, and admin screens alike.
---

# Retail Brand Theming

Premium Imports LK is one install of a system that other retail clients may eventually run too. If brand values — colors, logo, business name, header text — are hardcoded into components, every new client requires editing and redeploying core code, and every future update risks clobbering a client's customization. The fix is a theming layer: one place that defines "what this client looks like," loaded at runtime, with core components reading tokens instead of literal values.

## What must be themeable

- **Logo** (header, receipts, login screen, favicon)
- **Business name / display name**
- **Primary and accent brand colors** (buttons, headers, links, highlights)
- **Typography choice**, if clients need it — often lower priority than color/logo
- **Receipt/invoice branding** (business name, address, contact info printed on receipts and GRNs)

## What must stay fixed, not themeable

This is the part most white-label systems get wrong: not everything visual is a brand expression. Two systems are explicitly **excluded** from theming and must be protected from being overridden by a client's palette:

- **Status colors** — see [[pos-color-system-status]]. "Paid," "overdue," "out of stock," etc. carry safety-critical meaning across every module. If a client's brand red becomes the primary theme color, it must not silently become the "overdue" indicator too, or the reverse — a client's brand green must not be mistaken for "in stock" if it isn't. Keep status tokens on their own namespace, separate from theme tokens, so a theming pass can never accidentally overwrite them.
- **Core layout, spacing, and touch-target sizing** — see [[pos-touch-target-ergonomics]] and [[pos-visual-hierarchy]]. A client shouldn't be able to theme their way into an unusable POS by shrinking primary buttons or changing hierarchy through a color/size override.

If a future request asks to make status colors or ergonomic sizing "part of the client theme," flag that tension explicitly rather than quietly implementing it — it's a deliberate architectural boundary, not an oversight.

## Implementation approach

1. **Single theme config, loaded at runtime** — a `theme.json` (or equivalent settings-driven config) holding logo URL/path, business name, and a small set of named color tokens (e.g. `brand-primary`, `brand-accent`, `brand-header-bg`). Don't scatter brand values across multiple files.
2. **CSS custom properties at `:root`**, derived from the theme config, so components reference `var(--brand-primary)` rather than a literal hex value. This is what makes "swap the theme" a config change instead of a code change.
3. **A default/fallback theme** must always exist and load if the client's theme config is missing, malformed, or a value is absent (e.g. missing logo → fall back to a text-based business name header, never a broken image icon or blank space). The system must never render visibly "unstyled" or broken because a theme file was incomplete.
4. **Automatic contrast safety check** — when a client sets a custom accent color, verify it still passes reasonable contrast against the backgrounds it'll sit on (especially where it's used for text or the [[pos-visual-hierarchy]] primary-number treatment). If contrast fails, warn rather than silently shipping illegible text — a brand color that makes the total-due number hard to read is a hierarchy failure and a brand failure at once.
5. **Scope the theme to presentation only.** Business logic (pricing rules, tax calculation, workflow behavior) must never branch on which theme/client is active — theming is strictly a visual layer. If a client needs different business logic, that's a separate configuration concern, not part of this skill.

## Verification checklist

- [ ] No component contains a hardcoded hex color, logo path, or business name — all route through the theme config/tokens
- [ ] Status colors ([[pos-color-system-status]]) are not derived from or overridable by the client theme
- [ ] Touch-target sizes and layout spacing are not themeable
- [ ] A missing or malformed theme config falls back to a safe default, not a broken render
- [ ] Custom brand colors are checked for contrast before being applied to text or high-visibility elements
- [ ] Business logic does not branch on the active theme/client

Include this check in [[design-review-critique]] any time a screen introduces a new hardcoded visual value.
