# `target.classReset`

[Builtins Index](../INDEX.md) -> [Target Module](./INDEX.md)

Source:

* [../../../../src/builtins/target/index.js](../../../../src/builtins/target/index.js)

## Args

Accepted shapes:

* hash: `{ target? }`
* KV string: `target.classReset:target=#panel`

Target aliases:

* `target` / `selector`

## Side Effects

* Resolves target (explicit `target` or current `ticket.target`).
* Clears all classes from the target element.

Implementation detail:

* uses `removeAttribute("class")` when available
* falls back to `el.className = ""`

## Return Contract

* `ok`: class list cleared.
* `error`: invalid target.
