# `e.parent`

[Builtins Index](../INDEX.md) -> [Root Element Module](./INDEX.md)

Source:

* [../../../../src/builtins/e/index.js](../../../../src/builtins/e/index.js)

## Args

Accepted shapes:

* hash: `{ selector }`
* positional: `[selector]`

Behavior:

* no selector: `job.e.parentElement`
* with selector: `job.e.closest(selector)?.parentElement`

## Side Effects

* Writes resolved parent to `ticket.target`.

## Return Contract

* `ok`: detail includes `selector` or `null`.
* `error`: no parent found or root invalid.
