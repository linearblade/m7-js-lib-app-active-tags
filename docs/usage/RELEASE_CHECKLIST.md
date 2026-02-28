# Release Checklist

[README](../../README.md) -> [Usage TOC](./TOC.md)

Use this page as the single pre-release gate for ActiveTags `v1.0+`.

---

## One-command gate

From repo root:

```bash
sh scripts/release-check.sh
```

This script verifies:

* versioned dist artifacts exist for current [../../VERSION](../../VERSION)
* example/doc local links and imports resolve
* docs/example bundle references match current version (`activeTags.standalone.v<version>.min.js`)
* legacy naming drift is not reintroduced
* examples use `SERVICE_ID` (no hardcoded `app.activetags`)
* canonical example location remains `examples/stockTicker`

---

## Release flow

1. Set/update [../../VERSION](../../VERSION).
2. Build standalone dist:
   ```bash
   scripts/build-standalone.sh --with-map
   ```
3. Run release gate:
   ```bash
   sh scripts/release-check.sh
   ```
4. Smoke test key examples in browser:
   * [../../examples/inject/fromFile/injectFromFile.html](../../examples/inject/fromFile/injectFromFile.html)
   * [../../examples/requestHTTP/requestHTTP.html](../../examples/requestHTTP/requestHTTP.html)
   * [../../examples/stockTicker/stockTicker.html](../../examples/stockTicker/stockTicker.html)
   * [../../examples/tutorial/tutorial.html](../../examples/tutorial/tutorial.html)
5. Confirm canonical install flow in examples/docs:
   * import `install` + `SERVICE_ID` from standalone runtime
   * `const lib = install({ conf })`
   * `const AT = lib.service.get(SERVICE_ID)`
   * `await AT.start()`

---

## Related

* [BUNDLING.md](./BUNDLING.md)
* [INSTALLATION.md](./INSTALLATION.md)
* [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
