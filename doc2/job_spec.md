Locked. Here’s the airtight, LLM-consumable contract for AT 1.0 Job Configuration only, updated to your defaults:
	•	System generates job id (stable runtime identity)
	•	User may set a friendly job name (optional convenience)
	•	Binding attribute is data-config-at (not data-at)
	•	Activation attribute is data-activetag
	•	Default archetype for forms is form.submit
	•	Default stack is main

Below is the deliverable: AT Job Spec v1 — requirements + canonical JSON shape + mutation rules, tightly scoped to job configuration.

⸻

AT Job Spec v1

Job Configuration Contract Requirements

1) Purpose

Define a minimal, deterministic, machine-generatable configuration contract that:
	•	binds DOM elements to Jobs
	•	collects mutable inputs (dataset/attrs + execution inputs)
	•	merges an active configuration
	•	compiles creation-only artifacts (stacks/intervals/pipelines) once
	•	remains reachable for low-skill users while supporting high-ceiling “beast mode”

This spec does not define runtime execution semantics—only how the job becomes configured and what artifacts are produced.

⸻

2) HTML Binding Contract

2.1 Activation

An element becomes a Job candidate when it has:
	•	data-activetag present

Example:

<form data-activetag></form>
<div data-activetag></div>

2.2 Config Binding

A Job candidate may reference a Job Spec entry via:
	•	data-config-at="jobKey"

Example:

<form data-activetag data-config-at="contactForm"></form>

2.3 Identity vs Name (your rule)
	•	Job ID: system-generated (required, internal, stable)
	•	Job Name: optional user-friendly label for convenience

Important: Name is not required for binding; binding uses data-config-at.

⸻

3) Job Configuration Inputs

Jobs collect these inputs in two categories:

3.1 Creation-only inputs (immutable after creation unless API update)
	•	Element binding: e (DOM element) — immutable forever
	•	Job name: derived on creation only (may be updated via API)
	•	Config entry snapshot: resolved from data-config-at on creation only (may be updated via API)
	•	Stacks: derived once
	•	Intervals: derived once
	•	Pipelines per stack: derived once

3.2 Always-mutable inputs (recomputable)
	•	Dataset snapshot: from element data-* attributes
	•	Attrs snapshot: from element attributes (e.g., action/method; extensible)
	•	Manual overrides: supplied programmatically (patches)
	•	Trigger context: submit/click/hover/etc (per execution)
	•	Stack execution plan: per execution (run stack A, or A then B)
	•	Form inputs: per execution (FormData/value states)

⸻

4) Merge Model: Active Configuration

4.1 Active configuration definition

activeConf is a merged object derived from:
	1.	defaults
	2.	configEntrySnapshot (creation-only)
	3.	attrs (mutable)
	4.	dataset (mutable)
	5.	overrides (mutable)

4.2 Precedence (highest wins)
	1.	overrides
	2.	dataset
	3.	attrs
	4.	configEntrySnapshot
	5.	defaults

4.3 Merge semantics
	•	Deep merge objects
	•	Arrays replace by default
	•	Null deletion policy: null deletes (recommended)
(Allows a higher-precedence layer to remove inherited keys.)

⸻

5) Triggers in the Spec (configuration-level only)

Triggers must be represented as part of job configuration, but binding mechanics are TBD.

5.1 Trigger object (config-time shape)

{
  "type": "submit",
  "stackPlan": ["main"]
}

	•	type: string (submit/click/hover/change/etc)
	•	stackPlan: array of stack names in order

Note: how/where the runtime binds these triggers (delegator vs observer vs programmatic) is TBD and out of scope.

⸻

6) Stack Selection vs Stack Definitions

6.1 Immutable: stack definitions

At creation, the job produces stackDefs based on activeConf.stacks.

These definitions are immutable after creation unless explicitly rebuilt via API.

6.2 Always-mutable: stack plan

Which stacks are executed (and in what order) is not part of job immutability.

A run may specify:
	•	run stack "a"
	•	run "a" then "b"

This is modeled by stackPlan in triggers and/or per-run inputs.

⸻

7) Pipelines and “No Stage-Specific Config”

7.1 Pipeline references, not stage config

The spec forbids embedding “stage-specific configuration information” as a configuration tree.

Instead:
	•	stacks reference pipelines
	•	pipelines are lists of callable identifiers
	•	callables are resolved to implementations by the runtime library

7.2 Pipeline item format (minimal)

"pipelines": {
  "formSubmitDefault": ["form.serialize", "http.send", "dom.patch"]
}

Note: optional DSL params are allowed in the future (parseTarget-style), but not required for v1.

⸻

8) Intervals (creation-only artifact)

Intervals are part of job configuration but are derived once from activeConf.

Minimal interval def:

"intervals": {
  "poll": { "everyMs": 2000 }
}

Stacks may reference an interval by name (or embed it), but the compiled interval plan is creation-only.

⸻

9) Request Storage Facility

Each job must have a named request storage hash:
	•	requests[name] = lastRecord

