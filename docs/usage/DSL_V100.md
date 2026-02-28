# v1.0 DSL Manual — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

This manual documents the current (v1.0) expression and op-list DSL profile used by ActiveTags runtime parsing/evaluation.

Primary sources:

* [../../src/class/expressions/ExpressionResolver.js](../../src/class/expressions/ExpressionResolver.js)
* [../../src/class/expressions/dispatch.js](../../src/class/expressions/dispatch.js)
* [../../src/class/expressions/Interpolator.js](../../src/class/expressions/Interpolator.js)

---

## Version note

Current status:

* v1.0 resolver profile is active in `ExpressionResolver.js`.
* v1.0 op-list parsing supports semicolon-delimited rows plus named/positional args.
* legacy v098 reference material is archived outside the active usage path.

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

## 2) Dispatch targets (v1.0 profile)

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

## 6) Op-list syntax (v1.0)

Pipeline phase rows are normalized by `ExpressionResolver.parseOpList(...)`.

Row/arg delimiters:

* row delimiter: `;`
* arg delimiter: `,`

Row form:

```txt
<op>[:arg0,arg1,key=value,...]
```

Examples:

* `"target.reset"` -> one row
* `"target.find:target=.box,reset=true;@target.classAdd:class=is-active"` -> two rows
* `"foo:key=abc,enabled=true"` -> named args form

Supported arg projections:

* positional:
  * `"foo:a,b,c"` -> `args: ["a", "b", "c"]`
* key/value:
  * `"foo:key=abc,enabled=true"` -> `args: { key: "abc", enabled: "true" }`
* dot-notation expansion:
  * `"foo:a.b=1"` -> `args: { a: { b: "1" } }`
* repeated key accumulation:
  * `"foo:a=1,a=2"` -> `args: { a: ["1", "2"] }`

Normalized row metadata shape:

* `{ op, args, raw, builtin, pos, kv }`
* `args` auto-projection:
  * if any `=` appears in the row arg segment, `args` is the row `kv` hash
  * otherwise `args` is the row positional array (`pos`)

Builtin resolution markers:

* prefix form: `@target.patch`
* object form: `{ op: "target.patch", builtin: true, args: { ... } }`

Object/function row input is also accepted and normalized.

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

* [Basic Tag Setup](./BASIC_TAG_SETUP.md)
* [Configuration Model](./CONFIGURATION.md)
* [Pipelines](./PIPELINES.md)
* [Builtins & Operations](./OPERATIONS_BUILTINS.md)
* [../../src/class/expressions/ExpressionResolver.js](../../src/class/expressions/ExpressionResolver.js)
* [../../src/class/expressions/dispatch.js](../../src/class/expressions/dispatch.js)
* [../../src/class/expressions/Interpolator.js](../../src/class/expressions/Interpolator.js)
* [Usage TOC](./TOC.md)
* [README](../../README.md)
