# Introduction — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

> **Version notice**
> ActiveTags 1.0 is the spiritual successor to prior versions. It shares core ideas, but the runtime/process model has been substantially streamlined and is not backward compatible at this time.
> ActiveTags 0.99 and lower differ substantially from the current model.

ActiveTags exists to close a common gap: HTML and JavaScript often do not compose cleanly at scale.

For simple behavior, inline attributes can be enough. Example:

```html
<a
  at-pipeline="http.get:/foo/bar;buffer.out:innerHtml"
  at-event-event="click"
  at-event-pipeline="default">
  About
</a>
```

That works well for local behavior. At scale, inline-only config becomes limiting:

* behavior becomes harder to maintain when configuration is scattered across markup
* complex actions become hard to express as short attribute strings
* teams often need reusable, centrally managed component behavior

ActiveTags supports both inline and external configuration so teams can choose the right control surface per component.

Example with external config reference:

```html
<a at-name="link-about" at-config-at="window:ws.links.about">About</a>
```

With external config, behavior can live in structured objects and be managed separately from templates. This keeps markup cleaner while still supporting expressive workflows.

Inline and external configuration can be mixed as needed. Inline attributes take priority when both are present.

## Why this matters

Without a unified runtime, advanced behavior usually becomes scattered event handlers and custom glue for retries, fallbacks, refreshes, and post-action logic.

ActiveTags replaces that pattern with declarative pipelines: define `run x -> y -> z` once and let the runtime orchestrate execution consistently across components.

## How it works

ActiveTags behaves like an assembly line:

1. A stage receives the current work product.
2. It transforms or validates that work.
3. It passes the result to the next stage.

At runtime, this model centers on two conveyor concepts:

* `buffer`: the current work product moving through the pipeline
* `target`: the current DOM focus where that work is applied

This makes each stage explicit: what it received, what it produced, where output should go, and how failures are handled.

Example flow:

1. Fetch API response (`buffer` becomes response payload).
2. Validate shape/status.
3. Traverse to the required subtree.
4. Validate again for downstream expectations.
5. Hand off to a rendering/apply stage.

If the next operation needs a different DOM destination, move `target` and continue. This avoids one-off conditional glue and keeps operations reusable.

Authoring can stay lightweight or structured:

* inline DSL strings for quick local behavior
* structured config parameters for larger workflows
* literal function references or symbolic lookups for callable stages

The result is portable workflow logic: define operations once and reuse them across components.

## Example: Template + data stitching

Another common case is rendering a component by combining:

* a reusable template file
* data loaded from an API
* component-specific CSS assets

Teams often push this into server-side fragments, which can create friction:

* HTML designers need backend-template knowledge to edit fragments
* backend developers repeatedly slice or rewire designer output
* fragment logic and fragment styling drift across files and ownership boundaries

A cleaner model is:

1. Keep templates generic and reusable.
2. Load data from a REST-style API.
3. Configure ActiveTags to fetch template + data, stitch them, and attach required CSS/resources in one workflow.

This keeps concerns tidy while reducing duplicated rendering logic across backend and frontend boundaries.

```txt
<insert example here> (template + data + stitch pipeline code block)
```

## Result

You get:

* SPA-like interaction patterns without framework lock-in
* cleaner separation between markup, styling, and behavior configuration
* reusable component behavior that can be configured at runtime
* lower maintenance overhead as site complexity grows

---

## See also

* [Quick Start](./QUICKSTART.md)
* [Configuration Model](./CONFIGURATION.md)
* [Examples Library](./EXAMPLES_LIBRARY.md)
* [README](../../README.md)
