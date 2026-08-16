// Fix #5 (AUDIT_REPORT.md finding 5.1 / exec summary #5): process
// supervision for the main server. Previously `node server.js` was run
// directly from start.bat with no auto-restart, so any unhandled crash or
// closed console window took the whole system offline until someone
// noticed and manually restarted it. PM2 restarts the process automatically
// when it exits.
//
// Usage (see README.md "Running the server" for the full walkthrough):
//   npx pm2 start ecosystem.config.js   — start under supervision
//   npx pm2 save                        — persist the process list
//   npx pm2 logs premium-imports-server — view logs
//   npx pm2 stop premium-imports-server — stop
//
// The WhatsApp bridge (whatsapp-bridge/index.js) is intentionally NOT
// included here — it's a separate, manually-linked process (see
// AUDIT_REPORT.md finding 5.3, not part of this fix) and bringing it under
// supervision needs its own review since an unexpected auto-restart could
// interact with an active WhatsApp Web session.
module.exports = {
  apps: [
    {
      name: 'premium-imports-server',
      script: 'server.js',
      cwd: __dirname,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 2000,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
