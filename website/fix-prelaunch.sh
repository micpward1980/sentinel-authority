#!/bin/bash
# ══════════════════════════════════════════════════════════
#  Sentinel Authority — Pre-Launch Fix Script
#  
#  Copy to: ~/Downloads/sentinel-authority/website/
#  Run:     bash fix-prelaunch.sh
# ══════════════════════════════════════════════════════════

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║   SENTINEL AUTHORITY PRE-LAUNCH FIXES         ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo ""
echo "  Working in: $SCRIPT_DIR"
echo ""

# ──────────────────────────────────────────────────────────
# 🔴 CRITICAL FIX 1: Broken <meta charset> in index.html
# ──────────────────────────────────────────────────────────
echo "  [1/9] Fixing broken meta charset in index.html..."
sed -i '' 's|<meta charset="UTF-8  <link|<meta charset="UTF-8" />\
  <link|' index.html

# ──────────────────────────────────────────────────────────
# 🔴 CRITICAL FIX 2: Remove all truncated -webkit- lines
# ──────────────────────────────────────────────────────────
echo "  [2/9] Removing truncated -webkit- lines (22 instances)..."
for f in index.html 404.html research.html scenarios.html security.html conformance-agreement.html status.html; do
  if [ -f "$f" ]; then
    sed -i '' '/^[[:space:]]*-webkit-$/d' "$f"
  fi
done

# ──────────────────────────────────────────────────────────
# 🔴 CRITICAL FIX 3: Railway URL → api.sentinelauthority.org
# ──────────────────────────────────────────────────────────
echo "  [3/9] Fixing exposed Railway URL in status.html..."
sed -i '' 's|https://sentinel-authority-production.up.railway.app/api/verify/status/|https://api.sentinelauthority.org/api/verify/status/|g' status.html

# ──────────────────────────────────────────────────────────
# 🔴 CRITICAL FIX 4: CONVERGENCE → CONFORMANCE
# ──────────────────────────────────────────────────────────
echo "  [4/9] Fixing CONVERGENCE → CONFORMANCE in index.html..."
sed -i '' 's/CONVERGENCE FACTORS/CONFORMANCE FACTORS/g' index.html

# ──────────────────────────────────────────────────────────
# 🟡 FIX 5: Dark background opacity (0.4 → 0.04)
# ──────────────────────────────────────────────────────────
echo "  [5/9] Fixing dark background opacity on verify/contact..."
sed -i '' 's|background: rgba(0,0,0,0.4);|background: rgba(0,0,0,0.04);|' index.html

# ──────────────────────────────────────────────────────────
# 🟡 FIX 6: Canonical URL → www on index.html
# ──────────────────────────────────────────────────────────
echo "  [6/9] Normalizing canonical URL to www..."
sed -i '' 's|href="https://sentinelauthority.org/"|href="https://www.sentinelauthority.org/"|' index.html

# ──────────────────────────────────────────────────────────
# 🟡 FIX 7: Add conformance-agreement to sitemap
# ──────────────────────────────────────────────────────────
echo "  [7/9] Adding conformance-agreement.html to sitemap..."
if ! grep -q "conformance-agreement" sitemap.xml 2>/dev/null; then
  sed -i '' '/<\/urlset>/i\
  <url><loc>https://sentinelauthority.org/conformance-agreement.html</loc><priority>0.5</priority><changefreq>monthly</changefreq></url>' sitemap.xml
fi

# ──────────────────────────────────────────────────────────
# 🟢 FIX 8: Delete backup/dev files
# ──────────────────────────────────────────────────────────
echo "  [8/9] Removing backup files from production..."
rm -f ./*.colorbak ./*.bak ./*.bloom-backup
rm -f publications/*.bak publications/*.colorbak
rm -f downloads/*.bak downloads/*.colorbak
rm -f index.html.bloom-backup

# ──────────────────────────────────────────────────────────
# 🟢 FIX 9: Remove empty genie directory
# ──────────────────────────────────────────────────────────
echo "  [9/9] Removing empty genie directory..."
rmdir downloads/envelo-interlock/envelo/genie 2>/dev/null || true

# ══════════════════════════════════════════════════════════
# VERIFICATION
# ══════════════════════════════════════════════════════════
echo ""
echo "  ── VERIFICATION ──"
echo ""

ERRORS=0

# Charset
if grep -q 'charset="UTF-8"' index.html; then
  echo "  ✓ Meta charset fixed"
else
  echo "  ✗ Meta charset STILL BROKEN"; ERRORS=$((ERRORS+1))
fi

# Webkit
if grep -rq '^[[:space:]]*-webkit-$' index.html 404.html research.html scenarios.html security.html conformance-agreement.html status.html 2>/dev/null; then
  echo "  ✗ Truncated -webkit- lines REMAIN"; ERRORS=$((ERRORS+1))
else
  echo "  ✓ Truncated -webkit- lines removed"
fi

# Railway
if grep -q "railway.app" status.html 2>/dev/null; then
  echo "  ✗ Railway URL STILL EXPOSED"; ERRORS=$((ERRORS+1))
else
  echo "  ✓ Railway URL → api.sentinelauthority.org"
fi

# Convergence
if grep -qi "convergence" index.html 2>/dev/null; then
  echo "  ✗ CONVERGENCE still in index.html"; ERRORS=$((ERRORS+1))
else
  echo "  ✓ CONVERGENCE → CONFORMANCE"
fi

# Background
if grep -q "rgba(0,0,0,0\.4)" index.html 2>/dev/null; then
  echo "  ✗ Dark background (0.4) still present"; ERRORS=$((ERRORS+1))
else
  echo "  ✓ Background opacity → 0.04"
fi

# Canonical
if grep 'canonical' index.html | grep -q 'www.sentinelauthority'; then
  echo "  ✓ Canonical URL normalized to www"
else
  echo "  ✗ Canonical still missing www"; ERRORS=$((ERRORS+1))
fi

# Sitemap
if grep -q "conformance-agreement" sitemap.xml 2>/dev/null; then
  echo "  ✓ conformance-agreement.html in sitemap"
else
  echo "  ✗ conformance-agreement.html NOT in sitemap"; ERRORS=$((ERRORS+1))
fi

# Backups
BAK_COUNT=$(find . \( -name "*.bak" -o -name "*.colorbak" -o -name "*.bloom-backup" \) 2>/dev/null | wc -l | tr -d ' ')
if [ "$BAK_COUNT" = "0" ]; then
  echo "  ✓ Backup files removed"
else
  echo "  ⚠ $BAK_COUNT backup files remain"
fi

echo ""
if [ "$ERRORS" = "0" ]; then
  echo "  ══════════════════════════════════════════════"
  echo "  ✓ ALL 9 FIXES APPLIED — Ready to deploy"
  echo "  ══════════════════════════════════════════════"
  echo ""
  echo "  Deploy now:"
  echo "    bash deploy.sh"
  echo ""
else
  echo "  ══════════════════════════════════════════════"
  echo "  ✗ $ERRORS ISSUES REMAIN — Review above"
  echo "  ══════════════════════════════════════════════"
fi
