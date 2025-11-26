#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${ROOT_DIR}/ecolav-instalador-build"
DIST_DIR="${ROOT_DIR}/dist/installers"
DEB_SRC_DIR="${ROOT_DIR}/src-tauri/target/release/bundle/deb"

if ! command -v zip >/dev/null 2>&1; then
  echo "❌ O utilitário 'zip' é obrigatório para empacotar o instalador." >&2
  exit 1
fi

if ! compgen -G "${DEB_SRC_DIR}/*.deb" >/dev/null; then
  echo "❌ Nenhum pacote .deb encontrado em ${DEB_SRC_DIR}. Execute 'npm run tauri:build' antes do instalador." >&2
  exit 1
fi

rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}/chainway-rfid"
mkdir -p "${DIST_DIR}"

cp "${ROOT_DIR}/ecolav-instalador/instalar.sh" "${BUILD_DIR}/"
cp "${ROOT_DIR}/ecolav-instalador/README.txt" "${BUILD_DIR}/"
cp "${ROOT_DIR}"/src-tauri/target/release/bundle/deb/*.deb "${BUILD_DIR}/"
cp "${ROOT_DIR}/scale-server.cjs" "${BUILD_DIR}/"
cp "${ROOT_DIR}/package.json" "${BUILD_DIR}/"
cp "${ROOT_DIR}/package-lock.json" "${BUILD_DIR}/" 2>/dev/null || true
cp "${ROOT_DIR}/rfid-config.json" "${BUILD_DIR}/"

rsync -a --exclude 'node_modules' "${ROOT_DIR}/chainway-rfid/" "${BUILD_DIR}/chainway-rfid/"

ARCHIVE_PATH="${DIST_DIR}/ecolav-instalador-linux.zip"
rm -f "${ARCHIVE_PATH}"

(
  cd "${BUILD_DIR}"
  zip -r "${ARCHIVE_PATH}" . >/dev/null
)

echo "✅ Instalador completo gerado em: ${ARCHIVE_PATH}"

