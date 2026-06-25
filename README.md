# Saubhagya - jewellery storefront

A static-first jewellery website. **No backend, no database.** Every file is plain HTML/CSS/JS/JSON/images that Cloudflare Pages (or any static host) serves directly from a global CDN.

This README explains, in order:
1. What each file is
2. How `products.json` actually works in production (the part you were unsure about)
3. What "SEO pages" are and why they exist
4. How to deploy to Cloudflare Pages
5. The day-to-day workflow once it is live

---

## 1. What each file is

```
images/                Product photos, grouped by shape:
                         Earrings/  choker/  necklace/  pendant/  waist-chain/
                       Drop new photos into these folders. Use .webp where
                       possible (smaller files, faster site).

index.html             The home page. This IS the dynamic shop: search,
                       cart, checkout, product detail, the lot. It is a
                       single-page app that reads catalog.js and
                       products.json at runtime to render itself.

support.js             The component-framework runtime that index.html
                       uses (auto-loads React + Babel from a CDN).
                       Do not hand-edit.

catalog.js             Generates the 150 base SKUs (3 regions x 50). Edit
                       this only if you want to change region names,
                       category lists or the hero slideshow images.

products.json          Per-SKU overrides: price, image, name, badge.
                       This is the file you edit day to day. See section 2.

south-indian-traditional.html
mumbai-modern.html
north-indian-bridal.html
about.html  contact.html  trust.html  blogs.html
track-orders.html  shipping-and-returns.html  es-policy.html
grievances.html  terms.html  offer-terms.html  privacy-policy.html
                       Static SEO pages. See section 3.

site.css               Stylesheet for the static SEO pages.
sitemap.xml            Tells Google what pages exist.
robots.txt             Tells crawlers what is allowed.

build/site.js          Generates the static SEO pages above.
build/seed-products.js One-shot helper that rewrites products.json by
                       distributing every image in /images across the
                       150 SKUs. Run only when you want to reset.

package.json           Tells Cloudflare Pages how to build the site.
_headers               Tells Cloudflare how to cache each file type.

ProductCard.dc.html    A component used by index.html.
Hero Variations.dc.html  Design-only file (kept for reference).
```

---

## 2. How `products.json` works in production (this is the bit you asked about)

`products.json` is just a static file on your site. There is **no backend** and **no database**. Here is the full path from edit to "live on the website":

```
   you edit products.json on your laptop
                 |
                 v
        git commit + git push
                 |
                 v
   Cloudflare Pages picks it up automatically
                 |
                 v
   Cloudflare runs `node build/site.js` once
   (regenerates the static SEO pages from products.json)
                 |
                 v
   The new files go to Cloudflare's global CDN
                 |
                 v
   Live worldwide in ~30 seconds. No server. No restart.
```

When a customer's browser opens the home page (`index.html`), this happens:

1. The browser downloads `index.html`, `support.js`, `catalog.js`.
2. `catalog.js` builds the 150 base SKUs in memory.
3. `catalog.js` calls `fetch('products.json')` (a plain HTTP request for a static file).
4. Cloudflare's CDN returns the latest `products.json` (cached for 60 seconds, then refreshed).
5. The shop merges the overrides on top of the base catalog and renders.

That is the entire flow. The site has no need for a server because there is no logic that has to run on a server.

**So when you want to change a price or assign a new image:** edit `products.json`, push to git, done. The next visitor sees the change.

### The format

```json
{
  "_README": "Edit this file to change prices, images and names. After editing, commit and push - Cloudflare deploys in ~30 seconds.",
  "products": {
    "CC-SI-001": {
      "image": "images/necklace/necklace-05.webp",
      "price": 5200,
      "mrp": 7200,
      "name": "Goddess Lakshmi Temple Set",
      "badge": "BESTSELLER"
    },
    "CC-SI-002": {
      "image": "images/necklace/necklace-03.webp"
    }
  }
}
```

Every key is optional. If you only want to change a price, you only put `price`. If you only want to swap an image, you only put `image`.

**SKU code map** (you cannot change these without changing `catalog.js`):

| Code range          | Region                      |
|---------------------|-----------------------------|
| `CC-SI-001..050`    | South Indian Traditional    |
| `CC-MM-001..050`    | Mumbai Modern (AD edit)     |
| `CC-NB-001..050`    | North Indian Bridal         |

