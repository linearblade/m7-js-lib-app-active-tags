# `target.child`

[Builtins Index](../INDEX.md) -> [Target Module](./INDEX.md)

Source:

* [../../../../src/builtins/target/index.js](../../../../src/builtins/target/index.js)

## Args

Accepted shapes:

* hash: `{ index, target?, reset? }`
* positional: `[index]`
* KV string: `target.child:index=1,reset=true`

Index aliases:

* `index` / `idx` / `i`

Scope aliases:

* `target` / `scope` / `from` / `within`

Reset aliases (boolish):

* `reset` / `root`

Index normalization:

* `index = lib.number.toInt(rawIndex, 0)`

## Side Effects

* Resolves `base.children[index]` where base is chosen in this order:
  1) explicit `target`
  2) `job.e` if `reset` is truthy
  3) current `ticket.target`
* Validates and updates `ticket.target`.

## Return Contract

* `ok`: detail includes `{ index, reset }`.
* `error`: child not found or target invalid.
