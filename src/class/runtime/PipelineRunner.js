// -----------------------------------------------------------------------------
// PipelineRunner (deterministic stepping of a single ticket)
// -----------------------------------------------------------------------------

export class PipelineRunner {
  constructor({ lib, stageRegistry } = {}) {
    this.lib = lib || null;
    this.stageRegistry = stageRegistry;
    if (!this.stageRegistry) throw new Error("PipelineRunner requires stageRegistry");
  }

  /**
   * Resolve pipeline for a given job + stackName.
   * Assumes compiled artifact:
   *   job.pipelineDefs[stackName] = ["stageA", "stageB", ...]
   * (You can adapt this to your final compiler output easily.)
   */
  _getPipeline(job, stackName) {
    const defs = job?.pipelineDefs || job?.pipeline || job?.pipelines || null;
    if (!defs) return null;

    // common shapes:
    // - hash: { main: ["a","b"] }
    // - nested: { stacks: { main: { pipeline:[...] } } }
    if (Array.isArray(defs[stackName])) return defs[stackName];
    if (defs.stacks && defs.stacks[stackName] && Array.isArray(defs.stacks[stackName].pipeline)) {
      return defs.stacks[stackName].pipeline;
    }
    return null;
  }

  /**
   * Run exactly ONE stage step for this ticket.
   * Returns a StageResult-like object with status: ok|wait|error|complete
   */
  async step({ job, ticket, ctx }) {
    const stackName = ticket.stackPlan[ticket.cursor.stack] || null;
    if (!stackName) return SR_complete({ reason: "no stacks" });

    const pipeline = this._getPipeline(job, stackName);
    if (!pipeline || !pipeline.length) {
      // empty pipeline = stack completes immediately
      ticket.cursor.stack += 1;
      ticket.cursor.stage = 0;
      return ticket.cursor.stack >= ticket.stackPlan.length
        ? SR_complete({ reason: "all stacks done" })
        : SR_ok({ reason: "stack had no pipeline" });
    }

    const stageName = pipeline[ticket.cursor.stage];
    if (!stageName) {
      // end of pipeline for this stack
      ticket.cursor.stack += 1;
      ticket.cursor.stage = 0;
      return ticket.cursor.stack >= ticket.stackPlan.length
        ? SR_complete({ reason: "all stacks done" })
        : SR_ok({ reason: "stack complete" });
    }

    const fn = this.stageRegistry.get(stageName);
    if (!fn) {
      return SR_error(new Error(`Unknown stage '${stageName}'`), { stageName, stackName });
    }

    // Stage contract:
    //   fn({ job, ticket, inputs, ctx }) -> StageResult (can be async)
    let res;
    try {
      res = await fn({ job, ticket, inputs: ticket.inputs, ctx });
    } catch (err) {
      return SR_error(err, { stageName, stackName });
    }

    // normalize output
    if (!res || typeof res !== "object" || !res.status) {
      // treat truthy return as OK (legacy-friendly), falsy as ERROR
      return res ? SR_ok({ stageName, stackName, legacy: true }) : SR_error(new Error("Stage returned falsy"));
    }

    // advance cursor on OK; do not advance on WAIT/ERROR
    if (res.status === StageStatus.OK) {
      ticket.cursor.stage += 1;
    } else if (res.status === StageStatus.COMPLETE) {
      // complete means complete THIS stack immediately
      ticket.cursor.stack += 1;
      ticket.cursor.stage = 0;
    }

    return res;
  }
}
