#!/usr/bin/env bash
# Levanta todo en local: Postgres (Homebrew), Prisma generate + migrate, server y client.
set -euo pipefail
cd "$(dirname "$0")/.."

if command -v brew >/dev/null && ! pg_isready -q 2>/dev/null; then
  echo "▶ Arrancando postgresql@15…"
  brew services start postgresql@15 >/dev/null
  sleep 2
fi

if [ ! -f apps/server/.env ]; then
  echo "✗ Falta apps/server/.env (copia .env.example y ajusta DATABASE_URL)."
  exit 1
fi

pnpm --filter @crm/shared build
pnpm --filter server prisma:generate
pnpm --filter server prisma:migrate:deploy
pnpm --filter server prisma:seed

# Server y client en paralelo; Ctrl+C mata a los dos.
trap 'kill 0' INT TERM
pnpm --filter server start:dev &
pnpm --filter @crm/client dev &
wait
