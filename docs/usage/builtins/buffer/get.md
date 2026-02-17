# `buffer.get`

[Builtins Index](../INDEX.md) -> [Buffer Module](./INDEX.md)

Source:

* [../../../../src/builtins/buffer/index.js](../../../../src/builtins/buffer/index.js)

## Args

Parsed with:

```js
lib.args.parse(args, {}, { parms: "src dst", pop: true })
```

Fields:

* `src`: optional deep path within `buffer.get()`
* `dst`: optional unresolved expression destination

## Side Effects

* Reads from current buffer value.
* If `dst` is present, writes resolved value to parsed destination (`{ src, prop }`).
* Mirrors resolved value to `inputs.buffer`.

## Return Contract

* `ok`: detail includes `{ src, dst, value }`.
* `error`: invalid destination parse/write or runtime failure.
