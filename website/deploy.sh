#!/bin/bash
cd ~/Downloads/sentinel-authority/website
OUTPUT=$(vercel deploy --prod --yes 2>&1)
echo "$OUTPUT"
URL=$(echo "$OUTPUT" | grep "Production:" | awk '{print $NF}')
if [ -n "$URL" ]; then
  echo ""
  echo "Setting aliases..."
  vercel alias "$URL" www.sentinelauthority.org
  vercel alias "$URL" sentinelauthority.org
  echo "Done."
else
  echo "ERROR: Could not extract deploy URL"
fi
