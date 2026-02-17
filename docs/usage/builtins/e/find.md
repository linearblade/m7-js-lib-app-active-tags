# `e.find`

[Builtins Index](../INDEX.md) -> [Root Element Module](./INDEX.md)

Source:

* [../../../../src/builtins/e/index.js](../../../../src/builtins/e/index.js)

## Args

Accepted shapes:

* hash: `{ selector }`
* positional: `[selector]`

## Side Effects

* Resolves `job.e.querySelector(selector)`.
* Writes result to `ticket.target`.

## Return Contract

* `ok`: detail includes `selector`.
* `error`: selector misses or root invalid.
