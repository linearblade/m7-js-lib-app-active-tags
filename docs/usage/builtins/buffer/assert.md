# `buffer.assert`

[Builtins Index](../INDEX.md) -> [Buffer Module](./INDEX.md)

Source:

* [../../../../src/builtins/buffer/bufferAssert.js](../../../../src/builtins/buffer/bufferAssert.js)

## Args

Parsed with:

```js
lib.args.parse(args, {}, { parms: "key value predicate", pop: true })
```

Aliases:

* key: `key` or `path`
* expected: `value` / `val` / `expected`
* predicate: `predicate` / `pred`

Semantics:

* `key` optional; absent means full buffer value.
* `predicate` overrides built-in compare logic.

Predicate resolution order:

1. direct function value
2. user/root lookup via `lib.func.get(token)`
3. explicit `lib.*` lookup via `lib.func.get(token, { root: { lib } })`

## Side Effects

* No direct mutation.
* Executes user predicate when supplied.

## Return Contract

* `ok`: assertion passed; detail includes mode and compared values.
* `error`: assertion failed or predicate could not resolve.
