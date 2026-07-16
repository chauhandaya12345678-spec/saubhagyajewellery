/**
 * One-time cleanup: delete old test orders + Firebase test users
 * GET /api/admin/cleanup-test-data?secret=...
 * Run once. Deletes orders older than today + Firebase test users.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  
  // Simple protection — use a secret from env
  if (secret !== (env.CLEANUP_SECRET || 'cleanup-2026')) {
    return new Response(JSON.stringify({ error: 'Invalid secret' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = env.DB;
  const results = [];

  // Delete specific old test orders
  try {
    // First list what we have
    const all = await db.prepare("SELECT id, created_at FROM orders ORDER BY created_at DESC").all();
    results.push(`All orders: ${JSON.stringify((all.results||[]).map(o => o.id))}`);

    const del = await db.prepare(
      "DELETE FROM orders WHERE id LIKE 'CC-20260712-%' OR id LIKE 'CC-20260715-%'"
    ).run();
    results.push(`Deleted ${del.changes || 0} test orders`);
  } catch (e) {
    results.push(`Order delete error: ${e.message}`);
  }

  // Delete users without orders (guest accounts)
  try {
    const users = await db.prepare(
      "DELETE FROM users WHERE id NOT IN (SELECT DISTINCT user_id FROM orders WHERE user_id IS NOT NULL)"
    ).run();
    results.push(`Deleted ${users.changes || 0} orphaned users`);
  } catch (e) {
    results.push(`User cleanup error: ${e.message}`);
  }

  // Delete sessions
  try {
    const sessions = await db.prepare("DELETE FROM sessions").run();
    results.push(`Cleared ${sessions.changes || 0} sessions`);
  } catch (e) {
    results.push(`Session cleanup: ${e.message}`);
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
