# `target.classSet`

[Builtins Index](../INDEX.md) -> [Target Module](./INDEX.md)

Source:

* [../../../../src/builtins/target/index.js](../../../../src/builtins/target/index.js)

## Args

Accepted shapes:

* hash: `{ className, target? }`
* positional: `[className]`
* KV string: `target.classSet:class=is-active is-ready,target=.card`

Class aliases:

* `className` / `class` / `classes` / `cls` / `name` / `value`

Target aliases:

* `target` / `selector`

## Side Effects

* Resolves target (explicit `target` or current `ticket.target`).
* Replaces entire class list with provided classes.

Implementation detail:

* uses `setAttribute("class", "...")` when available
* falls back to `el.className = "..."`

## Return Contract

* `ok`: detail includes `{ classes }`.
* `error`: missing class name or invalid target.
