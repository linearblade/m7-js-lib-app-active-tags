# `e.child`

[Builtins Index](../INDEX.md) -> [Root Element Module](./INDEX.md)

Source:

* [../../../../src/builtins/e/index.js](../../../../src/builtins/e/index.js)

## Args

Accepted shapes:

* hash: `{ index }`
* positional: `[index]`

Index normalization:

* `index = lib.number.toInt(rawIndex, 0)`

## Side Effects

* Resolves `job.e.children[index]`.
* Writes result to `ticket.target`.

## Return Contract

* `ok`: detail includes numeric `index`.
* `error`: child not found or root invalid.
