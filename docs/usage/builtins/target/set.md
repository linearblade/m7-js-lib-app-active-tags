# `target.set`

[Builtins Index](../INDEX.md) -> [Target Module](./INDEX.md)

Source:

* [../../../../src/builtins/target/index.js](../../../../src/builtins/target/index.js)

## Args

Accepted shapes:

* hash: `{ target }` or `{ selector }`
* hash: `{ reset: true }` (sets to job root `job.e`)
* positional: `[selector]`
* KV string: `target.set:target=#app` or `target.set:reset=true`

Boolish aliases for reset:

* `reset` / `root`

Target aliases:

* `target` / `selector`

## Side Effects

* Resolves and sets `ticket.target`.
* If `reset` is true and no explicit target is given, resolves to `job.e`.

## Return Contract

* `ok`: detail includes `{ targetRef, reset }`.
* `error`: unresolved/invalid target reference.
