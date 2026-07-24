#!/usr/bin/env python3
"""
Saubhagya Jewellery - D1 Catalog Generator
==========================================
Single source of truth for the storefront catalog.

  * Short necklaces (SJ-SN01..05) x 3 colours (GL/GR/WH) = 15 SKUs, MULTI-COLOUR.
  * Crystal necklaces (SJ-CY01..06) x {MR=Maroon, GR=Green} = 9 SKUs; designs
    with 2 colours are multi-colour (switcher), MR-only designs are single.
  * Earrings (SJ-ER01..06 -MH = Mehndi) = 6 SKUs, SINGLE.
  * Jhumkas (14 files) = 14 SKUs, SINGLE independent products.

Each colour is its own D1 row; multi-colour rows carry a `variants` JSON that
links the sibling colours so the product page shows swatches + swaps SKU.

Images are the owner's originals, converted to WebP q95 (visually lossless),
in images/products/  (filename == SKU). Never content-edited/cropped.

Outputs:
  1. build/seed-d1.sql
  2. build/complete-catalog.json  (static/localhost fallback)

Usage:  python build/migrate-d1.py
Seed:   wrangler d1 execute saubhagya-db     --remote --file=build/seed-d1.sql
UAT:    wrangler d1 execute saubhagya-db-uat --remote --file=build/seed-d1.sql
"""

import json, math, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = 'images/products'
EXT = '.webp'

# ── Pricing (ALL-INCLUSIVE: listed price is final, checkout adds nothing) ──
#   fixed  = product cost + courier(90) + packaging(25)
#   %costs = 3% GST inclusive (2.913% of price) + 2.36% gateway = 5.273%
#   sell   = fixed / (1 - %costs) + margin, rounded up to a clean ₹5
#   MRP    = ceil(sell / 0.75) to ₹10  (~25% honest "compare at")
COURIER, PACKAGING = 90, 25
PCT_COSTS = 0.02913 + 0.0236
PROFIT = 90               # earrings/jhumkas use 0 (break-even) per owner

def price_from_cost(cost, margin=0):
    fixed = cost + COURIER + PACKAGING
    sell = int(math.ceil((fixed / (1 - PCT_COSTS) + margin) / 5.0) * 5)
    mrp = int(math.ceil((sell / 0.75) / 10.0) * 10)
    return sell, mrp

NECK_STOCK = 4            # 12 pcs per design / 3 colours
SINGLE_STOCK = 12         # earrings + jhumkas + crystal: 12 pcs each SKU

ADJ = ['Royal', 'Heritage', 'Peacock', 'Lotus', 'Divine', 'Regal', 'Grand', 'Antique']

# ── Multi-colour necklaces (short + crystal) ────────────────────────────────
# Each entry: design code, display name, ordered colour codes, price, mrp, weight
COLOR_LABEL = {'GL': 'Gold', 'GR': 'Green', 'WH': 'White', 'MR': 'Maroon'}

SHORT_PRICE, SHORT_MRP = 549, 740          # unchanged (product cost 315, +profit)
CRYSTAL_PRICE, CRYSTAL_MRP = price_from_cost(280, PROFIT)   # cost 280 + profit

NECKLACES = []
for i, d in enumerate(['SJ-SN01', 'SJ-SN02', 'SJ-SN03', 'SJ-SN04', 'SJ-SN05']):
    NECKLACES.append((d, f'{ADJ[i]} Short Necklace', ['GL', 'GR', 'WH'],
                      SHORT_PRICE, SHORT_MRP, None))
CRYSTAL_DESIGNS = {
    'SJ-CY01': ['MR'], 'SJ-CY02': ['MR', 'GR'], 'SJ-CY03': ['MR', 'GR'],
    'SJ-CY04': ['MR', 'GR'], 'SJ-CY05': ['MR'], 'SJ-CY06': ['MR'],
}
for i, (d, cols) in enumerate(CRYSTAL_DESIGNS.items()):
    NECKLACES.append((d, f'{ADJ[i]} Crystal Necklace', cols,
                      CRYSTAL_PRICE, CRYSTAL_MRP, 85))

# ── Jhumkas (single; each file own product; GL=Gold, SGL "S" = random tag) ───
JHUMKAS = ['SJ-JH01-GL', 'SJ-JH01-SGL', 'SJ-JH02-GL', 'SJ-JH02-SGL',
           'SJ-JH03-GL', 'SJ-JH03-SGL', 'SJ-JH04-GL', 'SJ-JH04-SGL',
           'SJ-JH05-GL', 'SJ-JH05-SGL', 'SJ-JH06-GL', 'SJ-JH06-SGL',
           'SJ-JH07-GL', 'SJ-JH08-GL']
JHUMKA_NAMES = ['Royal', 'Heritage', 'Peacock', 'Lotus', 'Divine', 'Regal',
                'Grand', 'Antique', 'Celestial', 'Imperial', 'Kundan',
                'Meenakari', 'Temple', 'Nakshi']
