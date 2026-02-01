Active Tags 1.0 — Job Configuration Specification

This document defines only the Job Configuration Process for Active Tags 1.0: how a Job is created from a DOM element + optional external JSON config, how inputs are collected, merged, frozen, and how the “active configuration” is produced.

It does not specify request execution, pipeline semantics, DOM mutation effects, rendering, chain execution, transport, or observer/delegator behavior—except where they directly constrain configuration.

⸻

1) Scope

In scope
	•	Job creation inputs and collection
	•	Identity and immutability rules
	•	Config sources (DOM element, external config entry, dataset, attrs, overrides)
	•	Active configuration merge + precedence
	•	First-creation-only derivations:
	•	stack definitions
	•	interval definitions
	•	pipeline plan for each stack
	•	Programmatic facilities for updating “immutable-after-creation” fields only via API
	•	Request storage facility schema (named requests; last-write semantics)

Out of scope
	•	Backward compatibility with AT < 1.0
	•	Network execution
	•	Stack runner / stage execution
	•	DOM mutation observer design
	•	Delegator event binding design
	•	Diagnostics/logging policy (beyond configuration errors)

⸻

2) Definitions and Terminology
	•	Job: A stateful runtime entity bound to exactly one DOM element; holds identity, config, derived plans, and request storage.
	•	DOM Element (e): The element the job is attached to; immutable once created.
	•	External Job Config Entry: Optional JSON object resolved from data-config (or equivalent), used as a configuration source.
	•	Dataset: A normalized object built from the element’s data-* attributes (with any chosen inflate rules).
	•	Attrs: Direct element attributes (e.g., action, method, others as required).
	•	Manual Overrides: Programmatic overrides applied to a job (e.g., job.setConfigPatch()).
	•	Active Configuration (activeConf): The final merged configuration used by the runtime. It is computed from config sources and can be recomputed.
	•	First Creation Derivations: Artifacts computed only at job creation time (unless explicitly rebuilt via API), including stacks, intervals, and pipeline plans.

⸻

3) Core Principles
	1.	Hard break from legacy
AT 1.0 does not preserve legacy schema or “stage-specific config” fields.
	2.	Strict mutability contract
	•	Some fields are immutable forever (e.g., bound DOM element).
	•	Some are immutable after creation (e.g., stacks) but can be updated via explicit API.
	•	Some are mutable and can be recomputed from DOM/config changes (e.g., dataset, attrs, activeConf).
	3.	Separation of “inputs” vs “derived configuration”
We always distinguish:
	•	collected inputs (raw sources)
	•	merged activeConf
	•	derived plans (stacks/intervals/pipelines)
	4.	No “stage-specific configuration information” in job config
Any “pipeline changes” or stage-specific tuning is done by:
	•	built-in callable pipeline units
	•	user-injected callables via a small DSL (the same family as parseTarget), referenced by name/descriptor

⸻

4) Job Mutability Model

4.1 Immutable forever
	•	job.e — the DOM element attached to the job

4.2 Immutable after creation (first-creation artifacts)

These are determined at creation time and must not change via DOM/config mutation.
They may only be changed via explicit programmatic commands:
	•	job.name (collected on creation only)
	•	job.configEntry (resolved external config entry snapshot on creation only)
	•	job.stackDefs (stack definitions)
	•	job.intervalDefs (interval definitions)
	•	job.pipelineDefs (pipeline plan for stack/stages)

4.3 Mutable (recomputable)

These may be refreshed from DOM/config changes:
	•	job.dataset (from data-*)
	•	job.attrs (from attributes)
	•	job.overrides (manual patches)
	•	job.activeConf (merged view computed from sources)

⸻

5) Job Configuration Inputs

The job configuration process collects the following inputs:

5.1 DOM Element (immutable)
	•	e: DOM node reference (must be valid element)

5.2 Job Name (creation-only)
	•	Derived once on create.
	•	No implicit renaming on DOM/config changes.

Requirement: Name derivation must be deterministic and well-defined.

5.3 External JSON Config Entry (creation-only)
	•	A job may reference an external config entry (via attribute such as data-config, or equivalent).
	•	External config resolution may involve interpolation (library scheme).
	•	The resolved config object is captured as configEntrySnapshot at creation.

Requirement: Config entry resolution happens once on creation and is not auto-refreshed unless explicitly invoked via API.

5.4 Dataset (mutable)
	•	Derived from data-* attributes (including any normalization: filtering, remapping, inflate rules).
	•	Refreshed by calling job.refreshDataset() (or similar).

5.5 Attrs (mutable)
	•	Derived from element attributes (minimum: action, method; extendable).
	•	Refreshed by calling job.refreshAttrs() (or similar).

