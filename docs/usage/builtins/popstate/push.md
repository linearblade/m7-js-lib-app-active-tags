# `popstate.push`

[Builtins Index](../INDEX.md) -> [Popstate Module](./INDEX.md)

Source:

* [../../../../src/builtins/popstate/index.js](../../../../src/builtins/popstate/index.js)

## Purpose

Write a new browser history entry immediately.

Recommended placement:

* final pipeline stage

## Args

Parsed with:

```js
lib.args.parse(args, {}, {
  parms: "pipelineKey eventName url title state inputs seedKey mode onSeed",
  pop: true,
})
```

Fields used by `popstate.push`:

* `pipelineKey` / `pipeline` / `key`
  replay pipeline key; defaults to the current ticket pipeline
* `eventName` / `event`
  optional replay event name
* `url` / `href`
  `false | true | string`
* `title`
  `false | true | string`
* `state`
  lightweight payload merged into stored replay state
* `inputs`
  extra replay inputs

## Side Effects

* writes a new history entry through `AT.popstate.writeBuiltinHistory(...)`
* stores replay metadata for later Back/Forward handling

Replay safety:

* if the current ticket was triggered by popstate replay (`inputs.reason === "popstate"`), this builtin skips writing a new history entry

## Return Contract

* `ok`: history entry was written, or replay write was intentionally skipped
* `error`: popstate runtime unavailable or thrown write error

## Example

```js
{
  op: "@popstate.push",
  args: {
    pipeline: "on_1",
    url: "./on-1.html",
    title: "on-1",
  },
}
```

