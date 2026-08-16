# COMMAND FILE v2: AI Business Intelligence + Daily Net Profit — Premium Imports LK

(Supersedes the earlier AI-INTELLIGENCE-LAYER-command.md — same features, adds a
swappable model backend so local AI can be tested later without a rewrite.)

## Context
- App: Premium Imports LK (Node/Express, JSON storage, localhost:3005 / LAN)
- Do NOT touch BATHCO COMMAND. This is Premium Imports LK only.
- Read CLAUDE.md, SESSION_LOG.md, INTEGRATION_MAP.md before starting.
- Bypass-permissions OFF before any data-layer work.

## Objective
The selling point: ask any question about the business in plain language and get a
real answer pulled from live data — no digging through date-filtered reports. Plus
automatic daily Net Profit on the dashboard.

## Assumptions (flagged, proceed on these — Claude Code should surface if wrong)
- GRN entries already store cost price per product → used as COGS basis. If not
  captured yet, STOP and report back before building Feature 3 — do not guess a cost.
- No expense tracking exists yet → build from scratch (Feature 1).
- ANTHROPIC_API_KEY stored server-side in .env only, never sent to frontend.
- LAN-only deployment stays as-is.

---

## FEATURE 1: Expense Tracking

### Data model — new file: data/expenses.json
```json
[
  {
    "id": "EXP-0001",
    "date": "2026-08-11",
    "category": "rent|salaries|transport|utilities|packaging|misc",
    "description": "",
    "amount": 0,
    "enteredBy": "",
    "createdAt": ""
  }
]
```

### API endpoints
- POST /api/expenses — add entry
- GET /api/expenses?from=&to=&category= — filtered list
- Soft-delete only (add `voided: true`) — no hard deletes, matches your immutable-
  transaction principle. Admin-only, logged.

### UI
- New "Expenses" tab in admin nav
- Form: date, category dropdown, description, amount
- Daily list with running total

---

## FEATURE 2: AI Query Endpoint (swappable model backend)

### Approach
Server-side call using tool use. The model gets READ-ONLY tools that query your real
JSON stores — it never sees or invents raw numbers, only synthesizes what the tools
return. Grounded and auditable by design, regardless of which model runs it.

### Model backend — build this as a swap, not a fork
Add `MODEL_BACKEND=claude|local` to .env. Wrap the model call in a single function
(e.g. `callModel(messages, tools)`) so routes/ai-query.js never talks to a specific
provider directly:
- `claude` → Anthropic API, model claude-sonnet-4-6, standard tool-use format.
- `local` → OpenAI-compatible endpoint (Ollama/LM Studio both support this format),
  same tool-use contract. Point at `LOCAL_MODEL_URL` in .env.

**Default backend for this build: `claude`.** Reason: this feature answers profit/
revenue questions — your rule that the AI must never invent a figure is non-
negotiable, and that's the exact failure mode small local models are weakest at
(multi-step tool chaining, e.g. "compare this month's profit to last month" = 2+
tool calls in sequence). Once a local model is chosen and hardware confirmed, switch
`MODEL_BACKEND=local` and run the full test checklist below against it before trusting
it — don't assume parity with Claude's results.

### New file: routes/ai-query.js
Tools exposed (read-only, no writes):
- getSales({from, to, product?, category?})
- getExpenses({from, to, category?})
- getGRN({from, to, vendor?})
- getVendorLedger({vendor})
- getStockLevel({product?})
- computeNetProfit({from, to})  ← reuses Feature 3 logic

### Endpoint
POST /api/ai-query
Body: { "question": "how much profit did we make this week?" }
Returns: { answer, dataUsed: [...] } — dataUsed is an audit trail of which
tools/ranges backed the answer, regardless of backend used.

### Guardrails (non-negotiable — same pattern as your WhatsApp escalation guards)
- Tools are READ-ONLY. Model must never call write/delete routes.
- Empty tool result → model must say "no data found," never estimate.
- Log every query + tool calls to logs/ai-query-log.json, including which
  MODEL_BACKEND answered it (needed once you're comparing local vs cloud accuracy).
- Rate-limit to 1 in-flight request at a time.

### UI
- Dashboard panel: text input + answer display
- Show last 5 queries for quick reuse

---

## FEATURE 3: Daily Net Profit

### Formula
Net Profit = Total Sales Revenue − COGS (Σ GRN cost price × qty sold) − Expenses
(same date range)

### New endpoint
GET /api/reports/net-profit?date=YYYY-MM-DD (defaults to today)
Returns: { revenue, cogs, expenses, netProfit, marginPercent }

### UI
- Dashboard card: "Today's Net Profit: Rs. X" — auto-refresh
- Also queryable via Feature 2 ("what was yesterday's profit?")

---

## Security note (existing flagged issue — higher stakes now)
/api/data/:key has no auth. This build adds an endpoint that surfaces financial data
on request. Minimum for this session: gate /api/ai-query and /api/expenses behind
the same session/login used for other admin screens, even on LAN. Full auth
hardening across all endpoints remains separate and pending — flagged again, not
blocking this build.

## Files to create/modify
- data/expenses.json (new)
- routes/expenses.js (new)
- routes/ai-query.js (new) — includes callModel() abstraction
- lib/model-backend.js (new) — claude/local switch logic
- routes/reports.js (extend with net-profit endpoint)
- public/admin/expenses.html + .js (new tab)
- public/admin/dashboard — net profit card + AI ask panel
- .env — ANTHROPIC_API_KEY, MODEL_BACKEND, LOCAL_MODEL_URL
- SESSION_LOG.md — log this session
- INTEGRATION_MAP.md — add ai-query.js, expenses.js, model-backend.js

## Test checklist
- [ ] Add 3 test expenses, confirm persistence + filter by date/category
- [ ] Ask AI: "how much did we spend on transport this month" — verify vs manual sum
- [ ] Ask AI: "what's our net profit this week" — verify vs manual calc
- [ ] Ask AI a question with no matching data — confirm "no data," no guessing
- [ ] Confirm graceful failure if API key / local endpoint missing
- [ ] Confirm MODEL_BACKEND swap works without code changes (test both if local is
      available; otherwise leave the switch wired but stay on claude for now)
- [ ] Confirm BATHCO COMMAND repo untouched (git status check)
