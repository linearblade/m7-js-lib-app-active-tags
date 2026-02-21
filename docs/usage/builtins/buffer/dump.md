# `buffer.dump`

[Builtins Index](../INDEX.md) -> [Buffer Module](./INDEX.md)

Source:

* [../../../../src/builtins/buffer/index.js](../../../../src/builtins/buffer/index.js)

## What it does

Diagnostic helper that logs current buffer contents and metadata.

This op is intentionally non-blocking for pipelines:

* it always returns `ok`
* it never mutates buffer value/meta

## Args

Optional hash args:

* `label`: log label prefix (default: `[AT][buffer.dump]`)
* `includeMeta`: boolish, include `buffer.meta()` (default `true`)
* `includeValue`: boolish, include `buffer.get()` (default `true`)
* `toInputs`: boolish, write dump snapshot to `inputs.bufferDump`

## Side Effects

* Console logging (`console.warn`)
* Optional snapshot mirror to `inputs.bufferDump`

## Return Contract

Always `ok` with detail:

* `op: "buffer.dump"`
* `dumped: true`
* selected include flags
* `logError` indicator when console logging failed
