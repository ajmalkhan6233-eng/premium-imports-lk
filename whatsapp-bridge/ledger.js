/* WhatsApp ledger commands (WHATSAPP_LEDGER_COMMAND.md, Phase 1) — fixed
   command grammar only, no fuzzy/AI matching on money. Every write is
   confirmation-gated: parse -> "Reply YES to confirm" -> write only on an
   exact "yes" from the same sender. Restricted to numbers listed in
   settings.ledgerAllowlist (staff/agents' own personal numbers, never the
   shop's own WhatsApp number — see SESSION_LOG.md for why). Each
   allowlisted sender writes only to their own customer/agent record,
   looked up by their own phone — never an arbitrary named customer. */

function normalizePhone(jid) {
  return String(jid || '').split('@')[0];
}

function isAllowlisted(phone, settings) {
  const list = (settings && settings.ledgerAllowlist) || [];
  return list.includes(phone);
}

function parseAmount(raw) {
  const cleaned = String(raw || '').replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return n > 0 ? n : null;
}

// Returns null when the text isn't a ledger command at all (caller falls
// through to whatever it would otherwise do), or { type: 'invalid' } when
// it matches a command word but the amount didn't parse.
function parseCommand(text) {
  const t = String(text || '').trim();
  let m;
  if ((m = /^bill\s+([\d,.]+)$/i.exec(t))) {
    const amount = parseAmount(m[1]);
    return amount ? { type: 'bill', amount } : { type: 'invalid' };
  }
  if ((m = /^paid\s+([\d,.]+)$/i.exec(t))) {
    const amount = parseAmount(m[1]);
    return amount ? { type: 'paid', amount } : { type: 'invalid' };
  }
  if (/^ledger$/i.test(t)) return { type: 'ledger' };
  if (/^receipt$/i.test(t)) return { type: 'receipt' };
  if (/^(yes|y)$/i.test(t)) return { type: 'confirm' };
  if (/^(no|cancel|n)$/i.test(t)) return { type: 'reject' };
  return null;
}

function money(n) {
  return 'LKR ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function newLedgerId() {
  return `L${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function findOrCreateAgent(customers, phone, label) {
  let cu = customers.find((c) => c.phone === phone);
  if (!cu) {
    cu = { id: `C${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: label, phone, address: '', dues: 0, ledger: [], isAgent: true };
    customers.push(cu);
  }
  return cu;
}

// Same shape as every other ledger write in server.js (append-only, amount
// + balanceAfter + ref + note + by) so this shows up correctly in the
// existing admin Customers UI, not a parallel format.
function applyLedgerEntry(cu, type, amount) {
  cu.dues = type === 'bill' ? (cu.dues || 0) + amount : Math.max(0, (cu.dues || 0) - amount);
  cu.ledger = cu.ledger || [];
  const entry = { id: newLedgerId(), type, date: todayStamp(), amount, balanceAfter: cu.dues, ref: '', note: 'via WhatsApp', by: 'whatsapp' };
  cu.ledger.push(entry);
  return entry;
}

function formatLedger(cu) {
  const entries = (cu.ledger || []).slice(-10).reverse();
  if (!entries.length) return `${cu.name}\nBalance: ${money(cu.dues)}\nNo entries yet.`;
  const lines = entries.map((e) => `${e.date}  ${e.type === 'bill' ? '+' : '-'}${money(e.amount)}  (bal ${money(e.balanceAfter)})`);
  return `${cu.name}\nBalance: ${money(cu.dues)}\n\nRecent:\n${lines.join('\n')}`;
}

function formatReceipt(cu) {
  const last = [...(cu.ledger || [])].reverse().find((e) => e.type === 'bill');
  if (!last) return `${cu.name}\nNo bills logged yet.`;
  return `Receipt\n${cu.name}\nDate: ${last.date}\nAmount: ${money(last.amount)}\nRef: ${last.ref || last.id}\nBalance: ${money(cu.dues)}`;
}

const USAGE = 'Ledger commands:\nbill <amount> — log a bill\npaid <amount> — log a payment\nledger — view recent entries\nreceipt — last bill as a receipt';

module.exports = {
  normalizePhone, isAllowlisted, parseCommand, money, findOrCreateAgent, applyLedgerEntry, formatLedger, formatReceipt, USAGE
};
