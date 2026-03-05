#!/bin/bash
set -e
echo "Building..."
npm run build
echo "Deploying to Vercel..."
DEPLOY_URL=$(npx vercel deploy --prod 2>&1 | grep "Production:" | head -1 | awk '{print $2}' | sed 's|https://||')
echo "Aliasing: $DEPLOY_URL"
npx vercel alias $DEPLOY_URL app.sentinelauthority.org
echo "✅ Done — app.sentinelauthority.org → https://$DEPLOY_URL"
