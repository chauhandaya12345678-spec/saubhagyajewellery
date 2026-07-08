# Payments + Shipping + Tracking — One-Time Setup

Use when you go live. Current state = placeholder keys, test mode.

---

## 1. Get the prerequisites

| Thing | Where | Time |
|---|---|---|
| Domain live with HTTPS | Cloudflare Pages (free) or any host | 1 day |
| GST registration | gst.gov.in (Composition or Regular) | 5–10 days |
| PAN, Aadhaar, bank account | Already have | — |
| Razorpay account | razorpay.com → Sign up | 10 min |
| Shiprocket account | shiprocket.in → Sign up | 10 min |

Magic Checkout requires GST. Without GST you can still use Standard Razorpay Checkout (no 1-click flow, but works the same).

---

## 2. Razorpay setup

1. Sign up → Submit KYC (PAN, GST, bank, Aadhaar). Approval = 2–5 days.
2. Dashboard → Settings → Configuration → enable **Magic Checkout** (one toggle, free).
3. Dashboard → Account & Settings → API Keys → **Generate Test Key** (for testing) and **Generate Live Key** (after KYC approved).
4. Copy `key_id` (starts with `rzp_test_` or `rzp_live_`). Keep `key_secret` in Cloudflare Worker secrets, NEVER in this repo.
5. Settings → Webhooks → add webhook URL (Shiprocket integration handles this automatically once connected, skip manual setup).

---

## 3. Shiprocket setup

1. Sign up → KYC (PAN, GST, bank, pickup address).
2. Settings → Pickup Address → add yours.
3. ~~Marketplace / Channels → Razorpay channel~~ **Correction (July 2026):** the Shiprocket Razorpay channel only imports *Magic Checkout* orders; with standard Razorpay Checkout it stays "Never Synced" forever. This site instead pushes every paid order to Shiprocket server-side (`functions/api/_lib.js → pushToShiprocket`, called from `/api/orders/save` and the Razorpay webhook). Requires Cloudflare Pages secrets: `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD` (API user from Settings → API → Configure User), `SHIPROCKET_PICKUP_LOCATION` (= pickup nickname, currently `work`).
4. Settings → Courier → enable couriers (Delhivery, Bluedart, India Post for COD reach).
5. Settings → Courier Rules → set priority: **Cheapest** (or Fastest for premium).
6. Settings → Automation → enable **Auto-Pickup** (optional, removes the weekly click).
7. Settings → Notifications → confirm WhatsApp + Email templates ON (default ON).
8. Settings → Tracking Page → branded URL → copy base URL (looks like `https://saubhagya.shiprocket.co/tracking/`). Paste into `shiprocketTrackBase` in `index.html`.

---

## 4. Code swap — index.html (top of file)

Find `window.CC_PAYMENTS` block near the top. Replace placeholders:

```js
window.CC_PAYMENTS = {
  razorpayKeyId: 'rzp_live_XXXXXXXXXXXXXX',        // paste Live Key ID from Razorpay
  createOrderUrl: 'https://api.yourdomain.com/orders',  // your Cloudflare Worker URL (see step 5)
  shiprocketTrackBase: 'https://saubhagya.shiprocket.co/tracking/',
  useMagicCheckout: true                            // flip to true once Magic toggled in Razorpay
};
```

Push to Cloudflare. Done.

---

## 5. Cloudflare Worker — backend for signed order IDs (free tier)

Magic Checkout needs an `order_id` created server-side with `key_secret`. Don't put `key_secret` in client code.

Free Cloudflare Worker, ~30 lines:

```js
// worker.js — deploy to Cloudflare Workers (free 100k req/day)
export default {
  async fetch(req, env) {
    if (req.method !== 'POST') return new Response('POST only', { status: 405 });
    const { amount, currency, cart } = await req.json();
    const auth = btoa(env.RZP_KEY_ID + ':' + env.RZP_KEY_SECRET);
    const r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, currency: currency || 'INR', notes: { cart: JSON.stringify(cart) } })
    });
    const data = await r.json();
    return new Response(JSON.stringify({ id: data.id, amount: data.amount, currency: data.currency }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
};
```

