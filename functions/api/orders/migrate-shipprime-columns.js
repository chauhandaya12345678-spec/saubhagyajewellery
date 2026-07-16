/** One-time D1 migration: rename shiprocket_* columns to shipprime_* */
export async function onRequest(context) {
  const { env } = context;
  const db = env.DB;
  const results = [];
  
  const renames = [
    ['shiprocket_order_id', 'shipprime_awb'],
    ['shiprocket_shipment_id', 'shipprime_order_id'],
    ['shiprocket_error', 'shipprime_error'],
    ['shiprocket_attempts', 'shipprime_attempts'],
    ['shiprocket_last_attempt_at', 'shipprime_last_attempt_at'],
  ];

  for (const [oldName, newName] of renames) {
    try {
      await db.prepare(`ALTER TABLE orders RENAME COLUMN ${oldName} TO ${newName}`).run();
      results.push(`OK: ${oldName} → ${newName}`);
    } catch (e) {
      results.push(`SKIP: ${oldName} → ${newName} (${e.message.slice(0,100)})`);
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
