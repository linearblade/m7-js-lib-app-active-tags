# `target.propSet`

[Builtins Index](../INDEX.md) -> [Target Module](./INDEX.md)

Source:

* [../../../../src/builtins/target/index.js](../../../../src/builtins/target/index.js)

## Args

Parsed with:

```js
lib.args.parse(args, {}, { parms: "prop value target reset", pop: true })
```

Aliases for property name:

* `prop` / `attr` / `key` / `name`

Additional aliases:

* target element: `target` / `selector`
* reset to job root: `reset` / `root` (boolish)

## Side Effects

* Resolves effective target in this order:
  1) explicit `target`
  2) `job.e` if `reset` is truthy
  3) VM-provided `target` / current `ticket.target`
* Writes property via `lib.dom.set(target, prop, value)`.

## Return Contract

* `ok`: detail includes `{ prop, reset, value }` (value returned by `lib.dom.set`).
* `error`: missing prop, invalid target, or set failure.
