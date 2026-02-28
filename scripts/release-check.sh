#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

fail_count=0

ok() {
    echo "[ok] $1"
}

fail() {
    echo "[fail] $1" >&2
    fail_count=$((fail_count + 1))
}

run_gate() {
    label="$1"
    shift
    if "$@"; then
        ok "$label"
    else
        fail "$label"
    fi
}

VERSION_VALUE=$(tr -d '[:space:]' < VERSION)
if [ -z "$VERSION_VALUE" ]; then
    fail "VERSION is empty."
else
    ok "VERSION=${VERSION_VALUE}"
fi

DIST_JS="dist/activeTags.standalone.v${VERSION_VALUE}.min.js"
DIST_LEGAL="${DIST_JS}.LEGAL.txt"

if [ -f "$DIST_JS" ]; then
    ok "dist artifact present: $DIST_JS"
else
    fail "missing dist artifact: $DIST_JS"
fi

if [ -f "$DIST_LEGAL" ]; then
    ok "legal artifact present: $DIST_LEGAL"
else
    fail "missing legal artifact: $DIST_LEGAL"
fi

run_gate "examples/docs local reference validator" sh scripts/validate-links.sh
run_gate "docs markdown link validator" sh scripts/validate-doc-links.sh

grep_scan() {
    grep -RIn \
        --exclude-dir=.git \
        --exclude-dir=archive \
        --exclude-dir=todo \
        --exclude=legacy_readme.md \
        "$@"
}

tmp_versioned=$(mktemp)
tmp_mismatch=$(mktemp)
tmp_old=$(mktemp)
tmp_legacy=$(mktemp)
tmp_hardcoded=$(mktemp)
trap 'rm -f "$tmp_versioned" "$tmp_mismatch" "$tmp_old" "$tmp_legacy" "$tmp_hardcoded"' EXIT HUP INT TERM

if grep_scan -E "activeTags\\.standalone\\.v[0-9][0-9.]*\\.min\\.js" README.md docs examples > "$tmp_versioned"; then
    grep -v "\\.v${VERSION_VALUE}\\.min\\.js" "$tmp_versioned" > "$tmp_mismatch" || true
    if [ -s "$tmp_mismatch" ]; then
        cat "$tmp_mismatch" >&2
        fail "dist version mismatch: expected v${VERSION_VALUE} in all docs/example references."
    else
        ok "all docs/example dist references match v${VERSION_VALUE}"
    fi
else
    fail "no versioned dist references found in README/docs/examples."
fi

if grep_scan "activeTags\\.standalone\\.min\\.js" README.md docs examples > "$tmp_old"; then
    cat "$tmp_old" >&2
    fail "unversioned dist path references found."
else
    ok "no unversioned dist path references found"
fi

if grep_scan -E "site\\.activeTags|fromFileStandAlone" README.md docs src examples > "$tmp_legacy"; then
    cat "$tmp_legacy" >&2
    fail "legacy naming references found (site.activeTags/fromFileStandAlone)."
else
    ok "no legacy naming references found"
fi

if grep -RIn -E "service\\.get\\((\"app\\.activetags\"|'app\\.activetags')\\)" examples > "$tmp_hardcoded"; then
    cat "$tmp_hardcoded" >&2
    fail "hardcoded ActiveTags service id found in examples (use SERVICE_ID constant)."
else
    ok "examples use SERVICE_ID constant (no hardcoded service id)"
fi

if [ ! -d "./examples/stockTicker" ]; then
    fail "canonical example directory missing: examples/stockTicker"
else
    ok "canonical stockTicker directory present"
fi

if [ -d "./stockTicker" ]; then
    fail "stale top-level stockTicker directory present (should live under examples/stockTicker)."
else
    ok "no stale top-level stockTicker directory"
fi

if [ "$fail_count" -gt 0 ]; then
    echo "Release check failed: ${fail_count} issue(s)." >&2
    exit 1
fi

echo "Release check passed."
