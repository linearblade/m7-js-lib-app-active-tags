// builtins/httpSend.js
// VM signature: ({ job, lib, args, trigger, ticket, inputs, ctx, step }) => StageResultLike

export default async function httpSend({ job, lib, args, trigger, inputs, step } = {}) {
  try {
    if (!inputs || typeof inputs !== "object") {
      return { status: "error", error: new Error("http.send: missing inputs"), detail: { op: "http.send", step } };
    }
    if (!lib?.site?.form?.submit) {
      return { status: "error", error: new Error("http.send: lib.site.form.submit missing"), detail: { op: "http.send", step } };
    }

    // Prefer trigger (submitter / event target), fallback to job element
    const source = trigger || job?.e;
    if (!lib.dom?.isDom || !lib.dom.isDom(source)) {
      return { status: "error", error: new Error("http.send: no valid DOM source (trigger/job.e)"), detail: { op: "http.send", step } };
    }

    // args are your runtime overrides:
    // e.g. { ajax: true, contentType:"json", response:"json", headers:{...}, useStructured:true, name:"default" }
    const opts = (args && typeof args === "object") ? { ...args } : {};

    // Force ajax mode for pipeline send
    // (matches your intention: request happens here, not browser navigation)
    opts.ajax = true;

    // Let lib.site.form.submit do the heavy lifting (collect+encode+fetch+parse)
    const payload = await lib.site.form.submit(source, opts);

    // Store response for downstream ops (dom.patch etc.)
    inputs.response = payload;

    // Optional: store last request record on job
    const reqName = opts.name || opts.requestName || "default";
    if (job) {
      if (!job.requests) job.requests = {};
      job.requests[reqName] = {
        ts: Date.now(),
        input: inputs.request || null,  // if form.collect ran earlier
        output: payload,
        meta: { op: "http.send" },
      };
    }

    return { status: "ok", detail: { op: "http.send", step, ok: !!payload?.ok, status: payload?.status ?? null } };
  } catch (err) {
    return { status: "error", error: err, detail: { op: "http.send", step } };
  }
}
