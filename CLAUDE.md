# Premium Imports LK — Notes for Claude Code

Local Node.js/Express + JSON-file business system (billing, GRN, loans,
storefront) for a small Sri Lankan import/retail shop. **Read `HANDOFF.md`
first, every session** — it's the primary continuity document (who you're
working with, hard rules, what's actually done vs. stale). See `README.md`
for the full setup and feature walkthrough, `AUDIT_REPORT.md` /
`SESSION_LOG.md` for audit findings and fixes already applied, and
`NEXT_STEPS_ROADMAP.md` for the prioritized backlog.

## Running the server

The server runs under PM2 (auto-restarts on crash) — **do not** tell the
user to run `node server.js` directly as the primary way to start it.

```
npm run start:pm2      # start under PM2 supervision (ecosystem.config.js)
npx pm2 restart premium-imports-server   # after editing server.js
npm run logs:pm2        # tail logs
npm run stop:pm2        # stop
```

`node server.js` / `npm start` still work for a quick one-off manual run
(e.g. local debugging), but changes made while running that way won't
survive a crash — always move back to `npm run start:pm2` for anything
left running unattended.

The WhatsApp bridge (`whatsapp-bridge/index.js`, run via `npm run
whatsapp`) is a separate, manually-linked process, intentionally **not**
under PM2 yet (see AUDIT_REPORT.md finding 5.3) — don't add it to
`ecosystem.config.js` without flagging that decision, since an unexpected
auto-restart could interact with an active WhatsApp Web session.

## Data

All business data lives in `data.json` at the project root (gitignored,
real customer/financial data — never commit it). Daily backups land in
`backups/`. Never hand-edit `data.json` on a whim; if you must, back it up
first (see how `SESSION_LOG.md`'s Fix #3/#4 testing did this).

## Known architectural gap

The `/api/data/:key` endpoints have no authentication (see
`AUDIT_REPORT.md` finding 1.1) — this is a known, tracked, **deferred**
issue, not an oversight to "helpfully" fix in passing. Don't add auth to
these endpoints unless explicitly asked to in a session scoped to that
work.

## Scope discipline

This repo has been through an external audit (`AUDIT_REPORT.md`) with
fixes tracked in `SESSION_LOG.md`. When asked to fix a specific numbered
finding, fix only that finding — don't bundle in adjacent audit items
"while you're in there" unless asked.

## Skill-First Rule (permanent)
Before starting any creation, build, design, or analysis task in any future session or command file, first check ~/.claude/skills and the project's .claude/skills for an installed skill matching the task (e.g. frontend-design for UI work, finance-skills for ledger/reconciliation work, ra-qm-skills for compliance work). Apply the matching skill's process and quality bar as primary guidance. If no matching skill exists, proceed with the command file's own instructions directly. Always log which skill (if any) was used in SESSION_LOG.md.

This rule applies globally — it is not specific to any one command file and should not be re-stated or re-confirmed each time.
