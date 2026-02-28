#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

fail_count=0
tab_char=$(printf '\t')

report_missing() {
    file="$1"
    line="$2"
    target="$3"
    echo "[missing] ${file}:${line} -> ${target}"
    fail_count=$((fail_count + 1))
}

normalize_link_target() {
    # Input: raw markdown target
    # Output: normalized path-ish value (still relative/absolute URL form)
    raw="$1"
    out=$(printf '%s' "$raw" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')

    case "$out" in
        \<*\>)
            out=$(printf '%s' "$out" | sed 's/^<//; s/>$//')
            ;;
    esac

    # Strip optional markdown title suffix: (path "title") / (path 'title')
    # Keep this intentionally simple for repo-local links.
    out=$(printf '%s' "$out" | sed 's/[[:space:]]\+".*$//; s/[[:space:]]\+'\''.*$//')

    printf '%s' "$out"
}

check_doc_file() {
    md="$1"
    rel_md=${md#./}
    base=$(dirname "$md")

    tmp=$(mktemp)

    # Extract markdown links outside fenced code blocks.
    awk '
        BEGIN { in_fence = 0 }
        {
            line = $0
            if (line ~ /^```/) {
                in_fence = !in_fence
                next
            }
            if (in_fence) next

            start = 1
            while (start <= length(line)) {
                rest = substr(line, start)
                idx = index(rest, "](")
                if (idx == 0) break
                idx = start + idx - 1

                left = idx
                while (left > 0 && substr(line, left, 1) != "[") left--
                if (left <= 0) {
                    start = idx + 2
                    continue
                }

                pos = idx + 2
                depth = 1
                link = ""
                while (pos <= length(line)) {
                    ch = substr(line, pos, 1)
                    if (ch == "(") {
                        depth++
                        link = link ch
                    } else if (ch == ")") {
                        depth--
                        if (depth == 0) break
                        link = link ch
                    } else {
                        link = link ch
                    }
                    pos++
                }

                if (depth == 0) {
                    printf "%d\t%s\n", NR, link
                    start = pos + 1
                } else {
                    break
                }
            }
        }
    ' "$md" > "$tmp"

    while IFS="$tab_char" read -r line raw_link; do
        [ -n "$raw_link" ] || continue
        link=$(normalize_link_target "$raw_link")
        [ -n "$link" ] || continue

        case "$link" in
            http://*|https://*|mailto:*|tel:*|data:*|javascript:*|\#*)
                continue
                ;;
        esac

        path=${link%%#*}
        [ -n "$path" ] || continue

        case "$path" in
            /*)
                target=".${path}"
                ;;
            *)
                target="$base/$path"
                ;;
        esac

        [ -e "$target" ] || report_missing "$rel_md" "$line" "$link"
    done < "$tmp"

    rm -f "$tmp"
}

main() {
    md_list=$(mktemp)

    find ./docs \
        -type f \
        -name '*.md' \
        ! -path './docs/archive/*' \
        ! -path './docs/todo/*' \
        ! -path './docs/legacy_readme.md' \
        | sort > "$md_list"

    while IFS= read -r md; do
        [ -n "$md" ] || continue
        check_doc_file "$md"
    done < "$md_list"

    rm -f "$md_list"

    if [ "$fail_count" -gt 0 ]; then
        echo "Doc link validation failed: ${fail_count} missing local link target(s)." >&2
        exit 1
    fi

    echo "Doc link validation passed: no missing local link targets in active docs."
}

main "$@"
