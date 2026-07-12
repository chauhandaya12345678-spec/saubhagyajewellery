# Retail Storefront Playbook

Every pattern applied to Saubhagya Jewellery. Copy to any static retail site.
Stack-neutral: works with plain HTML + CSS + JS. Backend assumed Cloudflare
Pages + D1 + R2. Swap providers as needed.

---

## 1. Zero-Deploy Product Data (prices, stock, images)

**Rule:** product data lives in DB, not files. Deploy only when *layout* changes.

### D1 schema
```sql
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL,
  mrp INTEGER NOT NULL,
  image TEXT NOT NULL,
  altImage TEXT,
  badge TEXT DEFAULT '',
  inStock INTEGER NOT NULL DEFAULT 1,
  stock_count INTEGER,
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_products_instock ON products(inStock);
```

### Update flow (feed to any AI/DeepSeek)
```bash
# Price
wrangler d1 execute <db> --remote --command="UPDATE products SET price=349 WHERE sku='X'"
# Out of stock
wrangler d1 execute <db> --remote --command="UPDATE products SET inStock=0 WHERE sku='X'"
# Low-stock warning
wrangler d1 execute <db> --remote --command="UPDATE products SET stock_count=2 WHERE sku='X'"
```
Cache TTL 60 s. Live in 1 min. Zero git push.

### API route
```js
// functions/api/products.js
export async function onRequest({ env, request }) {
  const url = new URL(request.url);
  const sku = url.searchParams.get('sku');
  let sql = 'SELECT * FROM products WHERE inStock = 1';
  const p = [];
  if (sku) { sql += ' AND sku = ?'; p.push(sku); }
  const { results } = await env.DB.prepare(sql).bind(...p).all();
  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' }
  });
}
```

### Client with static fallback
```js
fetch('/api/products').then(r=>r.json()).then(publish).catch(loadStaticJson);
function publish(list){ window.CATALOG = list.map(p=>({...p,id:p.sku})); dispatchEvent(new CustomEvent('catalog-ready')); }
```

---

## 2. Pre-launch: Wipe Test Users
```sql
DELETE FROM password_resets;
DELETE FROM sessions;
DELETE FROM orders;
DELETE FROM users;
DELETE FROM sqlite_sequence WHERE name IN ('users','sessions','password_resets');
```
Never touch `products` or `reviews`.

---

## 3. SEO Baseline per Page
```html
<title>{Page} | {Brand}</title>
<meta name="description" content="…155 chars">
<link rel="canonical" href="https://…">
<meta name="robots" content="index,follow">    <!-- noindex on cart/account/signin -->
<meta property="og:type" content="website">
<meta property="og:title" content="…">
<meta property="og:description" content="…">
<meta property="og:image" content="https://…/hero.webp">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="geo.region" content="IN-MH">
```

Organisation JSON-LD on home. Product JSON-LD on PDP (built after fetch).

---

## 4. Anchor-Text Hygiene

**Empty anchors** (hero image links, logo-only): add sr-only text.
```html
<a href="/categories?cat=earrings">
  <span class="sr-only">Shop Earrings — jhumkas, studs and drops</span>
</a>
```
```css
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;
  overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
```
**Merged tile text** (scanners see `SHOP NOWEarrings`): add trailing space:
```html
<div class="k">SHOP NOW </div>
<div class="t">Earrings </div>
```
Every tile `<a>` gets `aria-label`.

---

## 5. Word Count Without Wall of Text

Wrap long SEO copy in `<details>`. Google reads inside them.
```html
<section class="seo-block">
  <h2>{Short H2}</h2>
  <p class="seo-lede">{3 lines}</p>
  <div class="seo-faq">
    <details><summary>Shop by occasion</summary><p>…</p></details>
    <details><summary>Why shoppers trust us</summary><p>…</p></details>
  </div>
</section>
```
```css
.seo-faq summary{position:relative;padding:18px 40px 18px 4px;cursor:pointer;list-style:none}
.seo-faq summary::-webkit-details-marker{display:none}
.seo-faq summary::after{content:'+';position:absolute;right:6px;top:50%;transform:translateY(-50%);color:#C5A059;transition:.3s}
.seo-faq details[open] summary::after{transform:translateY(-50%) rotate(45deg)}
```

---

## 6. Sitemap + Real 301s

`sitemap.xml`: all indexable pages + category filter URLs + blog posts.
`_redirects` for retired routes (real 301, not meta-refresh):
```
/old-collection /categories.html?cat=necklaces 301
/old-collection.html /categories.html?cat=necklaces 301
```

---

## 7. Header Search with Typeahead

