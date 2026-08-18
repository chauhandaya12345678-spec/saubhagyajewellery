/**
 * GET  /api/admin/order-docs?id=<order_id>   (owner)
 *   → { order, business, labelUrl, invoice }  — everything needed to render the
 *     label link + a legal GST invoice / credit note for one order. Read-only.
 *
 * POST /api/admin/order-docs   body { id, issue: 'invoice' | 'credit' }  (owner)
 *   → assigns a stable FY-sequenced document number (idempotent) and returns it.
 *     Called when the seller opens the Finance tab / generates the document.
 */
import { verifyAdminAccess, adminCorsHeaders } from '../_lib.js';
import { loadBusinessConfig, computeInvoice, labelUrlFor, issueDocNumber, hydrateOrder } from './_docs.js';

const j = (o, s, cors) => new Response(JSON.stringify(o), {
  status: s || 200, headers: { 'Content-Type': 'application/json', ...cors },
});

const COLS = `id, name, email, phone, items, total, subtotal, discount, address,
  payment_method, razorpay_payment_id, razorpay_order_id, status, created_at,
  track_token, shipprime_awb, shipprime_order_id, awb_url, invoice_no, invoice_date,
  credit_note_no, credit_note_date`;

async function fetchOrder(env, id) {
  const row = await env.DB.prepare(`SELECT ${COLS} FROM orders WHERE id = ?`).bind(id).first();
  return row ? hydrateOrder(row) : null;
}

export async function onRequest(context) {
  const { request, env } = context;
  const cors = adminCorsHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  const auth = await verifyAdminAccess(request, env, cors, { requireOwner: true });
  if (auth.response) return auth.response;

  try {
    if (request.method === 'GET') {
      const id = new URL(request.url).searchParams.get('id');
      if (!id) return j({ error: 'id required' }, 400, cors);
      const order = await fetchOrder(env, id);
      if (!order) return j({ error: 'Order not found' }, 404, cors);
      const business = await loadBusinessConfig(env);
      const origin = new URL(request.url).origin;
      const tok = order.track_token ? `&t=${encodeURIComponent(order.track_token)}` : '';
      const base = `${origin}/invoice?order=${encodeURIComponent(order.id)}${tok}`;
      // Don't leak the raw token back to the UI — hand over ready-to-open URLs.
      delete order.track_token;
      return j({
        success: true,
        order,
        business,
        labelUrl: labelUrlFor(env, order),
        invoiceUrl: tok ? base : null,
        creditUrl: tok ? base + '&doc=credit' : null,
        invoice: computeInvoice(order, business),
      }, 200, cors);
    }

    if (request.method === 'POST') {
      let b; try { b = await request.json(); } catch { return j({ error: 'Invalid JSON' }, 400, cors); }
      const id = String(b.id || '').trim();
      const type = b.issue === 'credit' ? 'credit' : 'invoice';
      if (!id) return j({ error: 'id required' }, 400, cors);
      const order = await fetchOrder(env, id);
      if (!order) return j({ error: 'Order not found' }, 404, cors);
      const doc = await issueDocNumber(env, order, type);
      return j({ success: true, type, number: doc.number, date: doc.date }, 200, cors);
    }

    return j({ error: 'Method not allowed' }, 405, cors);
  } catch (e) {
    return j({ error: String(e.message || e) }, 500, cors);
  }
}
