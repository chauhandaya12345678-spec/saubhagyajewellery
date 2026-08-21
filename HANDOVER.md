# Saubhagya Jewellery — Handover Guide

**Domain:** saubhagyajewellery.com  
**Owner:** Daya  
**Last Updated:** July 2026  

This document explains everything you need to take over this site — whether you keep the current setup or migrate to Shopify/another platform.

---

## Table of Contents

0. [DATA OWNERSHIP — READ FIRST](#0-data-ownership--read-this-first)
1. [Business Overview](#1-business-overview)
2. [Current Architecture](#2-current-architecture)
3. [Services & Logins](#3-services--logins)
4. [Code Structure](#4-code-structure)
5. [Daily Operations](#5-daily-operations)
6. [Deployment Process](#6-deployment-process)
7. [Payment Flow (End-to-End)](#7-payment-flow-end-to-end)
8. [Environment Secrets](#8-environment-secrets)
9. [Migration Path to Shopify](#9-migration-path-to-shopify)
10. [Contacts & Support](#10-contacts--support)

---

## 0. DATA OWNERSHIP — READ THIS FIRST

**The D1 database is the single source of truth for all live product data.** Everything else (scripts, JSON files) is tooling around it.

- **All business data lives in Cloudflare D1** (`saubhagya-db`): products, orders, users, addresses, sessions, reviews, order events. Standard SQLite. You own it; export it any time:
  ```bash
  # FULL database backup (everything):
  npx wrangler d1 export saubhagya-db --remote --output=backup.sql
  # Products as JSON:
  npx wrangler d1 execute saubhagya-db --remote --json     --command "SELECT * FROM products" > products.json
  ```
  A ready Shopify-importable CSV generator produced `build/export/products-shopify.csv` — regenerate with the same SELECT + the column mapping in that file.

- **`build/migrate-d1.py` is OPTIONAL — a bulk-onboarding convenience, not a dependency.** It exists only to (a) type 15 similar rows once instead of by hand, (b) compute sell price from cost (cost + ₹90 courier + ₹25 packaging + 3% GST + 2.36% gateway + margin, rounded to ₹5; MRP = ceil(price/0.75) to ₹10), (c) regenerate the localhost fallback JSON. **Its generated seed NEVER overwrites existing D1 rows** (`ON CONFLICT` updates only the internal `variants` colour-switcher JSON). You can ignore the script entirely and add products with plain SQL — see §5.

- **Zero-deploy edits:** any direct D1 UPDATE (admin panel at `/admin.html?tab=inventory`, an agent, or wrangler) is live on the website within ~1-5 minutes (API cache). No git push needed. Reseeds/deploys will never revert those edits.

- **Images** are plain WebP files in `images/products/` (filename = SKU). No proprietary storage.

---

## 1. Business Overview

Saubhagya is a designer imitation jewellery brand based in Mumbai. We sell online across India.

| Detail | Value |
|--------|-------|
| Product Categories | Necklace (short + crystal), Earring (incl. jhumka); Bridal Set & Pendant reserved |
| Product Count | 44 SKUs (live in D1 — always check there, not this doc) |
| Price Range | ₹225 - ₹549 (all-inclusive: free shipping, GST included) |
| Average Order | ₹800-2,000 |
| Current Volume | Launch phase (0-50 orders/day expected) |
| Shipping | Pan-India, free insured delivery |
| Phone | +91 99870 08435 |
| Email | care@saubhagyajewellery.com |

---

## 2. Current Architecture

```
CUSTOMER BROWSER
       │
       ▼
┌──────────────────────────────────────────┐
│         Cloudflare Pages (Hosting)        │
│  ┌─────────────────────────────────────┐  │
│  │  Static HTML/CSS/JS (20+ pages)    │  │
│  │  • Home, Collections, PDP, Cart    │  │
│  │  • Checkout, Auth, Track Orders    │  │
│  │  • SEO Pages, Blog, Trust, Policy  │  │
│  └─────────────────────────────────────┘  │
│  ┌─────────────────────────────────────┐  │
│  │  Cloudflare Functions (Backend API) │  │
│  │  • /api/auth/signin, /signup       │  │
│  │  • /api/orders/create-razorpay     │  │
│  │  • /api/orders/save                │  │
│  │  • /api/orders/track               │  │
│  │  • /api/razorpay/webhook           │  │
│  │  • /api/products, /wishlist        │  │
│  └─────────────────────────────────────┘  │
│  ┌─────────────────────────────────────┐  │
│  │  D1 Database (SQLite)              │  │
│  │  • products (catalog)              │  │
│  │  • users (accounts)                │  │
│  │  • orders (purchases)              │  │
│  │  • sessions (auth tokens)          │  │
│  └─────────────────────────────────────┘  │
│  ┌─────────────────────────────────────┐  │
│  │  R2 Bucket (Product Images)       │  │
│  └─────────────────────────────────────┘  │
└──────────────────────────────────────────┘
       │
       ├──→ Razorpay (Payment Gateway)
       │     • Standard Checkout (popup)
       │     • Webhook → /api/razorpay/webhook
       │
       ├──→ ShipPrime (Shipping + Tracking)
       │     • API push on order save
       │     • Status webhook → /api/webhooks/shipprime
       │     • WhatsApp status templates to customer
       │
       └──→ Resend (Transactional Email)
             • Order confirmation
             • Welcome emails
```

---

## 3. Services & Logins

### 3.1 Cloudflare (Primary — Everything Lives Here)

| What | Where |
|------|-------|
| Dashboard | https://dash.cloudflare.com |
| Pages Project | saubhagyajewellery |
| D1 Database | saubhagya-db |
| R2 Bucket | saubhagya-images |
| Domain DNS | saubhagyajewellery.com |
| Email Routing | care@ → Gmail |

**How to get access:** Daya adds you as a member (Dashboard → Members → Invite)

### 3.2 GitHub (Code)

| What | Where |
|------|-------|
| Repo | github.com/chauhandaya12345678-spec/saubhagyajewellery |
| Branch | main |
| Auto-deploy | Yes — every push deploys via Cloudflare Pages |

**How to get access:** Daya adds you as a collaborator (Settings → Collaborators)

### 3.3 Razorpay (Payments)

| What | Where |
|------|-------|
| Dashboard | https://dashboard.razorpay.com |
| Key ID (public) | `rzp_live_T6EhbHB5QhrM5W` |
| Key Secret | In Cloudflare env vars (NOT in code) |
| Webhook Secret | In Cloudflare env vars |
| Webhook URL | https://saubhagyajewellery.com/api/razorpay/webhook |
| Events | payment.captured |

**How to get access:** Daya adds you as team member (Settings → Team → Add Member)

### 3.4 ShipPrime (Shipping)

| What | Where |
|------|-------|
| Credentials | In Cloudflare env vars (SHIPPRIME_*) |
| Push | Automatic on paid order (functions/api/_lib.js) |
| Status webhook | /api/webhooks/shipprime (Bearer secret) |
| Retry cron | /api/orders/retry-shipprime (x-admin-key, external cron) |

### 3.4b WhatsApp Business (Customer Notifications)

| What | Where |
|------|-------|
| Sender | Meta WhatsApp Business API (WHATSAPP_PHONE_ID / WHATSAPP_TOKEN env) |
| Templates | confirm_order, order_shipped, order_out_for_delivery, order_delivered, order_cancelled_update (3 body vars: name, order id, track link + image header) |
| Guard | UAT never sends (UAT_MODE env) |

### 3.4c Firebase (Phone OTP Sign-in)

| What | Where |
|------|-------|
| Project | saubhagya-jewellery (console.firebase.google.com) |
| Used by | signin.html (phone OTP) + /api/auth/firebase-verify |
| Key | FIREBASE_API_KEY env (referrer-restricted) |

### 3.5 Resend (Email)

| What | Where |
|------|-------|
| Dashboard | https://resend.com |
| API Key | In Cloudflare env vars |
| Sender | care@saubhagyajewellery.com |
| BCC | care@saubhagyajewellery.com |

**Note:** Fails silently — if RESEND_API_KEY is unset, emails just don't send. Orders still process fine.

---

## 4. Code Structure

```
saubhagyajewellery/
├── index.html              Home page (SPA: search, cart, checkout)
├── layout.js               ⚡ HEADER/FOOTER injected on all pages
│                           Edit this for: nav links, brand logo,
│                           header CSS, footer content
├── mpa.js                  Shopping cart, auth state, multi-page glue
├── catalog.js              Loads catalog from D1 API (fallback: build/complete-catalog.json)
├── site.css                Global styles (static pages)
│
├── product.html            Product detail page
├── checkout.html           3-step checkout (email→address→payment)
├── cart.html               Full cart page
├── signin.html             Login page
├── signup.html             Registration page
├── account.html            User account dashboard
├── success.html            Order confirmation page
├── track-orders.html       Order tracking (phone/email lookup)
│
├── south-indian-traditional.html   Collection page (SEO)
├── mumbai-modern.html              Collection page (SEO)
├── north-indian-bridal.html        Collection page (SEO)
├── about.html              Brand story
├── contact.html            Store contact + map
├── blogs.html              Blog listing
│
├── 404.html, trust.html, es-policy.html,
│   grievances.html, terms.html, offer-terms.html,
│   privacy-policy.html, shipping-and-returns.html
│   → Policy & legal pages
│
├── sitemap.xml             Search engine sitemap
├── robots.txt              Crawler rules
├── _headers                Cloudflare cache rules
├── _redirects              URL redirects
├── _routes.json            Function route mapping
├── wrangler.toml            Cloudflare config (D1, R2 bindings)
├── package.json            Node build config
│
├── functions/api/           🔑 BACKEND API (Cloudflare Workers)
│   ├── _lib.js             Shared helpers (hash, email, ShipPrime, WhatsApp)
│   ├── auth/signin.js      POST - email+password login
│   ├── auth/signup.js      POST - create account
│   ├── orders/create-razorpay-order.js  POST - create Razorpay order
│   ├── orders/save.js      POST - save order after payment
│   ├── orders/track.js     GET - lookup order by email/phone/order_id
│   ├── products.js         GET - fetch product catalog from D1
│   ├── razorpay/webhook.js POST - payment.captured backstop
│   ├── reviews.js          Product reviews CRUD
│   └── wishlist.js         Wishlist CRUD
│
├── images/                 All WebP q95
│   ├── products/           Product photos, filename = SKU
│   ├── models/             Model shots for hero/category tiles
│   ├── banners/            Hero banner art
│   └── brand/              Logos
│
└── build/                  Catalog tooling (OPTIONAL — see §0)
    ├── migrate-d1.py       Bulk product onboarding + price calculator.
    │                       Generates seed-d1.sql + complete-catalog.json.
    │                       NEVER overwrites existing D1 rows on reseed.
    ├── seed-d1.sql         Generated seed (new-SKU inserts only)
    ├── complete-catalog.json  Localhost/API-down fallback for catalog.js
    ├── schema-d1.sql       Product table schema
    ├── schema-auth-orders.sql  Users + Orders + Sessions tables
    └── export/             Ready data exports (full-backup.sql,
                            products-shopify.csv)
```

---

## 5. Daily Operations

### Add/Edit Product Price
```
1. D1 database → products table → UPDATE price
2. No deploy needed (instant, zero-deploy via D1 API).
   All pages read prices live from D1 — nothing else to update.
```

### Add New Product (NO script required)
```
1. Convert photo to WebP q95, name it <SKU>.webp, drop in images/products/,
   git push (images deploy with the site).
   SKU format: SJ-<TYPE><NN>-<COLOR>  e.g. SJ-SN06-GL
   Colours: GL Gold, GR Green, WH White, MR Maroon, MH Mehndi
2. Insert the row (zero-deploy, live in ~1 min):
   npx wrangler d1 execute saubhagya-db --remote --command "
   INSERT INTO products (sku,name,region,regionLabel,category,price,mrp,city,
     badge,image,altImage,inStock,stock_count,weightGrams)
   VALUES ('SJ-SN06-GL','New Necklace','modern','Mumbai Modern','Necklace',
     549,740,'Mumbai','','images/products/SJ-SN06-GL.webp','',1,12,NULL)"
3. Multi-colour design? Also set the variants JSON on each sibling row:
   [{"sku":"...-GL","label":"Gold","image":"images/products/...-GL.webp"}, ...]
4. Sitemap, Google Shopping feed, SEO meta all update automatically from D1.

(For BULK batches, build/migrate-d1.py does steps 2-3 for you — optional.)
```

### Process Orders (Daily)
```
1. Open ShipPrime dashboard → New Orders tab
2. Pack item → Generate AWB (auto-assigns courier)
3. Print label → Stick on package → Hand to pickup agent
4. Customer gets auto SMS/WhatsApp/email with tracking link
5. Check Razorpay dashboard → Settlements tab (funds landing)
```

### Handle Return/Refund
```
1. Customer contacts via WhatsApp (+91 99870 08435) or email
2. Razorpay dashboard → Transactions → find payment → Refund
3. ShipPrime → Reverse Pickup (if item returning)
```

---

## 6. Deployment Process

### Current: Cloudflare Pages Auto-Deploy
```
Edit files locally → git add → git commit → git push
          ↓
Cloudflare auto-detects push → runs `npm run build`
          ↓
Deploys to global CDN (~30 seconds)
          ↓
Live at saubhagyajewellery.com
```

**Build command:** none — static files + Pages Functions deploy as-is.  
**Output directory:** `/` (repo root)

### Deploy manually (without git push)
```bash
npx wrangler pages deploy . --project-name saubhagyajewellery --branch main
```

### Preview before going live
```bash
# Run local server
npx serve -p 5000

# Or use Python
python -m http.server 5000

# Open http://localhost:5000 in browser
```

---

## 7. Payment Flow (End-to-End)

```
1. Customer browses → adds to cart (localStorage)
2. Customer clicks "Checkout" → fills email, address, phone
3. Customer clicks "PAY NOW"
4. Browser calls POST /api/orders/create-razorpay-order
   → Razorpay creates order → returns order_id
5. Razorpay checkout popup opens (customer enters card/UPI)
6. Payment succeeds → Razorpay calls browser callback
7. Browser calls POST /api/orders/save
   → Saves order to D1 → Pushes to ShipPrime → WhatsApp + email confirm
8. Customer sees success page with order ID

BACKSTOP: If browser fails (tab closed, network drop):
  Razorpay webhook → POST /api/razorpay/webhook
  → Verifies signature → Saves order → Pushes ShipPrime → notifies
```

---

## 8. Environment Secrets

All sensitive values are stored in **Cloudflare Dashboard → Pages → saubhagyajewellery → Settings → Environment Variables**. None are in the codebase.

| Variable | Used By | Description |
|----------|---------|-------------|
| `RAZORPAY_KEY_ID` | Checkout page | Public key (also in code: rzp_live_T6EhbHB5QhrM5W) |
| `RAZORPAY_KEY_SECRET` | Orders API | Secret key for payment verification |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook | Verifies webhook came from Razorpay |
| `SHIPPRIME_TOKEN` | Orders API | ShipPrime API token |
| `SHIPPRIME_PICKUP_*` | Orders API | Pickup name/phone/address/city/state/pin |
| `SHIPPRIME_WEBHOOK_SECRET` | Status webhook | Verifies webhook came from ShipPrime |
| `WHATSAPP_PHONE_ID` / `WHATSAPP_TOKEN` | Notifications | Meta WhatsApp Business API |
| `FIREBASE_API_KEY` | Sign-in | Phone OTP verify |
| `ADMIN_KEY` | Retry cron | x-admin-key header for /api/orders/retry-shipprime |
| `UAT_MODE` | UAT only | 'true' on UAT = no real ShipPrime/WhatsApp/email |
| `RESEND_API_KEY` | Email | Resend API key for transactional emails |
| `ORDER_EMAIL_FROM` | Email | Sender address for order emails |
| `ORDER_EMAIL_BCC` | Email | BCC copy for store records |
| `DB` | All Functions | D1 database binding (auto-set by Cloudflare) |
| `IMAGES` | All Functions | R2 bucket binding (auto-set by Cloudflare) |

**To view/update secrets:** Cloudflare Dashboard → Workers & Pages → saubhagyajewellery → Settings → Variables

---

## 9. Migration Path to Shopify

If you decide to move to Shopify, here's what you need to migrate:

### What Migrates
| Item | How |
|------|-----|
| Products (44 SKUs) | Ready file: build/export/products-shopify.csv (regenerate any time — see §0) |
| Product Images | Already on R2, re-upload or use URLs |
| Domain | Point DNS to Shopify |
| Customer List | Export D1 users table → CSV → Import |
| Order History | Export D1 orders table (for records) |
| SEO Pages | Rebuild as Shopify pages/collections |
| Content (About, Contact, Policies) | Copy-paste to Shopify pages |
| Reviews | Re-collect via Judge.me or similar app |

### What Gets Replaced
| Current | Shopify Alternative |
|---------|---------------------|
| Custom HTML pages | Shopify theme (Dawn free, or custom) |
| D1 Database | Shopify admin (built-in) |
| Custom auth (D1) | Shopify customer accounts (built-in) |
| Razorpay | Shopify Payments India (Razorpay integrated) |
| ShipPrime | Shopify Shipping or courier app |
| Resend | Shopify Email (built-in) |
| Custom checkout | Shopify Checkout (optimized, secure) |
| Custom cart | Shopify Cart (built-in) |

### What Stays Independent
| Service | Notes |
|---------|-------|
| Razorpay | Can still use separately if needed |
| ShipPrime | Reconnect via Shopify app or keep API |
| WhatsApp | Business number, independent |
| Google Search Console | Re-submit Shopify sitemap |
| Google Analytics | Re-add tracking code |

### Migration Time Estimate
- Product import: 2-4 hours
- Theme setup: 1-3 days
- Content transfer: 1 day
- DNS switch: 30 minutes
- Testing: 1-2 days
- **Total: ~1 week**

---

## 10. Contacts & Support

| Role | Contact |
|------|---------|
| Owner (Daya) | WhatsApp: +91 99870 08435 |
| Customer Support | care@saubhagyajewellery.com |
| Store Address | Mumbai, Maharashtra |
| GSTIN | 27BKBPC3154K1ZC (HSN 7117 @ 3%, inclusive) -- edit in Admin -> Tax Settings |

### Quick Reference: "How Do I..."

| Task | Where |
|------|-------|
| Change a price | D1 database → UPDATE products SET price=... WHERE sku='...' |
| Add product photo | WebP q95 → images/products/<SKU>.webp → git push → update D1 image path |
| See if payment received | Razorpay dashboard → Transactions |
| Ship an order | ShipPrime dashboard → New Orders → Generate AWB |
| Check order status | ShipPrime dashboard → Orders → Search by order ID |
| Send marketing email | Resend dashboard (or setup Mailchimp later) |
| Check website traffic | Cloudflare Web Analytics (free, enable in dashboard) |
| Fix a broken page | Check Cloudflare Pages → Deployments → see build log |
| Renew domain | Cloudflare → Domain Registration → saubhagyajewellery.com |
| Change header/nav links | Edit layout.js → git push |
| Add new collection | Create new HTML (copy existing collection) → add to layout.js nav → git push |
| Change brand logo | Replace images/brand/saubhagya-logo.svg → git push |
| Add discount code | Edit checkout.html discount logic (or use Razorpay dashboard) |
| Process return/refund | Razorpay → Refund + ShipPrime → Reverse Pickup |

---

**End of Handover Guide. For questions, contact Daya.**
