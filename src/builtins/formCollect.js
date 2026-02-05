// builtins/formCollect.js

export default async function formCollect({ job, lib, args, trigger, inputs, step } = {}) {
    try {
	if (!lib?.site?.form?.collect) {
	    return {
		status: "error",
		error: new Error("form.collect: lib.site.form.collect is missing"),
		detail: { op: "form.collect", step },
	    };
	}

	// Prefer the runtime trigger (submit button / clicked element).
	// Fallback to the job element if trigger isn't provided.
	const source = trigger || job?.e;
	if (!lib.dom?.isDom || !lib.dom.isDom(source)) {
	    return {
		status: "error",
		error: new Error("form.collect: no valid trigger/job element"),
		detail: { op: "form.collect", step },
	    };
	}

	// Optional opts: { debug: true } etc (forwarded)
	const opts = args && typeof args === "object" ? args : {};
	const data = lib.site.form.collect(source, opts);

	if (!data || !data.form) {
	    return {
		status: "error",
		error: new Error("form.collect: collect() returned no form context"),
		detail: { op: "form.collect", step },
	    };
	}

	// Ensure inputs exists (it should, but be defensive)
	if (!inputs || typeof inputs !== "object") {
	    return {
		status: "error",
		error: new Error("form.collect: ticket.inputs missing/invalid"),
		detail: { op: "form.collect", step },
	    };
	}

	// Store into canonical location for http.send
	inputs.request = {
	    url: data.url || null,
	    method: data.method || null,
	    parms: Array.isArray(data.parms) ? data.parms : [],
	    form: data.form || null,
	    trigger: data.event || source || null,
	};

	// Convenience (optional): also expose raw collection
	inputs.form = data;

	return {
	    status: "ok",
	    detail: { op: "form.collect", step, count: inputs.request.parms.length },
	};
    } catch (err) {
	return {
	    status: "error",
	    error: err,
	    detail: { op: "form.collect", step },
	};
    }
}
