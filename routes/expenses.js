// AI-INTELLIGENCE-LAYER-v2-command.md Feature 1: Expense Tracking.
// Dependency-injected router (not a bare require of server.js internals)
// so it shares the exact same db/session/write-lock machinery every other
// endpoint in server.js already uses — same synchronous write-locked
// critical section pattern as /api/grns, same soft-delete-only pattern as
// bill voiding (see server.js POST /api/bills/:id/void).
const express = require('express');

const EXPENSE_CATEGORIES = ['rent', 'salaries', 'transport', 'utilities', 'packaging', 'misc'];

module.exports = function ({ db, saveData, withWriteLock, newId, requireSession, todayStamp }) {
  const router = express.Router();

  router.post('/', (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    withWriteLock(() => {
      const { date, category, description, amount } = req.body || {};
      const amt = Number(amount);
      if (!amt || amt <= 0) return res.status(400).json({ error: 'bad_request', message: 'Enter a valid amount.' });
      if (!EXPENSE_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: 'bad_request', message: `Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}` });
      }
      const expense = {
        id: newId('EXP'),
        date: date || todayStamp(),
        category,
        description: String(description || '').slice(0, 300),
        amount: amt,
        enteredBy: session.user,
        createdAt: new Date().toISOString(),
        voided: false
      };
      db.expenses = db.expenses || [];
      db.expenses.push(expense);
      saveData();
      res.json({ ok: true, expense });
    }).catch((e) => res.status(500).json({ error: 'server_error', message: e.message }));
  });

  router.get('/', (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const { from, to, category } = req.query;
    let list = db.expenses || [];
    if (from) list = list.filter((e) => e.date >= from);
    if (to) list = list.filter((e) => e.date <= to);
    if (category) list = list.filter((e) => e.category === category);
    res.json({ expenses: list });
  });

  // Soft-delete only (voided: true) — matches the immutable-transaction
  // principle already used for bills (void, never delete). Admin-only,
  // and the reason/who/when are recorded rather than the row disappearing.
  router.post('/:id/void', (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    if (session.role !== 'admin') return res.status(403).json({ error: 'forbidden', message: 'Admin access required.' });
    withWriteLock(() => {
      const expense = (db.expenses || []).find((e) => e.id === req.params.id);
      if (!expense) return res.status(404).json({ error: 'not_found', message: 'Expense not found.' });
      if (expense.voided) return res.status(400).json({ error: 'already_voided', message: 'This expense is already voided.' });
      const { reason } = req.body || {};
      expense.voided = true;
      expense.voidedBy = session.user;
      expense.voidedAt = new Date().toISOString();
      expense.voidReason = reason ? String(reason).slice(0, 300) : '';
      saveData();
      res.json({ ok: true, expense });
    }).catch((e) => res.status(500).json({ error: 'server_error', message: e.message }));
  });

  return router;
};

module.exports.EXPENSE_CATEGORIES = EXPENSE_CATEGORIES;
