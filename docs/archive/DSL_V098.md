# v098 DSL Manual (Legacy) — ActiveTags

[README](../../README.md) -> [Docs Archive](./README.md) -> [Usage TOC](../usage/TOC.md)

This manual documents the legacy v098 expression DSL profile.
For current runtime behavior, use [v1.0 DSL Manual](../usage/DSL_V100.md).

Primary sources:

* [../../src/class/expressions/ExpressionResolver.js](../../src/class/expressions/ExpressionResolver.js)
* [../../src/class/expressions/dispatch.js](../../src/class/expressions/dispatch.js)
* [../../src/class/expressions/Interpolator.js](../../src/class/expressions/Interpolator.js)

---

## Version note

Current status:

* runtime source of truth is `ExpressionResolver.js` (v1.0 profile)
* this page is retained for legacy compatibility/reference
* `archive/inert/ExpressionResolver.098.js` is legacy/inactive reference material

---

## 1) Core expression form

Expressions are parsed as:

```txt
type:locator
```

Examples:

* `job:id`
* `config:name`
* `this:innerHTML`
* `target:value`
* `window:location.href`
* `find:.title`
* `doc:#my-id`

Parsing/evaluation model:

1. `parse(ctx, target)` resolves the expression into either:
   * a target reference object: `{ src, prop }`
   * a direct value
   * a DOM element
   * `undefined`
2. `eval(ctx, target)` returns the final value (property lookup for `{ src, prop }`).

Unknown target types resolve to `undefined` unless provided by context override (see section 4).

---

## 2) Dispatch targets (v098 profile)

The dispatch table is defined in [../../src/class/expressions/dispatch.js](../../src/class/expressions/dispatch.js).

### Runtime/object targets

* `job:<path>`
  resolves from the current Job object
* `ticket:<path>`
  resolves from the current ticket
* `config:<path>`
  resolves from `job.config.schema`
* `trans:<path>`
  resolves from `job.transactions`
* `ws:<path>`
  resolves from `job.ws`
* `buffer:<path>`
  resolves from `ticket.buffer.get()`
* `buffer_meta:<path>`
  resolves from `ticket.buffer.meta()`
* `window:<path>`
  resolves from runtime window/root

### DOM-anchor targets

* `this:<path>`
  resolves from `job.e`
* `target:<path>`
  resolves from `ticket.target`

### DOM query targets

* `doc:<selector>`
  uses `document.querySelector(selector)`
* `find:<selector>`
  uses `(ticket.target || job.e).querySelector(selector)` with base-match fallback
* `closest:<selector>`
  uses `(ticket.target || job.e).closest(selector)`

### Form target

* `form:<fieldName>`
  uses `lib.dom.form.collect(base)` and returns the matching parameter value

### Legacy compatibility target

* `inline:<anything>`
  returns `{ src: job.e, prop: "innerHTML", special: <locator> }`

---

## 3) Locator semantics

`locator` is passed through as a string and interpreted by the target handler.

Common behaviors:

* For `{ src, prop }` references, property lookup uses:
  * `lib.dom.get(src, prop)` when `src` is a DOM element
  * `lib.hash.get(src, prop)` otherwise
* For selector-based targets (`doc`, `find`, `closest`), locator is a CSS selector.

When selector queries fail or return no match, resolver returns `undefined` and may emit warnings through the configured logger.

---

## 4) Context override behavior

If a `type` is not in built-in dispatch and `ctx[type]` exists:

* if `ctx[type]` is a function, resolver calls it with `(locator)`
* otherwise resolver treats it as `{ src: ctx[type], prop: locator }`

This allows local extension of expression targets without changing core dispatch.

---

## 5) Interpolation form (`${...}`)

`Interpolator` supports deep parsing/materialization of `${...}` tokens.

Two modes:

* value expression:
  * `"${job:id}"` returns raw resolved value type
* template expression:
  * `"id=${job:id}"` returns a string after interpolation

Materialization helper:

* `materialize(ctx, value)` parses and evaluates `${...}` recursively through objects/arrays/strings.

---

## 6) v098 op-list shorthand

ExpressionResolver also provides a v098-style list parser for compact op strings:

* `"op"` -> `{ op: "op", args: [], raw: "op" }`
* `"op:a,b,c"` -> `{ op: "op", args: ["a", "b", "c"], raw: "op:a,b,c" }`

Object items pass through unchanged.
This is tokenization/normalization only; it does not execute operations.

---

## 7) Practical debugging

For DOM-bound jobs, define a name so inspection is direct:

```html
<div at-name="test-link" at-config-at="window:ws.config.testLink"></div>
```

Then inspect:

```js
const job = AT.toJob("test-link");
```

Useful pointers:

* `job.config.inputs.report`:
  source resolution/read/parse errors
* `job.config.schemaReport`:
  schema normalization/shape errors

---

## See also

* [v1.0 DSL Manual (current)](../usage/DSL_V100.md)
* [Basic Tag Setup](../usage/BASIC_TAG_SETUP.md)
* [Configuration Model](../usage/CONFIGURATION.md)
* [Builtins & Operations](../usage/OPERATIONS_BUILTINS.md)
* [../../src/class/expressions/ExpressionResolver.js](../../src/class/expressions/ExpressionResolver.js)
* [../../src/class/expressions/dispatch.js](../../src/class/expressions/dispatch.js)
* [../../src/class/expressions/Interpolator.js](../../src/class/expressions/Interpolator.js)
* [Usage TOC](../usage/TOC.md)
* [README](../../README.md)
