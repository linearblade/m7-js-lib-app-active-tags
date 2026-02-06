// builtins/httpSend.js
export default async function httpSend({ job, lib, args, trigger, inputs, step } = {}) {
  try {
    const submit = lib.site.form.submit;

    // Prefer trigger (submitter / event target), fallback to job element
    const source = trigger || job.e;
    lib.dom.attempt(source, true);

    // runtime overrides
    const opts = lib.hash.is(args) ? { ...args } : {};
    opts.ajax = true;

    // send (submit handles collect+encode+request+parse per opts)
    const payload = await submit(source, opts);

    // downstream consumption
    inputs.response = payload;

    // optional request record
    const reqName = opts.name || opts.requestName || "default";
    if (!job.requests) job.requests = {};
    job.requests[reqName] = {
      ts: Date.now(),
      input: inputs.request || null,
      output: payload,
      meta: { op: "http.send" },
    };

    return {
      status: "ok",
      detail: {
        op: "http.send",
        step,
        ok: !!payload?.ok,
        status: payload?.status ?? null,
      },
    };
  } catch (err) {
    return { status: "error", error: err, detail: { op: "http.send", step } };
  }
}
