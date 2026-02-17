# `form.prepare`

[Builtins Index](../INDEX.md) -> [Form Module](./INDEX.md)

Source:

* [../../../../src/builtins/form/formPrepare.js](../../../../src/builtins/form/formPrepare.js)

## Args

No required `args` contract.

Trigger resolution order:

1. `inputs.trigger` (override)
2. `trigger` (engine trigger)
3. `job.e`

## Side Effects

* Validates resolved element as DOM.
* Sets `ticket.trigger` for downstream form stages.
* Performs no network call and no form submission.

## Return Contract

* `ok`: submit context staged.
* `error`: target resolution/validation failed.