---

## 3. What "SEO pages" are

The home page (`index.html`) is fast and pretty, but its product list is built by JavaScript **after** the page loads. That is invisible to old web crawlers and weakens what Google can index.

**SEO pages** solve this. They are plain static HTML files where the product list (24 per page) is hard-coded into the HTML itself, with proper `<title>`, meta description, canonical URL, Open Graph tags and JSON-LD structured data. They are what Google sees and ranks.

| File                                 | What it ranks for                                              |
|--------------------------------------|----------------------------------------------------------------|
| `south-indian-traditional.html`      | "South Indian temple jewellery online" and related queries     |
| `mumbai-modern.html`                 | "American diamond jewellery", "AD necklace online"             |
| `north-indian-bridal.html`           | "Kundan bridal jewellery", "Polki choker online"               |
| `about.html`, `contact.html`         | Brand and trust queries                                        |
| `trust.html` and the policy pages    | Required by law for an Indian e-commerce site                  |
| `sitemap.xml`                        | The map you submit in Google Search Console                    |
| `robots.txt`                         | Tells crawlers what is allowed                                 |

Every product card on these pages links into the dynamic shop via `index.html?product=CC-SI-001` etc. The shop reads the URL and opens that product's detail view.

You do not edit these pages by hand. They are generated by `build/site.js` from `products.json`. Cloudflare runs that command automatically on every push (see section 4).

---

## 4. Deploying to Cloudflare Pages

**One-time setup:**

1. Put this folder in a private GitHub (or GitLab) repository.
2. In Cloudflare dashboard: **Workers & Pages -> Create -> Pages -> Connect to Git**, choose this repo.
3. In the build settings:
   - **Framework preset:** None
   - **Build command:** `npm run build`
   - **Build output directory:** `/` (the repo root)
   - **Node version:** 18 or newer
4. Save and deploy.

That is the entire setup. From then on, every `git push` automatically rebuilds and deploys.

**Custom domain:** in Cloudflare Pages -> your project -> Custom domains -> Set up a domain. Cloudflare handles SSL automatically.

**Important:** open `build/site.js` and change the `BASE_URL` constant from the placeholder to your real domain (e.g. `https://saubhagyajewellery.com`). The canonical URLs, Open Graph URLs and sitemap entries are built from this.

---

## 5. Day-to-day workflow once it is live

### Change a price or name
Open `products.json`, find the SKU, edit, save, commit, push.
```json
"CC-SI-001": { "image": "...", "price": 5500, "mrp": 7500 }
```
~30 seconds later it is live globally.

### Add a new product photo
1. Drop the file into the right folder, e.g. `images/necklace/my-new-piece.webp`.
2. Open `products.json`, point a SKU at it:
   ```json
   "CC-SI-007": { "image": "images/necklace/my-new-piece.webp" }
   ```
3. Commit + push.

### Reset products.json from scratch (rare)
If you have added lots of new photos and want them auto-distributed across the 150 SKUs, run locally:
```
node build/seed-products.js
```
It backs up the existing file to `products.json.bak`, then writes a fresh one. Commit + push.

### Run it locally (optional, for previewing changes)
You need Python OR Node installed.
- With Python: `python -m http.server 8753`, then open http://localhost:8753/
- With Node: `npx serve -p 8753`

Do not open `index.html` directly from the file manager. The shop loads JavaScript that browsers block on `file://`. Use a local server.

### What you do NOT need
- No `.bat` files (removed).
- No build server or VPS.
- No Node.js installed on your laptop, unless you want to preview the static SEO pages locally before pushing. Cloudflare's build environment has Node.

---

## Notes on the placeholder copy

A few pages still have placeholder boilerplate marked "This is placeholder boilerplate; please have it reviewed before going live":
- `terms.html` (Terms of Service)
- `offer-terms.html` (Offer T&C)
- `privacy-policy.html` (Privacy Policy)

Get these reviewed by someone familiar with Indian e-commerce and the Consumer Protection (E-commerce) Rules 2020 before you launch.

Also update placeholder contact details across `contact.html`, `trust.html`, the footer, and the JSON-LD in `index.html`:
- WhatsApp/phone (currently `+91 22 0000 0000`)
- Email (`care@saubhagyajewellery.com`)
- GSTIN (`27ABCDE1234F1Z5`)
