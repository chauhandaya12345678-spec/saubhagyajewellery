/**
 * Shared helpers for order documents (label / invoice / credit note / manifest).
 * Not an endpoint — the leading underscore keeps Pages Functions from routing it.
 *
 *  - Business / tax identity (GSTIN, HSN, rate, bank) lives in the `settings`
 *    table under key 'business_config'; the seller edits it in the admin Tax
 *    Settings panel. It is INDEPENDENT of ShipPrime (ShipPrime exposes no API to
 *    read a shop's GSTIN), so changing the GSTIN in ShipPrime does NOT change it
 *    here — this is the single source of truth for the legal invoice.
 *  - Prices are GST-INCLUSIVE (matches the pricing model / HSN 7117 @ 3%), so the
 *    invoice back-computes taxable value and tax from the gross.
 *  - Place of supply: buyer state == seller state → CGST + SGST; else → IGST.
 */

export const BUSINESS_DEFAULTS = {
  legalName: '',                   // GST-registered legal person (e.g. proprietor)
  tradeName: 'Saubhagya Jewellery',// trade/brand name shown as the invoice header
  gstin: '',                       // set in Tax Settings; blank => invoice marks it a Bill of Supply
  pan: '',
  addr1: '', addr2: '', city: 'Mumbai', state: 'Maharashtra', pincode: '',
  sellerState: 'Maharashtra',      // origin state for intra/inter-state tax split
  hsn: '7117', gstRate: 3, pricesIncludeGst: true,
  invoicePrefix: 'SJ', creditPrefix: 'SJ/CN',
  bankName: '', bankAcc: '', bankIfsc: '', bankBranch: '',
  email: '', phone: '',
  declaration: 'Certified that the particulars given above are true and correct.',
  footerNote: 'This is a computer-generated invoice and does not require a physical signature.',
};

const STR_KEYS = ['legalName', 'tradeName', 'gstin', 'pan', 'addr1', 'addr2', 'city',
  'state', 'pincode', 'sellerState', 'hsn', 'invoicePrefix', 'creditPrefix', 'bankName',
  'bankAcc', 'bankIfsc', 'bankBranch', 'email', 'phone', 'declaration', 'footerNote'];

export async function loadBusinessConfig(env) {
  let cfg = { ...BUSINESS_DEFAULTS };
  try {
    const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('business_config').first();
    if (row && row.value) cfg = { ...cfg, ...JSON.parse(row.value) };
  } catch (e) { /* defaults */ }
  return cfg;
}

export function cleanBusinessConfig(b) {
  const out = { ...BUSINESS_DEFAULTS };
  for (const k of STR_KEYS) if (b[k] != null) out[k] = String(b[k]).slice(0, 300);
  const r = Number(b.gstRate); if (Number.isFinite(r) && r >= 0 && r <= 100) out.gstRate = r;
  if (b.pricesIncludeGst != null) out.pricesIncludeGst = !!b.pricesIncludeGst;
  out.gstin = out.gstin.toUpperCase().replace(/\s+/g, '');
  return out;
}

/** Indian financial year label for a date (Apr 1 – Mar 31), e.g. "25-26". */
export function financialYear(d) {
  const dt = d ? new Date(d) : new Date();
  const y = dt.getUTCFullYear(), m = dt.getUTCMonth(); // 0=Jan, 3=Apr
  const start = m >= 3 ? y : y - 1;
  return String(start).slice(-2) + '-' + String(start + 1).slice(-2);
}

/** ShipPrime label PDF url. labelUrl only comes back once (at create) but the
 *  CDN path is deterministic, so old orders reconstruct from the stored ids. */
export function labelUrlFor(env, order) {
  if (order.awb_url) return order.awb_url;
  const oid = order.shipprime_order_id, awb = order.shipprime_awb;
  if (!oid || !awb) return null;
  const base = (env.SHIPPRIME_LABEL_BASE || 'https://cdn.shipprime.live').replace(/\/+$/, '');
  return `${base}/labels/shipping-label-${oid}-${awb}.pdf`;
}

/** GST invoice math. All money in PAISE. items: [{name,sku,qty|quantity,price(₹),hsnCode?}].
 *  order.total/subtotal/discount are PAISE. Prices GST-inclusive per cfg. */
