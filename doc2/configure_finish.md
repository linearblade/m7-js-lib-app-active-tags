According to a document in your repo (activetags-combined.js), the new Job.js exists and the new registration path (registerJobs) is already using it — but the old “makeJob → configureJob → build stacks → interval stage” pipeline is only partially ported. Here’s the concrete map and a checklist.  ￼ ￼

⸻

1) What we were collecting in v098 job creation (from your old snippet)

From makeJob() + configureJob() + stack builders, a “job” effectively contained:
	•	Binding / identity
	•	e (DOM element)
	•	name (derived from ds.name || tag.name || jobCounter)
	•	status: 'ready'
	•	load: 0 (legacy flag)
	•	ws: {} (job workspace bucket)
	•	Config snapshots
	•	ds from getDataset(tag) (data-* + data-config merge + inflate)
	•	attr snapshot: { action, method }
	•	Derived defaults / normalization
	•	ensure ds.request exists if a URL is detected (ds.request.action or attr.action)
	•	normalize ds.response.json → 0/1 and default ds.response.src
	•	default ds.pre.src and ds.post.src to "this:innerHTML" when missing
	•	Execution plan (the big missing piece)
	•	initialize job.stack = {}
	•	read ds.tasklist (default ["this"])
	•	for each task prefix, push standard stack stages:
	•	request → response → pre → attr → post
	•	then always push:
	•	complete
	•	optional intervalStart if ds.interval enabled
	•	runAll

That’s the “job creation process” in practice: build the persistent job + precompile its stack(s).

⸻

2) What the new system is already collecting (today)

Job class fields (already present)

The new Job class already has the storage for most of this:
	•	e, id, createdAt, type
	•	name
	•	ds, attr
	•	status, load, error
	•	stack, intervals, ws
	•	run (ephemeral per-run state)
	•	flags (attached, hasRun, stacksBuilt, dirty)  ￼ ￼

Registration path (already present)

registerJobs(list) is already doing:
	•	idempotent lookup by element (this.jobs.getByElement(tag))
	•	collect ds = this.getDataset(tag)
	•	collect attr = { action, method }
	•	new Job({ e, ds, attr, type:"load", status:"ready", ws:{} })
	•	this.configureJob(job) (hook exists, but may not yet match old behavior)
	•	Scheduler assigns identity and stores it (this.jobs.register(job))  ￼

So yes: right now you can say “we are collecting element + ds + attr, then Scheduler gives us an id”. Plus the Job class is already ready to hold the rest.  ￼ ￼

⸻

3) Checklist: what’s still missing / needs porting (actionable)

A) Finish configureJob(job) parity (old → new)
	•	Set canonical job name (and mirror into ds.name) using job.setName(...) (Job supports it)  ￼
	•	Implement “request stub” behavior:
	•	if (ds.request.action || attr.action) exists and !ds.request, create ds.request = {}
	•	Normalize ds.response defaults:
	•	coerce ds.response.json to 0/1
	•	if !ds.response.src, set default "request:jsonData" vs "request:responseText"
	•	Default ds.pre.src / ds.post.src to "this:innerHTML" when those sections exist but src missing

B) Reintroduce stack construction (missing right now)

The current load trait literally notes stack construction is still needed.  ￼
	•	Port pushStack() (or a v1 equivalent)
	•	Port pushStackStandard() (request/chain/attr/chain)
	•	Implement “build stacks from ds.tasklist” (default ["this"])
	•	Always push complete and runAll
	•	Set job.flags.stacksBuilt = true once done (flag already exists)  ￼

C) Interval staging hook (defer execution, but stage it)
	•	If ds.interval exists and not disabled, stage an intervalStart stack item (like v098 did)
	•	Decide where the per-job interval handle lives:
	•	use job.intervals (already exists) to store manager handles/locks  ￼

D) Workspace strategy (you’ll want this early)

Right now you set per-job ws: {} during creation.  ￼
	•	Decide: should per-job ws be a plain object, or a WorkSpace child?
	•	If it’s a child workspace, define how it links to this.ws (root runtime workspace)

E) Detach / DOM lifecycle (observer correctness)

Job already supports detach() and tracks flags.attached.  ￼
	•	On MutationObserver “removed”, find job by element and call job.detach()
	•	Cancel/cleanup job intervals when detached (using IntervalManager)

⸻

If you want the fastest path to “we can test delegator + observer on [data-activetag]”, do it in this order:
	1.	configureJob parity → 2) stack build from tasklist → 3) observer detach cleanup.

That gets you to “jobs attach + jobs have stacks + jobs can be safely removed” — the minimum to start proving the engine again.