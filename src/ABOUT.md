Here’s a boilerplate version you can drop into docs/README headers:

Active Tags is a deterministic, engine-driven runtime for backend-hydrated UI components. HTML elements “activate” jobs, configuration is normalized once at load time, and all runtime activity—events, intervals, autoruns—reduces to enqueueing execution tickets into a single VM. Pipelines are implicit function chains that run with a shared per-ticket context, while triggers (DOM events) and schedulers (intervals) act only as enqueue sources and never execute work directly. The engine is the sole authority for execution order, gating, and error flow, which keeps behavior predictable, testable, and scalable—from simple hover effects to full request/response workflows—while enabling clean builtins for common operations (form collection, transforms, requests, and response routing) and safe, selective draining per job or ticket.


Good question — and the honest answer is: it’s a composed system, not a single thing, but it has a clear center of gravity.

Here’s the clean way to describe it.

You have built a compiler + a runtime state machine.

More precisely:

You’ve built a declarative job compiler that normalizes HTML- and JSON-based configuration into a stable execution schema, and a deterministic runtime engine that behaves like a state machine, advancing execution tickets through well-defined phases.

Why it’s a compiler

Because you:
	•	take multiple input languages (HTML data attributes, inline JSON, defaults)
	•	normalize and validate them
	•	resolve shapes, defaults, and references
	•	emit a compiled, immutable schema (requests, pipelines, events, intervals)
	•	separate “authoring syntax” from “runtime representation”

That’s textbook compilation, just not for a traditional language.

Why it’s a state machine

Because at runtime:
	•	work is represented as tickets with explicit state (ready | running | wait | error | complete)
	•	transitions are explicit and deterministic
	•	execution advances via tick()
	•	no work happens outside the engine
	•	side effects are constrained to stage execution

That’s a state machine, not just a task queue.

What it is not
	•	Not a scheduler (intervals only enqueue)
	•	Not a framework (no component lifecycle magic)
	•	Not a DSL engine (pipelines are simple call chains)
	•	Not a reactive system (no implicit reruns)

The best single label

If you need one phrase:

A declarative job compiler with a deterministic execution engine.

Or, more casually and accurately:

A runtime for turning HTML into controlled workflows.

That framing matches what you’ve actually built — and why it suddenly feels “real.”