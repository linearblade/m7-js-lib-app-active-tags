# `error.dump`

[Builtins Index](../INDEX.md) -> [Error Module](./INDEX.md)

Source:

* [../../../../src/builtins/error/errorDump.js](../../../../src/builtins/error/errorDump.js)

## Args

Hash options:

* `includeInputs` (default `true`)
* `includeCtx` (default `false`)
* `console` (default `true`)
* `level` (`warn` or default error logger)
* `printStack` (default `true`)
* `debugger` (default `false`)
* `throw` (default `false`)

## Side Effects

* Builds diagnostic payload from ticket/job/error context.
* Pushes payload into `inputs.errors`.
* Logs to console (unless disabled).
* Optional `debugger` break.
* Optional rethrow (`throw:true`).

## Return Contract

* `ok`: dump recorded.
* `error`: thrown/rethrown failure.
