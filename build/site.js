/* ============================================================
 *  Saubhagya - static SEO page generator
 *  ------------------------------------------------------------
 *  Builds real, separately-served HTML pages (Home, the three
 *  collections, About, Contact, Standards, and the policy pages)
 *  with their own URL, <title>, meta description, canonical,
 *  Open Graph and JSON-LD. Collection pages bake in the product
 *  listings as crawlable HTML; each product links into the app
 *  (index.html?product=SKU). The home page IS the dynamic app
 *  (index.html), not a static page.
 *
 *  Run:  node build/site.js
 *  Then serve the folder over HTTP (start.bat).
 *
 *  >>> Set BASE_URL to your real domain before going live. <<<
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..');
const BASE_URL = 'https://saubhagyajewellery.com'; // <-- replace with your real domain
const APP = 'index.html'; // the dynamic shopping app (cart / checkout / product detail) — also the home page
const WHATSAPP = 'https://wa.me/919987008435';

/* ---------- catalog: same deterministic algorithm as catalog.js ---------- */
function buildCatalog() {
  const REGIONS = {
    south:  { label: 'South Indian Traditional', cities: ['Chennai', 'Madurai', 'Coimbatore', 'Bengaluru', 'Hyderabad'], cats: ['Temple Necklace', 'Lakshmi Haaram', 'Matte Jhumkas', 'Vanki', 'Maang Tikka', 'Kasu Mala', 'Bridal Set'] },
    modern: { label: 'Mumbai Modern', cities: ['Mumbai', 'Pune', 'Ahmedabad', 'Surat'], cats: ['AD Necklace', 'Bridal Pendant', 'Solitaire Studs', 'Designer Drop', 'Pendant Set', 'Statement Choker'] },
    bridal: { label: 'North Indian Bridal', cities: ['Delhi', 'Jaipur', 'Lucknow', 'Chandigarh', 'Amritsar'], cats: ['Kundan Set', 'Polki Choker', 'Rani Haar', 'Nath', 'Passa', 'Bridal Set', 'Meenakari Set'] }
  };
  const ADJ = ['Royal', 'Heritage', 'Regal', 'Antique', 'Imperial', 'Maharani', 'Grand', 'Celestial', 'Noble', 'Vintage', 'Lotus', 'Peacock', 'Divine', 'Padmini', 'Aurelia', 'Mughal'];
  const PREFIX = { south: 'SI', modern: 'MM', bridal: 'NB' };
  const rng = (seed) => { const x = Math.sin(seed) * 10000; return x - Math.floor(x); };
  const all = [];
  Object.keys(REGIONS).forEach((reg, ri) => {
    const R = REGIONS[reg];
    for (let i = 1; i <= 50; i++) {
      const seed = ri * 1000 + i;
      const cat = R.cats[Math.floor(rng(seed) * R.cats.length)];
      const adj = ADJ[Math.floor(rng(seed * 1.7) * ADJ.length)];
      const price = Math.round((1200 + rng(seed * 2.3) * 8800) / 50) * 50;
      const mrp = Math.round(price * (1.18 + rng(seed * 3.1) * 0.24) / 50) * 50;
      const sku = 'CC-' + PREFIX[reg] + '-' + String(i).padStart(3, '0');
      const city = R.cities[Math.floor(rng(seed * 4.2) * R.cities.length)];
      const badges = ['', '', '', '', 'BESTSELLER', 'NEW', 'TRENDING'];
      const badge = badges[Math.floor(rng(seed * 5.5) * badges.length)];
      all.push({ id: sku, sku, name: adj + ' ' + cat, region: reg, regionLabel: R.label, category: cat, price, mrp, city, badge });
    }
  });
  return all;
}
function loadOverrides() {
  const p = path.join(OUT, 'products.json');
  if (!fs.existsSync(p)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return (raw && typeof raw === 'object' && raw.products && typeof raw.products === 'object') ? raw.products : raw;
  } catch (e) {
    console.warn('[build] products.json could not be parsed, ignoring:', e.message);
    return {};
  }
}
function applyOverrides(base, ov) {
  return base.map(p => {
    const o = ov[p.sku];
    if (!o || typeof o !== 'object') return p;
    const m = Object.assign({}, p);
    if (o.name) m.name = o.name;
    if (typeof o.price === 'number') m.price = o.price;
    if (typeof o.mrp === 'number') m.mrp = o.mrp;
    if (o.image) m.image = o.image;
    if (o.altImage) m.altImage = o.altImage;
    if (o.badge !== undefined) m.badge = o.badge;
    return m;
  });
}
const OVERRIDES = loadOverrides();
const CATALOG = applyOverrides(buildCatalog(), OVERRIDES);

