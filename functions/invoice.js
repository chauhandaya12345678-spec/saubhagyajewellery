/**
 * GET /invoice?order=<id>&t=<track_token>[&doc=invoice|credit][&print=1]
 *
 * Public, token-gated legal invoice / credit-note page. The link is emailed to
 * the customer at dispatch. The order's own track_token authorises viewing (same
 * token already used for order tracking) — no login. Noindex.
 *
 * For an invoice on a dispatched order the number is assigned on first view if
 * not already set (idempotent, one per order). Credit notes are only shown once
 * an admin has issued one (never auto-issued from the public page).
 */
import { loadBusinessConfig, computeInvoice, issueDocNumber, hydrateOrder } from './api/admin/_docs.js';
import { renderInvoiceHTML } from './api/admin/_invoice-html.js';
import { SECURITY_HEADERS as SEC } from './_sec.js';

const DISPATCHED = ['packed', 'shipped', 'out_for_delivery', 'delivered', 'rto_initiated', 'rto', 'returned'];

function page(html, status = 200) {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...SEC, 'X-Robots-Tag': 'noindex, nofollow' },
  });
}
const err = (msg) => page(`<!doctype html><meta charset="utf-8"><body style="font-family:Arial;padding:40px;color:#333">
  <h2>Invoice unavailable</h2><p>${msg}</p></body>`, 404);

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get('order');
  const token = url.searchParams.get('t');
  const kind = url.searchParams.get('doc') === 'credit' ? 'credit' : 'invoice';
  if (!id || !token) return err('Missing order reference.');

  const row = await env.DB.prepare(
    `SELECT id, name, email, phone, items, total, subtotal, discount, address, payment_method,
            status, created_at, track_token, shipprime_awb, shipprime_order_id, awb_url,
            invoice_no, invoice_date, credit_note_no, credit_note_date
       FROM orders WHERE id = ?`
  ).bind(id).first();
  if (!row || !row.track_token || row.track_token !== token) return err('Invalid or expired link.');

  const order = hydrateOrder(row);
  const business = await loadBusinessConfig(env);
  const invoice = computeInvoice(order, business);

  let number, date;
  if (kind === 'credit') {
    if (!order.credit_note_no) return err('No credit note has been issued for this order yet.');
    number = order.credit_note_no; date = order.credit_note_date;
  } else {
    number = order.invoice_no; date = order.invoice_date;
    if (!number) {
      if (!DISPATCHED.includes(String(order.status || '').toLowerCase()))
        return err('Your invoice will be available once the order is dispatched.');
      const issued = await issueDocNumber(env, order, 'invoice');
      number = issued.number; date = issued.date;
    }
  }

  return page(renderInvoiceHTML(kind, {
    order, business, invoice, number, date,
    autoprint: url.searchParams.get('print') === '1',
  }));
}
