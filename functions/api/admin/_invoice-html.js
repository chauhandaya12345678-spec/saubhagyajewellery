/**
 * Printable HTML for a legal GST Tax Invoice / Credit Note.
 * Shared by the public token-gated page (functions/invoice.js) and the admin
 * Finance tab. All money passed in PAISE. Pure string builder — no I/O.
 */

export const STATE_CODES = {
  'jammu and kashmir': '01', 'himachal pradesh': '02', 'punjab': '03', 'chandigarh': '04',
  'uttarakhand': '05', 'haryana': '06', 'delhi': '07', 'rajasthan': '08', 'uttar pradesh': '09',
  'bihar': '10', 'sikkim': '11', 'arunachal pradesh': '12', 'nagaland': '13', 'manipur': '14',
  'mizoram': '15', 'tripura': '16', 'meghalaya': '17', 'assam': '18', 'west bengal': '19',
  'jharkhand': '20', 'odisha': '21', 'chhattisgarh': '22', 'madhya pradesh': '23', 'gujarat': '24',
  'daman and diu': '25', 'dadra and nagar haveli': '26', 'maharashtra': '27', 'karnataka': '29',
  'goa': '30', 'lakshadweep': '31', 'kerala': '32', 'tamil nadu': '33', 'puducherry': '34',
  'andaman and nicobar islands': '35', 'telangana': '36', 'andhra pradesh': '37', 'ladakh': '38',
};
export function stateCode(state) { return STATE_CODES[String(state || '').trim().toLowerCase()] || '--'; }

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rup = (paise) => '₹' + (Math.round(Number(paise) || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Indian amount-in-words for rupees (integer part), e.g. 1799 -> "One Thousand Seven Hundred Ninety Nine". */
export function rupeesInWords(paise) {
  let n = Math.round((Number(paise) || 0) / 100);
  if (n === 0) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x) => x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : '');
  const three = (x) => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + two(x % 100) : '') : two(x));
  let out = '';
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thou = Math.floor(n / 1000); n %= 1000;
  const hund = n;
  if (crore) out += three(crore) + ' Crore ';
  if (lakh) out += three(lakh) + ' Lakh ';
  if (thou) out += three(thou) + ' Thousand ';
  if (hund) out += three(hund);
  return out.trim() + ' Rupees Only';
}

/**
 * kind = 'invoice' | 'credit'
 * data = { order, business, invoice (from computeInvoice), number, date, autoprint }
 */
