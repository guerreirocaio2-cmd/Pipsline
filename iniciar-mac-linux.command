#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'Instale o Node.js 24 pelo site nodejs.org e abra este arquivo novamente.'
  exit 1
fi
node -e 'if (Number(process.versions.node.split(".")[0]) < 24) { console.error("Instale o Node.js 24 ou superior pelo site nodejs.org."); process.exit(1); }'
if ! command -v npm >/dev/null 2>&1; then
  printf '%s\n' 'O npm não foi encontrado. Reinstale o Node.js 24 com o npm incluído.'
  exit 1
fi
if [ ! -f node_modules/tsx/package.json ]; then
  printf '%s\n' 'Preparando o Pipsfit. Na primeira vez, é necessário acesso à internet.'
  npm ci --no-audit --no-fund
fi
if [ ! -f dist/index.html ]; then
  npm run build
fi
export NODE_ENV=development
export HOST=127.0.0.1
export PORT="${PORT:-3001}"
export APP_ORIGIN="http://localhost:$PORT"
printf '%s\n' 'Iniciando o Pipsfit. Mantenha esta janela aberta enquanto usar o aplicativo.'
node scripts/abrir-navegador.mjs &
open_helper_pid=$!
trap 'kill "$open_helper_pid" 2>/dev/null || true' EXIT
npm start
