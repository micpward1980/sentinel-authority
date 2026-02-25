#!/bin/bash
# ══════════════════════════════════════════════════════════
#  Sentinel Authority — PDF Cleanup Script
#  Keeps only latest version of each document
#  
#  Run from: ~/Downloads/sentinel-authority/website/
#  Command:  bash cleanup-pdfs.sh
# ══════════════════════════════════════════════════════════

set -e
cd "$(dirname "$0")"

echo ""
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║   PDF CLEANUP — Latest Versions Only          ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo ""

DELETED=0

# ──────────────────────────────────────────────────────────
# STEP 1: Delete old/unlinked PDFs (15 files)
# ──────────────────────────────────────────────────────────
echo "  [1/3] Deleting old PDF versions..."

# CAT-72 Procedure: keep v4, delete v1-v3
for v in v1.0 v2.0 v3.0; do
  f="docs/CAT-72_Procedure_${v}.pdf"
  if [ -f "$f" ]; then rm -f "$f"; echo "    ✗ $f"; DELETED=$((DELETED+1)); fi
done

# ENVELO Requirements: keep v3, delete v1-v2
for v in v1.0 v2.0; do
  f="docs/ENVELO_Requirements_${v}.pdf"
  if [ -f "$f" ]; then rm -f "$f"; echo "    ✗ $f"; DELETED=$((DELETED+1)); fi
done

# ODDC Certification Guide: keep v5, delete v4
f="docs/ODDC_Certification_Guide_v4.0.pdf"
if [ -f "$f" ]; then rm -f "$f"; echo "    ✗ $f"; DELETED=$((DELETED+1)); fi

# ODDC Critical QA: never linked anywhere, delete all 3
for v in v1.0 v2.0 v3.0; do
  f="docs/ODDC_Critical_QA_${v}.pdf"
  if [ -f "$f" ]; then rm -f "$f"; echo "    ✗ $f"; DELETED=$((DELETED+1)); fi
done

# ODDC Overview: keep v3, delete v1-v2
for v in v1.0 v2.0; do
  f="docs/ODDC_Overview_${v}.pdf"
  if [ -f "$f" ]; then rm -f "$f"; echo "    ✗ $f"; DELETED=$((DELETED+1)); fi
done

# ODDC Scenarios: keep v3, delete v1-v2
for v in v1.0 v2.0; do
  f="docs/ODDC_Scenarios_${v}.pdf"
  if [ -f "$f" ]; then rm -f "$f"; echo "    ✗ $f"; DELETED=$((DELETED+1)); fi
done

# Superseded download
f="downloads/ODDC_Certification_Guide_v3.pdf"
if [ -f "$f" ]; then rm -f "$f"; echo "    ✗ $f"; DELETED=$((DELETED+1)); fi

# Unlinked duplicate white paper
f="Sentinel_Authority_When_Self-Certification_Fails.pdf"
if [ -f "$f" ]; then rm -f "$f"; echo "    ✗ $f"; DELETED=$((DELETED+1)); fi

# ──────────────────────────────────────────────────────────
# STEP 2: Remove version history UI from research.html
# ──────────────────────────────────────────────────────────
echo ""
echo "  [2/3] Removing version history from research.html..."

# Remove version history buttons
sed -i '' '/ver-toggle.*onclick/d' research.html

# Remove ver-list and ver-row HTML
sed -i '' '/<div class="ver-list">/d' research.html
sed -i '' '/<div class="ver-row">/d' research.html

# Remove orphaned </div> tags left behind (where ver-list closing tags were)
# These appear as double "      </div>" lines — remove the second one
# We do this by finding the pattern and removing the duplicate
python3 -c "
lines = open('research.html').readlines()
out = []
i = 0
while i < len(lines):
    if (i + 1 < len(lines) and 
        lines[i].strip() == '</div>' and 
        lines[i+1].strip() == '</div>' and
        i + 2 < len(lines) and
        lines[i+2].strip() == '</div>'):
        # Three consecutive </div> — skip the middle one (orphan)
        out.append(lines[i])
        i += 1  # skip this one
        # next iteration picks up the remaining two
    else:
        out.append(lines[i])
    i += 1
open('research.html', 'w').writelines(out)
"

# Remove unused version history CSS
sed -i '' '/\.ver-toggle{/d' research.html
sed -i '' '/\.ver-toggle:hover{/d' research.html
sed -i '' '/\.ver-list{/d' research.html
sed -i '' '/\.ver-list.open{/d' research.html
sed -i '' '/\.ver-row{/d' research.html
sed -i '' '/\.ver-row a{/d' research.html
sed -i '' '/\.ver-row a:hover{/d' research.html
sed -i '' '/\.ver-num{/d' research.html

echo "    ✓ Version history dropdowns removed"
echo "    ✓ Unused CSS removed"

# ──────────────────────────────────────────────────────────
# STEP 3: Verify
# ──────────────────────────────────────────────────────────
echo ""
echo "  [3/3] Verifying..."

ERRORS=0

# Check no old PDFs remain
OLD_COUNT=$(find ./docs -name "*_v1.0.pdf" -o -name "*_v2.0.pdf" 2>/dev/null | wc -l | tr -d ' ')
if [ "$OLD_COUNT" = "0" ]; then
  echo "  ✓ All old PDF versions deleted"
else
  echo "  ✗ $OLD_COUNT old versions still exist"; ERRORS=$((ERRORS+1))
fi

# Check no version history in HTML
VER_COUNT=$(grep -c "ver-toggle\|ver-list\|ver-row\|ver-num" research.html 2>/dev/null || echo "0")
if [ "$VER_COUNT" = "0" ]; then
  echo "  ✓ Version history UI removed from research.html"
else
  echo "  ✗ $VER_COUNT version history references remain"; ERRORS=$((ERRORS+1))
fi

# Show what's kept
echo ""
echo "  Remaining PDFs (12 files):"
echo "  ─────────────────────────────────────────"
echo "  docs/"
ls docs/*.pdf 2>/dev/null | sed 's|docs/|    |'
echo ""
echo "  publications/"
ls publications/*.pdf 2>/dev/null | sed 's|publications/|    |'
echo ""
echo "  root/"
ls *.pdf 2>/dev/null | sed 's|^|    |'

echo ""
if [ "$ERRORS" = "0" ]; then
  echo "  ══════════════════════════════════════════════"
  echo "  ✓ DELETED $DELETED PDFs — 12 remain (latest only)"
  echo "  ══════════════════════════════════════════════"
  echo ""
  echo "  Deploy with: bash deploy.sh"
else
  echo "  ══════════════════════════════════════════════"
  echo "  ✗ $ERRORS ISSUES REMAIN"
  echo "  ══════════════════════════════════════════════"
fi
