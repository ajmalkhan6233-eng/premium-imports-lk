# LOCAL AI FALLBACK — Honest Guidance (for Ajmal, not for Claude Code to auto-execute)

You asked about connecting a local model (Ollama + a ~980MB model) to take over small edits when Claude Code usage runs out, then handing back when it resets. Straight answer with the real constraints:

## Important correction first
Claude Code cannot be reconfigured to run on Ollama or any local model — it's built specifically to run Claude. There's no setting that swaps the backend. What you actually want is a SEPARATE tool that can drive a local model agentically, used as a stand-in during downtime, not a mode inside Claude Code itself.

## The realistic tool: Aider
**Aider** (open-source, terminal-based, works with Ollama out of the box) is the closest analog to what you're picturing — it edits real files, understands your repo, and takes plain-language instructions, same basic shape as Claude Code.
```
pip install aider-chat
# point it at your local Ollama model
aider --model ollama/<your-model-name>
```
Continue.dev is an alternative if you prefer a VS Code-style extension instead of terminal.

## Capability reality check — set expectations correctly
A ~980MB model is roughly 1-2B parameters, heavily quantized. That's genuinely useful for small, low-risk text and style edits. It is NOT reliable for anything requiring careful multi-file reasoning, security logic, or financial calculations — it will make mistakes with confidence, not flag its own uncertainty the way a larger model does. Treat it like a junior intern doing typo fixes, not a developer you'd trust with the till.

## Hard exclusions — the local model must NEVER touch
- BATHCO COMMAND — same absolute rule as everywhere else
- Any auth/session/login code (Finding #1 area)
- Bank account / payment detail code
- Discount, pricing, or stock calculation logic
- WhatsApp agent escalation/send logic
- Anything in GRN/Sell number generation or the concurrency-safe write queue

## What's actually safe for it
- Copy/text changes (labels, headings, button text)
- Minor CSS/color tweaks that don't touch layout structure
- Adding code comments
- Simple, isolated visual fixes you can eyeball-verify yourself in two minutes

## Handoff protocol (both directions)
- Before switching to the local model: tell it explicitly which files are in-scope for this session — don't give it free rein over the whole repo.
- Work on a separate git branch while on the local model, if you have git set up on this machine (repo: ajmalkhan6233-eng/premium-imports-lk). This means nothing lands on your live app until reviewed.
- When Claude Code usage resets: have Claude Code read HANDOFF.md, then diff-review everything the local model touched before merging — treat it exactly like reviewing a junior dev's PR, not like trusted committed work.
- Log what the local model did in SESSION_LOG.md the same way Claude Code sessions are logged, so nothing gets lost in the handoff.

## Bottom line
This is a workable safety net for genuinely small edits during downtime — not a like-for-like replacement while Claude Code is unavailable. Keep its scope narrow and always review before it touches the live app.
