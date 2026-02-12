Active Tags 1.0 — Job Configuration Specification

1. Purpose

This document defines the Job Configuration contract for Active Tags 1.0.

It specifies how a Job is created, configured, merged, frozen, and refreshed, and which artifacts are derived at creation time.

This specification is intentionally limited to configuration. It does not define runtime execution, stack runners, request transport, DOM mutation behavior, or scheduling semantics.

The goal is to provide a deterministic, machine-generatable, and explained configuration model that the engine can safely build against.

⸻

2. Scope

In Scope
	•	Job identity and immutability rules
	•	HTML-to-job binding
	•	Configuration input sources
	•	Active configuration merge process
	•	Creation-only derivations:
	•	stack definitions
	•	interval definitions
	•	pipeline plans
	•	Programmatic refresh and rebuild rules
	•	Request storage facility (structure only)
	•	Validation and determinism guarantees

Out of Scope
	•	Runtime execution of stacks or stages
	•	HTTP transport or request lifecycle
	•	Pipeline callable behavior
	•	DOM mutation semantics
	•	Scheduler / runner implementation
	•	Observer or delegator behavior
	•	Backward compatibility with AT < 1.0

⸻

3. Definitions
	•	Job: A stateful runtime entity bound to exactly one DOM element.
	•	DOM Element (e): The element a Job is attached to; immutable.
	•	Config Entry: A JSON configuration object resolved by name or inline definition.
	•	Active Configuration (activeConf): The merged configuration used to derive creation-only artifacts.
	•	Creation-only artifacts: Derived structures that are frozen after job creation.

⸻

4. HTML Binding Contract

4.1 Activation

An element becomes a Job candidate when it contains:
	•	data-activetag

Example:

<form data-activetag></form>
<div data-activetag></div>

4.2 Configuration Binding

A Job candidate may reference a configuration entry via:
	•	data-config-at="<jobKey>"

Example:

<form data-activetag data-config-at="contactForm"></form>

4.3 Defaults
	•	Job IDs are system-generated
	•	Job names are optional and user-facing
	•	Default stack name: main
	•	Default form archetype: form.submit

⸻

5. Configuration Inputs

5.1 Configuration Sources

A Job’s configuration may be composed from the following sources:
	1.	configEntrySnapshot (creation-only)
	2.	dataset (mutable DOM data-*)
	3.	attrs (mutable DOM attributes)
	4.	overrides (programmatic)
	5.	defaults (library-defined)

5.2 Merge Precedence (highest wins)
	1.	overrides
	2.	dataset
	3.	attrs
	4.	configEntrySnapshot
	5.	defaults

This precedence is fixed for Active Tags 1.0.

5.3 Merge Semantics
	•	Objects: deep-merged unless explicitly replace-only
	•	Arrays: replace-by-default (no concatenation)
	•	Scalars: overwrite
	•	Null semantics: null deletes inherited value

⸻

6. Active Configuration Output

The merge process produces:
	•	job.activeConf

activeConf must contain sufficient information to derive:
	•	stack definitions
	•	interval definitions
	•	pipeline definitions per stack

⸻

7. First-Creation Derivations (Immutable-After-Creation)

The following artifacts are derived once at job creation and frozen:

7.1 Stack Definitions
	•	Jobs may define multiple named stacks
	•	Stack definitions are derived from activeConf.stacks
	•	If missing, a deterministic default stack MUST be created
	•	Stack definitions MUST NOT be inferred from stage-specific config fields

7.2 Interval Definitions
	•	Derived from activeConf.intervals
	•	Normalized into a stable internal structure
	•	Stored as a hash where possible

7.3 Pipeline Definitions
	•	Each stack resolves to an ordered pipeline definition
	•	Pipelines are composed of callables referenced via DSL
	•	No stage-specific configuration trees are permitted

⸻

8. Programmatic Update Facilities

8.1 Immutable-After-Creation Updates (Explicit Only)

The following operations MUST be explicit API calls:
	•	job.setName(name)
	•	job.setConfigEntry(configObj | ref)
	•	job.rebuildStacks()
	•	job.rebuildIntervals()
	•	job.rebuildPipelines()

8.2 Mutable Refresh Operations

The following may be refreshed without rebuilding artifacts:
	•	job.refreshDataset()
	•	job.refreshAttrs()
	•	job.setOverrides(patch) / patchOverrides() / clearOverrides()
	•	job.recomputeActiveConf()

8.3 Reload Master Operation

A unified reload API MUST exist:

job.reload({
  dataset: true,
  attrs: true,
  recompute: true,
  rebuild: false
});

By default, reload MUST NOT rebuild creation-only artifacts.

⸻

9. Request Storage Facility

Each Job MUST maintain a request storage hash:

job.requests = {
  [name]: requestRecord
};

9.1 Record Requirements

Each record MUST include:
	•	name (string)
	•	ts (timestamp)
	•	input (optional)
	•	output (optional)
	•	meta (optional)

9.2 Semantics
	•	Only the most recent request per name is stored
	•	No request history is retained in v1.0

⸻

10. Validation and Error Handling

10.1 Creation-Time Validation (Hard Fail)
	•	Missing or invalid DOM element
	•	Configuration resolution failure
	•	Invalid stack, interval, or pipeline definitions

10.2 Reload-Time Validation (Soft by Default)
	•	Dataset/attr refresh failures retain last snapshot
	•	activeConf recompute failures retain last activeConf
	•	Rebuild failures must be explicit and non-partial

10.3 Determinism

Given identical inputs, configuration operations MUST be deterministic.

⸻

11. Non-Goals and Explicit Removals

Removed from Active Tags 1.0 configuration:
	•	Stage-specific configuration trees
	•	Attribute-level transform DSLs
	•	Pipeline behavior toggles embedded in config

Replacement model:
	•	Built-in pipeline callables define behavior
	•	Users customize by selecting callables and parameters via DSL

⸻

12. Minimal Internal Job Data Model (Configuration View)

Immutable Forever
	•	e

Immutable-After-Creation
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

Runtime Storage (Out of Scope)
	•	requests
	•	ws

⸻

13. Required Creation Order

Job creation MUST proceed in this exact order:
	1.	Bind DOM element (immutable)
	2.	Generate system job id
	3.	Derive job name (creation-only)
	4.	Resolve configEntrySnapshot
	5.	Collect dataset
	6.	Collect attrs
	7.	Merge activeConf
	8.	Derive stackDefs
	9.	Derive intervalDefs
	10.	Derive pipelineDefs per stack

⸻

End of Specification