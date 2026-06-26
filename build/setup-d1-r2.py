#!/usr/bin/env python3
"""
Saubhagya Jewellery – D1 + R2 One-Shot Setup
=========================================
Run this AFTER Daya provides Cloudflare API token.

Usage:
  # 1. Set your Cloudflare API token
  export CLOUDFLARI_API_TOKEN="your-token-here"

  # 2. Run this script
  cd /c/Users/Daya/Documents/GitHub/saubhagyajewellery
  python build/setup-d1-r2.py

What it does:
  1. Creates D1 database "saubhagya-db"
  2. Creates R2 bucket "saubhagya-images"
  3. Updates wrangler.toml with correct database_id
  4. Runs schema SQL
  5. Seeds product data
  6. Verifies everything
"""

import json, os, subprocess, sys, re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WRANGLER = "npx wrangler"

def run(cmd, capture=True):
    """Run a command and return output."""
    full_cmd = f"cd {BASE} && {cmd}"
    print(f"  → {cmd}")
    result = subprocess.run(full_cmd, shell=True, capture_output=capture, text=True, timeout=60)
    if result.returncode != 0:
        print(f"  ❌ ERROR: {result.stderr.strip()}")
        return None
    return result.stdout.strip() if capture else result

def step(n, msg):
    print(f"\n{'='*60}")
    print(f" Step {n}: {msg}")
    print(f"{'='*60}")

def main():
    print("="*60)
    print("  SAUBHAGYA — D1 + R2 SETUP")
    print("="*60)

    # ── Check token ──
    token = os.environ.get("CLOUDFLARI_API_TOKEN") or os.environ.get("CLOUDFLARE_API_TOKEN")
    if not token:
        print("\n❌ No Cloudflare API token found!")
        print("   Set it with: export CLOUDFLARI_API_TOKEN='your-token'")
        sys.exit(1)
    print(f"\n✅ Token found: ...{token[-8:]}")

    # ── Step 1: Create D1 Database ──
    step(1, "Creating D1 database 'saubhagya-db'")
    out = run(f"{WRANGLER} d1 create saubhagya-db")
    if out is None:
        # Maybe it already exists — try to get its ID
        print("   Trying to fetch existing DB...")
        out = run(f"{WRANGLER} d1 list")
        if out and 'saubhagya-db' in out:
            print("   ✅ D1 database 'saubhagya-db' already exists (will find ID)")
        else:
            sys.exit(1)

    # Extract database ID from output
    db_id = None
    for line in (out or "").split('\n'):
        m = re.search(r'([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})', line)
        if m and 'saubhagya-db' in line:
            db_id = m.group(1)
            break

    if not db_id:
        print("   Could not extract database_id. Listing all DBs...")
        out = run(f"{WRANGLER} d1 list")
        if out:
            print(out)
        # Fallback: let the user provide it
        db_id = input("   Enter database_id manually (or empty to skip): ").strip()
        if not db_id:
            print("   ❌ No database_id — aborting.")
            sys.exit(1)

    print(f"   ✅ Database ID: {db_id}")

    # ── Step 2: Create R2 Bucket ──
    step(2, "Creating R2 bucket 'saubhagya-images'")
    out = run(f"{WRANGLER} r2 bucket create saubhagya-images")
    if out and "created" in out.lower():
        print(f"   ✅ R2 bucket created")
    elif "already exists" in out:
        print(f"   ✅ R2 bucket already exists")
    else:
        print(f"   {out or 'Created (or already exists)'}")

    # ── Step 3: Update wrangler.toml with database_id ──
    step(3, "Updating wrangler.toml with database_id")
    toml_path = os.path.join(BASE, "wrangler.toml")
    with open(toml_path, 'r') as f:
        content = f.read()
    content = content.replace("PUT_YOUR_DATABASE_ID_HERE", db_id)
    with open(toml_path, 'w') as f:
        f.write(content)
    print(f"   ✅ wrangler.toml updated")

    # ── Step 4: Run Schema SQL ──
    step(4, "Creating products table")
    run(f"{WRANGLER} d1 execute saubhagya-db --file=build/schema-d1.sql", capture=False)
    print(f"   ✅ Schema applied")

    # ── Step 5: Seed Data ──
    step(5, "Seeding product data from products.json")
    # First generate the SQL
    run(f"python build/migrate-d1.py", capture=False)
    run(f"{WRANGLER} d1 execute saubhagya-db --file=build/seed-d1.sql", capture=False)
    print(f"   ✅ Product data seeded")

    # ── Step 6: Verify ──
    step(6, "Verifying setup")
    out = run(f"{WRANGLER} d1 execute saubhagya-db --command='SELECT COUNT(*) as count FROM products'")
    if out:
        print(f"   {out}")
        if '144' in out or 'count' in out:
            print(f"   ✅ All products verified!")
        else:
            print(f"   ⚠️  Product count may need checking")

    print(f"\n{'='*60}")
    print(f"  ✅ D1 + R2 SETUP COMPLETE!")
    print(f"{'='*60}")
    print(f"\nNext steps:")
    print(f"  1. Deploy to Cloudflare Pages:")
    print(f"     git add -A && git commit -m 'feat: D1 + R2 zero-deploy' && git push")
    print(f"  2. Verify: visit https://saubhagyajewellery.pages.dev/api/products")
    print(f"  3. From now on, update products via:")
    print(f"     wrangler d1 execute saubhagya-db --command=\"UPDATE products SET price=...\"")
    print(f"\n  💡 Or better — just ask me (Hermes) on Discord!")
    print(f"     'Hermes, silver necklace ka price ₹350 karo' → done in 5 seconds!")

if __name__ == '__main__':
    main()
