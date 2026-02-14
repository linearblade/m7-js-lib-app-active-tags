# LOC Count Methodology

[README](../README.md) -> [Docs Root](./)

This document defines a repeatable LOC counting method for ActiveTags and its related m7 libraries.

---

## Purpose

Use this when we want consistent trend checks over time:

* total JS lines
* comment-documentation lines (JSDoc-style estimate)
* code lines

---

## Scope (directories to count)

Primary app:

* `src`

Related libs:

* `../m7-js-lib/src`
* `../m7-js-lib-primitive-dom-changeobserver/src`
* `../m7-js-lib-primitive-dom-eventdelegator/src`
* `../m7-js-lib-primitive-log/src`
* `../m7-js-lib-interval/src`
* `../m7-js-lib-site-form/src`

---

## Counting rules

All counts are over `*.js` files only.

Definitions:

1. `total_lines`
   every line in every matched JS file
2. `comment_lines`
   lines matching:
   `^\s*(/\*|\*)`
3. `code_lines`
   `total_lines - comment_lines`

This comment heuristic is intentionally JSDoc-oriented.

---

## Known limitations

This method does not count:

* `//` single-line comments
* inline block comment fragments not starting the line

So `comment_lines` is a stable estimate for doc-heavy block comments, not an exact full-comment metric.

---

## Single-directory command

Run from project root:

```bash
find src -type f -name '*.js' -print0 | \
xargs -0 awk 'BEGIN{files=0;total=0;comment=0} FNR==1{files++} {total++; if ($0 ~ /^[[:space:]]*(\/\*|\*)/) comment++} END{code=total-comment; printf("files=%d\ntotal_lines=%d\ncomment_lines=%d\ncode_lines=%d\n", files, total, comment, code)}'
```

Replace `src` with any target directory listed above.

---

## Combined rollup command

Run from project root:

```bash
dirs=(
  "src"
  "../m7-js-lib/src"
  "../m7-js-lib-primitive-dom-changeobserver/src"
  "../m7-js-lib-primitive-dom-eventdelegator/src"
  "../m7-js-lib-primitive-log/src"
  "../m7-js-lib-interval/src"
  "../m7-js-lib-site-form/src"
)

g_files=0
g_total=0
g_comment=0
g_code=0

for d in "${dirs[@]}"; do
  out=$(find "$d" -type f -name '*.js' -print0 | xargs -0 awk 'BEGIN{files=0;total=0;comment=0} FNR==1{files++} {total++; if ($0 ~ /^[[:space:]]*(\/\*|\*)/) comment++} END{code=total-comment; printf("%d %d %d %d\n", files, total, comment, code)}')
  read -r files total comment code <<< "$out"
  printf "%s\nfiles=%d total=%d comment=%d code=%d\n\n" "$d" "$files" "$total" "$comment" "$code"
  g_files=$((g_files+files))
  g_total=$((g_total+total))
  g_comment=$((g_comment+comment))
  g_code=$((g_code+code))
done

printf "GRAND_TOTAL\nfiles=%d total=%d comment=%d code=%d\n" "$g_files" "$g_total" "$g_comment" "$g_code"
```

---

## Baseline snapshot (2026-02-13)

Using this exact method:

* `src`: files `57`, total `18265`, comment `10845`, code `7420`
* `../m7-js-lib/src`: files `16`, total `3537`, comment `1306`, code `2231`
* `../m7-js-lib-primitive-dom-changeobserver/src`: files `2`, total `1675`, comment `659`, code `1016`
* `../m7-js-lib-primitive-dom-eventdelegator/src`: files `2`, total `1406`, comment `670`, code `736`
* `../m7-js-lib-primitive-log/src`: files `9`, total `2077`, comment `908`, code `1169`
* `../m7-js-lib-interval/src`: files `5`, total `2618`, comment `791`, code `1827`
* `../m7-js-lib-site-form/src`: files `3`, total `663`, comment `238`, code `425`

Grand total:

* files `94`
* total `30241`
* comment `15417`
* code `14824`