/* ---------- helpers ---------- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');
const urlOf = (slug) => slug === 'index.html' ? BASE_URL + '/' : BASE_URL + '/' + slug.replace(/\.html$/, '');

/* ---------- shared chrome ---------- */
const NAV = [
  { slug: 'index.html', label: 'Home' },
  { slug: 'south-indian-traditional.html', label: 'South Indian' },
  { slug: 'mumbai-modern.html', label: 'Mumbai Modern' },
  { slug: 'north-indian-bridal.html', label: 'North Indian Bridal' },
  { slug: 'about.html', label: 'About' },
  { slug: 'contact.html', label: 'Contact' }
];

// Header/footer live in ONE runtime source now: layout.js (<x-layout>/<x-footer>
// custom elements, hydrated by mpa.js). Generated pages just emit the tags —
// keep NAV/labels in sync with layout.js when they change.
function header(active) {
  return `<x-layout page="${active}"></x-layout>`;
}

function footer() {
  return `<x-footer></x-footer>`;
}

function page({ slug, title, desc, h1, jsonld, body, active }) {
  const u = urlOf(slug);
  const ld = (Array.isArray(jsonld) ? jsonld : [jsonld]).filter(Boolean)
    .map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${u}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Saubhagya">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${u}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="site.css">
<script src="layout.js"></script>
<script src="mpa.js" defer></script>
${ld}
</head>
<body>
${header(active)}
<main>
${body}
</main>
${footer()}
</body>
</html>
`;
}

function breadcrumb(trail) {
  // trail: [[label, href|null], ...]
  const html = trail.map((t, i) => i === trail.length - 1
    ? `<span>${esc(t[0])}</span>`
    : `<a href="${t[1]}">${esc(t[0])}</a>`).join('<i>/</i>');
  const ld = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t[0], item: t[1] ? urlOf(t[1]) : undefined }))
  };
  return { html: `<nav class="crumb">${html}</nav>`, ld };
}

function productCard(p) {
  const tag = p.badge ? (p.city ? p.badge + ' · ' + p.city : p.badge) : (p.city || '');
  const img = p.image
    ? `<img class="card-photo" src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">`
    : `<span class="card-ph">STUDIO PRODUCT SHOT</span>`;
  return `<a class="card" href="product.html?sku=${encodeURIComponent(p.sku)}">
  <div class="card-img${p.image ? ' card-img-photo' : ''}">${tag ? `<span class="card-tag">${esc(tag)}</span>` : ''}${img}</div>
  <div class="card-name">${esc(p.name)}</div>
  <div class="card-price">${inr(p.price)}</div>
</a>`;
}

/* ---------- collection pages ---------- */
const COLLECTIONS = {
  south: {
    slug: 'south-indian-traditional.html', region: 'south', label: 'South Indian Traditional', navtone: 'emerald',
    title: 'South Indian Temple Jewellery Online | Saubhagya',
    desc: 'Shop handcrafted South Indian temple imitation jewellery: matte antique-gold haarams, Lakshmi necklaces, jhumkas and complete bridal sets. Free insured shipping across India.',
    intro: [
      'Matte antique-gold temple jewellery, modelled in Rhino CAD and cast for bridal weight. Our South Indian collection brings the grandeur of Chennai and Madurai craftsmanship to high-quality imitation jewellery you can wear to every occasion.',
      'From Lakshmi haarams and kasu malas to matte jhumkas, vanki and maang tikka, each piece is hand-finished and inspected before it ships, fully insured, across India.'
    ]
  },
  modern: {
    slug: 'mumbai-modern.html', region: 'modern', label: 'Mumbai Modern', navtone: 'charcoal',
    title: 'American Diamond (AD) Jewellery Online | Saubhagya',
    desc: 'Shop Mumbai Modern imitation jewellery: AD necklaces, bridal pendants, solitaire studs, designer drops, pendant sets and statement chokers. Free insured shipping across India.',
    intro: [
      'Contemporary American Diamond pieces with a clean, high-shine finish, for evening and everyday. The Mumbai Modern edit pairs sparkle with restraint, designed for the office, the party and everything in between.',
      'Explore AD necklaces, bridal pendants, solitaire studs, designer drops and statement pieces, all dispatched insured across India.'
    ]
  },
  bridal: {
    slug: 'north-indian-bridal.html', region: 'bridal', label: 'North Indian Bridal', navtone: 'maroon',
    title: 'Kundan & Polki Bridal Jewellery Online | Saubhagya',
    desc: 'Shop North Indian bridal imitation jewellery: Kundan sets, Polki chokers, rani haar, nath, passa and complete bridal looks. Handcrafted, free insured shipping across India.',
    intro: [
      'Kundan and Polki craftsmanship: complete bridal looks for the modern North Indian bride. From statement chokers and rani haar to nath and passa, our bridal collection is built for the big day and the heirloom years after.',
      'Every set is made-to-order, individually inspected and shipped insured across India.'
    ]
  }
};

