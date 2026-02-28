# `target.classToggle`

[Builtins Index](../INDEX.md) -> [Target Module](./INDEX.md)

Source:

* [../../../../src/builtins/target/index.js](../../../../src/builtins/target/index.js)

## Args

Accepted shapes:

* hash: `{ className, target?, force? }`
* positional: `[className]`
* KV string: `target.classToggle:class=is-open,target=.panel,force=true`

Class aliases:

* `className` / `class` / `classes` / `cls` / `name` / `value`

Target aliases:

* `target` / `selector`

Force aliases (boolish):

* `force` / `state`

`force` behavior:

* omitted: normal toggle
* `true`: ensure class is present
* `false`: ensure class is absent

## Side Effects

* Resolves target (explicit `target` or current `ticket.target`).
* Toggles each class via `classList.toggle`.

## Return Contract

* `ok`: detail includes `{ classes, force, toggled }`.
* `error`: missing class name, invalid target, or no `classList`.
