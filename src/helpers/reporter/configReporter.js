// helpers/reporter/configReporter.js

export function configReporter({ job, lib, log, bucketName } = {}) {
    if (!job) return;
    if (!lib) throw new Error("configReporter: missing lib");
    if (!log) return; // logging is optional by design
    if (!bucketName) throw new Error("configReporter: missing bucket name");
    const bucket = bucketName;

    const domReport    = lib.hash.get(job, "config.inputs.report");
    const schemaReport = lib.hash.get(job, "config.schemaReport");

    const emit = (phase, rep) => {
        if (!rep || typeof rep !== "object") return;

        const errors   = lib.array.to(rep.errors);
        const warnings = lib.array.to(rep.warnings);

        if (!errors.length && !warnings.length) return;

        const toRow = (entry, level) => {
            entry = lib.hash.to(entry);

            const code = lib.str.to(entry.code || entry.id || entry.key, true).trim();
            const path = lib.str.to(entry.path || entry.at || entry.field, true).trim();
            const msg  = lib.str.to(entry.msg || entry.message || entry.text || entry.note, true).trim();

            return {
                jobId: job.id,
                jobName: job.name,
                phase,
                level,
                code: code || undefined,
                path: path || undefined,
                msg:  msg  || undefined,
                raw: entry,
            };
        };

        for (let i = 0; i < warnings.length; i++) {
            log.warn(bucket, toRow(warnings[i], "warn"), { event: "job.config.warn" });
        }
        for (let i = 0; i < errors.length; i++) {
            log.error(bucket, toRow(errors[i], "error"), { event: "job.config.error" });
        }
    };

    emit("dom", domReport);
    emit("schema", schemaReport);
}

export default configReporter;
/*
  //saving in case I want a basic reporter.
  const basicemit = (phase, rep) => {
  if (!rep || typeof rep !== "object") return;

  const errors   = lib.array.to(rep.errors);
  const warnings = lib.array.to(rep.warnings);

  if (!errors.length && !warnings.length) return;

  const body = {
  job: {
  id: job.id,
  name: job.name,
  // optionally include selector/type/etc if you have it
  },
  phase,              // "dom" | "schema"
  ok: rep.ok === true,
  report: { ok: rep.ok, errors, warnings }
  };

  // Emit warnings first (optional), errors second
  if (warnings.length) log.warn(bucket, body, { event: "job.config.warn" });
  if (errors.length)   log.error(bucket, body, { event: "job.config.error" });
  };

*/