function collectionPage(key) {
  const c = COLLECTIONS[key];
  const items = CATALOG.filter(p => p.region === c.region).slice(0, 24);
  const crumb = breadcrumb([['Home', 'index.html'], [c.label, null]]);
  const grid = items.map(productCard).join('\n');
  const itemListLd = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: c.label,
    itemListElement: items.map((p, i) => ({
      '@type': 'ListItem', position: i + 1, name: p.name, url: urlOf(APP) + '?product=' + encodeURIComponent(p.id)
    }))
  };
  const body = `${crumb.html}
<section class="ph">
  <div class="kicker">THE COLLECTION</div>
  <h1>${esc(c.label)}</h1>
  ${c.intro.map(t => `<p class="lede">${esc(t)}</p>`).join('\n  ')}
</section>
<section class="grid-wrap">
  <div class="grid">
${grid}
  </div>
  <div class="cta-row"><a class="btn" href="${APP}?collection=${c.region}">SHOP THE FULL ${esc(c.label.toUpperCase())} EDIT &rarr;</a></div>
</section>`;
  return page({ slug: c.slug, title: c.title, desc: c.desc, h1: c.label, active: c.slug, jsonld: [crumb.ld, itemListLd], body });
}

/* ---------- home ---------- */
function homePage() {
  const trending = [];
  for (let i = 0; i < 3; i++) [CATALOG[i], CATALOG[50 + i], CATALOG[100 + i]].forEach(p => { if (p) trending.push(p); });
  const reviews = [
    { stars: '★★★★★', quote: 'The matte temple haaram looked exactly like real antique gold. Got endless compliments at my sister’s wedding.', name: 'Ananya R.', meta: 'Chennai' },
    { stars: '★★★★★', quote: 'Packaging was stunning and the unboxing video process made me feel secure. The AD choker sparkles beautifully.', name: 'Priya M.', meta: 'Mumbai' },
    { stars: '★★★★★', quote: 'My Kundan bridal set was the highlight of my reception. Lightweight yet so regal, worth every rupee.', name: 'Simran K.', meta: 'Delhi' }
  ];
  const card3 = (key, line) => {
    const c = COLLECTIONS[key];
    return `<a class="ccard ccard-${c.navtone}" href="${c.slug}"><span class="ccard-k">${esc(c.label.split(' ')[0].toUpperCase())}</span><span class="ccard-t">${esc(line)}</span></a>`;
  };
  const ld = {
    '@context': 'https://schema.org', '@type': 'JewelryStore', name: "Saubhagya Jewellery",
    description: 'Premium designer imitation jewellery: temple, Kundan/Polki and American Diamond. High-quality artificial jewellery with secure shipping across India.',
    url: BASE_URL + '/', priceRange: '₹₹₹',
    address: { '@type': 'PostalAddress', streetAddress: 'Tanaji Nagar Rd, opp Vishwakarma Mandir, Hanuman Nagar, Kandivali East', addressLocality: 'Mumbai', postalCode: '400101', addressRegion: 'Maharashtra', addressCountry: 'IN' }, telephone: '+91-99870-08435'
  };
  const body = `<section class="hero">
  <div class="kicker">MODERN HERITAGE &middot; EST. SAUBHAGYA</div>
  <h1>Premium Designer Imitation Jewellery</h1>
  <p class="lede">Handcrafted temple, Kundan/Polki and American Diamond jewellery. High-quality artificial jewellery with free insured shipping across India.</p>
  <div class="cta-row">
    <a class="btn" href="${APP}">EXPLORE COLLECTIONS</a>
    <a class="btn btn-ghost" href="${APP}?collection=south">SHOP BESTSELLERS</a>
  </div>
</section>
<section class="band">
  <div class="kicker center">THREE REGIONS, ONE ATELIER</div>
  <h2 class="center">Explore by Heritage</h2>
  <div class="ccards">
    ${card3('south', 'Temple & Antique Gold')}
    ${card3('modern', 'American Diamond Edit')}
    ${card3('bridal', 'Kundan & Polki Bridal')}
  </div>
</section>
<section class="band">
  <div class="kicker center">TRENDING NOW</div>
  <h2 class="center">Loved Across India</h2>
  <div class="grid">
${trending.map(productCard).join('\n')}
  </div>
</section>
<section class="seo">
  <h2>Buy High-Quality Imitation Jewellery Online</h2>
  <p>Saubhagya is a Mumbai atelier crafting premium designer imitation jewellery for weddings, festivals and every day. Browse South Indian temple jewellery, Mumbai Modern American Diamond pieces and North Indian Kundan and Polki bridal sets, all handcrafted and shipped insured across India.</p>
</section>
<section class="reviews">
  <div class="kicker center gold">HAPPY CUSTOMERS</div>
  <h2 class="center light">Worn &amp; Loved Across India</h2>
  <div class="rgrid">
    ${reviews.map(r => `<div class="rcard"><div class="rstars">${r.stars}</div><p>&ldquo;${esc(r.quote)}&rdquo;</p><div class="rname">${esc(r.name)}</div><div class="rmeta">${esc(r.meta)}</div></div>`).join('\n    ')}
  </div>
</section>`;
  return page({
    slug: 'index.html', active: 'index.html',
    title: "Saubhagya | Premium Designer Imitation Jewellery Online (Temple, Kundan, AD)",
    desc: 'Buy premium designer imitation jewellery online: South Indian temple, North Indian Kundan/Polki bridal and Mumbai Modern American Diamond. Handcrafted, free insured shipping across India.',
    jsonld: ld, body
  });
}

