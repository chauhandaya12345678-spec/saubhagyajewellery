# Saubhagya — Magic Checkout + SMS OTP Sign In

---

## Feature 1: Twilio OTP Sign In

### How It Works

```
signin.html → User enters phone number → "SEND OTP"
         │
         ▼
POST /api/auth/send-otp (Naya endpoint)
  → Twilio Verify API → SMS with 6-digit OTP to user's phone
  → Response: { success: true }
         │
         ▼
signin.html → OTP input field shows → User enters 6-digit code
         │
         ▼
POST /api/auth/verify-otp (Naya endpoint)
  → Twilio Verify API → Check OTP
  → Response: { success: true, user: {...}, session_token: "..." }
         │
         ▼
User logged in → redirect to account page
```

### New Files Needed (2)

| File | Purpose |
|------|---------|
| `functions/api/auth/send-otp.js` | POST - phone number accept → Twilio Verify sends SMS |
| `functions/api/auth/verify-otp.js` | POST - OTP verify → login/create account → return session |

### File to Edit (1)

| File | Change |
|------|--------|
| `signin.html` | Add phone input + "Send OTP" button + OTP input fields + toggle between email/password and phone/OTP modes |

### D1 Table Needed

Already have `users` table with `phone` column. No new table needed — Twilio Verify handles OTP state server-side.

### Twilio Credentials (Cloudflare Env Vars)

```
TWILIO_ACCOUNT_SID     = (set in Cloudflare env vars — do not commit real value)
TWILIO_AUTH_TOKEN      = (set in Cloudflare env vars — do not commit real value)
TWILIO_VERIFY_SID      = (set in Cloudflare env vars — do not commit real value)
```

### UI Design

```
┌──────────────────────────────┐
│       Sign in to Saubhagya    │
│                              │
│  Mobile Number               │
│  +91 [  99870 08435   ]      │
│                              │
│  [  SEND OTP  ]              │
│                              │
│  6-digit code                │
│  [  _  _  _  |  _  _  _  ]  │
│                              │
│  [  VERIFY & LOGIN  ]        │
│                              │
│  ───── or ─────              │
│  Sign in with email/password │
└──────────────────────────────┘
```

### User Scenarios

| Scenario | What Happens |
|----------|--------------|
| Returning user (same phone) | OTP verify → login with existing account |
| New user (first time) | OTP verify → auto-create account with phone |
| Wrong OTP | Twilio returns error → show "Wrong code. Try again." |
| Expired OTP | Twilio auto-expires after 10 min → show "OTP expired, request new" |

---

## Feature 2: Magic Checkout

### How It Works

```
Current: checkout.html on my site → Razorpay popup → save order
New:     checkout.html → redirect to checkout.razorpay.com → payment → redirect back to my site
```

### Flow

```
User clicks "PLACE ORDER"
         │
         ▼
Browser → POST /api/magic-checkout/create-session (Naya endpoint)
  → Creates Razorpay Magic Checkout Session
  → Returns session_url
         │
         ▼
Browser redirects to: https://checkout.razorpay.com/...
  (Razorpay hosted page — address, payment all there)
         │
         ▼
User enters address → pays → done
         │
         ▼
Razorpay redirects back to: saubhagyajewellery.com/success?order_id=XXX
         │
         ▼
Webhook: Razorpay → POST /api/razorpay/webhook
  → Order saved to D1 → Push to Shiprocket → Send email
```

### When to Switch

Custom checkout tab tak istemal karo jab tak Magic Checkout pe puri testing complete na ho jaye. Dono ek saath rakh sakte ho — ek switch/toggle se.

### New Files Needed (1)

| File | Purpose |
|------|---------|
| `functions/api/magic-checkout/create-session.js` | POST - creates Razorpay checkout session |

### Files to Edit (2)

| File | Change |
|------|--------|
| `checkout.html` | Add Razorpay Magic Checkout SDK, redirect to session URL instead of current Razorpay popup flow |
| `success.html` | Handle redirect from Magic Checkout |
| `functions/api/orders/save.js` | (Maybe) Add support for Magic Checkout order flow |

### Magic Checkout Integration Steps

| Step | Detail |
|------|--------|
| 1 | Enable Magic Checkout in Razorpay Dashboard |
| 2 | Set up webhook URL in Razorpay Dashboard → Settings → Webhooks → Add: `https://saubhagyajewellery.com/api/razorpay/webhook` |
| 3 | Create session endpoint — generates checkout link |
| 4 | Update checkout.html to redirect user to Magic Checkout |
| 5 | Test payment flow end-to-end |

---

## Implementation Order

| Order | Feature | Time |
|-------|---------|------|
| 1 | Twilio OTP Sign In | ~1 hour |
| 2 | Magic Checkout | ~1-2 hours |
| 3 | Test both end-to-end | ~30 min |

---

## Credentials Summary (For Cloudflare Env Vars)

### Twilio (For OTP)

```
TWILIO_ACCOUNT_SID = (set in Cloudflare env vars — do not commit real value)
TWILIO_AUTH_TOKEN  = (set in Cloudflare env vars — do not commit real value)
TWILIO_VERIFY_SID  = (set in Cloudflare env vars — do not commit real value)
```

### Razorpay (Already Set)

```
RAZORPAY_KEY_ID (live)         = rzp_live_T6EhbHB5QhrM5W
RAZORPAY_KEY_SECRET (live)     = (in CF env vars)
RAZORPAY_WEBHOOK_SECRET (live) = (in CF env vars)
```
