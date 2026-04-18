# `popstate.seed`

[Builtins Index](../INDEX.md) -> [Popstate Module](./INDEX.md)

Source:

* [../../../../src/builtins/popstate/index.js](../../../../src/builtins/popstate/index.js)

## Purpose

Conditionally seed history state once per job/seed key.

This is the one-time baseline helper for pipelines that should:

* seed a replayable baseline on first run
* avoid duplicate seeding on later runs

## Args

Parsed with:

```js
lib.args.parse(args, {}, {
  parms: "pipelineKey eventName url title state inputs seedKey mode onSeed",
  pop: true,
})
```

Relevant fields:

* `seedKey` / `seed` / `id`
  seed identity inside `job.ws.popstate.seed`
* `pipelineKey` / `pipeline` / `key`
  replay pipeline key; defaults to the current ticket pipeline
* `eventName` / `event`
  optional replay event name
* `mode`
  `"set"` or `"push"`; defaults to `"set"`
* `onSeed`
  `"complete"` or `"continue"`; defaults to `"complete"`
* `url` / `href`
  `false | true | string`
* `title`
  `false | true | string`
* `state`
  lightweight payload merged into stored replay state
* `inputs`
  extra replay inputs

Seed key fallback order:

1. explicit `seedKey`
2. `pipelineKey`
3. current `ticket.pipelineKey`
4. `"default"`

## Side Effects

First run for a given seed key:

* writes history using `mode`
* marks `job.ws.popstate.seed[seedKey] = true`

Later runs:

* no history write
* returns normal continuation

## Return Contract

First unseeded run:

* `complete` when `onSeed !== "continue"`
* `ok` when `onSeed === "continue"`

Later seeded runs:

* `ok`

Errors:

* `error` when popstate runtime is unavailable or history write throws

## Examples

One-time startup seed that stops the rest of the pipeline on first run:

```js
{
  op: "@popstate.seed",
  args: {
    pipeline: "index",
    url: "./",
    title: true,
  },
}
```

Fragment baseline seed that pushes once, then continues:

```js
{
  op: "@popstate.seed",
  args: {
    seedKey: "fragment-main:index",
    pipeline: "fragment_index",
    mode: "push",
    onSeed: "continue",
    url: false,
    title: false,
  },
}
```

