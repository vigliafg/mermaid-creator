#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

source scripts/env.sh

if [[ ! -d node_modules ]]; then
  echo "node_modules assente: eseguo npm ci..."
  npm ci
fi

exec npm run tauri:dev
