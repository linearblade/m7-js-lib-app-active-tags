### Pipeline block definition (AT 1.x)

A **pipeline block** is a **named, declarative unit of work** attached to a Job that the engine can execute deterministically.

It describes:

1. **what input to read** (optional)
2. **what steps to run** (required)
3. **what output to write** (optional)
4. **what to do on failure** (optional)

In other words: a pipeline block is a **data-defined routine** that transforms `src → dst` by executing a defined sequence of operations.

---

## PipelineBlock shape

```ts
type PipelineBlock = {
  /** Optional: where to read initial input into the job buffer. */
  src?: TargetRef;

  /** Required: ordered operations to run. */
  run: PipelineOp[];

  /** Optional: where to write the final buffer to. */
  dst?: TargetRef;

  /** Optional: ordered operations to run if any op in `run` fails. */
  onError?: PipelineOp[];

  /** Optional: defines failure behavior. Default: "block". */
  onErrorMode?: "block" | "continue";

  /** Optional metadata (debugging, trace labels, etc.). */
  meta?: Record<string, any>;
};
```

### TargetRef (input/output bindings)

A **TargetRef** identifies a value source/target using a `type:loc` notation (same idea as v098), but in v1 we’ll allow both string and structured form:

```ts
type TargetRef =
  | string                    // "request:responseText", "ws:response", "this:innerHTML"
  | { type: string, path?: string }; // {type:"ws", path:"response"}
```

---

## New direction: built-in pipeline operations (structured, consumer-friendly)

Instead of expecting consumers to write `"lib.site.at.v098.response.json"` strings, AT 1.x provides **built-in ops** for the chain, request, and transform behaviors.

### PipelineOp (structured)

```ts
type PipelineOp =
  | { op: "buffer.read", from: TargetRef }              // explicit form of src (optional)
  | { op: "buffer.write", to: TargetRef }               // explicit form of dst (optional)

  // request builtins
  | { op: "request.submit", request?: RequestSpec }     // sends request, stores response on job
  | { op: "request.chain", pipeline: string }           // run another pipeline block by name

  // response/buffer builtins
  | { op: "response.json" }                             // parse responseText -> json; set buffer
  | { op: "buffer.traverse", path: string }             // traverse buffer by path (ex: "data")

  // transforms
  | { op: "attr.transform", map: Record<string,string> } // set element attrs from expressions

  // UX
  | { op: "ui.confirm", message: string }
  | { op: "ui.alert", mode?: "buffer" | "clear", target?: TargetRef }

  // escape hatch (optional, but I’d keep it as last resort)
  | { op: "call", name: string, args?: any[] };
```

**Why this is better:** the consumer can fully structure pipelines as data without needing to know internal function names. Your engine stays stable, and you can add ops without breaking schema.

---

## Execution semantics (contract)

When executing a pipeline block `P`:

1. If `P.src` exists → `buffer.read(P.src)`
2. Execute each `P.run[i]` in order:

   * each op returns `ok | wait | error`
3. If any op returns `error`:

   * run `P.onError` (if present)
   * if `P.onErrorMode === "continue"` then continue, else stop
4. If `P.dst` exists → `buffer.write(P.dst)`
5. Return final status

This is a clean generalization of v098 `runChain()`.

---

## Example: “delete bucket” pipeline using built-ins

This is your earlier block, but now consumer-structured and engine-native:

```json
{
  "pipelines": {
    "initial": {
      "run": [
        { "op": "ui.confirm", "message": "are you sure you want to delete this bucket?" },
        { "op": "request.submit" },
        { "op": "response.json" },
        { "op": "ui.alert", "mode": "buffer" },
        { "op": "buffer.traverse", "path": "data" },
        { "op": "call", "name": "app.bucket.delete" }
      ],
      "onError": [
        { "op": "ui.alert", "mode": "buffer" }
      ]
    }
  }
}
```

Notes:

* `request.submit` uses the Job’s request config (action/method/body/enctype) unless overridden.
* `response.json` reads from the latest request response and sets the buffer to the parsed json (or error).
* `call` is optional; you can also replace it with a first-class op later (e.g. `app.bucket.delete` op).

---

## Built-in ops you mentioned (explicitly)

You said: “built-in pipeline functions for the chain, such as submit, or attr transform”.

Those map cleanly to:

* `{ op: "request.submit" }`
* `{ op: "attr.transform", map: {...} }`

…and because they are structured, the consumer can compose them without having to embed “magic strings”.

