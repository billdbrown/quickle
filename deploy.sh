#!/usr/bin/env bash
# Deploy quickle.bill.computer: a static site, nothing to build at deploy time.
# (Puzzles come from scripts/generate.mjs, committed as site/days.json.)
set -euo pipefail
cd "$(dirname "$0")"
node --test test/check.test.mjs
CLOUDFLARE_API_TOKEN=$(tr -d ' \r\n' < "$HOME/.config/cloudflare/api-token") \
  npx --yes wrangler@4 deploy