Requirements
	•	Single-level hash (not Map)
	•	Last-write-wins per name
	•	No history retention in v1

Minimal record:

{
  "name": "foo",
  "ts": 1730000000000,
  "input": {},
  "output": {},
  "meta": {}
}


⸻

AT Job Spec v1 JSON Shape

This is the LLM-consumable “page contract”.

{
  "version": 1,
  "jobs": {
    "contactForm": {
      "name": "Contact Form",
      "selector": "form#contact",
      "archetype": "form.submit",
      "triggers": [
        { "type": "submit", "stackPlan": ["main"] }
      ],
      "stacks": {
        "main": { "pipeline": "formSubmitDefault" }
      }
    }
  },
  "pipelines": {
    "formSubmitDefault": ["form.serialize", "http.send", "dom.patch"]
  }
}

Notes
	•	jobs keys are spec keys (used by data-config-at)
	•	name is optional, user-facing
	•	selector is optional if you bind purely through data-config-at discovery; but keeping it makes the spec self-validating and LLM-friendly
	•	archetype defaults to:
	•	form.submit if the element is a <form>
	•	otherwise omitted (runtime chooses minimal defaults)

⸻

Configuration Lifecycle Requirements

Creation-time (compile) steps
	1.	Bind element (immutable)
	2.	Generate system job id
	3.	Collect job name (creation-only)
	4.	Resolve configEntrySnapshot from data-config-at (creation-only)
	5.	Collect dataset (mutable snapshot)
	6.	Collect attrs (mutable snapshot)
	7.	Merge activeConf
	8.	Compile stackDefs (creation-only)
	9.	Compile intervalDefs (creation-only)
	10.	Compile pipelineDefs per stack (creation-only)

Reload / refresh (mutable)

A job may refresh:
	•	dataset
	•	attrs
	•	overrides
	•	activeConf

But must not rebuild stacks/intervals/pipelines unless explicit API calls are invoked.

⸻

Open TBD Notes (explicitly recorded)
	•	Trigger binding mechanism (delegator rules / dataset-driven / programmatic / hybrid) remains TBD.
	•	DSL parameterization format for pipeline items remains TBD (but reserved).
	•	Advanced selection rules (conditional stack routing) TBD.

⸻

If you want the next practical step: I can turn this into a strict JSON Schema (Draft 2020-12) so the contract is not just “guidance” but formally machine-validatable—perfect for LLM generation + automated checking.


