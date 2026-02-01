This is a very important question, because the answer determines whether AT 1.0 becomes:
	•	a dominant infrastructure tool
or
	•	a brilliant but niche power engine

The good news: you don’t have to choose one audience — if you draw the line correctly.

I’ll answer in three layers:
	1.	What skill levels actually exist (in reality, not theory)
	2.	Whether JSON is a meaningful barrier vs data-*
	3.	The correct minimum bar for AT 1.0 (this is the key)

⸻

1️⃣ The real skill strata (observed, not idealized)

Forget titles like “frontend dev” or “designer”. In practice, people cluster like this:

Tier 0 — HTML-only authors
	•	Can write tags
	•	Can copy/paste attributes
	•	No real mental model of execution
	•	Thinks in “this submits here” and “this swaps that”

Truth:
These users already struggle with anything beyond action= and method=.
They are not your long-term audience for AT 1.0 dominance.

⸻

Tier 1 — HTML + attributes (HTMX / Alpine users)
	•	Comfortable with data-*
	•	Comfortable copying small patterns
	•	Not comfortable inventing abstractions
	•	Execution model is fuzzy but usable

This was AT <1.0’s original target.
And this is where the pain started: complex behavior encoded in attributes becomes unreadable and fragile.

⸻

Tier 2 — HTML + basic JSON
	•	Can write:

{ "pipeline": ["http", "dom.apply"] }


	•	Understands objects, arrays, strings
	•	Does not want to write JS logic
	•	Comfortable reading configs

This is the critical insight:
👉 There is almost no meaningful cognitive gap between Tier 1 and Tier 2.

Anyone who can manage non-trivial data-* trees can handle JSON — JSON is often easier.

⸻

Tier 3 — JS users (but don’t want frameworks)
	•	Comfortable defining reusable configs
	•	Want behavior centralized
	•	Hate writing handlers for every page
	•	Love declarative orchestration

This is your expansion audience.

⸻

Tier 4 — Power users (beast mode)
	•	Want intervals, pipelines, fan-out, orchestration
	•	Previously abused AT in wonderful ways
	•	Will write configs + small DSL fragments

They will follow wherever the engine allows.

⸻

2️⃣ Is JSON a higher bar than data-*?

No — it’s the opposite past trivial cases.

Here’s the hard truth:

data-* looks easy but scales horribly

<div
  data-tasklist="this poll"
  data-request-action="/api"
  data-response-json="1"
  data-post-src="this:innerHTML"
  data-interval-every="2000"
>

This requires:
	•	understanding naming conventions
	•	implicit defaults
	•	string encoding
	•	hidden structure
	•	undocumented coupling

This is harder than JSON, not easier.

⸻

JSON is explicit, bounded, and readable

{
  "stacks": {
    "main": { "pipeline": ["http", "dom.apply"] },
    "poll": { "pipeline": ["http", "dom.apply"], "interval": { "everyMs": 2000 } }
  }
}

This:
	•	shows structure visually
	•	has clear nesting
	•	avoids string-encoded DSL hacks
	•	is copyable and testable

JSON lowers cognitive load once behavior exceeds triviality.

⸻

3️⃣ The correct minimum bar for AT 1.0 (this matters)

Here’s the decisive call:

The minimum reasonable bar for Active Tags 1.0 is:

👉 “Comfortable with HTML and basic JSON configuration.”

Not JS.
Not frameworks.
Not async code.

But JSON is non-negotiable for the product you want.

Why this is the right bar
	•	Anyone below this level will never safely use beast mode anyway
	•	Anyone above this level will hate data-attribute soup
	•	This bar:
	•	dramatically simplifies the engine
	•	clarifies documentation
	•	enables real composition
	•	avoids false simplicity

Most importantly:

AT’s power curve only makes sense once structure is visible.

JSON makes structure visible.

⸻

4️⃣ What this means strategically

You are not competing with:
	•	jQuery helpers
	•	copy-paste snippets
	•	“no-code” toys

You are competing with:
	•	HTMX + JS glue
	•	ad-hoc fetch handlers
	•	framework bloat for backend-heavy UIs

Those users already understand JSON.

⸻

5️⃣ Final positioning (this is the sentence)

If you had to write the product truthfully:

Active Tags is for developers who want declarative, backend-driven UI workflows without writing custom JavaScript — but who are comfortable expressing behavior in structured configuration.

That sentence excludes the wrong people on purpose.

⸻

6️⃣ One last hard truth (important)

Trying to lower the bar below “basic JSON” will:
	•	force you back into data-* contortions
	•	make beast mode unmaintainable
	•	obscure the execution model
	•	and ultimately weaken adoption, not increase it

HTMX already owns the “HTML-only” mental model.

AT should own the “configuration-first execution engine” space.

⸻

If you want, the next logical step is:
	•	defining the smallest JSON config a user ever needs to write (the true “hello world”)
	•	and ensuring the default form archetype requires zero JSON unless customization is needed

That’s how you get dominance without dumbing the system down.