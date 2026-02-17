# `dom.attempt`

[Builtins Index](../INDEX.md) -> [DOM Module](./INDEX.md)

Source:

* [../../../../src/builtins/dom/domAttempt.js](../../../../src/builtins/dom/domAttempt.js)

## Args

Parsed with:

```js
lib.args.parse(args, {}, { parms: "target barf", pop: true })
```

Used fields:

* `target`: value to resolve as DOM

Notes:

* `barf` is parsed but currently ignored.
* Resolution is strict (`lib.dom.attempt(source, true)`).

## Side Effects

* Resolves and writes `ticket.target`.
* Throws/returns error when target cannot be resolved.

## Return Contract

* `ok`: detail includes `{ op: "dom.attempt", resolved }`.
* `error`: wrapped stage error.
