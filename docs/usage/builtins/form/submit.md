# `form.submit`

[Builtins Index](../INDEX.md) -> [Form Module](./INDEX.md)

Source:

* [../../../../src/builtins/form/formSubmit.js](../../../../src/builtins/form/formSubmit.js)

## Args

`args` hash is merged into submit options.

Option precedence in `makeOpts`:

1. runtime args
2. staged `buffer.meta()` (wins)

Header precedence:

* staged `buffer.meta().headers` overrides `args.headers`.

Source resolution in `normalizeTarget`:

1. buffer value when it looks like `form.collect` output
2. `trigger`
3. `job.e`

## Side Effects

* Executes async submit via `lib.dom.form.submit(src, opts)`.
* Stores transaction on `job.transactions[requestName]`.
* Writes response payload into `buffer`.

## Return Contract

* `ok`: detail includes `{ op, step, ok, status }`.
* `error`: wrapped submission/runtime error.
