/**
 * Web Push (VAPID) helpers.
 *
 * Deliberately sends push messages with NO encrypted payload. The Web Push
 * encryption scheme (aes128gcm: ECDH against the subscription key, HKDF, then
 * AES-GCM per recipient) is a lot of hand-rolled crypto to get subtly wrong,
 * and a mistake there fails silently per-subscriber. A payload-less push is
 * fully spec-compliant: the browser wakes the service worker, which then GETs
 * /api/push/latest and shows what it finds.
 *
 * That also means the notification text can be corrected or localised after the
 * push has already been sent, and no customer data ever transits the push
 * service — Google/Mozilla/Apple only ever see "something happened".
 */

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const b64uToBytes = (s) => {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

/** Import the VAPID private scalar (JWK "d") as an ES256 signing key. */
async function importVapidKey(privateD, publicKeyB64u) {
  const raw = b64uToBytes(publicKeyB64u);   // 0x04 || X(32) || Y(32)
  const x = b64u(raw.slice(1, 33));
  const y = b64u(raw.slice(33, 65));
  return crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: privateD, x, y, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

/**
 * Build the `Authorization: vapid ...` header for one push endpoint.
 * The JWT audience is the ORIGIN of the push service, not the full URL —
 * getting that wrong is the usual cause of a blanket 401 from FCM.
 */
export async function vapidHeader(env, endpoint) {
  const aud = new URL(endpoint).origin;
  const header = b64u(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64u(new TextEncoder().encode(JSON.stringify({
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.VAPID_SUBJECT || 'mailto:care@saubhagyajewellery.com',
  })));
  const unsigned = `${header}.${payload}`;
  const key = await importVapidKey(env.VAPID_PRIVATE_KEY, env.VAPID_PUBLIC_KEY);
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsigned)
  );
  // Web Crypto already returns the raw r||s pair ES256 wants — no DER unwrap.
  return `vapid t=${unsigned}.${b64u(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
}

/**
 * Deliver one payload-less push. Returns { ok, status, gone } where `gone`
 * marks a subscription the push service has permanently rejected (404/410),
 * which the caller should delete rather than retry forever.
 */
export async function sendPush(env, sub, ttlSeconds = 86400) {
  let res;
  try {
    res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidHeader(env, sub.endpoint),
        TTL: String(ttlSeconds),
        // No body, so the content encoding header must be absent, and
        // Content-Length must be 0 for FCM to accept it.
        'Content-Length': '0',
      },
    });
  } catch (e) {
    return { ok: false, status: 0, gone: false, error: String((e && e.message) || e) };
  }
  return {
    ok: res.status >= 200 && res.status < 300,
    status: res.status,
    gone: res.status === 404 || res.status === 410,
  };
}
