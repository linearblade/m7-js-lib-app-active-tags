# `target.toBuffer`

[Builtins Index](../INDEX.md) -> [Target Module](./INDEX.md)

Source:

* [../../../../src/builtins/target/index.js](../../../../src/builtins/target/index.js)

## Args

No args.

## Side Effects

* Reads current working target (`ticket.target`) and writes it into `buffer`.

## Return Contract

* `ok`: target moved to buffer.
* `error`: current target invalid.
