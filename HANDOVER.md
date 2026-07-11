# Saubhagya Jewellery — Handover Guide

**Domain:** saubhagyajewellery.com  
**Owner:** Daya  
**Last Updated:** July 2026  

This document explains everything you need to take over this site — whether you keep the current setup or migrate to Shopify/another platform.

---

## Table of Contents

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

## 1. Business Overview

Saubhagya is a designer imitation jewellery brand based in Mumbai. We sell online across India.

| Detail | Value |
|--------|-------|
| Product Categories | South Indian Traditional, Mumbai Modern (AD), North Indian Bridal |
| Product Count | ~150 SKUs |
| Price Range | ₹100 - ₹10,000 |
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
       ├──→ Shiprocket (Shipping + Tracking)
       │     • API: Create ad-hoc orders
       │     • Manual: AWB generation, pickup
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

### 3.4 Shiprocket (Shipping)

| What | Where |
|------|-------|
| Dashboard | https://app.shiprocket.in |
| Email + Password | In Cloudflare env vars |
| Pickup Location | "Primary" (Mumbai) |
| Box Dimensions | 12x12x6 cm, 0.3 kg default |

**How to get access:** Daya adds you as sub-user (Settings → API → Add Sub-user)

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
├── catalog.js              Product catalog + search index (150 SKUs)
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
│   ├── _lib.js             Shared helpers (hash, email, Shiprocket)
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
├── images/                 Product images
│   ├── banners/            Hero banners
│   ├── brand/              Logo (SVG + JPG)
│   ├── Earrings/           Product photos by category
│   ├── necklace/
│   ├── choker/
│   ├── pendant/
│   └── waist-chain/
│
└── build/                  Build scripts & DB schema
    ├── site.js             Generates static SEO pages
    ├── seed-products.js    Auto-assign images to SKUs
    ├── audit-images.js     Image inventory checker
    ├── inject-tracking.js  Tracking widget builder
    ├── schema-d1.sql       Product catalog table
    ├── schema-auth-orders.sql  Users + Orders + Sessions tables
    ├── seed-d1.sql         Initial product data (144 SKUs)
    └── complete-catalog.json  Full catalog export
```

---

## 5. Daily Operations

### Add/Edit Product Price
```
1. D1 database → products table → UPDATE price
2. No deploy needed (instant, zero-deploy via D1 API)
3. Static pages need rebuild if price shown on collection pages:
   Edit products.json → git push → auto-deploy (~30 seconds)
```

### Add New Product
```
1. Upload image to images/<category>/
2. Insert row into D1 products table:
   SKU format: CC-<region>-<number> (e.g., CC-SI-051)
   Region codes: SI (South Indian), MM (Mumbai Modern), NB (North Indian)
3. Add to products.json for SEO page rendering
4. Git push → auto-deploy
```

### Process Orders (Daily)
```
1. Open Shiprocket dashboard → New Orders tab
2. Pack item → Generate AWB (auto-assigns courier)
3. Print label → Stick on package → Hand to pickup agent
4. Customer gets auto SMS/WhatsApp/email with tracking link
5. Check Razorpay dashboard → Settlements tab (funds landing)
```

### Handle Return/Refund
```
1. Customer contacts via WhatsApp (+91 99870 08435) or email
2. Razorpay dashboard → Transactions → find payment → Refund
3. Shiprocket → Reverse Pickup (if item returning)
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

**Build command:** `npm run build` (runs `node build/site.js && node build/inject-tracking.js`)  
**Output directory:** `/` (repo root)  
**Node version:** 18+

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
   → Saves order to D1 → Pushes to Shiprocket → Sends email
8. Customer sees success page with order ID

BACKSTOP: If browser fails (tab closed, network drop):
  Razorpay webhook → POST /api/razorpay/webhook
  → Verifies signature → Saves order → Pushes Shiprocket → Sends email
```

---

## 8. Environment Secrets

All sensitive values are stored in **Cloudflare Dashboard → Pages → saubhagyajewellery → Settings → Environment Variables**. None are in the codebase.

| Variable | Used By | Description |
|----------|---------|-------------|
| `RAZORPAY_KEY_ID` | Checkout page | Public key (also in code: rzp_live_T6EhbHB5QhrM5W) |
| `RAZORPAY_KEY_SECRET` | Orders API | Secret key for payment verification |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook | Verifies webhook came from Razorpay |
| `SHIPROCKET_EMAIL` | Orders API | Shiprocket login email |
| `SHIPROCKET_PASSWORD` | Orders API | Shiprocket login password |
| `SHIPROCKET_PICKUP_LOCATION` | Orders API | Pickup address name (default: "Primary") |
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
| Products (~150 SKUs) | Export D1 → CSV → Import to Shopify |
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
| Shiprocket | Shopify Shipping or Shyplite/Pickrr app |
| Resend | Shopify Email (built-in) |
| Custom checkout | Shopify Checkout (optimized, secure) |
| Custom cart | Shopify Cart (built-in) |

### What Stays Independent
| Service | Notes |
|---------|-------|
| Razorpay | Can still use separately if needed |
| Shiprocket/Shyplite | Connect via Shopify app |
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
| GSTIN | (update in footer before launch) |

### Quick Reference: "How Do I..."

| Task | Where |
|------|-------|
| Change a price | D1 database → UPDATE products SET price=... WHERE sku='...' |
| Add product photo | Drop in images/<category>/ → Update D1 + products.json → git push |
| See if payment received | Razorpay dashboard → Transactions |
| Ship an order | Shiprocket dashboard → New Orders → Generate AWB |
| Check order status | Shiprocket dashboard → Orders → Search by order ID |
| Send marketing email | Resend dashboard (or setup Mailchimp later) |
| Check website traffic | Cloudflare Web Analytics (free, enable in dashboard) |
| Fix a broken page | Check Cloudflare Pages → Deployments → see build log |
| Renew domain | Cloudflare → Domain Registration → saubhagyajewellery.com |
| Change header/nav links | Edit layout.js → git push |
| Add new collection | Create new HTML (copy existing collection) → add to layout.js nav → git push |
| Change brand logo | Replace images/brand/saubhagya-logo.svg → git push |
| Add discount code | Edit checkout.html discount logic (or use Razorpay dashboard) |
| Process return/refund | Razorpay → Refund + Shiprocket → Reverse Pickup |

---

**End of Handover Guide. For questions, contact Daya.**
