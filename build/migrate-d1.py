#!/usr/bin/env python3
"""
Saubhagya Jewellery – D1 Migration Script
======================================
Reproduces the exact same 150-product catalog as catalog.js / build/site.js,
merges in products.json overrides, and outputs:
  1. seed.sql       – INSERT statements for D1
  2. complete.json  – full merged catalog as JSON (for reference / R2 fallback)

Usage:
  cd /c/Users/Daya/Documents/GitHub/saubhagyajewellery
  python build/migrate-d1.py
"""

import json, math, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── Reproduce the deterministic algorithm from catalog.js ──────────

REGIONS = {
    'south': {
        'label': 'South Indian Traditional',
        'cities': ['Chennai', 'Madurai', 'Coimbatore', 'Bengaluru', 'Hyderabad'],
        'cats': ['Temple Necklace', 'Lakshmi Haaram', 'Matte Jhumkas', 'Vanki', 'Maang Tikka', 'Kasu Mala', 'Bridal Set']
    },
    'modern': {
        'label': 'Mumbai Modern',
        'cities': ['Mumbai', 'Pune', 'Ahmedabad', 'Surat'],
        'cats': ['AD Necklace', 'Bridal Pendant', 'Solitaire Studs', 'Designer Drop', 'Pendant Set', 'Statement Choker']
    },
    'bridal': {
        'label': 'North Indian Bridal',
        'cities': ['Delhi', 'Jaipur', 'Lucknow', 'Chandigarh', 'Amritsar'],
        'cats': ['Kundan Set', 'Polki Choker', 'Rani Haar', 'Nath', 'Passa', 'Bridal Set', 'Meenakari Set']
    }
}
ADJ = ['Royal', 'Heritage', 'Regal', 'Antique', 'Imperial', 'Maharani', 'Grand', 'Celestial',
       'Noble', 'Vintage', 'Lotus', 'Peacock', 'Divine', 'Padmini', 'Aurelia', 'Mughal']
PREFIX = {'south': 'SI', 'modern': 'MM', 'bridal': 'NB'}
BADGES = ['', '', '', '', 'BESTSELLER', 'NEW', 'TRENDING']
BLOCKED_SKUS = ['CC-NB-002']
BLOCKED_NAMES = ['Regal Lakshmi Haaram', 'Regal Bridal Set', 'Antique Rani Haar']

def rng(seed):
    x = math.sin(seed) * 10000
    return x - math.floor(x)

def build_base():
    """Generate 150 base products, same algorithm as catalog.js."""
    catalog = []
    for ri, (reg_key, R) in enumerate(REGIONS.items()):
        for i in range(1, 51):
            seed = ri * 1000 + i
            cat = R['cats'][int(math.floor(rng(seed) * len(R['cats'])))]
            adj = ADJ[int(math.floor(rng(seed * 1.7) * len(ADJ)))]
            price = round((1200 + rng(seed * 2.3) * 8800) / 50) * 50
            mrp = round(price * (1.18 + rng(seed * 3.1) * 0.24) / 50) * 50
            sku = 'CC-' + PREFIX[reg_key] + '-' + str(i).zfill(3)
            city = R['cities'][int(math.floor(rng(seed * 4.2) * len(R['cities'])))]
            badge = BADGES[int(math.floor(rng(seed * 5.5) * len(BADGES)))]
            catalog.append({
                'sku': sku, 'name': adj + ' ' + cat,
                'region': reg_key, 'regionLabel': R['label'], 'category': cat,
                'price': price, 'mrp': mrp, 'city': city, 'badge': badge,
                'image': '', 'altImage': '', 'inStock': 1
            })
    return catalog

def load_overrides():
    """Load products.json overrides, same as build/site.js."""
    path = os.path.join(BASE, 'products.json')
    if not os.path.exists(path):
        return {}
    with open(path, 'r') as f:
        raw = json.load(f)
    if isinstance(raw, dict) and 'products' in raw and isinstance(raw['products'], dict):
        return raw['products']
    return raw if isinstance(raw, dict) else {}

def apply_overrides(base, overrides):
    """Merge overrides onto base, same as catalog.js applyOverrides()."""
    result = []
    for p in base:
        if p['sku'] in BLOCKED_SKUS or p['name'] in BLOCKED_NAMES:
            continue
        o = overrides.get(p['sku'])
        if o and isinstance(o, dict):
            if o.get('name'): p['name'] = o['name']
            if isinstance(o.get('price'), (int, float)): p['price'] = int(o['price'])
            if isinstance(o.get('mrp'), (int, float)): p['mrp'] = int(o['mrp'])
            if o.get('image'): p['image'] = o['image']
            if o.get('altImage'): p['altImage'] = o['altImage']
            if 'badge' in o: p['badge'] = o['badge'] if o['badge'] else ''
        result.append(p)
    return result

def escape_sql(val):
    """Escape a string value for SQLite."""
    if val is None:
        return 'NULL'
    if isinstance(val, (int, float)):
        return str(int(val))
    s = str(val).replace("'", "''")
    return f"'{s}'"

def generate_sql(products):
    """Generate D1 INSERT statements."""
    lines = [
        "DELETE FROM products;",
        "INSERT INTO products (sku, name, region, regionLabel, category, price, mrp, city, badge, image, altImage, inStock) VALUES"
    ]
    values = []
    for p in products:
        row = f"  ({escape_sql(p['sku'])}, {escape_sql(p['name'])}, {escape_sql(p['region'])}, {escape_sql(p['regionLabel'])}, {escape_sql(p['category'])}, {p['price']}, {p['mrp']}, {escape_sql(p['city'])}, {escape_sql(p['badge'])}, {escape_sql(p['image'])}, {escape_sql(p['altImage'])}, {p['inStock']})"
        values.append(row)
    lines.append(",\n".join(values) + ";")
    return "\n".join(lines)

def main():
    base = build_base()
    overrides = load_overrides()
    merged = apply_overrides(base, overrides)
    
    print(f"Base products:  {len(base)}")
    print(f"Overrides:      {len(overrides)}")
    print(f"Merged (active): {len(merged)}")
    
    # Output 1: complete JSON (for reference)
    out_json = os.path.join(BASE, 'build', 'complete-catalog.json')
    with open(out_json, 'w') as f:
        json.dump(merged, f, indent=2)
    print(f"\n✅ JSON written: {out_json}")
    
    # Output 2: SQL seed file
    out_sql = os.path.join(BASE, 'build', 'seed-d1.sql')
    sql = generate_sql(merged)
    with open(out_sql, 'w') as f:
        f.write(sql)
        f.write("\n")
    print(f"✅ SQL written:  {out_sql}")
    
    with_img = sum(1 for p in merged if p['image'])
    print(f"\nSummary: {len(merged)} products, {with_img} with images")

if __name__ == '__main__':
    main()
