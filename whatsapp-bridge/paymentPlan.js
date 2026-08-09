/* Payment-plan intent + structured menu. This is one of the few places a
   rigid menu is correct (per spec) — the assistant offers the real
   configured plans as a numbered list and just records the customer's
   choice as a preference. It never creates a bill or moves money. */
const PLAN_INTENT_KEYWORDS = [
  'pay later', 'pay in', 'installment', 'installments', 'payment plan',
  'pay in parts', 'pay over time', 'buy now pay later', 'credit terms',
  'can i pay', 'instalment', 'instalments'
];

function checkPaymentPlanIntent(text) {
  const lower = String(text || '').toLowerCase();
  return PLAN_INTENT_KEYWORDS.some((kw) => lower.includes(kw));
}

function formatPlanMenu(plans) {
  const lines = plans.map((p, i) => `${i + 1}) ${p.name}${p.days > 0 ? ` (due in ${p.days} day${p.days === 1 ? '' : 's'})` : ' (due today)'}`);
  return `Sure! Here's how you can pay:\n${lines.join('\n')}\n\nJust reply with the number and I'll note it down — we'll set it up properly when you come in.`;
}

// Parses a bare numeric reply ("2", "2)", "option 2") against the plan list
// that was actually offered. Returns the matched plan or null.
function parsePlanChoice(text, offeredPlans) {
  const match = String(text || '').trim().match(/^\D*(\d+)/);
  if (!match) return null;
  const idx = parseInt(match[1], 10) - 1;
  if (idx < 0 || idx >= offeredPlans.length) return null;
  return offeredPlans[idx];
}

module.exports = { checkPaymentPlanIntent, formatPlanMenu, parsePlanChoice };
