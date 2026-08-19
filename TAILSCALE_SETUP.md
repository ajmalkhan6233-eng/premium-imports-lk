# Remote Access via Tailscale — Setup Steps for Ajmal

**Why this file exists instead of Claude just doing it**: setting this up
needs two things Claude Code is not allowed to do on your behalf, even
when you explicitly ask —

1. **Creating a Tailscale account.** Tailscale sign-in is an OAuth flow
   (Google/Microsoft/GitHub/Apple/email) — account creation is on
   Claude's permanent do-not-do list, no exceptions.
2. **Installing VPN/network software system-wide.** Tailscale adds a
   virtual network adapter and needs admin consent on Windows —
   modifying system/network settings is also on that same list.

Both of those are five-minute, no-technical-skill steps for you to do
yourself. Everything else — whether the app itself needs any changes —
is already checked and answered below.

## The good news: the app needs zero code changes

`server.js` already does `app.listen(PORT, '0.0.0.0', ...)` — it binds
to *every* network interface on the machine, not just `localhost` or
the home WiFi's LAN IP. Right now that's *why* it's reachable at
`http://192.168.1.204:3005` from phones on the home WiFi (see the
console banner it prints on start).

Once Tailscale is running on this PC, Tailscale gives the machine an
additional IP address (something like `100.x.x.x`) on its own private
encrypted network. Because the server already listens on `0.0.0.0`, it
automatically becomes reachable at `http://<this-PC's-tailscale-ip>:3005`
too — Tailscale handles the encrypted tunnel entirely outside the app;
the app has no idea it's happening. Nothing in `server.js`'s IP-handling
(`clientIp()`, used only for login-lockout tracking) makes any
LAN-only assumption that would break over a Tailscale IP either — it
just reads whatever real IP the request came from, whatever range that
is.

## What "computer on / off" actually means with Tailscale

- **PC on, Tailscale running, PM2 running**: reachable from any of your
  other devices that are also signed into the same Tailscale network
  (your phone, laptop, etc.) — from anywhere with internet, not just
  home WiFi.
- **PC off, or Tailscale/PM2 not running**: unreachable, same as today.
  Tailscale doesn't add a cloud server that keeps running when this PC
  is off — it's a direct connection between devices that are both
  online. This matches exactly what you asked for: reachable while the
  PC is on, unreachable when it's off.

## Setup steps (run these yourself)

1. Go to **tailscale.com**, sign up (Google/Microsoft/GitHub/Apple, or
   email) — pick whichever account you're comfortable tying this to.
   The free "Personal" plan covers this use case (up to 3 users / 100
   devices).
2. Download and install **Tailscale for Windows** on this PC. It'll ask
   for admin permission during install — that's expected, it's
   installing a network driver.
3. After install, it opens a browser tab to sign in — sign in with the
   same account from step 1. Once signed in, Tailscale shows this PC in
   its device list with its `100.x.x.x` address (also visible any time
   from the Tailscale tray icon → your PC's name).
4. Install the **Tailscale app on your phone** (iOS/Android, same
   store you get any app from) and sign in with the *same account*.
   This is what puts your phone on the same private network as the PC.
5. With PM2 already running the server (see `README.md` /
   `HANDOFF.md` — `npm run start:pm2`, or it now starts automatically
   via the Startup shortcut, see the PM2-startup-path fix logged
   2026-08-19), open on your phone (over mobile data, WiFi off, to
   prove it's *not* just hitting home WiFi):
   `http://<the-PC's-tailscale-ip>:3005`
   You should land on the same login screen as at the shop counter.
6. To confirm it goes dark when it should: stop the server
   (`npx pm2 stop premium-imports-server`, or just turn the PC off) and
   reload that same URL on your phone — it should fail to connect, not
   show a cached or stale page.

## One thing worth deciding before wiring it in daily

Tailscale reaching the server is a separate question from whether the
*app itself* should treat a remote/Tailscale login differently from an
in-shop one (e.g., should a PIN alone be enough from outside the shop,
or does remote access want a stronger check?). Nothing about that has
been changed here — today, a valid PIN works the same whether you're on
the shop WiFi or on Tailscale from anywhere. Flagging this as a real
question worth answering once this is actually in daily use, not
something silently decided either way.
