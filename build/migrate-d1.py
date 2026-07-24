#!/usr/bin/env python3
"""
Saubhagya Jewellery - D1 Catalog Generator
==========================================
Single source of truth for the storefront catalog.

  * Necklaces (SJ-SN01..05) x 3 colours (GL/GR/WH) = 15 SKUs, MULTI-COLOUR:
    each colour is its own D1 row; the `variants` JSON links the siblings so
    the product page shows colour swatches and swaps SKU in place.
  * Earrings (SJ-ER01..06 -MH) = 6 SKUs, SINGLE (no variants).
  * Jhumkas  (14 files) = 14 SKUs, SINGLE independent products (no switcher,
    no colour label). GL=Gold; the "S" in SGL is just a random tag, not a
    colour — so each file is its own Jhumka design with its own name.

Images are the owner's originals, copied byte-for-byte to images/products/
(filename == SKU). Never edited/resized.

Outputs:
  1. build/seed-d1.sql           - DELETE + INSERT for D1
  2. build/complete-catalog.json - static/localhost fallback for catalog.js

Usage:
  python build/migrate-d1.py
Then seed:  wrangler d1 execute saubhagya-db     --remote --file=build/seed-d1.sql
UAT:        wrangler d1 execute saubhagya-db-uat --remote --file=build/seed-d1.sql
"""

import json, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = 'images/products'   # unique filenames = no CDN immutable-cache clash

# ── Pricing (ALL-INCLUSIVE: listed price is final, checkout adds nothing) ──
# Necklace cost build-up: product 315 + courier 90 + packaging 25 + 3% GST
# + ~2.4% gateway => break-even ~456; sell 549 leaves ~Rs 90/unit.
# Earrings/jhumkas reuse the same band FOR NOW (owner to confirm real cost).
PRICE = 549
MRP = 740
STOCK_DEFAULT = 5

ADJ = ['Royal', 'Heritage', 'Peacock', 'Lotus', 'Divine', 'Regal', 'Grand', 'Antique']

# Multi-colour necklaces ------------------------------------------------------
NECK_COLORS = {'GL': 'Gold', 'GR': 'Green', 'WH': 'White'}
NECK_ORDER = ['GL', 'GR', 'WH']
NECK_DESIGNS = ['SJ-SN01', 'SJ-SN02', 'SJ-SN03', 'SJ-SN04', 'SJ-SN05']

# Jhumkas — every file is its own single product (no colour switcher, no
# colour label). Order preserves the folder order; each gets a distinct name.
JHUMKAS = ['SJ-JH01-GL', 'SJ-JH01-SGL', 'SJ-JH02-GL', 'SJ-JH02-SGL',
           'SJ-JH03-GL', 'SJ-JH03-SGL', 'SJ-JH04-GL', 'SJ-JH04-SGL',
           'SJ-JH05-GL', 'SJ-JH05-SGL', 'SJ-JH06-GL', 'SJ-JH06-SGL',
           'SJ-JH07-GL', 'SJ-JH08-GL']
JHUMKA_NAMES = ['Royal', 'Heritage', 'Peacock', 'Lotus', 'Divine', 'Regal',
                'Grand', 'Antique', 'Celestial', 'Imperial', 'Kundan',
                'Meenakari', 'Temple', 'Nakshi']

# Single earrings (all -MH) --------------------------------------------------
EARRINGS = ['SJ-ER01-MH', 'SJ-ER02-MH', 'SJ-ER03-MH', 'SJ-ER04-MH', 'SJ-ER05-MH', 'SJ-ER06-MH']


def _img(sku):
    path = os.path.join(BASE, IMG_DIR, f'{sku}.jpeg')
    if not os.path.exists(path):
        raise SystemExit(f'MISSING IMAGE: {IMG_DIR}/{sku}.jpeg')
    return f'{IMG_DIR}/{sku}.jpeg'


def _row(sku, name, category, badge='', variants=None):
    return {
        'sku': sku, 'name': name,
        'region': 'modern', 'regionLabel': 'Mumbai Modern',
        'category': category, 'price': PRICE, 'mrp': MRP, 'city': 'Mumbai',
        'badge': badge, 'image': _img(sku), 'altImage': '',
        'inStock': 1, 'stock_count': STOCK_DEFAULT, 'variants': variants,
    }


def build_catalog():
    cat = []

    # necklaces (multi-colour)
    for i, design in enumerate(NECK_DESIGNS):
        name = f'{ADJ[i]} Short Necklace'
        variants = [{'sku': f'{design}-{c}', 'label': NECK_COLORS[c],
                     'image': _img(f'{design}-{c}')} for c in NECK_ORDER]
        for c in NECK_ORDER:
            sku = f'{design}-{c}'
            cat.append(_row(sku, name, 'Necklace',
                            badge='NEW' if (design == 'SJ-SN01' and c == 'GL') else '',
                            variants=variants))

    # jhumkas (each file = its own single product, unique name, no colour)
    for i, sku in enumerate(JHUMKAS):
        cat.append(_row(sku, f'{JHUMKA_NAMES[i]} Jhumkas', 'Jhumkas',
                        badge='NEW' if i == 0 else ''))

    # earrings (single)
    for i, sku in enumerate(EARRINGS):
        cat.append(_row(sku, f'{ADJ[i]} Earrings', 'Earring',
                        badge='NEW' if i == 0 else ''))

    return cat


def esc(val):
    if val is None:
        return 'NULL'
    if isinstance(val, (int, float)):
        return str(int(val))
    return "'" + str(val).replace("'", "''") + "'"


def variants_sql(v):
    return 'NULL' if not v else esc(json.dumps(v))


def generate_sql(products):
    lines = [
        'DELETE FROM products;',
        'INSERT INTO products (sku, name, region, regionLabel, category, price, mrp, city, badge, image, altImage, inStock, stock_count, variants) VALUES',
    ]
    rows = []
    for p in products:
        rows.append(
            f"  ({esc(p['sku'])}, {esc(p['name'])}, {esc(p['region'])}, {esc(p['regionLabel'])}, "
            f"{esc(p['category'])}, {p['price']}, {p['mrp']}, {esc(p['city'])}, {esc(p['badge'])}, "
            f"{esc(p['image'])}, {esc(p['altImage'])}, {p['inStock']}, {p['stock_count']}, "
            f"{variants_sql(p['variants'])})"
        )
    lines.append(',\n'.join(rows) + ';')
    return '\n'.join(lines)


def main():
    catalog = build_catalog()
    by_cat = {}
    for p in catalog:
        by_cat[p['category']] = by_cat.get(p['category'], 0) + 1
    with open(os.path.join(BASE, 'build', 'complete-catalog.json'), 'w') as f:
        json.dump(catalog, f, indent=2)
    with open(os.path.join(BASE, 'build', 'seed-d1.sql'), 'w') as f:
        f.write(generate_sql(catalog) + '\n')
    print(f'{len(catalog)} SKUs: ' + ', '.join(f'{k}={v}' for k, v in by_cat.items()))


if __name__ == '__main__':
    main()
