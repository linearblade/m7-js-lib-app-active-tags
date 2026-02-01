Active Tags is **a declarative execution engine embedded in the DOM**.

More precisely:

> **Active Tags is a browser-side job runner that turns HTML elements into stateful, network-aware components using data attributes as configuration.**

It is **not** a templating system, **not** a framework, and **not** a form helper—though it can do parts of all three. Its core identity is different.

---

## What Active Tags *Actually* Is

### 1) A DOM-Driven Job System

Each “active tag” is a DOM element that becomes a **job**.

* The element itself is the *identity* of the job
* `data-*` attributes define the job’s configuration
* The job is registered, queued, and executed by the Active Tags engine

In your code, this is explicit:

* `makeJob(tag)` → builds a job object
* `job.ds` → inflated dataset (the job’s configuration)
* `job.stack` → ordered execution stages
* `job.status` → lifecycle control (`ready`, `wait`, `error`, etc.) 

HTML is not “rendered”; it is **activated**.

---

### 2) A Stack-Based Execution Engine

Active Tags runs work through **stacks**, not callbacks or promises.

A stack is:

* ordered
* interruptible
* resumable
* composable

Each stack entry represents a **stage**:

* `request`
* `chain`
* `attr`
* `intervalStart / intervalUnlock`
* `complete`
* `runAll`

Stages return:

* `1` → success, continue
* `0` → error, abort
* `"wait"` → pause until async continuation (e.g., HTTP response)

This is why Active Tags can:

* pause on XHR
* resume later
* safely interleave intervals and network responses

This is *not* accidental complexity — it’s deliberate control flow.

---

### 3) A Declarative HTTP Orchestrator

Active Tags is primarily a **backend interaction tool**.

It:

* builds HTTP requests from data attributes
* sends them
* captures the response
* feeds the response back into the stack
* chains transformations and side effects

Example concepts (not syntax):

* `data-request-action`
* `data-request-method`
* `data-response-src`
* `data-pre`, `data-post`

This makes it fundamentally different from:

* `fetch()` wrappers
* form submit helpers
* “AJAX libraries”

Active Tags **owns the lifecycle of a request**, not just the call.

---

### 4) A Component Assembly Mechanism (Not a Component Framework)

Active Tags lets you build **reusable, backend-hydrated components**, but:

* components are *HTML-first*
* behavior is *data-configured*
* logic is *centralized*
* composition is *implicit*

A “component” is:

* a DOM subtree
* one or more active tags
* a shared dataset + execution ordering
* optional dependencies (`require`)

No JSX. No virtual DOM. No reactive diffing.

This is **post-render activation**, not render-time abstraction.

---

### 5) A Controlled Side-Effect Engine

Active Tags explicitly manages side effects:

* DOM mutation
* network I/O
* timers / intervals
* script execution

It does not:

* hide them
* virtualize them
* auto-repeat them without rules

That’s why it tracks:

* running state per stack
* interval locks
* job completion
* dependency satisfaction (`require`) 

This is *why* it scales beyond simple “AJAX snippets”.

---

## What Active Tags Is **Not**

It is **not**:

* a frontend framework
* a state management library
* a reactive system
* a templating engine
* a form helper (that’s just one use case)

Those can *exist around it*, but Active Tags is the **execution spine**, not the UI layer.

---

## One-Sentence Definition (Canonical)

> **Active Tags is a declarative, stack-driven execution engine that turns DOM elements into stateful jobs capable of orchestrating HTTP requests, data transformations, and controlled side effects.**

If you want, next we can:

* contrast it explicitly with HTMX / Alpine / Stimulus (to sharpen intent)
* define the **minimum irreducible core** Active Tags must keep
* or map the current code to this definition and identify where it drifted

This definition will anchor every refactor decision going forward.
