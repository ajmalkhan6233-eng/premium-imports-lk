// AI-INTELLIGENCE-LAYER-v2-command.md Feature 3 (Daily Net Profit).
// Pure function, no HTTP/db-loading concerns — GET /api/reports/net-profit
// (server.js) and the ai-query "computeNetProfit" tool (routes/ai-query.js)
// both call this directly so the two never drift into two different
// definitions of "net profit."
//
// Revenue/COGS reuse the exact bill-filtering convention already used by
// the dashboard's "Profit" stat (public/app/dashboard.js renderHome):
// type !== 'quote' && status !== 'voided'. COGS is summed from each bill
// line's `cost` (captured from product.costPrice at the moment of sale,
// which GRN receiving sets — see POST /api/grns) rather than re-walking
// GRN history, which is the same COGS basis the dashboard already uses.
function computeNetProfit(db, { from, to }) {
  const bills = (db.bills || []).filter((b) =>
    b.type !== 'quote' && b.status !== 'voided' && b.date >= from && b.date <= to
  );
  const revenue = bills.reduce((s, b) => s + (b.total || 0), 0);
  const cogs = bills.reduce((s, b) =>
    s + (b.items || []).reduce((ps, it) => ps + (it.cost || 0) * (it.qty || 0), 0), 0
  );
  const expenses = (db.expenses || [])
    .filter((e) => !e.voided && e.date >= from && e.date <= to)
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const netProfit = revenue - cogs - expenses;
  const marginPercent = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  return { from, to, revenue, cogs, expenses, netProfit, marginPercent };
}

module.exports = { computeNetProfit };
