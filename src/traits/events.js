export const eventTraits = {

    startEvents() {
	const lib = this.lib;
	const jobs = this.jobs.list ? this.jobs.list() : [];
	if( !lib.array.len(jobs) )return 0;
	
	let count = 0;
	
	for (const job of jobs) {
	    if (!job) continue;
	    // enabled gate (matches schema shape)
	    const enabled = lib.hash.get(job,"config.schema.enabled");
	    if (lib.bool.no(enabled) ) continue;
	    this.registerEvents(job);
	    count++;
	}
	
	return count;
    },

    registerEvents(jobLike) {
	const lib = this.lib;
	const job = this.toJob(jobLike);
	if (!job) return 0;

	const events = lib.hash.get(job, "config.schema.events");
	if (!lib.hash.is(events)) return 0;

	let count = 0;

	for (const name in events) {
	    const rec = lib.hash.get(events,name);
	    if(!rec) continue;

            // enabled gate (default true at normalize-time, but still respect runtime)
            const enabled = lib.hash.get(rec, "enabled");
            if (lib.bool.no(enabled)) continue;

            // minimal sanity: must have an event type
            const type = lib.hash.get(rec, "event");
            if (!lib.str.to(type, true).trim()) continue;

            this._registerEvent(job, name, rec);
            count++;
	}

	return count;
    },

    _registerEvent(job, name, rec) {
	console.log(`registering event for job: ${job.name || job.id} , event: ${name} type : ${rec.event}`);
	const lib = this.lib;

	const delegator = this.svc.delegator;
	const engine = this.engine;
	if (!delegator || !engine) return 0;

	const eventType = lib.str.to(rec.event, true).trim().toLowerCase();
	const pipeline  = lib.str.to(rec.pipeline, true).trim();
	if (!eventType || !pipeline) return 0;

	const options = lib.hash.to(rec.options);
	const policy = { match: "closest" };

	// TEMP: Anchor delegation to active tags (portable).
	// Later we can support job-scoped subselectors.
	const selector = "[data-activetag]";

	// Optional: tag for later teardown (even if you don't implement disable yet)
	const tag = `at:event:${job.id || job.name || "job"}`;
	const AT = this;
	// Register delegated handler
	delegator.on({
	    eventType,
	    selector,
	    options,
	    policy,
	    tag,
	    handler(e) {

		// "this" is the matched [data-activetag] element (closest match)
		// Only act if this event belongs to THIS job's element
		if (job.e && this !== job.e) return;

		// Hover semantics fix: ignore internal moves (child ↔ child)
		if ((eventType === "pointerover" || eventType === "pointerout") && this && e) {
		    const rt = e.relatedTarget;
		    if (rt && this.contains(rt)) return;
		}
		console.log(`queing ${pipeline}`);
		const ticket = engine.enqueue(job, pipeline, {
		    inputs: {
			reason: "event",
			eventName: name,
			event: e
		    },
		    meta: {
			source: "delegator",
			eventType,
			eventName: name
		    }
		});
		Promise.resolve().then(() => AT.engine.drain({ ticket }));
		
		//AT.engine.getTicketByJob('at-2','hover_on');
		//AT.engine.drain({ticket} )

	    }
	});

	return 1;
    },
};

export default eventTraits;