/* ---------- content pages ---------- */
const CONTENT = [
  {
    slug: 'about.html', kicker: 'OUR STORY', title: 'About Us | Saubhagya',
    desc: 'Saubhagya is a Mumbai atelier crafting premium designer imitation jewellery: temple, Kundan/Polki and American Diamond, handcrafted and shipped insured across India.',
    h1: 'About Us',
    lede: 'Saubhagya is a Mumbai atelier crafting premium designer imitation jewellery: temple, Kundan/Polki and American Diamond, for weddings, festivals and every day in between.',
    blocks: [
      ['h', 'The House'],
      ['p', 'We pair traditional Indian craftsmanship with modern CAD design. Every piece is modelled in Rhino, hand-finished in matte antique gold or high-shine AD, and individually inspected before it leaves the atelier.'],
      ['p', 'Our mission is simple: high-quality artificial jewellery that looks and feels like fine jewellery, at a fraction of the price, so you can wear something extraordinary to every occasion.'],
      ['h', 'Our Promise'],
      ['p', 'Free insured shipping across India and a bespoke quality guarantee on every handcrafted piece.']
    ]
  },
  {
    slug: 'contact.html', kicker: 'WE ARE HERE TO HELP', title: 'Contact Us & Store Location | Saubhagya',
    desc: 'Contact Saubhagya on WhatsApp or phone, or visit us at Kandivali East, Mumbai. Client care Monday to Saturday.',
    h1: 'Contact Us',
    lede: 'Questions about a piece, your order, or a custom bridal commission? Reach us through any of the channels below.',
    blocks: [
      ['h', 'Client Care'],
      ['p', 'WhatsApp and phone: +91 99870 08435. Email: care@saubhagyajewellery.com. We typically reply within a few hours, Monday to Saturday.'],
      ['h', 'Flagship Atelier'],
      ['p', 'Saubhagya Jewellery, Tanaji Nagar Rd, opp Vishwakarma Mandir, Hanuman Nagar, Kandivali East, Mumbai 400101, Maharashtra. Open Monday to Saturday, 11:00 am to 7:30 pm. Private bridal consultations are by appointment.']
    ],
    whatsapp: true
  },
  {
    slug: 'trust.html', kicker: 'CLIENT CARE &middot; OUR STANDARDS', title: 'Our Standards: Quality Guarantee & Unboxing Protocol | Saubhagya',
    desc: 'Our quality guarantee, the unboxing protocol for transit-insurance claims, and the trust details behind every Saubhagya order.',
    h1: 'A Promise of Flawless Craft',
    lede: 'Buy high-quality imitation jewellery with secure shipping across India. Our guardrails exist to protect the integrity of every handcrafted piece, and your confidence in it.',
    blocks: [
      ['h', 'Bespoke Quality Guarantee'],
      ['p', 'Every Saubhagya piece is made-to-order and individually inspected before it leaves our atelier. Because our jewellery is created for weddings and events, we are unable to accept change-of-mind returns or exchanges. This policy protects all clients from wardrobing, the wearing of an item to an occasion before returning it, and keeps every piece dispatched to you in pristine, unworn condition.'],
      ['p', 'Should a piece arrive with a genuine manufacturing defect, we will repair or replace it without question. Defect claims are honoured when supported by the continuous unboxing video described below.'],
      ['h', 'The Unboxing Protocol'],
      ['p', 'Record continuously: begin filming before the outer seal is broken, in a single uncut take with no pauses or edits.'],
      ['p', 'Show every detail: capture the shipping label, the sealed box, and the full piece as it is revealed, clearly and in good light.'],
      ['p', 'Report within 48 hours: share the unedited video via WhatsApp within 48 hours of delivery to authorise any transit-damage claim.']
    ],
    whatsapp: true
  },
  {
    slug: 'blogs.html', kicker: 'THE JOURNAL', title: 'The Journal | Saubhagya',
    desc: 'Styling notes, craft stories and bridal inspiration from the Saubhagya atelier.',
    h1: 'Blogs',
    lede: 'Styling notes, craft stories and bridal inspiration from the Saubhagya atelier.',
    blocks: [
      ['h', 'Coming soon'],
      ['p', 'Our journal is being written. Soon you will find guides on styling temple jewellery, caring for matte antique-gold finishes, and choosing a bridal set for the big day.'],
      ['p', 'In the meantime, follow us on Instagram and Pinterest for daily inspiration.']
    ]
  },
  {
    slug: 'track-orders.html', kicker: 'ORDER STATUS', title: 'Track Your Order | Saubhagya',
    desc: 'Track your Saubhagya order. Confirmation and tracking are sent by email and WhatsApp as soon as your piece ships.',
    h1: 'Track Orders',
    lede: 'Your confirmation and tracking details are sent by email and WhatsApp as soon as your piece ships.',
    blocks: [
      ['h', 'How to track'],
      ['p', 'Use the tracking link in your shipping email, or message us your order number (it begins with “CC”) on WhatsApp and we will share live status.'],
      ['h', 'Dispatch timelines'],
      ['p', 'Ready pieces dispatch within 2 to 4 business days. Made-to-order bridal sets ship within 10 to 14 days. All shipments are fully insured in transit.']
    ],
    whatsapp: true
  },
  {
    slug: 'shipping-and-returns.html', kicker: 'POLICY', title: 'Shipping, Delivery & Returns | Saubhagya',
    desc: 'Free insured shipping across India. Read our delivery timelines and our made-to-order returns and defect policy.',
    h1: 'Shipping & Returns',
    lede: 'Free insured shipping across India on every order.',
    blocks: [
      ['h', 'Shipping & Delivery'],
      ['p', 'Ready pieces dispatch within 2 to 4 business days; made-to-order bridal sets within 10 to 14 days. Every shipment is fully insured in transit and delivered across India.'],
      ['h', 'Returns'],
      ['p', 'Because every piece is made-to-order and individually inspected, we are unable to accept change-of-mind returns. Verified manufacturing defects are repaired or replaced, supported by the continuous unboxing video described in our standards.']
    ],
    related: [['Read our standards', 'trust.html']]
  },
  {
    slug: 'es-policy.html', kicker: 'POLICY', title: 'E & S Policy (Exchange & Shipping) | Saubhagya',
    desc: 'Our Exchange & Shipping policy in plain language: how exchanges work and how we ship insured across India.',
    h1: 'E & S Policy',
    lede: 'Our Exchange & Shipping policy, in plain language.',
    blocks: [
      ['h', 'Exchange'],
      ['p', 'Because every piece is made-to-order and individually inspected, we are unable to accept change-of-mind returns. Verified manufacturing defects are repaired or replaced, supported by the continuous unboxing video described in our standards.'],
      ['h', 'Shipping'],
      ['p', 'Free insured shipping across India on every order. Ready pieces dispatch in 2 to 4 business days; bridal sets in 10 to 14 days.']
    ],
    related: [['Read our standards', 'trust.html']]
  },
  {
    slug: 'grievances.html', kicker: 'WE ARE LISTENING', title: 'Grievances | Saubhagya',
    desc: 'How to raise a concern with Saubhagya. Contact our Grievance Officer by email or WhatsApp; we respond within 48 hours.',
    h1: 'Grievances',
    lede: 'If something is not right, we want to make it right. Here is how to raise a concern.',
    blocks: [
      ['h', 'Raise a concern'],
      ['p', 'Write to our Grievance Officer at care@saubhagyajewellery.com, or message us on WhatsApp with your order number and a short description. For defect claims, please include your continuous unboxing video.'],
      ['h', 'Our commitment'],
      ['p', 'We acknowledge every grievance within 48 hours and aim to resolve it within 7 working days.']
    ],
    whatsapp: true
  },
  {
    slug: 'terms.html', kicker: 'THE FINE PRINT', title: 'Terms of Service | Saubhagya',
    desc: 'The terms of service for shopping with Saubhagya: orders, pricing, products and use of this website.',
    h1: 'Terms of Service',
    lede: 'By using this website and placing an order, you agree to the terms below.',
    blocks: [
      ['h', 'Orders & pricing'],
      ['p', 'All prices are in Indian Rupees. We reserve the right to correct pricing errors and to decline or cancel any order.'],
      ['h', 'Products'],
      ['p', 'Our jewellery is premium designer imitation (artificial) jewellery. Colours and finishes may vary slightly from screen to piece due to the handcrafted nature of each item.'],
      ['h', 'Use of site'],
      ['p', 'Content on this site is owned by Saubhagya and may not be reproduced without permission. This is placeholder boilerplate; please have it reviewed before going live.']
    ]
  },
  {
    slug: 'offer-terms.html', kicker: 'PROMOTIONS', title: 'Offer Terms & Conditions | Saubhagya',
    desc: 'Terms that apply to discounts, coupons and promotional offers at Saubhagya.',
    h1: 'Offer T&C',
    lede: 'Terms that apply to discounts, coupons and promotional offers.',
    blocks: [
      ['h', 'General'],
      ['p', 'Offers cannot be combined unless stated, apply while stocks last, and may be withdrawn at any time. Discount codes apply to eligible items only.'],
      ['h', 'Eligibility'],
      ['p', 'One use per customer unless specified. Saubhagya reserves the right to disqualify orders that misuse a promotion. This is placeholder boilerplate; please have it reviewed before going live.']
    ]
  },
  {
    slug: 'privacy-policy.html', kicker: 'YOUR DATA', title: 'Privacy Policy | Saubhagya',
    desc: 'How Saubhagya collects, uses and protects your data when you shop with us.',
    h1: 'Privacy Policy',
    lede: 'We respect your privacy and collect only what we need to fulfil your order and improve your experience.',
    blocks: [
      ['h', 'What we collect'],
      ['p', 'Contact and delivery details you provide at checkout, and basic usage data to keep the site fast and secure.'],
      ['h', 'How we use it'],
      ['p', 'To process orders, arrange insured delivery, provide support, and (only with your consent) send offers. We do not sell your personal data.'],
      ['h', 'Your choices'],
      ['p', 'You can ask us to access or delete your data any time by writing to care@saubhagyajewellery.com. This is placeholder boilerplate; please have it reviewed before going live.']
    ]
  }
];

