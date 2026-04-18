#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_SCRIPT="${ROOT_DIR}/scripts/build-standalone.sh"
NOMAP_DIR="${ROOT_DIR}/dist/nomap"
MAP_DIR="${ROOT_DIR}/dist/map"
VERSION=""

usage() {
    cat <<'EOF'
Usage:
  scripts/build-dist.sh [--version <version>]

Options:
  --version <version>  Override VERSION file value for both outputs.
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

NOMAP_CMD=("${BUILD_SCRIPT}" "--out-dir" "${NOMAP_DIR}")
MAP_CMD=("${BUILD_SCRIPT}" "--out-dir" "${MAP_DIR}" "--with-map")

if [[ -n "${VERSION}" ]]; then
    NOMAP_CMD+=("--version" "${VERSION}")
    MAP_CMD+=("--version" "${VERSION}")
fi

echo "Building nomap standalone dist..."
"${NOMAP_CMD[@]}"

echo "Building map standalone dist..."
"${MAP_CMD[@]}"

echo "Done."
