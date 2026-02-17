# Builtin Reference — ActiveTags

[README](../../../README.md) -> [Usage TOC](../TOC.md)

This is the dedicated builtin reference generated from source JSDoc under `src/builtins/**`.

Structure:

1. Module index (namespace-level)
2. Function page (one page per builtin op)

Runtime source of truth:

* [../../../src/builtins/index.js](../../../src/builtins/index.js)

## Modules

* [Confirm (`confirm`)](./confirm/INDEX.md)
* [DOM (`dom.*`)](./dom/INDEX.md)
* [Form (`form.*`)](./form/INDEX.md)
* [HTTP (`http.*`)](./http/INDEX.md)
* [Error (`error.*`)](./error/INDEX.md)
* [Buffer (`buffer.*`)](./buffer/INDEX.md)
* [Target (`target.*`)](./target/INDEX.md)
* [Root Element (`e.*`)](./e/INDEX.md)

## Return Contract Legend

Most builtin functions return StageResult-like objects:

* `status: "ok"` -> continue run phase
* `status: "error"` -> transition to error phase
* `status: "complete"` -> complete ticket without error phase

Some builtins intentionally return non-StageResult scalars (documented per function).

## See also

* [Builtins & Operations](../OPERATIONS_BUILTINS.md)
* [Usage TOC](../TOC.md)
* [README](../../../README.md)