Real `<form>` so mobile "Go" submits:
```html
<form action="/categories.html" method="get" class="nav-search-form">
  <svg …search-icon…></svg>
  <input name="q" enterkeyhint="search" inputmode="search" placeholder="Search…">
  <button type="submit">SEARCH</button>
</form>
<div class="nav-search-hits" role="listbox"></div>
```
Typeahead: 140 ms debounce, 6 hits + "See all", arrow-key nav, ESC close, backdrop dim.
```js
input.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>renderHits(input.value.trim()),140)});
function renderHits(q){
  if(!q)return hide();
  const hits=(window.CATALOG||[]).filter(p=>p.inStock&&(p.name+' '+p.category).toLowerCase().includes(q.toLowerCase())).slice(0,6);
  hitsEl.innerHTML=hits.map(row).join('')+`<a class="more" href="/categories.html?q=${encodeURIComponent(q)}">SEE ALL →</a>`;
  hitsEl.classList.add('on');
}
```

---

## 8. Premium 3D Product Cards

One CSS block covers all cards (`.card`, `.tr-card`, `.p-card`):
```css
.card{position:relative;background:#fff;border-radius:16px;padding:10px 10px 16px;
  box-shadow:0 1px 2px rgba(6,40,26,.04),0 6px 18px -12px rgba(6,40,26,.18);
  transition:transform .5s cubic-bezier(.22,1,.36,1),box-shadow .5s}
.card:hover{transform:translateY(-6px);
  box-shadow:0 8px 20px -8px rgba(6,40,26,.22),0 40px 60px -30px rgba(6,40,26,.28),
             0 0 0 1px rgba(197,160,89,.28)}
.card-img{aspect-ratio:4/5;overflow:hidden;border-radius:12px;
  background:linear-gradient(135deg,#f5f2ea,#eae5d8);isolation:isolate}
.card-img::after{content:'';position:absolute;inset:0;opacity:0;
  background:linear-gradient(180deg,rgba(255,255,255,0) 60%,rgba(6,40,26,.08));transition:.5s}
.card:hover .card-img::after{opacity:1}
.card:hover .card-img img{transform:scale(1.06)}
.card-tag{position:absolute;top:12px;left:12px;
  background:linear-gradient(135deg,#0B3C26,#06281a);color:#C5A059;
  font:600 9px 'Montserrat',sans-serif;letter-spacing:1.4px;padding:5px 11px;border-radius:4px;
  box-shadow:0 2px 6px rgba(6,40,26,.28)}
```
Quick-add pill: fades in on hover desktop, always visible mobile.

---

## 9. Mobile UX Kit

### Sticky bottom CTA on PDP
```html
<div class="pdp-mobile-bar">
  <div class="price">₹1,599</div>
  <button class="add">ADD TO BAG</button>
  <button class="buy">BUY NOW</button>
</div>
```
```css
@media(max-width:900px){
  .pdp-mobile-bar{position:fixed;left:0;right:0;bottom:0;z-index:40;display:flex;gap:10px;
    padding:10px 14px calc(10px + env(safe-area-inset-bottom));
    background:rgba(255,255,255,.97);backdrop-filter:blur(14px);
    border-top:1px solid rgba(197,160,89,.28);
    transform:translateY(120%);transition:transform .4s cubic-bezier(.22,1,.36,1)}
  .pdp-mobile-bar.on{transform:translateY(0)}
}
```
Reveal via scroll listener when primary ADD button leaves viewport. Same handlers as main buttons.

### Safe-area padding
```css
@supports(padding:max(0px)){
  header.site{padding-top:env(safe-area-inset-top)}
  footer.site{padding-bottom:max(30px,env(safe-area-inset-bottom))}
  .pdp-wrap{padding-bottom:calc(96px + env(safe-area-inset-bottom))}
}
```

### Tap targets
- Buttons ≥ 48 px tall. Qty +/− ≥ 44×44. Search ≥ 46. Body ≥ 12 px.
- `touch-action: manipulation` on cards/tiles. `-webkit-overflow-scrolling: touch` on scroll surfaces.
- `.card:active { transform: scale(.98) }` for instant tap feedback.

---

## 10. Mobile Nav Drawer

MUST be `position: fixed` — NOT nested inside sticky header with `backdrop-filter`, else parent filter tints drawer.
```css
.nav-drawer{position:fixed;top:59px;left:0;right:0;z-index:70;background:#fff;
  max-height:0;overflow:hidden;transition:max-height .45s cubic-bezier(.22,1,.36,1);
  padding-bottom:env(safe-area-inset-bottom)}
.nav-drawer.open{max-height:calc(100vh - 59px);overflow-y:auto}
.nav-drawer-backdrop{position:fixed;inset:0;top:64px;z-index:59;
  background:rgba(6,40,26,.4);opacity:0;pointer-events:none;transition:.35s}
.nav-drawer-backdrop.on{opacity:1;pointer-events:auto}
```
Burger toggles drawer + backdrop. ESC + backdrop-tap close. `body.overflow=hidden` while open.

