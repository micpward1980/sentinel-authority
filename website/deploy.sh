#!/bin/bash
cd ~/Downloads/sentinel-authority/website
OUTPUT=$(npx vercel deploy --prod --yes 2>&1)
echo "$OUTPUT"
URL=$(echo "$OUTPUT" | grep "Production:" | grep -o 'https://[^ ]*\.vercel\.app' | head -1)
if [ -z "$URL" ]; then
  echo "❌ Could not parse production URL from output"
  exit 1
fi
echo "→ Aliasing $URL"
npx vercel alias "$URL" www.sentinelauthority.org
npx vercel alias "$URL" sentinelauthority.org
echo "✅ Done — www.sentinelauthority.org → $URL"