Deploy:
1. `npm i -g wrangler`
2. `wrangler login`
3. Save above as `worker.js`. Add `wrangler.toml` (one minute, copy from Cloudflare docs).
4. `wrangler secret put RZP_KEY_ID` → paste live key id
5. `wrangler secret put RZP_KEY_SECRET` → paste live key secret
6. `wrangler deploy` → gives you a URL like `https://cc-pay.YOURACCT.workers.dev`
7. Paste URL into `createOrderUrl` in index.html.

Skip this section if not using Magic Checkout. Standard Razorpay Checkout works without it (just leave `createOrderUrl: null`).

---

## 6. track-orders.html

Replace static info with a tiny form:

```html
<input id="awb" placeholder="Enter AWB or order ID">
<button onclick="location.href = window.CC_PAYMENTS.shiprocketTrackBase + document.getElementById('awb').value">
  Track
</button>
```

Or just link to your Shiprocket tracking dashboard. Customers also get email + WhatsApp link automatically, so this page is rarely visited.

---

## 7. Auth page (signin/signup)

Delete. Magic Checkout handles login via phone OTP inside the payment popup. No accounts needed on the site.

If you want returning-customer love letters later, add Mailchimp / Sendinblue email capture in footer. Free for <500 subscribers. Skip for now.

---

## 8. Test before live launch

In test mode (`rzp_test_` key):

- Add items → Checkout → enter dummy email/address → PAY NOW
- Razorpay popup opens → use test card `4111 1111 1111 1111`, any future expiry, any CVV, OTP `123456`
- Success → order confirmation page should show
- Check Razorpay dashboard → Test Payments → see the test transaction
- Check Shiprocket → should auto-receive the order (once connection done)

When live = swap to `rzp_live_` key. Same flow with real money.

---

## 9. Weekly checklist after live

1. Open Shiprocket → New Orders tab → confirm count = Razorpay paid orders. (Skip if Auto-Pickup ON.)
2. Click **Generate Pickup**. Submit.
3. Pack boxes. Stick printed AWB labels (Shiprocket prints them). Hand to courier when arrives.
4. Razorpay → eyeball settlements landed in bank (T+2 auto).

20 min/week for 50 orders. Zero code work after this setup.

---

## 10. Things you DON'T need

- No user accounts table
- No address book code
- No SMS gateway (Shiprocket sends WhatsApp + email)
- No order status polling page (Shiprocket handles)
- No invoice generation code (Shiprocket auto-generates GST invoices)
- No refund code (Razorpay dashboard 1-click)
- No reverse-pickup code (Shiprocket dashboard 1-click)

---

## 11. Costs

| Item | Cost |
|---|---|
| Razorpay | 2% per transaction (UPI cheaper, ~0.4%). Zero monthly. |
| Shiprocket | ~₹35–50 per shipment depending on weight + zone. Zero monthly on Lite plan. |
| Cloudflare Pages + Workers | Free (100k Worker requests/day) |
| Domain | ~₹800/year |
| Email + WhatsApp notifications | Included in Shiprocket |
| GST filing | CA fees ~₹500–1500/month or self-file free on gst.gov.in |

No subscription. Pay only on sale.

---

## 12. Future upgrades (when sales grow)

- **Loyalty / repeat customer**: Add Magic Checkout's built-in saved-address recognition (already free, just enable in dashboard).
- **Abandoned cart recovery**: Razorpay Magic has it free. Toggle in dashboard.
- **WhatsApp marketing**: AiSensy or Wati. ~₹999/month.
- **Reviews**: Judge.me free tier.
- **Analytics**: Cloudflare Web Analytics — free, no cookie banner needed.
