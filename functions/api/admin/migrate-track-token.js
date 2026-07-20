/** Add track_token column to orders table + generate tokens for existing orders */
export async function onRequest(context) {
  const { env } = context;
  const db = env.DB;
  
  // Add column
  try {
    await db.prepare("ALTER TABLE orders ADD COLUMN track_token TEXT").run();
  } catch(e) { /* already exists */ }
  
  // Generate tokens for existing orders that don't have one
  const rows = await db.prepare("SELECT id FROM orders WHERE track_token IS NULL OR track_token = ''").all();
  let updated = 0;
  for (const row of (rows.results || [])) {
    const token = crypto.randomUUID().slice(0, 8);
    await db.prepare("UPDATE orders SET track_token = ? WHERE id = ?").bind(token, row.id).run();
    updated++;
  }
  
  return new Response(JSON.stringify({ ok: true, orders_updated: updated }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
