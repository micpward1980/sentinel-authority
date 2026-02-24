#!/bin/bash
cd ~/Downloads/sentinel-authority/website
vercel deploy --prod --yes
read -p "Paste the Production URL: " URL
vercel alias "$URL" www.sentinelauthority.org
vercel alias "$URL" sentinelauthority.org
echo "Aliases set."
