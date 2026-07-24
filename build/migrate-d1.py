#!/usr/bin/env python3
"""
Saubhagya Jewellery - D1 Catalog Generator
==========================================
Single source of truth for the storefront catalog.
5 short-necklace designs x 3 colours (GL=Gold, GR=Green, WH=White) = 15 SKUs.
Each colour is its own D1 row (own stock count, own orderable SKU); the
`variants` JSON on every row links the 3 sibling colours so the product
page can render colour swatches and swap SKU in place.

Outputs:
  1. build/seed-d1.sql          - DELETE + INSERT for D1
  2. build/complete-catalog.json - static/localhost fallback for catalog.js

Usage:
  python build/migrate-d1.py
Then seed (live):
  wrangler d1 execute saubhagya-db --remote --file=build/seed-d1.sql
UAT:
  wrangler d1 execute saubhagya-db-uat --remote --file=build/seed-d1.sql
"""

import json, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── Pricing (ALL-INCLUSIVE: listed price is final, checkout adds nothing) ──
# Cost build-up per short necklace: product 315 + avg courier 90 + packaging 25
# + 3% GST (inclusive) + ~2.4% gateway  =>  break-even ~456.
# Sell 549 leaves ~Rs 90/unit (~16%) after all costs. MRP = ceil(549/0.75).
PRICE = 549
MRP = 740

COLORS = {'GL': 'Gold', 'GR': 'Green', 'WH': 'White'}
COLOR_ORDER = ['GL', 'GR', 'WH']

# design code -> display name (colour appended per row)
DESIGNS = {
    'SJ-SN01': 'Royal Short Necklace',
    'SJ-SN02': 'Heritage Short Necklace',
    'SJ-SN03': 'Peacock Short Necklace',
    'SJ-SN04': 'Lotus Short Necklace',
    'SJ-SN05': 'Divine Short Necklace',
}

STOCK_PER_COLOR = 4          # 12 pcs per design / 3 colours
CATEGORY = 'Necklace'
IMG_DIR = 'images/products'  # new dir; unique filenames = no CDN cache clash


def build_catalog():
    catalog = []
    for design, base_name in DESIGNS.items():
        variants = [
            {'sku': f'{design}-{c}', 'label': COLORS[c],
             'image': f'{IMG_DIR}/{design}-{c}.jpeg'}
            for c in COLOR_ORDER
        ]
        for ci, c in enumerate(COLOR_ORDER):
            sku = f'{design}-{c}'
            img = f'{IMG_DIR}/{sku}.jpeg'
            if not os.path.exists(os.path.join(BASE, IMG_DIR, f'{sku}.jpeg')):
                raise SystemExit(f'MISSING IMAGE: {IMG_DIR}/{sku}.jpeg')
            catalog.append({
                'sku': sku,
                'name': f'{base_name} ({COLORS[c]})',
                'region': 'modern', 'regionLabel': 'Mumbai Modern',
                'category': CATEGORY,
                'price': PRICE, 'mrp': MRP,
                'city': 'Mumbai',
                'badge': 'NEW' if (design == 'SJ-SN01' and c == 'GL') else '',
                'image': img, 'altImage': '',
                'inStock': 1,
                'stock_count': STOCK_PER_COLOR,
                'variants': variants,
            })
    return catalog


def esc(val):
    if val is None:
        return 'NULL'
    if isinstance(val, (int, float)):
        return str(int(val))
    return "'" + str(val).replace("'", "''") + "'"


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
            f"{esc(json.dumps(p['variants']))})"
        )
    lines.append(',\n'.join(rows) + ';')
    return '\n'.join(lines)


def main():
    catalog = build_catalog()
    out_json = os.path.join(BASE, 'build', 'complete-catalog.json')
    with open(out_json, 'w') as f:
        json.dump(catalog, f, indent=2)
    out_sql = os.path.join(BASE, 'build', 'seed-d1.sql')
    with open(out_sql, 'w') as f:
        f.write(generate_sql(catalog) + '\n')
    print(f'{len(catalog)} SKUs ({len(DESIGNS)} designs x {len(COLORS)} colours)')
    print(f'OK JSON: {out_json}')
    print(f'OK SQL:  {out_sql}')


if __name__ == '__main__':
    main()
