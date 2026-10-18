#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'Instale o Node.js 24 pelo site nodejs.org e abra este arquivo novamente.'
  exit 1
fi
node scripts/iphone-mac.mjs
