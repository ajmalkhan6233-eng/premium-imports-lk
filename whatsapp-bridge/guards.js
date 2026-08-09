/* Hard escalation guards — deterministic keyword match, runs before the AI
   ever sees the message. Anything matching here skips the AI entirely.
   Same pattern as LAYLA: never let the assistant improvise on money or a
   complaint. */
const ESCALATION_KEYWORDS = [
  // complaint / refund / cancel
  'complaint', 'complain', 'refund', 'cancel', 'cancelled', 'canceled',
  'wrong item', 'wrong order', 'wrong product', 'missing item', 'not what i ordered',
  // angry / upset language
  'angry', 'upset', 'furious', 'unacceptable', 'disappointed', 'terrible service',
  'worst service', 'scam', 'cheated', 'cheating', 'fraud',
  // payment dispute
  'dispute', 'chargeback', "didn't receive", 'did not receive', 'not received',
  'never received', 'money back',
  // damaged / faulty
  'broken', 'damaged', 'defective', 'faulty',
  // last resort
  'sue', 'lawyer', 'police', 'report you', 'consumer affairs'
];

const HOLDING_REPLY = "Thanks for letting me know — let me get this to Nushra directly so she can sort it out for you. 🙏";

function checkEscalation(text) {
  const lower = String(text || '').toLowerCase();
  const hit = ESCALATION_KEYWORDS.find((kw) => lower.includes(kw));
  return { escalate: !!hit, matchedKeyword: hit || null };
}

module.exports = { checkEscalation, HOLDING_REPLY, ESCALATION_KEYWORDS };
