export const intervalTraits = {

  startIntervals() {
    const lib = this.lib;
    const jobs = this.jobs.list ? this.jobs.list() : [];
    if (!lib.array.len(jobs)) return 0;

    let count = 0;

    for (const job of jobs) {
      if (!job) continue;

      const enabled = lib.hash.get(job, "config.schema.enable.enabled");
      if (lib.bool.no(enabled)) continue;

      this.registerIntervals(job);
      count++;
    }

    return count;
  },

  registerIntervals(jobLike) {
    const lib = this.lib;
    const job = this.toJob(jobLike);
    if (!job) return 0;

      const mgr = this.svc.interval;
    if (!mgr) return 0;

    const intervals = lib.hash.get(job, "config.schema.intervals");
    if (!lib.hash.is(intervals)) return 0;

    let count = 0;

    for (const name in intervals) {
      const rec = lib.hash.get(intervals, name);
      if (!rec) continue;

      const enabled = lib.hash.get(rec, "enabled");
      if (lib.bool.no(enabled)) continue;

      // minimal sanity: must have repeat/everyMs-ish and a pipeline
      const everyMs = Number(lib.hash.get(rec, "repeat") || 0);
      const pipeline = lib.str.to(lib.hash.get(rec, "pipeline"), true).trim();
      if (!Number.isFinite(everyMs) || everyMs <= 0) continue;
      if (!pipeline) continue;

      this._registerInterval(job, name, rec);
      count++;
    }

    return count;
  },

  _registerInterval(job, name, rec) {
    console.log(`registering interval for job: ${job.name || job.id} , interval: ${name}`);

    const lib = this.lib;

    const mgr = this.svc.interval
    const engine = this.engine;
    if (!mgr || !engine) return 0;

    const everyMs = Math.max(1, Number(rec.repeat) || 0);
    const maxRuns = Number(rec.max || 0) || 0;

    const pipeline = lib.str.to(rec.pipeline, true).trim();
    if (!pipeline) return 0;

    // allowOverlap=false => coalesce (one pending run)
    // allowOverlap=true  => queue (do not drop ticks; bounded internally)
    const allowOverlap = lib.bool.yes(rec.allowOverlap);
    const overlapPolicy = allowOverlap ? 'queue' : 'coalesce';

    // onError: stop|continue  ->  pause|continue
    const onError = lib.str.to(rec.onError, true).trim().toLowerCase();
    const errorPolicy = (onError === 'stop') ? 'pause' : 'continue';

    // Unique interval name in the IntervalManager registry.
    // Names MUST be unique globally, so include job id.
    const intervalName = `at:${job.id}:${name}`;

    const AT = this;

    // Register (replaces existing by same name automatically)
    const interval = mgr.register({
      name: intervalName,
      everyMs,
      maxRuns,
      overlapPolicy,
      errorPolicy,

      fn(ctx) {
        // enqueue pipeline on schedule
        engine.enqueue(job, pipeline, {
          inputs: {
            reason: "interval",
            intervalName: name,
            interval: ctx,
          },
          meta: {
            source: "interval",
            intervalKey: name,
            intervalName: intervalName,
          }
        });

        // rig: drive engine (same as events)
        AT.engine.drain();
      }
    });

    // Start immediately (your schema implies repeat>0 means runnable; enabled already gated)
    mgr.start(intervalName);

    return interval;
  },
};

export default intervalTraits;