5.6 Manual Overrides (mutable)
	•	A programmatic patch object controlled by the user.
	•	Must be applied at merge time.

⸻

6) Active Configuration Formation

6.1 Active Configuration Sources

Active Configuration is the merge of (some subset of):
	1.	configEntrySnapshot (creation-only JSON config)
	2.	dataset (mutable DOM data)
	3.	attrs (mutable DOM attrs)
	4.	overrides (programmatic)
	5.	defaults (library-defined defaults)

6.2 Merge Precedence (highest wins)

Requirement (default policy):
	1.	overrides
	2.	dataset
	3.	attrs
	4.	configEntrySnapshot
	5.	defaults

This precedence is chosen to:
	•	let runtime patches win
	•	let markup win over plain attrs
	•	let explicit markup win over external config
	•	maintain stable defaults

Note: You can swap dataset vs attrs if desired. But pick one and freeze it in v1.0.

6.3 Merge Semantics
	•	Merge must be deep-merge for objects unless a key is explicitly “replace-only”.
	•	Arrays are replace-by-default (no concatenation), unless a specific field defines otherwise.
	•	Scalars overwrite.
	•	Null semantics must be explicit:
	•	Either “null deletes” or “null is value”.
	•	Choose one policy; recommended: null deletes to allow removal of inherited config.

6.4 Output
	•	job.activeConf is the final merged object.
	•	Must include enough info to build:
	•	stack definitions (creation-only)
	•	interval definitions (creation-only)
	•	pipeline plan (creation-only)
	•	Must also drive runtime request execution later (out of scope).

⸻

7) First-Creation Derivations

The following are computed during job creation and then frozen (immutable-after-creation):

7.1 Determine Stacks (creation-only)
	•	A job may have multiple named stacks.
	•	Stack definitions are derived from activeConf.stacks (or similar).
	•	If missing, there must be a deterministic default stack definition.

Requirement: Stacks are not inferred from “stage-specific config fields.” They come from an explicit stack DSL or a minimal default.

7.2 Determine Intervals (creation-only)
	•	Interval definitions are derived from activeConf.intervals (or similar).
	•	Interval definitions must be normalized into a stable internal format (hash or array, but stored as hash if possible).

7.3 Determine Pipeline per Stack (creation-only)
	•	Each stack has a pipeline definition derived from activeConf.pipelines (or stack-local pipeline definition).
	•	Pipelines are defined as ordered callables (built-ins or user references via DSL).
	•	No “stage-specific configuration information” is stored; pipeline components are callables with their own internal behavior and can accept DSL parameters.

⸻

8) Programmatic Update Facilities

Immutable-after-creation fields may be updated only via explicit API calls.

8.1 Required job API commands
	•	job.setName(name)
Updates job.name. Must not be influenced by DOM/config refresh.
	•	job.setConfigEntry(configObj) or job.setConfigRef(ref)
Replaces the creation-only config entry snapshot (explicitly).
	•	job.rebuildStacks()
Recomputes stack definitions from current activeConf (explicit). Marks stacks as “rebuilt at T”.
	•	job.rebuildIntervals()
Recomputes interval definitions from current activeConf (explicit).
	•	job.rebuildPipelines()
Recomputes pipeline plans from current activeConf (explicit).

8.2 Mutable refresh API commands
	•	job.refreshDataset()
Recollect dataset from DOM element.
	•	job.refreshAttrs()
Recollect attrs from DOM element.
	•	job.setOverrides(patch) / job.patchOverrides(patch) / job.clearOverrides()
Manage manual overrides.
	•	job.recomputeActiveConf()
Re-merges sources into activeConf.

8.3 “Reload config” master operation (single function)

Requirement: Provide a single operation to “reload an object’s conf” without implicitly changing creation-only artifacts.

Suggested shape:
	•	job.reload({ dataset=true, attrs=true, recompute=true, rebuild=false })

Where:
	•	dataset refresh toggles dataset recollection
	•	attrs refresh toggles attrs recollection
	•	recompute toggles activeConf recomputation
	•	rebuild is false by default; if true, may call rebuildStacks/Intervals/Pipelines in a controlled order

⸻

9) Request Storage Facility

Each Job must include a request storage facility supporting named request objects, where only the last request per name is stored.

9.1 Storage requirements
	•	job.requests is a single-level hash keyed by request name.
	•	Value is the most recent request record for that name.

Example:

job.requests = {
  foo: { /* last foo request record */ },
  bar: { /* last bar request record */ },
  baz: { /* last baz request record */ }
};

9.2 Record shape (minimal)

The spec does not mandate transport fields, but requires:
	•	name (string)
	•	ts (timestamp)
	•	input (optional: request descriptor used)
	•	output (optional: response-like record)
	•	meta (optional: debugging fields)

