# `form.headers`

[Builtins Index](../INDEX.md) -> [Form Module](./INDEX.md)

Source:

* [../../../../src/builtins/form/requestHeaders.js](../../../../src/builtins/form/requestHeaders.js)

## Args

Supported shapes:

* direct header map: `{ "X-CSRF": "abc" }`
* explicit: `{ headers: { ... } }`
* mode form: `{ mode: "merge"|"replace"|"clear", headers: { ... } }`

Mode default: `merge`.

## Side Effects

* Mutates `buffer.meta().headers` only.
* Leaves buffer value unchanged.

## Return Contract

* `ok`: detail op label is `request.headers` with selected `mode`.
* `error`: invalid args/buffer mutation failure.
