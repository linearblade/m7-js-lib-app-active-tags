# `target.patch`

[Builtins Index](../INDEX.md) -> [Target Module](./INDEX.md)

Source:

* [../../../../src/builtins/target/index.js](../../../../src/builtins/target/index.js)

## Args

Control args:

* `target` / `selector` (optional explicit element reference)
* `reset` / `root` (boolish; use `job.e` as base target)
* `fromDom` / `dom` / `attrs` / `fromAttributes` (boolish, default `true`)

Patch payload sources:

* `data-attr-*` attributes on resolved target (prefix stripped), when `fromDom` is enabled
* remaining args hash keys after removing control args
* legacy fallback: first positional hash item, when no remaining args keys exist

Merge behavior:

* args payload keys win over DOM-derived patch keys.

## Side Effects

* Resolves effective target in this order:
  1) explicit `target`
  2) `job.e` if `reset` is truthy
  3) current `ticket.target`
* Applies each patch key through `lib.dom.set(el, key, value)`.

## Return Contract

* `ok`: detail includes `{ applied, keys, reset, fromDom }`.
* `error`: target invalid or patch application failure.