9.3 Update semantics
	•	job.storeRequest(name, record) overwrites job.requests[name].
	•	No history is stored in v1.0 (by design).

⸻

10) Validation and Error Handling

10.1 Creation-time validation (hard fails)
	•	Missing/invalid DOM element => error
	•	Config resolution errors => error (unless configured to warn and continue)
	•	Invalid stack/interval/pipeline definitions => error (creation only)

10.2 Reload-time validation (soft by default)
	•	If dataset/attrs refresh fails, job remains with last-known snapshots.
	•	If recompute fails, job keeps last activeConf.
	•	Rebuild operations fail explicitly and do not partially update unless specified.

10.3 Deterministic behavior

All configuration operations must be deterministic given the same inputs.

⸻

11) Non-goals and Explicit Removals

Removed from AT 1.0 job config
	•	Any “stage-specific configuration information” like:
	•	attr transform configs
	•	pipeline behavior toggles scattered in config tree
	•	per-stage oddities baked into schema

Replacement approach
	•	Built-in pipeline callables define behavior.
	•	Users customize by selecting/injecting callables through a DSL descriptor (e.g., “callable name + params”), not by mutating stage configuration trees.

⸻

12) Suggested Minimal Internal Data Model (Job Fields)

Immutable forever
	•	e

Immutable-after-creation
	•	name
	•	configEntrySnapshot
	•	stackDefs
	•	intervalDefs
	•	pipelineDefs

Mutable
	•	dataset
	•	attrs
	•	overrides
	•	activeConf

Runtime storage
	•	requests (hash)
	•	ws (basic workspace; compatible default)

⸻

13) Required Configuration Process Order (Creation)

Creation must execute in this order:
	1.	bind e (immutable)
	2.	derive name (creation-only)
	3.	resolve external configEntrySnapshot (creation-only)
	4.	collect dataset (mutable)
	5.	collect attrs (mutable)
	6.	compute activeConf
	7.	derive stackDefs (creation-only)
	8.	derive intervalDefs (creation-only)
	9.	derive pipelineDefs per stack (creation-only)

⸻


user mutable inputs

Here’s the clean way to define “always-mutable inputs” in AT 1.0, tightly bounded to job configuration.

These are not “job config” in the sense of stacks/pipelines/intervals.
They are per-execution / per-request inputs that must be allowed to change every time without rebuilding the job.

⸻

Always-mutable inputs

1) Form runtime values

Source: FormData / current form fields at the moment of execution
Examples:
	•	<input> / <select> / <textarea> values
	•	checked state, selected options
	•	dynamic hidden fields injected by JS

Rule: Never stored as part of job config. Collected fresh per run.

⸻

2) Posting parameters (derived from DOM at time of execution)

Source: form element attributes or button submitter
	•	method (form.method or submitter override)
	•	action (form.action or submitter override)
	•	enctype / encoding
	•	submit button name/value contribution (the clicked submitter matters)

Rule: These are execution inputs, not job identity/config. Always re-derived unless user explicitly pins them via overrides for that run.

⸻

3) Manual execution inputs (caller-provided “run context”)

Source: programmatic call, e.g. activeTags.run(job, ctx)
Examples:
	•	extra payload / patch data
	•	headers
	•	query params
	•	runtime variables for interpolation
	•	flags like dryRun, silent, noDomWrite

Rule: Must never mutate job config unless an explicit “persist” API is invoked.

⸻

4) Runtime interpolation scope

Anything used by your small DSL / parseTarget-style references should be allowed to vary per execution:
	•	environment variables
	•	“this”, “event”, “submitter”, “form”, “job”, “dataset” snapshots
	•	any ephemeral ctx.vars

Rule: DSL resolution should accept a run scope object that changes per run.

⸻

5) Event context (delegator)

If a job is triggered by an event:
	•	event object
	•	target/currentTarget
	•	submitter for forms
	•	pointer coords, key modifiers, etc.

Rule: always per-execution.

⸻

What is not always-mutable (important boundary)

These are job configuration and should not change every run unless explicitly updated:
	•	job name
	•	external config entry snapshot
	•	stack defs
	•	pipeline defs
	•	interval defs

⸻

Proposed structure (one clean “mutable inputs” object)

When a job executes, it should receive a Run Inputs object:

runInputs = {
  event,          // optional
  submitter,      // optional
  formData,       // optional (FormData or plain object)
  post: {         // always mutable request hints
    method,
    action,
    encoding,
    headers,
    query,
  },
  vars: { ... },  // interpolation scope / DSL vars
  payload,        // caller-provided body override/patch
  flags: { ... }, // runtime behavior toggles
};

This is the “always mutable” payload. It can be rebuilt every run without touching job config.

⸻

