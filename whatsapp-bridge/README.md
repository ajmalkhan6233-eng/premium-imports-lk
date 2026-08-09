# WhatsApp Assistant Bridge

Connects the shop's real WhatsApp number to the internal app so the
assistant (replying as **Nushra** — see Settings → WhatsApp Assistant)
can answer customers about stock, prices, and delivery, log every
conversation, and hand off to a real person automatically the moment
that person sends a message from their own phone.

## Before you start

1. The main server must already be running (`npm start`), since this
   bridge reads/writes shop data through it.
2. Add your Anthropic API key to `secrets.json` in the project root
   (the `"anthropicApiKey"` field) — without it, the assistant sends a
   short holding reply instead of a real answer.
3. Set up Settings → WhatsApp Assistant, Delivery Zones, and Payment
   Plans first so the assistant has real information to work with.

## First run — linking the shop's WhatsApp number

```
npm run whatsapp
```

A QR code will print in this terminal. On the phone with the shop's
WhatsApp number: **WhatsApp → Settings → Linked Devices → Link a
Device**, then scan it. This is a one-time step — after that, the
session is saved in `whatsapp-bridge/auth/` (never committed to git —
it's as sensitive as being logged into that WhatsApp account) and it
reconnects on its own every time you run `npm run whatsapp` again.

**Keep this process running** alongside the main server for the
assistant to actually work — closing this terminal stops it from
replying (existing conversations and data aren't affected, it just
stops responding until you start it again).

## What it does automatically

- Replies as Nushra, live product/price/stock and delivery-zone answers
  only from real data — never invents anything.
- Hard-guards on complaint/refund/cancel/angry/payment-dispute language:
  skips the AI entirely and hands that chat to a human.
- The moment Nushra sends a real message into a chat from her own
  phone, the assistant stops replying to that conversation for good —
  no re-engaging automatically.
- Every message (both directions) is logged and visible in the
  internal app under **Messages**.

## If something looks wrong

- **Not connecting / stuck without a QR code**: stop it (Ctrl+C),
  delete the `whatsapp-bridge/auth/` folder, and run `npm run whatsapp`
  again to re-link from scratch.
- **Replies read like a generic bot / wrong info**: check Settings —
  the assistant only knows what's actually in Products, Delivery
  Zones, and the Assistant Name field.
- **Want to stop it replying to everyone temporarily**: just stop the
  process (Ctrl+C). Nothing sends while it's not running.