export function renderInvoiceHTML(kind, data) {
  const { order, business: bz, invoice: iv, number, date } = data;
  const isCredit = kind === 'credit';
  const title = isCredit ? 'CREDIT NOTE' : 'TAX INVOICE';
  const hasGstin = !!(bz.gstin && bz.gstin.trim());
  const docTitle = hasGstin ? title : 'BILL OF SUPPLY';
  const addr = order.address || {};
  const buyerAddr = [addr.street, addr.apt, addr.landmark, addr.city, addr.state, addr.pin].filter(Boolean).join(', ');
  const buyerState = addr.state || '';
  const sellerAddr = [bz.addr1, bz.addr2, bz.city, bz.state, bz.pincode].filter(Boolean).join(', ');
  const inter = iv.interState;

  const roundedTotal = Math.round(iv.grandTotal / 100) * 100;
  const roundOff = roundedTotal - iv.grandTotal;

  const taxCols = inter
    ? `<th class="r">Taxable</th><th class="r">IGST</th><th class="r">Total</th>`
    : `<th class="r">Taxable</th><th class="r">CGST</th><th class="r">SGST</th><th class="r">Total</th>`;
  const rows = iv.lines.map((l, i) => `<tr>
      <td>${i + 1}</td>
      <td>${esc(l.name)}${l.sku ? `<div class="sku">SKU: ${esc(l.sku)}</div>` : ''}</td>
      <td class="c">${esc(l.hsn)}</td>
      <td class="c">${l.qty}</td>
      <td class="r">${rup(l.taxable)}</td>
      ${inter
      ? `<td class="r">${rup(l.igst)}<div class="pct">@${iv.rate}%</div></td>`
      : `<td class="r">${rup(l.cgst)}<div class="pct">@${(iv.rate / 2)}%</div></td><td class="r">${rup(l.sgst)}<div class="pct">@${(iv.rate / 2)}%</div></td>`}
      <td class="r">${rup(l.lineTotal)}</td>
    </tr>`).join('');

  const taxSummary = inter
    ? `<tr><td>IGST @ ${iv.rate}%</td><td class="r">${rup(iv.igst)}</td></tr>`
    : `<tr><td>CGST @ ${iv.rate / 2}%</td><td class="r">${rup(iv.cgst)}</td></tr>
       <tr><td>SGST @ ${iv.rate / 2}%</td><td class="r">${rup(iv.sgst)}</td></tr>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(docTitle)} ${esc(number || order.id)}</title>
<style>
 :root{--ink:#1a1a1a;--mut:#666;--line:#d8d2c4;--head:#0B291C}
 *{box-sizing:border-box} body{font-family:'Segoe UI',Arial,sans-serif;color:var(--ink);margin:0;background:#f4f2ec}
 .sheet{max-width:820px;margin:16px auto;background:#fff;padding:34px 38px;box-shadow:0 1px 8px rgba(0,0,0,.1)}
 .top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;border-bottom:2px solid var(--head);padding-bottom:14px}
 .brand{font-size:20px;font-weight:800;color:var(--head);letter-spacing:.3px}
 .legal{font-size:12px;color:var(--mut);margin-top:2px}
 .logo{width:58px;height:auto;filter:brightness(0);opacity:.9;display:inline-block;margin:0 0 6px auto}
 .doctitle{font-size:20px;font-weight:800;letter-spacing:2px;color:var(--head);text-align:right}
 .docmeta{font-size:12px;color:var(--mut);text-align:right;margin-top:4px;line-height:1.6}
 .small{font-size:12px;line-height:1.6}
 .parties{display:flex;gap:18px;margin-top:16px}
 .party{flex:1;border:1px solid var(--line);border-radius:8px;padding:10px 12px}
 .lbl{font-size:10px;letter-spacing:1px;color:var(--mut);text-transform:uppercase;margin-bottom:4px}
 table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12.5px}
 th{background:#faf7f0;text-align:left;padding:8px;border:1px solid var(--line);font-size:11px;letter-spacing:.4px;color:#444}
 td{padding:8px;border:1px solid var(--line);vertical-align:top}
 .r{text-align:right} .c{text-align:center}
 .sku{font-size:10px;color:#c0392b;font-weight:600}
 .pct{font-size:9px;color:var(--mut)}
 .totals{display:flex;justify-content:flex-end;margin-top:12px}
 .totals table{width:320px;margin:0}
 .totals td{border:none;padding:4px 8px}
 .grand{font-weight:800;font-size:15px;border-top:2px solid var(--head)!important}
 .words{margin-top:10px;font-size:12px}.words b{text-transform:capitalize}
 .foot{display:flex;justify-content:space-between;gap:20px;margin-top:22px;font-size:11.5px;color:#333}
 .sign{text-align:right;min-width:220px}
 .note{font-size:10.5px;color:var(--mut);margin-top:18px;border-top:1px dashed var(--line);padding-top:10px;line-height:1.6}
 .bar{max-width:820px;margin:0 auto 24px;text-align:center}
 .btn{background:var(--head);color:#fff;border:none;border-radius:8px;padding:10px 22px;font-size:13px;cursor:pointer}
 @media print{body{background:#fff}.sheet{box-shadow:none;margin:0;max-width:none}.bar{display:none}}
</style></head><body>
<div class="sheet">
 <div class="top">
   <div>
     <div class="brand">${esc(bz.tradeName || bz.legalName || 'Saubhagya Jewellery')}</div>
     <div class="small" style="margin-top:6px;max-width:340px">${esc(sellerAddr)}</div>
     <div class="small">${hasGstin ? 'GSTIN: <b>' + esc(bz.gstin) + '</b>' : ''}${bz.pan ? ' · PAN: ' + esc(bz.pan) : ''}</div>
     ${bz.phone || bz.email ? `<div class="small">${esc([bz.phone, bz.email].filter(Boolean).join(' · '))}</div>` : ''}
   </div>
   <div style="text-align:right">
     <img class="logo" src="https://saubhagyajewellery.com/images/brand/logo-mark-clean.png" alt="" width="58" height="43">
     <div class="doctitle">${esc(docTitle)}</div>
     <div class="docmeta">
       No: <b>${esc(number || '—')}</b><br>
       Date: ${esc(date || '—')}<br>
       Order: ${esc(order.id)}${isCredit && order.invoice_no ? '<br>Against Inv: ' + esc(order.invoice_no) : ''}
     </div>
   </div>
 </div>

 <div class="parties">
   <div class="party">
     <div class="lbl">Bill / Ship To</div>
     <div class="small"><b>${esc(order.name || '')}</b><br>${esc(buyerAddr)}<br>${esc(order.phone || '')}</div>
   </div>
   <div class="party">
     <div class="lbl">Supply</div>
     <div class="small">
       Place of Supply: <b>${esc(buyerState)} (${stateCode(buyerState)})</b><br>
       ${inter ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)'}<br>
       Reverse Charge: No · Payment: ${esc(order.payment_method || '')}
     </div>
   </div>
 </div>

 <table>
   <thead><tr><th>#</th><th>Description</th><th class="c">HSN</th><th class="c">Qty</th>${taxCols}</tr></thead>
   <tbody>${rows}</tbody>
 </table>

 <div class="totals"><table>
   <tr><td>Taxable Value</td><td class="r">${rup(iv.taxable)}</td></tr>
   ${taxSummary}
   ${roundOff ? `<tr><td>Round Off</td><td class="r">${rup(roundOff)}</td></tr>` : ''}
   <tr class="grand"><td>${isCredit ? 'Refund Total' : 'Grand Total'}</td><td class="r">${rup(roundedTotal)}</td></tr>
 </table></div>

 <div class="words">Amount in words: <b>${esc(rupeesInWords(roundedTotal))}</b></div>

 <div class="foot">
   <div>
     ${bz.bankName ? `<div class="lbl">Bank</div><div class="small">${esc(bz.bankName)}${bz.bankBranch ? ', ' + esc(bz.bankBranch) : ''}<br>A/C: ${esc(bz.bankAcc)} · IFSC: ${esc(bz.bankIfsc)}</div>` : ''}
     <div class="small" style="margin-top:8px">${esc(bz.declaration || '')}</div>
   </div>
   <div class="sign">
     <div class="small">For <b>${esc(bz.tradeName || bz.legalName || '')}</b></div>
     <div style="height:44px"></div>
     <div class="small">Authorised Signatory</div>
   </div>
 </div>

 <div class="note">
   ${!hasGstin ? '<b>Bill of Supply</b> — supplier not registered / composition; no GST charged.<br>' : ''}
   ${esc(bz.footerNote || '')}
 </div>
</div>
<div class="bar"><button class="btn" onclick="window.print()">Print / Save as PDF</button></div>
${data.autoprint ? '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},400);});</script>' : ''}
</body></html>`;
}
