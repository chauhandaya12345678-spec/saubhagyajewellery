-- ============================================================
--  Saubhagya — Customer-Centric Diagnostics
--  Answers: did the customer get notified? log in? OTP fail?
--  email sent? did ALL purchase notifications fire? do their
--  stored name/address match what they typed? is data in sync?
--
--  HOW TO RUN one query:
--    npx wrangler d1 execute saubhagya-db --remote --command "<paste query>"
--  OR paste into Cloudflare Dashboard > D1 > saubhagya-db > Console.
--  OR open a `wrangler d1 export` dump in DB Browser for SQLite.
--
--  SAFE: every query here is read-only (SELECT). Nothing here writes.
--  Replace :PHONE (10-digit) or :ORDER (CC-YYYYMMDD-XXXX) placeholders.
-- ============================================================


-- 0) FIRST TIME: confirm the real columns of the OTP tables
--    (they're created by migration, columns may differ from below)
-- .schema login_otps      -- run in wrangler:  --command ".schema login_otps"
-- .schema order_otps


-- ============================================================
-- A. LOGIN / OTP  — "did they log in, or fail because no OTP?"
-- ============================================================

-- A1. All OTP attempts for one phone, newest first
--     (col names: adjust to your login_otps schema from step 0 —
--      typically phone, otp/code, verified/used, created_at, expires_at)
SELECT * FROM login_otps
WHERE phone LIKE '%:PHONE%'
ORDER BY created_at DESC LIMIT 20;

-- A2. OTPs requested but NEVER verified in last 24h
--     = people stuck at login (got code but couldn't finish, or never got it)
SELECT phone, created_at
FROM login_otps
WHERE COALESCE(verified,0)=0
  AND created_at >= datetime('now','-1 day')
ORDER BY created_at DESC;

-- A3. Did this phone ever actually get a session (= truly logged in)?
SELECT s.id, s.user_id, s.email, s.name, s.created_at
FROM sessions s JOIN users u ON u.id=s.user_id
WHERE u.phone LIKE '%:PHONE%'
ORDER BY s.created_at DESC;

-- A4. Registered but zero sessions = account exists, never logged in
SELECT u.id, u.name, u.phone, u.email, u.created_at
FROM users u
LEFT JOIN sessions s ON s.user_id=u.id
WHERE s.id IS NULL
ORDER BY u.created_at DESC LIMIT 50;


-- ============================================================
-- B. PER-ORDER NOTIFICATION TRUTH  — "did every notification fire?"
-- ============================================================

-- B1. Full event timeline for ONE order (the #1 diagnostic view)
SELECT created_at, kind, ok, detail
FROM order_events
WHERE order_id = ':ORDER'
ORDER BY created_at ASC;

-- B2. One-row scorecard per order: which notifications fired?
--     1 = at least one success logged, 0 = never fired, -1 = only failures
SELECT
  o.id, o.name, o.phone, o.status, o.created_at,
  MAX(CASE WHEN e.kind='shiprocket_push' THEN e.ok END) AS shiprocket,
  MAX(CASE WHEN e.kind='email_sent'      THEN e.ok END) AS email,
  MAX(CASE WHEN e.kind='whatsapp_sent'   THEN e.ok END) AS whatsapp,
  COUNT(CASE WHEN e.kind LIKE 'whatsapp%' AND e.ok=0 THEN 1 END) AS wa_failures
FROM orders o
LEFT JOIN order_events e ON e.order_id=o.id
GROUP BY o.id
ORDER BY o.created_at DESC;

-- B3. Orders where a notification FAILED (needs owner attention)
SELECT o.id, o.name, o.phone, e.kind, e.detail, e.created_at
FROM order_events e JOIN orders o ON o.id=e.order_id
WHERE e.ok=0
ORDER BY e.created_at DESC;

-- B4. Orders that got NO email_sent event at all
--     (Resend key missing, or customer left email blank)
SELECT o.id, o.name, o.phone, o.email, o.created_at
FROM orders o
WHERE NOT EXISTS (
  SELECT 1 FROM order_events e
  WHERE e.order_id=o.id AND e.kind='email_sent' AND e.ok=1)
ORDER BY o.created_at DESC;

-- B5. Orders that got NO whatsapp confirmation
SELECT o.id, o.name, o.phone, o.status, o.created_at
FROM orders o
WHERE NOT EXISTS (
  SELECT 1 FROM order_events e
  WHERE e.order_id=o.id AND e.kind LIKE 'whatsapp%' AND e.ok=1)
ORDER BY o.created_at DESC;


-- ============================================================
-- C. DATA-MATCH / SYNC  — "do stored details match what they input?"
-- ============================================================

-- C1. Order vs saved address-book row: name/phone/pincode mismatch
--     (order.address is JSON; compare against addresses table by phone)
SELECT
  o.id,
  o.name                                   AS order_name,
  a.full_name                              AS book_name,
  o.phone                                  AS order_phone,
  a.phone                                  AS book_phone,
  json_extract(o.address,'$.pincode')      AS order_pin,
  a.pincode                                AS book_pin,
  json_extract(o.address,'$.city')         AS order_city,
  a.city                                   AS book_city
FROM orders o
LEFT JOIN addresses a ON a.phone = o.phone
WHERE lower(trim(COALESCE(o.name,'')))  <> lower(trim(COALESCE(a.full_name,'')))
   OR json_extract(o.address,'$.pincode') <> a.pincode;

-- C2. Order phone/email vs the users account it's linked to
SELECT o.id, o.name AS order_name, u.name AS acct_name,
       o.phone AS order_phone, u.phone AS acct_phone,
       o.email AS order_email, u.email AS acct_email
FROM orders o LEFT JOIN users u ON u.id=o.user_id
WHERE (o.user_id IS NOT NULL)
  AND ( lower(trim(COALESCE(o.email,''))) <> lower(trim(COALESCE(u.email,'')))
     OR o.phone <> u.phone );

-- C3. Orphan orders: has a user_id that no longer exists in users
SELECT o.id, o.user_id, o.name, o.phone
FROM orders o LEFT JOIN users u ON u.id=o.user_id
WHERE o.user_id IS NOT NULL AND u.id IS NULL;

-- C4. Duplicate customer identity: same phone under >1 user id
SELECT phone, COUNT(*) n, GROUP_CONCAT(id) ids, GROUP_CONCAT(name) names
FROM users WHERE phone IS NOT NULL
GROUP BY phone HAVING n>1;

-- C5. Address captured but no pincode/state = shipping will guess/fallback
SELECT id, full_name, phone, address1, city, state, pincode, created_at
FROM addresses
WHERE pincode IS NULL OR pincode='' OR state IS NULL OR state='';


-- ============================================================
-- D. ONE-CUSTOMER 360°  — everything about one phone in one look
-- ============================================================

-- D1. Account
SELECT 'account' section, id, name, email, phone, created_at
FROM users WHERE phone LIKE '%:PHONE%';

-- D2. Their orders + notification scorecard
SELECT o.id, o.status, o.total/100.0 AS rupees, o.created_at,
  MAX(CASE WHEN e.kind='whatsapp_sent' THEN e.ok END) AS wa,
  MAX(CASE WHEN e.kind='email_sent'    THEN e.ok END) AS email
FROM orders o LEFT JOIN order_events e ON e.order_id=o.id
WHERE o.phone LIKE '%:PHONE%'
GROUP BY o.id ORDER BY o.created_at DESC;

-- D3. Their saved addresses
SELECT id, full_name, address1, city, state, pincode, usage_count, last_used_at
FROM addresses WHERE phone LIKE '%:PHONE%';
