/**
 * POST /api/admin/backup-db   — dump D1 to the private BACKUPS bucket
 * GET  /api/admin/backup-db   — list the backups that exist
 *
 * Why this exists on top of D1 Time Travel: Time Travel restores the database
 * to a point in time, but only within Cloudflare and only inside its retention
 * window. This writes an independent, dated snapshot that survives a bad
 * migration, a wrong DELETE, or the database itself being dropped.
 *
 * Auth: owner admin session / x-admin-key, OR the x-backup-key shared secret so
 * a scheduler (cron-job.org, GitHub Actions) can call it unattended.
 *
 * SECURITY — this endpoint reads customer PII. Two rules hold it in:
 *   1. It writes to BACKUPS, never IMAGES. IMAGES is publicly served, so a dump
 *      there would publish the entire customer table. BACKUPS has no public
 *      domain and must never be given one.
 *   2. Ephemeral auth tables are skipped entirely (below). They are worthless
 *      in a restore and would be the most damaging thing in a leaked dump.
 */
import { verifyAdminAccess, adminCorsHeaders } from '../_lib.js';

// Live sessions, OTPs and reset tokens restore to nothing useful — a user just
// signs in again — but in a stolen dump they are directly exploitable. Left out.
const SKIP_TABLES = new Set([
  'sessions', 'admin_sessions', 'login_otps', 'order_otps',
  'cod_verifications', 'password_resets', 'rate_limits', 'admin_login_attempts',
]);

const RETAIN = 30;        // keep the newest 30 snapshots
const STALE_HOURS = 26;   // a daily backup that hasn't landed in 26h is late

async function listTables(db) {
  const r = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf%' ORDER BY name"
  ).all();
  return (r.results || []).map((x) => x.name).filter((n) => !SKIP_TABLES.has(n));
}

export async function onRequest(context) {
  const { request, env } = context;
  const cors = adminCorsHeaders(request);
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json', ...cors },
  });

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  // Scheduler path: a single shared secret, compared in full (not short-circuit).
  const key = request.headers.get('x-backup-key') || '';
  let authed = false;
  if (env.BACKUP_KEY && key) {
    let diff = key.length ^ env.BACKUP_KEY.length;
    for (let i = 0; i < Math.max(key.length, env.BACKUP_KEY.length); i++) {
      diff |= (key.charCodeAt(i) || 0) ^ (env.BACKUP_KEY.charCodeAt(i) || 0);
    }
    authed = diff === 0;
  }
  if (!authed) {
    const auth = await verifyAdminAccess(request, env, cors, { requireOwner: true });
    if (auth.response) return auth.response;
  }

  if (!env.BACKUPS) return json({ error: 'BACKUPS bucket not bound' }, 501);
  if (!env.DB) return json({ error: 'DB not bound' }, 501);

  const listBackups = async () => {
    const listed = await env.BACKUPS.list({ prefix: 'db/', limit: 100 });
    return (listed.objects || [])
      .map((o) => ({ key: o.key, size: o.size, uploaded: o.uploaded }))
      .sort((a, b) => (a.key < b.key ? 1 : -1));
  };

  if (request.method === 'GET') {
    const backups = await listBackups();
    const last = backups[0] || null;
    const ageHours = last ? (Date.now() - new Date(last.uploaded).getTime()) / 3600000 : null;
    return json({
      success: true,
      count: backups.length,
      lastBackupAt: last ? last.uploaded : null,
      ageHours: ageHours == null ? null : Math.round(ageHours * 10) / 10,
      // Healthy = a backup exists and is younger than a day and a bit. The
      // watchdog reads this; so does the admin panel's status card.
      healthy: ageHours != null && ageHours < STALE_HOURS,
      staleAfterHours: STALE_HOURS,
      retain: RETAIN,
      backups,
    });
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Idempotent guard so a watchdog can call this on a tight schedule without
  // producing a backup per tick: with ?ifStale=N it only runs when the newest
  // snapshot is older than N hours, otherwise it reports and does nothing.
  const ifStaleRaw = new URL(request.url).searchParams.get('ifStale');
  if (ifStaleRaw !== null) {
    const threshold = Number(ifStaleRaw) || STALE_HOURS;
    const existing = await listBackups();
    const newest = existing[0] || null;
    const ageH = newest ? (Date.now() - new Date(newest.uploaded).getTime()) / 3600000 : Infinity;
    if (ageH < threshold) {
      return json({
        success: true, skipped: true, reason: 'recent backup exists',
        lastBackupAt: newest ? newest.uploaded : null,
        ageHours: Math.round(ageH * 10) / 10, thresholdHours: threshold,
      });
    }
  }

  const startedAt = new Date();
  const tables = await listTables(env.DB);
  const dump = {};
  const counts = {};
  for (const t of tables) {
    // Table names come from sqlite_master, never from user input, so they
    // cannot be bound as parameters and cannot be injected either.
    const r = await env.DB.prepare(`SELECT * FROM "${t}"`).all();
    dump[t] = r.results || [];
    counts[t] = dump[t].length;
  }

  const stamp = startedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const key2 = `db/backup-${stamp}.json`;
  const body = JSON.stringify({
    takenAt: startedAt.toISOString(),
    database: 'saubhagya-db',
    skipped: [...SKIP_TABLES],
    counts,
    tables: dump,
  });

  await env.BACKUPS.put(key2, body, {
    httpMetadata: { contentType: 'application/json', cacheControl: 'no-store' },
  });

  // Retention — drop the oldest beyond RETAIN so the bucket cannot grow forever.
  let pruned = 0;
  try {
    const all = await env.BACKUPS.list({ prefix: 'db/', limit: 1000 });
    const keys = (all.objects || []).map((o) => o.key).sort().reverse();
    for (const old of keys.slice(RETAIN)) { await env.BACKUPS.delete(old); pruned++; }
  } catch { /* retention must never fail the backup itself */ }

  return json({
    success: true,
    key: key2,
    bytes: body.length,
    tables: tables.length,
    rows: Object.values(counts).reduce((a, b) => a + b, 0),
    counts,
    pruned,
    tookMs: Date.now() - startedAt.getTime(),
  });
}
