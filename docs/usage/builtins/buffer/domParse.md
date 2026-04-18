# `buffer.domParse`

[Builtins Index](../INDEX.md) -> [Buffer Module](./INDEX.md)

Source:

* [../../../../src/builtins/buffer/index.js](../../../../src/builtins/buffer/index.js)

## Args

Parsed with:

```js
lib.args.parse(args, {}, { parms: "selector attr dst lax", pop: true })
```

Aliases:

* selector: `selector` / `sel` / `query`
* extracted property: `attr` / `prop` / `key` / `name`
* destination: `dst` / `to` / `target`
* lax mode: `lax`

Defaults:

* `attr: "innerHTML"`
* `lax: false`

## Side Effects

* Reads current `buffer.get()` and treats it as HTML.
  Fallback extraction order:
  1. string buffer value
  2. `buffer.html`
  3. `buffer.body`
  4. `String(bufferValue)`
* Parses HTML through `DOMParser(..., "text/html")`.
* Resolves one node with `querySelector(selector)`.
* Reads extracted value with `lib.dom.get(node, attr)`.
* If `dst` is present, writes to the parsed expression destination.
  This supports both DOM property destinations and plain object paths.
* If `dst` is empty, overwrites `buffer` with the extracted value.

## Lax Mode

When `lax: true`:

* parse failure
* selector miss
* missing extracted attribute/property

all return `ok` and leave the buffer unchanged.

When `lax: false`:

* those conditions return `error`

Missing `selector` is always an error.

## Return Contract

* `ok`: detail includes `{ selector, attr, dst, value }`
* `ok` in lax mode: detail includes `{ skipped: true, reason }`
* `error`: missing selector, parse failure, selector miss, or extraction failure

## Examples

Overwrite buffer with extracted fragment markup:

```js
{
  op: "@buffer.domParse",
  args: {
    selector: "#main",
  },
}
```

Write extracted href into a destination expression:

```js
{
  op: "@buffer.domParse",
  args: {
    selector: "a.next",
    attr: "href",
    dst: "inputs:nextUrl",
    lax: true,
  },
}
```
