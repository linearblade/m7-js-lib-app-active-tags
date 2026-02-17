# `buffer.traverse`

[Builtins Index](../INDEX.md) -> [Buffer Module](./INDEX.md)

Source:

* [../../../../src/builtins/buffer/bufferTraverse.js](../../../../src/builtins/buffer/bufferTraverse.js)

## Args

Supported shapes:

* `{ path: "a.b[0].c", required?: boolean }`
* `{ value: "a.b[0].c", required?: boolean }`
* scalar/positional shorthand

Defaults:

* `required` defaults to `true`

## Side Effects

* Resolves path inside `buffer.get()`.
* Overwrites buffer with resolved sub-value.
* Writes traversal metadata into buffer meta: `{ traverse: { path, tokens } }`.
* Mirrors latest value to `inputs.buffer`.

## Return Contract

* `ok`: traversal succeeded.
* `error`: missing/invalid path or required path not found.
