# `target.propGet`

[Builtins Index](../INDEX.md) -> [Target Module](./INDEX.md)

Source:

* [../../../../src/builtins/target/index.js](../../../../src/builtins/target/index.js)

## Args

Parsed with:

```js
lib.args.parse(args, {}, { parms: "prop dst target reset", pop: true })
```

Aliases:

* prop: `prop` / `attr` / `key` / `name`
* destination: `dst` / `to`
* target element: `target` / `selector`
* reset to job root: `reset` / `root` (boolish)

## Side Effects

* Resolves effective target in this order:
  1) explicit `target`
  2) `job.e` if `reset` is truthy
  3) VM-provided `target` / current `ticket.target`
* Reads `prop` from resolved target using `lib.dom.get(target, prop)`.
* If `dst` is provided, writes value to parsed expression destination.
* If `dst` is empty, writes value to `buffer` with meta `{ op: "target.propGet", prop }`.

## Return Contract

* `ok`: detail includes `{ prop, dst, reset, value }`.
* `error`: missing prop, invalid target, or destination write failure.
