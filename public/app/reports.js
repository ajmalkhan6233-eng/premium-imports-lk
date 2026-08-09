/* ================= REPORTS ================= */
function computeMarketingSourceBreakdown() {
  const rows = [];
  [['facebook', 'Facebook'], ['tiktok', 'TikTok'], ['direct', 'Direct WhatsApp']].forEach(([src, label]) => {
    const convos = (STATE.waConversations || []).filter((c) => c.source === src);
    const customerIds = new Set(convos.map((c) => c.customerId).filter(Boolean));
    const sales = STATE.bills.filter((b) => b.type !== 'quote' && b.customerId && customerIds.has(b.customerId));
    rows.push({ label, conversations: convos.length, salesCount: sales.length, salesTotal: sales.reduce((s, b) => s + (b.total || 0), 0) });
  });
  const webOrders = STATE.orders || [];
  const confirmedWeb = webOrders.filter((o) => o.status === 'confirmed');
  rows.push({ label: 'Website (storefront)', conversations: webOrders.length, salesCount: confirmedWeb.length, salesTotal: confirmedWeb.reduce((s, o) => s + (o.total || 0), 0) });
  return rows;
}
function renderReports() {
  const c = document.getElementById('pageContent');
  const sourceRows = computeMarketingSourceBreakdown();
  c.innerHTML = `
    <div class="grid">
      <div class="card"><h3>Sales</h3><p class="sub">All bills and credit memos</p><button class="btn small" id="rep-sales">Export CSV</button></div>
      <div class="card"><h3>Stock</h3><p class="sub">Current product stock and value</p><button class="btn small" id="rep-stock">Export CSV</button></div>
      <div class="card"><h3>Customer Dues</h3><p class="sub">Outstanding balances</p><button class="btn small" id="rep-dues">Export CSV</button></div>
      <div class="card"><h3>Loans</h3><p class="sub">Lender balances</p><button class="btn small" id="rep-loans">Export CSV</button></div>
      <div class="card">
        <h3>Net Profit</h3>
        <p class="sub">Sale price − cost price, across all bill line items in the period</p>
        <div class="row">
          <div class="field"><label>From</label><input type="date" id="rep-np-from" value="${todayISO().slice(0, 8)}01"></div>
          <div class="field"><label>To</label><input type="date" id="rep-np-to" value="${todayISO()}"></div>
        </div>
        <button class="btn small" id="rep-netprofit">Export CSV</button>
      </div>
    </div>

    <div class="section-title"><h3>Where customers come from</h3></div>
    <div class="card">
      <p class="sub" style="margin-top:-6px">Facebook/TikTok/Direct counts come from tagged WhatsApp conversations (Settings → Marketing Links); "resulting sales" are in-store bills matched to a customer from that conversation. Website counts come from storefront orders.</p>
      <table>
        <tr><th>Source</th><th>Conversations / Orders</th><th>Resulting Sales</th><th>Sales Value</th></tr>
        ${sourceRows.map((r) => `<tr><td>${r.label}</td><td>${r.conversations}</td><td>${r.salesCount}</td><td>${money(r.salesTotal)}</td></tr>`).join('')}
      </table>
      <button class="btn small" style="margin-top:10px" id="rep-sources">Export CSV</button>
    </div>
  `;
  document.getElementById('rep-sales').onclick = () => {
    const rows = [['Number', 'Type', 'Date', 'Time', 'Customer', 'Total', 'Payment', 'Paid', 'Balance Due', 'By', 'Source']];
    STATE.bills.filter((b) => b.type !== 'quote').forEach((b) => rows.push([b.number, b.type, b.date, b.time, b.customerName, b.total, b.paymentType, b.paid, b.balanceDue, b.by, b.source]));
    downloadCsv(rows, 'sales.csv');
  };
  document.getElementById('rep-netprofit').onclick = () => {
    const from = document.getElementById('rep-np-from').value;
    const to = document.getElementById('rep-np-to').value;
    const bills = STATE.bills.filter((b) => b.type !== 'quote' && (!from || b.date >= from) && (!to || b.date <= to));
    const rows = [['Number', 'Date', 'Customer', 'Sale Subtotal', 'Discount', 'Sale Total', 'Cost Total', 'Net Profit']];
    let grandProfit = 0;
    bills.forEach((b) => {
      const subtotal = (b.items || []).reduce((s, it) => s + it.price * it.qty, 0);
      const discount = b.discountAmount || 0;
      const saleTotal = subtotal - discount;
      const costTotal = (b.items || []).reduce((s, it) => s + it.cost * it.qty, 0);
      const profit = saleTotal - costTotal;
      grandProfit += profit;
      rows.push([b.number, b.date, b.customerName, subtotal, discount, saleTotal, costTotal, profit]);
    });
    rows.push(['', '', '', '', '', '', 'TOTAL', grandProfit]);
    downloadCsv(rows, `net-profit-${from || 'all'}_to_${to || 'all'}.csv`);
  };
  document.getElementById('rep-stock').onclick = () => {
    const rows = [['Name', 'Category', 'Brand', 'Cost Price', 'Selling Price', 'Stock', 'Stock Value']];
    STATE.products.forEach((p) => rows.push([p.name, p.category, p.brand, p.costPrice, p.sellingPrice, p.stock, (p.costPrice || 0) * (p.stock || 0)]));
    downloadCsv(rows, 'stock.csv');
  };
  document.getElementById('rep-dues').onclick = () => {
    const rows = [['Customer', 'Phone', 'Dues']];
    STATE.customers.forEach((cu) => rows.push([cu.name, cu.phone, cu.dues]));
    downloadCsv(rows, 'customer-dues.csv');
  };
  document.getElementById('rep-loans').onclick = () => {
    const rows = [['Lender', 'Phone', 'Given', 'Repaid', 'Balance']];
    STATE.lenders.forEach((l) => rows.push([l.name, l.phone, l.given, l.repaid, l.balance]));
    downloadCsv(rows, 'loans.csv');
  };
  document.getElementById('rep-sources').onclick = () => {
    const rows = [['Source', 'Conversations / Orders', 'Resulting Sales', 'Sales Value']];
    sourceRows.forEach((r) => rows.push([r.label, r.conversations, r.salesCount, r.salesTotal]));
    downloadCsv(rows, 'marketing-sources.csv');
  };
}
function downloadCsv(rows, filename) {
  const csv = rows.map((r) => r.map((cell) => {
    const s = cell === null || cell === undefined ? '' : String(cell);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