{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://m7.org/schemas/active-tags/at-job-spec-v1.schema.json",
  "title": "Active Tags Job Spec v1 (Job Configuration Only)",
  "type": "object",
  "additionalProperties": false,
  "required": ["version", "jobs"],
  "properties": {
    "version": {
      "type": "integer",
      "const": 1,
      "description": "Contract version. Must be 1 for this schema."
    },

    "defaults": {
      "$ref": "#/$defs/Defaults",
      "description": "Optional contract-level defaults merged into job activeConf at lowest precedence."
    },

    "jobs": {
      "type": "object",
      "description": "Dictionary of job specs. Keys are referenced by HTML via data-config-at=\"<jobKey>\".",
      "minProperties": 1,
      "additionalProperties": { "$ref": "#/$defs/JobSpec" },
      "propertyNames": { "$ref": "#/$defs/IdToken" }
    },

    "pipelines": {
      "type": "object",
      "description": "Pipeline library (optional). Pipelines are referenced by stacks via pipeline name.",
      "additionalProperties": { "$ref": "#/$defs/PipelineDef" },
      "propertyNames": { "$ref": "#/$defs/IdToken" }
    },

    "archetypes": {
      "type": "object",
      "description": "Optional archetype registry. Jobs may refer to archetypes by name. Resolution is runtime-defined.",
      "additionalProperties": { "$ref": "#/$defs/ArchetypeDef" },
      "propertyNames": { "$ref": "#/$defs/IdToken" }
    },

    "notes": {
      "type": "string",
      "description": "Optional human-readable notes. Ignored by runtime."
    }
  },

  "$defs": {
    "IdToken": {
      "type": "string",
      "minLength": 1,
      "maxLength": 128,
      "pattern": "^[A-Za-z_][A-Za-z0-9_\\-:.]*$",
      "description": "Identifier token for keys and references."
    },

    "CssSelector": {
      "type": "string",
      "minLength": 1,
      "maxLength": 1024,
      "description": "CSS selector string. Used for self-validation and optional binding."
    },

    "Defaults": {
      "type": "object",
      "additionalProperties": true,
      "description": "Arbitrary defaults object. Runtime merges at lowest precedence."
    },

    "JobSpec": {
      "type": "object",
      "additionalProperties": false,
      "description": "Job configuration entry. Bound from DOM via data-config-at=\"jobKey\". Job ID is system-generated; job name is optional.",
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 256,
          "description": "Optional user-friendly job name (creation-only)."
        },

        "selector": {
          "$ref": "#/$defs/CssSelector",
          "description": "Optional selector describing where the job lives. Recommended for validation and LLM output."
        },

        "archetype": {
          "$ref": "#/$defs/IdToken",
          "description": "Optional archetype name. Default archetype is form.submit for <form data-activetag> elements."
        },

        "triggers": {
          "type": "array",
          "description": "Trigger declarations. Binding mechanism is TBD; trigger objects exist for configuration and routing.",
          "items": { "$ref": "#/$defs/TriggerDef" },
          "minItems": 1
        },

        "stacks": {
          "type": "object",
          "description": "Stack definitions. Derived once at creation into compiled stack defs (immutable after creation unless rebuilt via API).",
          "minProperties": 1,
          "additionalProperties": { "$ref": "#/$defs/StackDef" },
          "propertyNames": { "$ref": "#/$defs/IdToken" }
        },

        "intervals": {
          "type": "object",
          "description": "Interval definitions (optional). Derived once at creation into compiled interval defs.",
          "additionalProperties": { "$ref": "#/$defs/IntervalDef" },
          "propertyNames": { "$ref": "#/$defs/IdToken" }
        },

        "config": {
          "type": "object",
          "description": "Arbitrary config subtree. Merged into activeConf (creation snapshot + mutable DOM sources + overrides).",
          "additionalProperties": true
        }
      },
      "required": ["stacks"],
      "allOf": [
        {
          "if": { "properties": { "triggers": { "type": "array" } }, "required": ["triggers"] },
          "then": {}
        }
      ]
    },

    "TriggerDef": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type"],
      "properties": {
        "type": {
          "type": "string",
          "minLength": 1,
          "maxLength": 64,
          "description": "Trigger type (e.g., submit, click, hover, change, keydown). Exact binding semantics TBD."
        },

        "stackPlan": {
          "$ref": "#/$defs/StackPlan",
          "description": "Per-execution stack selection plan. Always-mutable input concept represented in config."
        },

        "when": {
          "type": "string",
          "description": "TBD: future conditional expression/DSL for trigger routing. Ignored unless runtime supports it."
        },

        "notes": {
          "type": "string",
          "description": "Optional trigger notes. Ignored by runtime."
        }
      }
    },

    "StackPlan": {
      "description": "Ordered list of stack names to execute. Always-mutable per run; config may provide defaults.",
      "oneOf": [
        {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/$defs/IdToken" }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["stacks"],
          "properties": {
            "mode": {
              "type": "string",
              "enum": ["replace", "append"],
              "default": "replace",
              "description": "How this plan interacts with any runtime default plan."
            },
            "stacks": {
              "type": "array",
              "minItems": 1,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": ["name"],
                "properties": {
                  "name": { "$ref": "#/$defs/IdToken" }
                }
              }
            },
            "stopOnError": {
              "type": "boolean",
              "default": true,
              "description": "Optional future control; runtime-defined."
            }
          }
        }
      ]
    },

    "StackDef": {
      "type": "object",
      "additionalProperties": false,
      "required": ["pipeline"],
      "properties": {
        "pipeline": {
          "description": "Pipeline reference or inline pipeline list.",
          "oneOf": [
            { "$ref": "#/$defs/IdToken" },
            { "$ref": "#/$defs/PipelineDef" }
          ]
        },

        "interval": {
          "description": "Optional interval reference or inline interval def for this stack.",
          "oneOf": [
            { "$ref": "#/$defs/IdToken" },
            { "$ref": "#/$defs/IntervalDef" }
          ]
        },

        "notes": {
          "type": "string",
          "description": "Optional stack notes. Ignored by runtime."
        }
      }
    },

    "PipelineDef": {
      "type": "array",
      "description": "Ordered list of callable identifiers. Callable resolution and DSL params are runtime-defined.",
      "minItems": 1,
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 256,
        "description": "Callable reference (e.g., form.serialize, http.send, dom.patch). Future: allow DSL args."
      }
    },

    "IntervalDef": {
      "type": "object",
      "additionalProperties": false,
      "description": "Interval definition. Derived once at creation into compiled interval plan.",
      "properties": {
        "everyMs": {
          "type": "integer",
          "minimum": 1,
          "maximum": 2147483647,
          "description": "Base interval period in milliseconds."
        },
        "maxRuns": {
          "type": "integer",
          "minimum": 0,
          "maximum": 2147483647,
          "default": 0,
          "description": "0 means unlimited."
        },
        "overlapPolicy": {
          "type": "string",
          "enum": ["skip", "coalesce", "queue"],
          "default": "coalesce",
          "description": "Policy when a tick fires while the interval is already running."
        },
        "enabled": {
          "type": "boolean",
          "default": true,
          "description": "Whether this interval is enabled at creation."
        },
        "notes": {
          "type": "string",
          "description": "Optional interval notes. Ignored by runtime."
        }
      },
      "required": ["everyMs"]
    },

    "ArchetypeDef": {
      "type": "object",
      "additionalProperties": true,
      "description": "Archetype definition. Runtime may merge archetype config into activeConf."
    }
  }
}