Requirements statements (so you can paste into the spec)
	•	R1: Form input values MUST be collected at execution time and MUST NOT be persisted into job configuration by default.
	•	R2: Posting parameters (method/action/encoding) MUST be re-derived at execution time from DOM and/or run inputs unless explicitly overridden for that run.
	•	R3: Programmatic/manual inputs MUST be provided as a per-execution context object and MUST NOT mutate job configuration unless an explicit persistence API is used.
	•	R4: DSL/interpolation MUST accept a per-execution scope object (vars + event + submitter + formData) and MUST NOT depend on job config mutation.
	•	R5: Job configuration rebuild actions (stacks/intervals/pipelines) MUST NOT occur as a side-effect of per-execution inputs.




---
Got it. Here are the additions to the Job Configuration spec, still tightly bounded to configuration + execution-input boundaries, with clear “TBD” notes where behavior isn’t decided yet.

⸻

Addendum: Triggers and Stack Selection as Always-Mutable Inputs

1) Triggers (events) must be represented

Requirement
A Job must support being executed by trigger contexts (events), such as:
	•	submit
	•	click
	•	hover / mouseenter / mouseleave
	•	change
	•	keydown / keyup
	•	custom delegated events (future)

Scope boundary
Triggers are not job configuration (they are not stacks/pipelines/intervals).
They are always-mutable execution inputs.

Data model
When execution is triggered, the runtime must create a Trigger Context object:

trigger = {
  type,           // e.g. "submit", "click"
  event,          // native Event
  target,         // event.target
  currentTarget,  // event.currentTarget (delegator-controlled)
  submitter,      // HTMLButtonElement/HTMLInputElement when submit
  ts,             // timestamp
  meta: { ... }   // reserved: pointer coords, key mods, etc
};

Note (TBD)
How triggers are bound / declared is not decided yet:
	•	could be dataset-driven (data-trigger="submit click")
	•	could be delegator rules external to job
	•	could be programmatic registration
	•	could be hybrid

The spec only requires that the trigger context exists and is passed into execution.

⸻

2) Stack selection must be user-controllable at execution time

You want jobs to be “configured and immutable” but allow the user (or event/input) to decide what stack(s) to run. That means stack selection is always-mutable and must be modeled as part of Run Inputs, not job config.

Requirement
A job may have multiple configured stacks, but the executed stack plan can be determined per run.

Examples:
	•	on submit, run stack "a"
	•	on submit, run "a" then "b"
	•	run default stack unless overridden

Rule
Stack definitions are immutable-after-creation (job.stackDefs).
But stack execution plan is mutable per run.

So we introduce:
	•	StackDefs (immutable-after-creation): what stacks exist and their pipeline plans
	•	StackPlan (always-mutable): which stacks to run this time, and in what order

StackPlan shape (proposed)

stackPlan = {
  mode: "replace" | "append",  // replace default plan or append to it
  stacks: [
    { name: "a" },
    { name: "b" }
  ],
  // optional future controls:
  // stopOnError: true/false
  // until: "stageName"
};

Where StackPlan comes from (precedence)
Stack plan can be derived from multiple per-run sources (highest wins):
	1.	Explicit manual execution input (runInputs.stackPlan)
	2.	Trigger-derived input (e.g. submitter dataset says run stack “save”)
	3.	Form input field (e.g. <input name="stack" value="a">)
	4.	Job default (configured default stack, e.g. "main")

This preserves job immutability while allowing dynamic choice.

Note (TBD)
We are not deciding today:
	•	whether the stack name can be inferred from event.type
	•	whether there’s a routing table (trigger → stack)
	•	whether multiple stacks run sequentially or as a composed pipeline
	•	whether stack selection can include conditionals

The document only requires:
	•	stack selection exists as a per-run input
	•	job stack definitions remain immutable unless rebuilt explicitly

⸻

Updated “Always-Mutable Inputs” list (additions)

Add these to the always-mutable section:
	•	Trigger Context (event type + event object + submitter + meta)
	•	Stack Execution Plan (which stacks to execute, and ordering)

⸻

Requirements statements (copy/paste)
	•	T1: Runtime execution MUST accept a Trigger Context object representing the event that caused execution (submit/click/hover/etc).
	•	T2: Trigger binding/declaration is TBD, but Trigger Context MUST be available to stack selection, interpolation, and request formation.
	•	S1: Stack definitions (available stack names and their pipelines) MUST be immutable-after-creation unless rebuilt via explicit API.
	•	S2: Stack execution plan (selected stacks and order) MUST be always-mutable and supplied per execution via run inputs.
	•	S3: The engine MUST support executing multiple stacks in an explicit order as specified by the stack plan.

⸻

If you want the next refinement (still within job configuration boundaries): I can add a short section defining how stack names are validated against job.stackDefs and what to do on invalid selection (error vs fallback).