export function computeInvoice(order, cfg) {
  const rate = Number(cfg.gstRate) || 0;
  const incl = cfg.pricesIncludeGst !== false;
  const buyerState = String((order.address && order.address.state) || '').trim().toLowerCase();
  const sellerState = String(cfg.sellerState || '').trim().toLowerCase();
  const interState = !!(buyerState && sellerState && buyerState !== sellerState);

  const raw = Array.isArray(order.items) ? order.items : [];
  const lines = raw.map((it) => {
    const qty = Number(it.qty || it.quantity || 1) || 1;
    const grossP = Math.round((Number(it.price) || 0) * 100) * qty; // ₹→paise
    return { name: it.name || it.sku || it.id || 'Item', sku: it.sku || it.id || '',
      hsn: String(it.hsnCode || cfg.hsn || ''), qty, grossP };
  });
  const grossSum = lines.reduce((s, l) => s + l.grossP, 0);
  const discount = Math.max(0, Number(order.discount) || 0);
  const netTarget = Math.max(0, grossSum - discount); // what the buyer actually paid

  let allocated = 0;
  lines.forEach((l, i) => {
    const net = grossSum > 0
      ? (i === lines.length - 1 ? netTarget - allocated : Math.round(l.grossP * netTarget / grossSum))
      : 0;
    allocated += net;
    const gross = Math.max(0, net);                      // discounted inclusive line amount
    l.taxable = (incl && rate > 0) ? Math.round(gross * 100 / (100 + rate)) : gross;
    l.gst = incl ? (gross - l.taxable) : Math.round(l.taxable * rate / 100);
    l.cgst = interState ? 0 : Math.round(l.gst / 2);
    l.sgst = interState ? 0 : (l.gst - l.cgst);
    l.igst = interState ? l.gst : 0;
    l.lineTotal = l.taxable + l.gst;
  });

  const sum = (k) => lines.reduce((s, l) => s + l[k], 0);
  return {
    rate, interState, buyerState, sellerState,
    lines,
    taxable: sum('taxable'), cgst: sum('cgst'), sgst: sum('sgst'),
    igst: sum('igst'), gst: sum('gst'), grandTotal: sum('lineTotal'),
    orderTotal: Number(order.total) || 0,
  };
}

/** Assign a stable, FY-sequenced document number to an order (idempotent).
 *  type = 'invoice' | 'credit'. Returns { number, date }. */
export async function issueDocNumber(env, order, type) {
  const db = env.DB;
  const existing = type === 'credit' ? order.credit_note_no : order.invoice_no;
  const existingDate = type === 'credit' ? order.credit_note_date : order.invoice_date;
  if (existing) return { number: existing, date: existingDate };

  const cfg = await loadBusinessConfig(env);
  const fy = financialYear(order.created_at);
  const counter = (type === 'credit' ? 'credit_' : 'invoice_') + fy;

  let seq = null;
  try {
    const r = await db.prepare('UPDATE doc_counters SET next_no = next_no + 1 WHERE name = ? RETURNING next_no')
      .bind(counter).first();
    if (r && r.next_no != null) seq = r.next_no;
  } catch (e) { /* older D1 without RETURNING or missing row */ }
  if (seq == null) {
    await db.prepare('INSERT INTO doc_counters (name, next_no) VALUES (?, 1) ON CONFLICT(name) DO UPDATE SET next_no = next_no + 1')
      .bind(counter).run();
    const r2 = await db.prepare('SELECT next_no FROM doc_counters WHERE name = ?').bind(counter).first();
    seq = (r2 && r2.next_no) || 1;
  }

  const prefix = type === 'credit' ? (cfg.creditPrefix || 'SJ/CN') : (cfg.invoicePrefix || 'SJ');
  const number = `${prefix}/${fy}/${String(seq).padStart(4, '0')}`;
  const date = new Date().toISOString().slice(0, 10);
  const col = type === 'credit' ? 'credit_note' : 'invoice';
  await db.prepare(`UPDATE orders SET ${col}_no = ?, ${col}_date = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(number, date, order.id).run();
  return { number, date };
}

/** Parse an order row's JSON columns into usable objects. */
export function hydrateOrder(row) {
  const parse = (s, d) => { try { return JSON.parse(s); } catch (e) { return d; } };
  return { ...row, items: parse(row.items, []), address: parse(row.address, {}) };
}