function contentPage(d) {
  const crumb = breadcrumb([['Home', 'index.html'], [d.h1, null]]);
  const blocks = d.blocks.map(b => b[0] === 'h'
    ? `<h2>${esc(b[1])}</h2>`
    : `<p>${esc(b[1])}</p>`).join('\n  ');
  const related = (d.related || []).map(r => `<a class="pill" href="${r[1]}">${esc(r[0])} &rarr;</a>`).join('');
  const wa = d.whatsapp ? `<a class="btn" href="${WHATSAPP}">Chat on WhatsApp</a>` : '';
  const body = `${crumb.html}
<section class="ph">
  <div class="kicker">${d.kicker}</div>
  <h1>${esc(d.h1)}</h1>
  <p class="lede">${esc(d.lede)}</p>
</section>
<section class="prose">
  ${blocks}
  ${related ? `<div class="pillrow">${related}</div>` : ''}
  ${wa}
  <div class="back"><a href="index.html">&larr; Back to shopping</a></div>
</section>`;
  return page({ slug: d.slug, title: d.title, desc: d.desc, h1: d.h1, active: d.slug, jsonld: crumb.ld, body });
}

/* ---------- stylesheet ---------- */
const CSS = `*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:#FAFAFA;color:#1A1A1A;font-family:'Montserrat',sans-serif;line-height:1.5}
a{color:inherit;text-decoration:none}
img{max-width:100%}
h1,h2,h3{font-family:'Cormorant Garamond',serif;font-weight:500;color:#1A1A1A;margin:0}
.kicker{font-size:11px;letter-spacing:4px;color:#C5A059;margin-bottom:14px}
.kicker.center{text-align:center}
.kicker.gold{color:#C5A059}
.center{text-align:center}
.lede{font-weight:300;font-size:15px;line-height:1.85;color:#6a6a6a;max-width:640px}
.btn{display:inline-block;font-size:12px;letter-spacing:2px;padding:15px 32px;background:#0B3C26;color:#fff;border:1px solid #0B3C26;cursor:pointer;transition:background .3s}
.btn:hover{background:#06281a}
.btn-ghost{background:transparent;color:#1A1A1A;border:1px solid #C5A059}
.btn-ghost:hover{background:#C5A059;color:#fff}
.cta-row{display:flex;gap:16px;flex-wrap:wrap;margin-top:28px}
/* header */
header.site{position:sticky;top:0;z-index:30;background:rgba(255,255,255,.92);backdrop-filter:blur(12px);border-bottom:1px solid rgba(197,160,89,.18)}
.nav{display:flex;align-items:center;gap:20px;padding:16px 40px;max-width:1280px;margin:0 auto}
.navlinks{flex:1;display:flex;gap:20px;flex-wrap:wrap;font-size:12px;letter-spacing:.5px}
.navlink{padding-bottom:2px;border-bottom:1px solid transparent;white-space:nowrap}
.navlink:hover,.navlink.is-active{border-bottom:1px solid #C5A059}
.logo{flex:none;text-align:center}
.logo-name{display:block;font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:600;color:#0B3C26;letter-spacing:1px;line-height:1}
.logo-sub{display:block;font-size:8px;letter-spacing:5px;color:#C5A059;margin-top:3px}
.nav-icons{flex:1;display:flex;gap:18px;justify-content:flex-end;font-size:11px;letter-spacing:1px;color:#1A1A1A}
.nav-icons a:hover{color:#0B3C26}
/* breadcrumb */
.crumb{max-width:1280px;margin:0 auto;padding:18px 40px 0;font-size:11px;letter-spacing:.6px;color:#9a9a9a}
.crumb a:hover{color:#0B3C26}
.crumb i{font-style:normal;margin:0 10px}
.crumb span{color:#1A1A1A}
/* page header / hero */
.hero{max-width:900px;margin:0 auto;padding:64px 40px 40px;text-align:center}
.hero h1{font-size:50px;font-weight:400;line-height:1.15;margin:0 auto}
.hero .lede{margin:18px auto 0}
.hero .cta-row{justify-content:center}
.ph{max-width:900px;margin:0 auto;padding:30px 40px 8px}
.ph h1{font-size:44px;font-weight:400;line-height:1.14}
.band{max-width:1280px;margin:0 auto;padding:56px 40px}
.band h2{font-size:34px}
.band h2.center{margin-bottom:36px}
/* heritage cards */
.ccards{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:8px}
.ccard{position:relative;height:300px;display:flex;flex-direction:column;justify-content:flex-end;padding:26px;color:#fff;overflow:hidden}
.ccard-emerald{background:repeating-linear-gradient(135deg,#0d3324 0 20px,#0a2c1f 20px 40px)}
.ccard-charcoal{background:repeating-linear-gradient(135deg,#232323 0 20px,#1c1c1c 20px 40px)}
.ccard-maroon{background:repeating-linear-gradient(135deg,#5a131e 0 20px,#460d16 20px 40px)}
.ccard-k{font-size:10px;letter-spacing:3px;color:#C5A059;margin-bottom:8px}
.ccard-t{font-family:'Cormorant Garamond',serif;font-size:26px}
/* product grid */
.grid-wrap{max-width:1280px;margin:0 auto;padding:20px 40px 70px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
.card{display:block}
.card-img{position:relative;height:300px;background:repeating-linear-gradient(135deg,#f1efe9 0 16px,#e9e6dd 16px 32px);display:flex;align-items:center;justify-content:center;overflow:hidden}
.card-img-photo{background:#efece4}
.card-photo{width:100%;height:100%;object-fit:cover;display:block;transition:transform .9s cubic-bezier(.22,1,.36,1)}
.card:hover .card-photo{transform:scale(1.05)}
.card-ph{font-size:9px;letter-spacing:2px;color:#b3ab98}
.card-tag{position:absolute;top:12px;left:12px;background:rgba(255,255,255,.92);padding:5px 10px;font-size:9px;letter-spacing:1.2px;color:#0B3C26;z-index:2}
.card-name{font-family:'Cormorant Garamond',serif;font-size:19px;color:#1A1A1A;margin-top:14px;line-height:1.3}
.card-price{font-size:13px;font-weight:500;color:#0B3C26;margin-top:6px}
.card-price small{color:#9a9a9a;font-weight:400;font-size:10px}
.cta-row .btn{margin-top:0}
.grid-wrap .cta-row{justify-content:center;margin-top:48px}
/* seo block */
.seo{max-width:900px;margin:0 auto;padding:10px 40px 60px}
.seo h2{font-size:28px;margin-bottom:14px}
.seo p{font-weight:300;font-size:14px;line-height:1.9;color:#4a4a4a}
/* reviews */
.reviews{background:#06281a;padding:70px 40px}
.reviews h2.light{color:#fff;margin-bottom:36px}
.rgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;max-width:1280px;margin:0 auto}
.rcard{background:rgba(255,255,255,.04);border:1px solid rgba(197,160,89,.25);padding:30px 26px}
.rstars{color:#C5A059;letter-spacing:3px}
.rcard p{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:19px;line-height:1.5;color:#f3ede0;margin:16px 0 20px}
.rname{font-size:12px;color:#fff}
.rmeta{font-size:11px;color:rgba(255,255,255,.5);margin-top:3px}
/* prose / content pages */
.prose{max-width:760px;margin:0 auto;padding:12px 40px 70px}
.prose h2{font-size:24px;margin:28px 0 10px}
.prose p{font-weight:300;font-size:14px;line-height:1.9;color:#4a4a4a;margin:0 0 14px;max-width:680px}
.pillrow{display:flex;flex-wrap:wrap;gap:12px;margin:18px 0}
.pill{font-size:12px;letter-spacing:.5px;color:#0B3C26;border:1px solid #ddd6c6;padding:11px 16px}
.pill:hover{border-color:#C5A059}
.back{margin-top:40px;border-top:1px solid #eae5d8;padding-top:22px;font-size:11px;letter-spacing:1px;color:#9a9a9a}
.back a:hover{color:#0B3C26}
/* footer */
footer.site{background:#06281a;color:#fff;padding:60px 40px 30px}
.fwrap{max-width:1280px;margin:0 auto;display:grid;grid-template-columns:1.7fr 1fr 1fr 1.2fr;gap:40px}
.fbrand p{font-weight:300;font-size:12px;line-height:1.8;color:rgba(255,255,255,.6);margin-top:16px;max-width:300px}
.fhead{font-size:10px;letter-spacing:2px;color:#C5A059;margin-bottom:16px}
.fcol a{display:block;font-weight:300;font-size:13px;color:rgba(255,255,255,.75);margin-bottom:11px}
.fcol a:hover{color:#C5A059}
.fatelier{font-weight:300;font-size:12px;line-height:1.7;color:rgba(255,255,255,.6)}
.fwa{display:inline-block;margin-top:14px;font-size:12px;border-bottom:1px solid #C5A059;padding-bottom:3px;color:#fff}
.fbar{max-width:1280px;margin:32px auto 0;padding-top:20px;border-top:1px solid rgba(255,255,255,.12);display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;font-size:11px;color:rgba(255,255,255,.45)}
.fpay i{font-style:normal;border:1px solid rgba(255,255,255,.2);padding:4px 9px;margin-left:8px;font-size:10px;letter-spacing:1px}
/* responsive */
@media(max-width:900px){
  .nav{flex-direction:column;gap:14px;padding:14px 20px}
  .navlinks,.nav-icons{justify-content:center;flex:none}
  .ccards,.grid,.rgrid{grid-template-columns:repeat(2,1fr)}
  .fwrap{grid-template-columns:1fr 1fr}
  .hero h1{font-size:36px}.ph h1{font-size:34px}
  .band,.hero,.ph,.prose,.seo,.crumb,.grid-wrap{padding-left:20px;padding-right:20px}
}
@media(max-width:560px){
  .grid,.ccards,.rgrid{grid-template-columns:1fr}
  /* compact mobile footer */
  footer.site{padding:28px 16px 18px}
  .fwrap{grid-template-columns:1fr 1fr;gap:22px 16px;align-items:start}
  .fbrand{grid-column:1/-1;text-align:center;padding-bottom:14px;border-bottom:1px solid rgba(197,160,89,.18);margin-bottom:4px}
  .fbrand p{display:none}
  .fhead{font-size:9px;letter-spacing:1.5px;margin-bottom:10px}
  .fcol a{font-size:11px;margin-bottom:7px}
  .fatelier{font-size:10px;line-height:1.55;text-align:center}
  .fwa{display:inline-block;margin-top:8px;font-size:11px;padding:6px 12px;background:rgba(197,160,89,.12);border:1px solid rgba(197,160,89,.4)}
  .fbar{flex-direction:column;gap:6px;align-items:center;text-align:center;margin-top:16px;padding-top:12px;font-size:10px}
  .fpay{display:none}
  .logo-name{font-size:20px;letter-spacing:1px}
  .logo-sub{font-size:7px;letter-spacing:4px}
}
/* PDP mobile: single column + sticky cart */
@media(max-width:768px){
  div[style*="1fr 1fr"]{
    grid-template-columns:1fr !important;
    gap:24px !important;
    padding:20px !important;
    padding-bottom:80px !important
  }
  div[style*="position:sticky"]{position:static !important}
  div[style*="Cormorant"][style*="42px"]{font-size:28px !important}
  div[style*="4 / 5"],div[style*="4/5"]{max-height:45vh !important}
  button[style*="letter-spacing"][style*="54px"]{
    position:fixed !important;bottom:0 !important;left:0 !important;
    right:0 !important;width:100% !important;height:56px !important;
    border-radius:0 !important;z-index:999 !important
  }
}`;

/* ---------- write ---------- */
function write(name, content) {
  fs.writeFileSync(path.join(OUT, name), content, 'utf8');
  return name;
}

const written = [];
written.push(write('site.css', CSS));
// Home is index.html (the dynamic app) per user preference; no static home is generated.
['south', 'modern', 'bridal'].forEach(k => written.push(write(COLLECTIONS[k].slug, collectionPage(k))));
CONTENT.forEach(d => written.push(write(d.slug, contentPage(d))));

// sitemap + robots
const pageSlugs = ['index.html', ...['south', 'modern', 'bridal'].map(k => COLLECTIONS[k].slug), ...CONTENT.map(d => d.slug)];
const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pageSlugs.map(s => `  <url><loc>${urlOf(s)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;
written.push(write('sitemap.xml', sitemap));
written.push(write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${BASE_URL}/sitemap.xml\n`));

console.log('Generated ' + written.length + ' files into ' + OUT + ':');
written.forEach(w => console.log('  - ' + w));
console.log('\nProducts baked into collection pages: 24 each (catalog has ' + CATALOG.length + ' total).');
console.log('Remember to set BASE_URL in build/site.js to your real domain.');
