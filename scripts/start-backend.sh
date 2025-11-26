#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/backend"

cd "${BACKEND_DIR}"

if [ ! -d node_modules ]; then
  echo "📦 Instalando dependências do backend..."
  npm install --production
fi

echo "🚀 Iniciando scale-server..."
node scale-server.cjs

