#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENTRY_FILE="${ROOT_DIR}/src/standalone/prebundle.js"
VERSION_FILE="${ROOT_DIR}/VERSION"
DIST_DIR="${ROOT_DIR}/dist/nomap"
BANNER=$'/**\n * @license\n * Copyright (c) 2026 m7.org\n * SPDX-License-Identifier: LicenseRef-MTL-10\n */'

WITH_MAP=0
VERSION=""

usage() {
    cat <<'EOF'
Usage:
  scripts/build-standalone.sh [--version <version>] [--out-dir <dir>] [--with-map]

Options:
  --version <version>  Override VERSION file value.
  --out-dir <dir>      Output directory for the bundle.
  --with-map           Also emit source map output.
  -h, --help           Show this help text.
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --version)
            if [[ $# -lt 2 ]]; then
                echo "error: --version requires a value" >&2
                exit 1
            fi
            VERSION="$2"
            shift 2
            ;;
        --out-dir)
            if [[ $# -lt 2 ]]; then
                echo "error: --out-dir requires a value" >&2
                exit 1
            fi
            DIST_DIR="$2"
            shift 2
            ;;
        --with-map)
            WITH_MAP=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "error: unknown argument '$1'" >&2
            usage
            exit 1
            ;;
    esac
done

if [[ -z "${VERSION}" ]]; then
    if [[ ! -f "${VERSION_FILE}" ]]; then
        echo "error: VERSION file not found at ${VERSION_FILE}" >&2
        exit 1
    fi
    VERSION="$(tr -d '[:space:]' < "${VERSION_FILE}")"
fi

if [[ -z "${VERSION}" ]]; then
    echo "error: version is empty" >&2
    exit 1
fi

mkdir -p "${DIST_DIR}"

OUT_BASE="${DIST_DIR}/activeTags.standalone.v${VERSION}.min.js"

ESBUILD_BIN="npx"
ESBUILD_ARGS=(--yes esbuild@0.27.3)
if command -v esbuild >/dev/null 2>&1; then
    ESBUILD_BIN="esbuild"
    ESBUILD_ARGS=()
fi

BUILD_CMD=(
    "${ESBUILD_BIN}"
    "${ESBUILD_ARGS[@]}"
    "${ENTRY_FILE}"
    --bundle
    --format=esm
    --minify
    --legal-comments=linked
    "--define:__AT_VERSION__=\"${VERSION}\""
    --banner:js="${BANNER}"
    --outfile="${OUT_BASE}"
)

if [[ "${WITH_MAP}" -eq 1 ]]; then
    BUILD_CMD+=(--sourcemap)
fi

echo "Building standalone bundle:"
echo "  version: ${VERSION}"
echo "  map:     $([[ "${WITH_MAP}" -eq 1 ]] && echo "yes" || echo "no")"
echo "  output:  ${OUT_BASE}"

"${BUILD_CMD[@]}"

if [[ "${WITH_MAP}" -eq 0 ]]; then
    rm -f "${OUT_BASE}.map"
fi

echo "Done."
