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

check_examples_html() {
    html_list=$(mktemp)
    find ./examples -type f -name '*.html' | sort > "$html_list"

    while IFS= read -r html; do
        [ -n "$html" ] || continue

        rel_html=${html#./}
        dir=$(dirname "$html")

        tmp=$(mktemp)
        awk '
            {
                row = $0
                if (row ~ /<script/ && row ~ /src="/) {
                    while (match(row, /src="[^"]+"/)) {
                        src = substr(row, RSTART + 5, RLENGTH - 6)
                        printf "%d\t%s\n", NR, src
                        row = substr(row, RSTART + RLENGTH)
                    }
                }
            }
        ' "$html" > "$tmp"

        while IFS="$tab_char" read -r line src; do
            [ -n "$src" ] || continue

            case "$src" in
                http://*|https://*|//*|data:*|javascript:*|mailto:*)
                    continue
                    ;;
                /*)
                    [ -e ".${src}" ] || report_missing "$rel_html" "$line" "$src"
                    ;;
                *)
                    [ -e "$dir/$src" ] || report_missing "$rel_html" "$line" "$src"
                    ;;
            esac
        done < "$tmp"
        rm -f "$tmp"

        tmp=$(mktemp)
        awk '
            {
                row = $0
                if (row ~ /at-at="/) {
                    while (match(row, /at-at="[^"]+"/)) {
                        val = substr(row, RSTART + 7, RLENGTH - 8)
                        printf "%d\t%s\n", NR, val
                        row = substr(row, RSTART + RLENGTH)
                    }
                }
            }
        ' "$html" > "$tmp"

        while IFS="$tab_char" read -r line atval; do
            [ -n "$atval" ] || continue

            old_ifs=$IFS
            IFS=' '
            set -- $atval
            IFS=$old_ifs

            for token in "$@"; do
                case "$token" in
                    import:*)
                        ref=${token#import:}
                        ref=${ref%%#*}
                        [ -n "$ref" ] || continue

                        case "$ref" in
                            http://*|https://*|//*)
                                continue
                                ;;
                            /*)
                                [ -e ".${ref}" ] || report_missing "$rel_html" "$line" "$token"
                                ;;
                            *)
                                [ -e "$dir/$ref" ] || report_missing "$rel_html" "$line" "$token"
                                ;;
                        esac
                        ;;
                esac
            done
        done < "$tmp"
        rm -f "$tmp"
    done < "$html_list"

    rm -f "$html_list"
}

check_markdown_example_links() {
    md_list=$(mktemp)
    {
        find ./docs/usage -type f -name '*.md'
        find ./docs/api -type f -name '*.md'
        [ -f ./README.md ] && echo ./README.md
    } | sort -u > "$md_list"

    while IFS= read -r md; do
        [ -n "$md" ] || continue

        rel_md=${md#./}
        base=$(dirname "$md")

        tmp=$(mktemp)
        awk '
            BEGIN { in_fence = 0 }
            {
                if ($0 ~ /^```/) {
                    in_fence = !in_fence
                    next
                }
                if (in_fence) next

                row = $0
                while (match(row, /\]\(([^)]*examples[^)]*)\)/)) {
                    token = substr(row, RSTART, RLENGTH)
                    sub(/^\]\(/, "", token)
                    sub(/\)$/, "", token)
                    printf "%d\t%s\n", NR, token
                    row = substr(row, RSTART + RLENGTH)
                }
            }
        ' "$md" > "$tmp"

        while IFS="$tab_char" read -r line link; do
            [ -n "$link" ] || continue

            link=$(printf '%s' "$link" | sed 's/ \".*$//; s/^<//; s/>$//')

            case "$link" in
                ''|http://*|https://*|mailto:*|\#*|data:*|javascript:*|tel:*)
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
    done < "$md_list"

    rm -f "$md_list"
}

check_examples_html
check_markdown_example_links

if [ "$fail_count" -gt 0 ]; then
    echo "Validation failed: ${fail_count} missing local reference(s)." >&2
    exit 1
fi

echo "Validation passed: no missing local script/import/example-link references."
