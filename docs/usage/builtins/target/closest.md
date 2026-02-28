# `target.closest`

[Builtins Index](../INDEX.md) -> [Target Module](./INDEX.md)

Source:

* [../../../../src/builtins/target/index.js](../../../../src/builtins/target/index.js)

## Args

Accepted shapes:

* hash: `{ selector, target?, reset? }`
* positional: `[selector]`
* KV string: `target.closest:selector=.panel,reset=true`

Selector aliases:

* `selector` / `query` / `sel`

Scope aliases:

* `target` / `scope` / `from` / `within`

Reset aliases (boolish):

* `reset` / `root`

## Side Effects

* Computes `base.closest(selector)` where base is chosen in this order:
  1) explicit `target`
  2) `job.e` if `reset` is truthy
  3) current `ticket.target`
* Validates and updates `ticket.target`.

## Return Contract

* `ok`: detail includes `{ selector, reset }`.
* `error`: selector misses or target invalid.
