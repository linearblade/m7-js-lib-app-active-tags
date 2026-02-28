# `target.classAdd`

[Builtins Index](../INDEX.md) -> [Target Module](./INDEX.md)

Source:

* [../../../../src/builtins/target/index.js](../../../../src/builtins/target/index.js)

## Args

Accepted shapes:

* hash: `{ className, target? }`
* positional: `[className]`
* KV string: `target.classAdd:class=is-hidden,target=#panel`

Class aliases:

* `className` / `class` / `classes` / `cls` / `name` / `value`

Target aliases:

* `target` / `selector`

Class token parsing:

* supports whitespace-delimited, comma-delimited, or array values
* de-duplicates final class list

## Side Effects

* Resolves target (explicit `target` or current `ticket.target`).
* Runs `el.classList.add(...classes)`.

## Return Contract

* `ok`: detail includes `{ classes }`.
* `error`: missing class name, invalid target, or no `classList`.
