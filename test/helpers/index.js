/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

export { createFakeEnv } from "./createEnv.js";
export { installStubServices } from "./createServices.js";
export { recordHooks } from "./recordHooks.js";
export { createAT, createHeadlessJob, ensureLib } from "./createAT.js";
export {
    ensureElementPolyfill,
    FakeElement,
    createDomEnv,
    createActiveTagElement,
    createFakeForm,
    createRecordingDelegator,
    createRecordingIntervalManager,
} from "./createDom.js";
export { createRecordingPopstateService } from "./createPopstate.js";
