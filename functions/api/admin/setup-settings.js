/**
 * Warehouse/settings table for pickup address.
 * Run once to create table + seed with default address.
 */
export async function onRequest(context) {
  const { env } = context;
  const db = env.DB;

  // Create settings table
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  // Seed default pickup address
  const defaults = {
    pickup_name: 'Saubhagya Jewellery',
    pickup_phone: '9987008435',
    pickup_address1: 'Shop/Gala Premises, upper floor, Lokmanya Chawl Committee opp Vishwakarma Mandir, tanaji nagar rd, Wadarapada Road 1, Hanuman Nagar, Akurli Cross Road, Kandivali East',
    pickup_address2: '',
    pickup_city: 'Mumbai',
    pickup_state: 'Maharashtra',
    pickup_pin: '400101',
  };

  for (const [key, value] of Object.entries(defaults)) {
    await db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').bind(key, value).run();
  }

  return new Response(JSON.stringify({ ok: true, message: 'Settings table created and seeded' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
