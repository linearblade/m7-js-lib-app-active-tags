Yep — big picture, no code. Here’s how I’d think about modernizing Active Tags around those two goals without losing what makes it special.

⸻

1) “Run once” → Fluid runtime

Right now the engine’s mental model is basically:

scan DOM → build jobs → run stacks → job is “done” (or looping via interval)

That’s great for initial boot, but it fights you when the page is living:
	•	components get added/removed
	•	configs change
	•	the same element needs to re-run with new inputs
	•	you want to “hot reload” behavior without nuking state

What “fluid” should mean

A fluid Active Tags runtime should behave like a long-lived service:
	•	Attach: turn an element into a job (or rebind it)
	•	Detach: remove a job and clean its timers/resources
	•	Update: change config or inputs and re-run a named stack
	•	Reconcile: re-scan a subtree and bring jobs into sync
	•	Restart policies: “rerun from scratch” vs “rerun from stage X” vs “rerun if dirty”

The key shift

Stop thinking “constructor creates the world.”
Start thinking:

constructor creates a runtime; runtime manages a registry; jobs come and go.

So conceptually:
	•	engine instance = runtime
	•	jobs are entities that can be created, updated, destroyed
	•	stacks are executions that can be triggered repeatedly

Practical implications (without implementation detail)

If it’s fluid, Active Tags needs clear answers to:
	•	What is job identity? (element reference, id, or computed key)
	•	What state persists between runs? (ws, buffer, interval lock, last response)
	•	What resets on rerun? (stack queue, job.status, response r, buffer)
	•	What is the lifecycle contract when DOM changes? (cleanup intervals, detach handlers)

Right now “once something is up, its up” happens because:
	•	state is welded to job objects
	•	intervals & stacks aren’t treated as disposable resources
	•	job completion is sticky (“load=1”) in a way that blocks reactivation

Fluid = make jobs and their resources explicitly disposable and restartable.

⸻

2) Data attributes fatigue → Config layering

You’ve already got the beginnings of this with data-config (pull config from somewhere). That’s the right instinct.

What you want is a layered config system:

A sane hierarchy

Think of config sources as layers that merge in order:
	1.	Engine defaults (global baseline)
	2.	Runtime config (passed into constructor: transport, logging, policies)
	3.	Component preset (a named config object: “userCard”, “searchBox”)
	4.	Element config (data attributes, minimal overrides)
	5.	Invocation overrides (when you manually trigger something)

That gives you the best of both worlds:
	•	HTML stays clean
	•	you can still do quick per-element tweaks in markup
	•	you can reuse components by referencing a preset

What “simple JS configs” unlocks
	•	real reuse (“preset” configs, shareable definitions)
	•	fewer “billion attributes”
	•	versioning (swap preset v1 → v2)
	•	easier testing (configs as objects)
	•	ability to generate jobs programmatically (no DOM required)

But there’s a trap

JS configs can easily drift into “now it’s just another framework.”

So the guiding rule should be:

JS config should reduce attribute noise, not replace the declarative nature of Active Tags.

Meaning:
	•	data attributes remain a valid interface
	•	JS config becomes a source, not the only way

⸻

The unifying idea: Reconciliation

Your two goals converge into one architectural posture:

Active Tags becomes a reconciler between DOM and a job registry.

	•	DOM can change → runtime reconciles
	•	config can change → runtime reconciles
	•	presets can update → runtime reconciles
	•	jobs can be re-run → runtime reconciles

This gives you “fluid” without losing determinism.

⸻

What I’d propose as the “new mental model”

Instead of “Active Tags loads scripts”, it becomes:

Active Tags is a runtime that attaches workflows to elements.

And workflows are defined by:
	•	presets (JS objects)
	•	or attributes
	•	or both

⸻

The two biggest decisions you’ll need to make (conceptually)

Not asking you to answer right now — just framing the choices.

Decision A: What is a “job” in the modern system?
	•	Is it ephemeral execution? (created per run)
	•	Or a persistent binding? (exists while element exists)

I strongly suspect you want persistent binding + repeatable executions.

Decision B: How “reactive” do you want it?
	•	purely triggered (manual run / event / interval)
	•	or reactive to DOM mutations/config changes

A middle ground usually wins:
	•	MutationObserver optional, used for attach/detach
	•	but reruns still triggered intentionally unless a policy says otherwise

⸻

What “headway” looks like in big picture terms

If we’re “jumping to the fun part,” the most impactful conceptual deliverable is:
	1.	Define a runtime lifecycle (attach/update/detach/reconcile/run)
	2.	Define config layering + merge rules (preset + element overrides)
	3.	Define what state is persistent vs per-run
	4.	Define how re-running interacts with intervals and in-flight requests

Once those are solid, the ES6 cleanup becomes straightforward instead of chaotic.

⸻

If you want to keep the conversation flowing:
Tell me which vision feels more like you:
	•	A) Active Tags is a “DOM workflow runtime” you can keep running forever (attach/detach/reconcile).
	•	B) Active Tags is more like a “job runner” you call repeatedly on subtrees, no automatic watching.

Both can be fluid — but they lead to different vibes.