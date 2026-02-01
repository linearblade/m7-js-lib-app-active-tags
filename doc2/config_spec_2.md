Yep. If we want AT 1.0 to dominate, config has to match the two realities:
	•	90%: single pipeline (mostly forms) → should feel ridiculously easy
	•	10%: multi-stage / “beast mode” → should be expressive and readable, and not a data-attribute hairball

So we drop the old “encode a program in data-*” mentality as the primary path.

Below is a brass-tacks configuration strategy that cleanly supports both use cases while staying true to “backend-driven components that hydrate”.

⸻

The new rule: HTML declares activation + identity, not programs

HTML should do only these jobs:
	1.	Mark element as an AT job

<form data-activetag></form>

	2.	Optionally reference a config

<form data-activetag data-at="contactForm"></form>

That’s it. No more “tasklist”, no more “chain.pre.src”, no more nested pipeline DSL in attributes.

Attributes can still hold runtime inputs (like action/method) and simple knobs if you really want—but the “program” lives elsewhere.

⸻

Config must be achieved by one of two paths

Path A (default): Registry config by name

You define a job config once in JS (or JSON), then reference it by name in markup.

JS registry

lib.service.set('activeTags', new ActiveTags(lib, {
  jobs: {
    contactForm: {
      type: "form",
      stacks: {
        main: { pipeline: ["serializeForm", "http", "domPatch"] }
      }
    }
  }
}));

HTML

<form data-activetag data-at="contactForm"></form>

This is the sweet spot:
	•	readable
	•	reusable
	•	versionable
	•	testable
	•	no markup spaghetti

Path B (advanced): Inline config (but not data-attr soup)

For beast mode jobs, inline config is sometimes the right tool, but it should be JSON (or a light DSL) in one place, not scattered.

Example:

<div data-activetag>
  <script type="application/json" data-at-conf>
    {
      "stacks": {
        "main": { "pipeline": ["http", "domPatch"] },
        "poll": { "pipeline": ["http", "domPatch"], "interval": { "everyMs": 3000 } }
      }
    }
  </script>
</div>

Still declarative, but centralized and sane.

⸻

Now how this maps to your two use cases

1) Single pipeline jobs (forms, 90%)

We make this boring by providing built-in job archetypes.

Example: “form submit job”

jobs: {
  formDefault: {
    type: "form",
    stacks: {
      submit: { pipeline: ["form.serialize", "http.send", "dom.apply"] }
    }
  }
}

HTML can be nearly “no config”:

<form data-activetag data-at="formDefault"></form>

Optional runtime overrides remain mutable:
	•	action/method/enctype taken from DOM at execution
	•	runInputs can choose stack (submit, saveDraft, etc.)

2) Multi-stage / beast mode (10%)

Here registry config shines because complex stacks are readable:

jobs: {
  chatWidget: {
    type: "component",
    stacks: {
      init:  { pipeline: ["http.send", "dom.apply"] },
      send:  { pipeline: ["form.serialize", "http.send", "dom.append"] },
      poll:  { pipeline: ["http.send", "dom.apply"], interval: { everyMs: 2000 } }
    },
    defaultStackPlan: ["init", "poll"]
  }
}

HTML remains clean:

<div data-activetag data-at="chatWidget"></div>


⸻

The key design decision: “config entry” is the primary program container

So the job configuration process becomes:
	1.	attach to element (immutable)
	2.	derive job name (creation only)
	3.	resolve config entry by name or inline JSON (creation only snapshot)
	4.	collect dataset + attrs (mutable)
	5.	merge activeConf (mutable)
	6.	compute stacks/intervals/pipelines (creation only, unless rebuild API called)

This fits what you already outlined.

⸻

What we should drop from AT 1.0 (cleanly)

✅ Drop as primary mechanism:
	•	describing pipelines in data-* trees
	•	tasklist as whitespace lists in attributes
	•	stage config structures embedded per element

✅ Keep, but downgrade to “runtime inputs”:
	•	method/action/enctype
	•	lightweight knobs like data-at-stack="save" (maybe)

⸻

One concrete proposal (so we can proceed immediately)

HTML contract (minimal)
	•	data-activetag activates job
	•	data-at="<jobName>" selects registry config
	•	optional: data-at-stack="..." for per-run selection (still mutable)

Engine config contract
	•	new ActiveTags(lib, { jobs: { [name]: jobConfig } })

This gives you instant testability:
	•	make a contactForm config
	•	bind it to one form
	•	prove delegator + observer
	•	then expand to beast mode configs

⸻

If you want the next step (without bikeshedding): I’ll write the Job Config Schema v1 with just the minimum keys needed for single pipeline + multi-stage (stacks, pipeline list, optional interval), and nothing else. That schema will become the foundation that replaces the old data-xyz soup.