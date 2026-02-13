# Introduction — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

ActiveTags exists to close a common gap: HTML and JavaScript often do not compose cleanly at scale.

For simple behavior, inline attributes can be enough. For example, a link can declare a pipeline directly:

```html
<a
  at-pipeline="http.get:/foo/bar buffer.out:innerHtml"
  at-event-event="click"
  at-event-pipeline="default">
  About
</a>
```

That is useful for local, quick behavior. But large sites usually need more than inline strings:

* behavior becomes harder to maintain when config is scattered across markup
* complex actions become hard to express as short attribute strings
* teams often need reusable, centrally managed component behavior

ActiveTags supports both inline and external configuration, so you can choose the right level of control.

Example with external config reference:

```html
<a at-name="link-about" at-config-at="window:ws.links.about">About</a>
```

With external config, behavior can live in structured objects and be managed separately from templates. This keeps documents cleaner while still allowing expressive pipelines.

Inline and external configuration can be mixed as needed. Inline attributes take priority when both are present.

## Why this matters

Without a unified runtime, advanced behavior usually turns into scattered event handlers and custom glue code for fallbacks, retries, refreshes, and post-action logic.

ActiveTags replaces that pattern with declarative pipelines: define `run x -> y -> z` once, let the runtime orchestrate it, and keep behavior consistent across components.

## Result

You get:

* SPA-like interaction patterns without framework lock-in
* cleaner separation between markup, style, and behavior config
* reusable component behavior that can be configured at runtime
* lower maintenance overhead as site complexity grows

---

## See also

* [Quick Start](./QUICKSTART.md)
* [Configuration Model](./CONFIGURATION.md)
* [Examples Library](./EXAMPLES_LIBRARY.md)
* [README](../../README.md)
