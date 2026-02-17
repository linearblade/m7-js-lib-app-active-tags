# `buffer.set`

[Builtins Index](../INDEX.md) -> [Buffer Module](./INDEX.md)

Source:

* [../../../../src/builtins/buffer/index.js](../../../../src/builtins/buffer/index.js)

## Args

Parsed with:

```js
lib.args.parse(args, {}, { parms: "value meta", pop: true })
```

Accepted shapes:

* hash: `{ value, meta }`
* positional: `[value, meta]`

Defaults:

* missing `value` -> `null`
* missing `meta` -> `null`

## Side Effects

* Writes to ticket buffer via `buffer.set(value, meta)`.

## Return Contract

* `ok`: buffer write completed.
* `error`: parse/write failure.