---

## 11. Collapsible Footer

```html
<details class="fcol"><summary class="fhead">COMPANY</summary>
  <a href="/about">About</a> …
</details>
```
Force-open on desktop via JS:
```js
function syncFooterDetails(){
  const open=innerWidth>560;
  document.querySelectorAll('footer.site details.fcol').forEach(d=>{
    open?d.setAttribute('open',''):d.removeAttribute('open');
  });
}
syncFooterDetails();addEventListener('resize',syncFooterDetails);
```
Mobile: chevron + tap-to-open. Desktop: static column.

---

## 12. External Trust Signals (footer)
```html
<div class="fsocial">
  <a href="https://instagram.com/brand" rel="noopener" target="_blank">Instagram</a>
  <a href="https://facebook.com/brand" rel="noopener" target="_blank">Facebook</a>
  <a href="https://wa.me/91…" rel="noopener" target="_blank">WhatsApp</a>
  <a href="https://maps.google.com/?q=…" rel="noopener" target="_blank">Google Maps</a>
</div>
```

---

## 13. Cross-Document View Transitions

Smooth app-like page transitions with pure CSS (Chrome 126+, Safari 18.2+). Old browsers fall back to plain nav.
```css
@view-transition { navigation: auto }
@media (prefers-reduced-motion: no-preference) {
  header.site { view-transition-name: site-nav }
  footer.site { view-transition-name: site-footer }
}
```
Shared product image: same `view-transition-name` on catalog thumb + PDP hero, keyed by SKU.
```js
// Catalog render
`<img src="${p.image}" style="view-transition-name: prod-${p.sku}">`
// PDP render
imgEl.style.viewTransitionName = 'prod-' + p.sku;
```

---

## 14. Cache-Bust Assets
```html
<link rel="stylesheet" href="site.css?v=9">
<script src="layout.js?v=9"></script>
```
Bulk: `for f in *.html; do sed -i 's/?v=8/?v=9/g' "$f"; done`

---

## 15. India Integrations

- **Razorpay**: UPI/cards/EMI. Server creates order, client renders checkout modal, webhook confirms. Store `razorpay_payment_id` on order row.
- **Shiprocket**: ad-hoc order push after payment. Customer gets tracking SMS only after admin generates AWB — document on trust page.
- **Resend**: transactional email (order, welcome, magic link, reset). Free 100/day.

---

## 16. Auth (email OR phone)

Guest checkout auto-creates row with `is_guest=1`. Signup with same email/phone claims that row (orders already queryable by phone). Password: `s256$<salt>$<sha256>`. Magic link + reset in one `password_resets` table with `type` column.

---

## 17. Deploy Flow

1. Edit locally.
2. Preview: `npm run dev` → `npx serve -l 8756 .`
3. `git commit -am "…"; git push` → Cloudflare Pages auto-builds.
4. Product edits: `wrangler d1 execute` only. Never git.
5. Never `--no-verify`, never force-push main.

`.gitignore`: `.wrangler/`, `node_modules/`, `*.log`, `.env`.

---

## 18. Pre-launch Checklist

- [ ] Test users/orders wiped from prod D1
- [ ] Sitemap linked from robots.txt + submitted to Search Console
- [ ] Canonical + OG tags on every indexable page
- [ ] `noindex` on cart/checkout/signin/account/success/404
- [ ] All prices sourced from D1 (no hardcoded fallback in prod)
- [ ] Sticky bottom CTA on PDP mobile
- [ ] Search typeahead returns hits inside sheet
- [ ] All external links `rel="noopener" target="_blank"`
- [ ] Payment gateway test order with real card (small amount)
- [ ] Shiprocket AWB drill (staff knows flow)
- [ ] Resend sender domain verified
- [ ] Cookie banner shown on first visit
- [ ] PIN-code delivery estimator on PDP
- [ ] View transitions verified on Chrome mobile

---

## Files Worth Reusing Verbatim

- `functions/api/products.js` — D1 read API
- `functions/api/_lib.js` — hash, Resend email, Shiprocket push, PIN ETA
- `catalog.js` — API + fallback loader
- `mpa.js` — cart / user session hydration (works with any static page)
- `layout.js` — header + footer + drawer + search + cookie banner
- `build/wipe-test-users.sql`, `build/stock-update-examples.sql`
- `_redirects` — 301 map

Copy these, rename brand strings, swap D1 database_id in `wrangler.toml`, change palette in `site.css`. Works out of the box.
