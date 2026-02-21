# `form.collect`

[Builtins Index](../INDEX.md) -> [Form Module](./INDEX.md)

Source:

* [../../../../src/builtins/form/formCollect.js](../../../../src/builtins/form/formCollect.js)

## Args

* `args` (hash) is forwarded to `lib.dom.form.collect(source, opts)`.

Source resolution:

1. `trigger`
2. `job.e`

## Side Effects

* Collects form context and writes it to `buffer` via `buffer.set(data)`.
* Does not mutate `inputs`.

## Return Contract

* `ok`: detail includes op/step and field count.
* `error`: invalid source or collection failure.
