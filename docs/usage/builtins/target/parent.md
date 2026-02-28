# `target.parent`

[Builtins Index](../INDEX.md) -> [Target Module](./INDEX.md)

Source:

* [../../../../src/builtins/target/index.js](../../../../src/builtins/target/index.js)

## Args

Accepted shapes:

* hash: `{ selector?, target?, reset? }`
* positional: `[selector]`
* KV string: `target.parent:selector=.row,reset=true`

Behavior:

* no selector: `base.parentElement`
* with selector: `base.closest(selector)?.parentElement`

Base selection order:

1) explicit `target`
2) `job.e` if `reset` is truthy
3) current `ticket.target`

## Side Effects

* Resolves next parent element and sets `ticket.target`.

## Return Contract

* `ok`: detail includes `{ selector, reset }` (`selector` can be `null`).
* `error`: no parent found or target invalid.