JHUMKA_COST = {
    'SJ-JH01-GL': 110, 'SJ-JH02-GL': 110, 'SJ-JH03-GL': 110,
    'SJ-JH04-GL': 100, 'SJ-JH06-GL': 100, 'SJ-JH08-GL': 100,
    'SJ-JH05-GL': 95,  'SJ-JH07-GL': 95,
    'SJ-JH01-SGL': 100, 'SJ-JH02-SGL': 100, 'SJ-JH03-SGL': 100,
    'SJ-JH04-SGL': 100, 'SJ-JH05-SGL': 100, 'SJ-JH06-SGL': 100,
}

# ── Earrings (single; -MH = Mehndi colour) ──────────────────────────────────
EARRINGS = ['SJ-ER01-MH', 'SJ-ER02-MH', 'SJ-ER03-MH', 'SJ-ER04-MH', 'SJ-ER05-MH', 'SJ-ER06-MH']
EARRING_COST = 115


def _img(sku):
    path = os.path.join(BASE, IMG_DIR, f'{sku}{EXT}')
    if not os.path.exists(path):
        raise SystemExit(f'MISSING IMAGE: {IMG_DIR}/{sku}{EXT}')
    return f'{IMG_DIR}/{sku}{EXT}'


def _row(sku, name, category, price, mrp, stock, weight=None, badge='', variants=None):
    return {
        'sku': sku, 'name': name,
        'region': 'modern', 'regionLabel': 'Mumbai Modern',
        'category': category, 'price': price, 'mrp': mrp, 'city': 'Mumbai',
        'badge': badge, 'image': _img(sku), 'altImage': '',
        'inStock': 1, 'stock_count': stock, 'weightGrams': weight, 'variants': variants,
    }


def build_catalog():
    cat = []
    first_neck = True
    for design, name, cols, price, mrp, weight in NECKLACES:
        variants = None
        if len(cols) > 1:
            variants = [{'sku': f'{design}-{c}', 'label': COLOR_LABEL[c],
                         'image': _img(f'{design}-{c}')} for c in cols]
        for c in cols:
            sku = f'{design}-{c}'
            cat.append(_row(sku, name, 'Necklace', price, mrp, NECK_STOCK, weight,
                            badge='NEW' if first_neck else '', variants=variants))
            first_neck = False

    for i, sku in enumerate(JHUMKAS):
        price, mrp = price_from_cost(JHUMKA_COST[sku])          # break-even
        cat.append(_row(sku, f'{JHUMKA_NAMES[i]} Jhumkas', 'Jhumkas', price, mrp,
                        SINGLE_STOCK, None, badge='NEW' if i == 0 else ''))

    price, mrp = price_from_cost(EARRING_COST)                  # break-even
    for i, sku in enumerate(EARRINGS):
        cat.append(_row(sku, f'{ADJ[i]} Earrings', 'Earring', price, mrp,
                        SINGLE_STOCK, None, badge='NEW' if i == 0 else ''))

    return cat


def esc(val):
    if val is None:
        return 'NULL'
    if isinstance(val, (int, float)):
        return str(int(val))
    return "'" + str(val).replace("'", "''") + "'"


def generate_sql(products):
    lines = [
        'DELETE FROM products;',
        'INSERT INTO products (sku, name, region, regionLabel, category, price, mrp, city, badge, image, altImage, inStock, stock_count, weightGrams, variants) VALUES',
    ]
    rows = []
    for p in products:
        variants_sql = 'NULL' if not p['variants'] else esc(json.dumps(p['variants']))
        weight_sql = 'NULL' if p['weightGrams'] is None else str(int(p['weightGrams']))
        rows.append(
            f"  ({esc(p['sku'])}, {esc(p['name'])}, {esc(p['region'])}, {esc(p['regionLabel'])}, "
            f"{esc(p['category'])}, {p['price']}, {p['mrp']}, {esc(p['city'])}, {esc(p['badge'])}, "
            f"{esc(p['image'])}, {esc(p['altImage'])}, {p['inStock']}, {p['stock_count']}, "
            f"{weight_sql}, {variants_sql})"
        )
    lines.append(',\n'.join(rows) + ';')
    return '\n'.join(lines)


def main():
    catalog = build_catalog()
    by = {}
    for p in catalog:
        by[p['category']] = by.get(p['category'], 0) + 1
    with open(os.path.join(BASE, 'build', 'complete-catalog.json'), 'w') as f:
        json.dump(catalog, f, indent=2)
    with open(os.path.join(BASE, 'build', 'seed-d1.sql'), 'w') as f:
        f.write(generate_sql(catalog) + '\n')
    print(f'{len(catalog)} SKUs: ' + ', '.join(f'{k}={v}' for k, v in by.items()))
    print(f'Crystal necklace price {CRYSTAL_PRICE}/{CRYSTAL_MRP}')


if __name__ == '__main__':
    main()
