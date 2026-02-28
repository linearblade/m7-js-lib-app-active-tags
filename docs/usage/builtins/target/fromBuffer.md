# `target.fromBuffer`

[Builtins Index](../INDEX.md) -> [Target Module](./INDEX.md)

Source:

* [../../../../src/builtins/target/index.js](../../../../src/builtins/target/index.js)

## Args

No args.

## Side Effects

* Reads `buffer.get()` and assigns to `ticket.target`.
* Enforces strict DOM validity.

## Return Contract

* `ok`: target loaded from buffer.
* `error`: buffer value is not a DOM target.
