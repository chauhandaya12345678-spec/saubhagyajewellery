/**
 * GET /api/admin/invoice-register?from=YYYY-MM-DD&to=YYYY-MM-DD   (owner)
 *   → every issued invoice in the date range (by invoice_date) with its GST
 *     breakup, plus range totals. Powers the admin "download invoices date-wise"
 *     export (a GST invoice register — what a CA needs for GSTR-1). JSON; the
 *     admin turns it into a CSV client-side.
 */
import { verifyAdminAccess, adminCorsHeaders } from '../_lib.js';
import { loadBusinessConfig, computeInvoice, hydrateOrder } from './_docs.js';

const j = (o, s, cors) => new Response(JSON.stringify(o), {
  status: s || 200, headers: { 'Content-Type': 'application/json', ...cors },
});
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function onRequest(context) {
  const { request, env } = context;
  const cors = adminCorsHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  const auth = await verifyAdminAccess(request, env, cors, { requireOwner: true });
  if (auth.response) return auth.response;

  try {
    const url = new URL(request.url);
    const from = (url.searchParams.get('from') || '').trim();
    const to = (url.searchParams.get('to') || '').trim();
    const credit = url.searchParams.get('doc') === 'credit';
    const noCol = credit ? 'credit_note_no' : 'invoice_no';
    const dateCol = credit ? 'credit_note_date' : 'invoice_date';

    const clauses = [`${noCol} IS NOT NULL AND ${noCol} != ''`];
    const params = [];
    if (isDate(from)) { clauses.push(`date(${dateCol}) >= date(?)`); params.push(from); }
    if (isDate(to)) { clauses.push(`date(${dateCol}) <= date(?)`); params.push(to); }

    const sql = `SELECT id, name, phone, items, total, subtotal, discount, address, payment_method,
                        created_at, ${noCol} AS doc_no, ${dateCol} AS doc_date
                   FROM orders WHERE ${clauses.join(' AND ')}
                  ORDER BY ${dateCol} ASC, ${noCol} ASC`;
    const { results } = await env.DB.prepare(sql).bind(...params).all();

    const business = await loadBusinessConfig(env);
    const totals = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0, count: 0 };
    const rows = (results || []).map((r) => {
      const o = hydrateOrder(r);
      const iv = computeInvoice(o, business);
      totals.taxable += iv.taxable; totals.cgst += iv.cgst; totals.sgst += iv.sgst;
      totals.igst += iv.igst; totals.total += iv.grandTotal; totals.count += 1;
      return {
        doc_no: o.doc_no, doc_date: o.doc_date, order_id: o.id, name: o.name || '',
        state: (o.address && o.address.state) || '', place: iv.interState ? 'Inter-state' : 'Intra-state',
        taxable: iv.taxable, cgst: iv.cgst, sgst: iv.sgst, igst: iv.igst, total: iv.grandTotal,
        payment: o.payment_method || '',
      };
    });

    return j({ success: true, from, to, kind: credit ? 'credit' : 'invoice', business, count: rows.length, rows, totals }, 200, cors);
  } catch (e) {
    return j({ error: String(e.message || e) }, 500, cors);
  }
}
