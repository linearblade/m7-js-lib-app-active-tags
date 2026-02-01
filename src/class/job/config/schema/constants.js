//request defaults.
export const INTERVAL = {
    RANGE_ERROR   : ['stop', 'continue'],
    RANGE_DEFAULT : "stop"
};
export const REQUEST = {
    TIMEOUT_DEFAULT : 10,
    METHODS         : ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'], 
    METHOD_DEFAULT  : "GET"
};
// Arrays are replaced (NOT concatenated), and array+scalar overwrites (NOT push).
export const MERGE_OPTS_V1 = {
    disp: {
	aa: function (l, r) { return r; }, // array + array  => replace
	as: function (l, r) { return r; }  // array + scalar => overwrite
	// hh recursion already uses merge(l,r,opts) per your fixed implementation
    }
};

export const DEFAULT_REQUEST_SHAPE = {
    url: undefined,          // filled from form.action if missing
    method: REQUEST.METHOD_DEFAULT,          // typical submit default (element may override)

    encoding: "urlencoded",  // typical form default (element.enctype may override)
    body: undefined,         // produced from form fields at submit-time

    headers: {},             // serializer may set Content-Type if needed
    credentials: undefined,

    timeoutMs: undefined,
    transport: undefined,
    
    flags: {
        json: undefined,
        urlencoded: true
    }
};

export const DEFAULT_INTERVAL_SHAPE = {
    // master switch for the interval definition
    enabled: true,

    // which pipelines to run on interval autorun (same selector semantics as enable.autorun)
    autorun: ["__DEFAULT__"],

    // scheduler config
    repeat: 0,          // ms; 0 means "not runnable until configured"
    max: 0,             // 0 means infinite
    pipeline: "initial",// default pipeline name (resolved/validated later)

    // runtime behavior
    onError: "stop",    // "stop" | "continue"
    allowOverlap: false // allow a new run while the previous is still running
};

export const DEFAULT_PIPELINE_SHAPE = {
    confirm: { mode: "none" }, // normalized confirm object
    run: [],                   // ops list (string|array coerced later)
    onError: []                // ops list (string|array coerced later)
};


export const BLOCK_NORMALIZERS = {
    REQUEST: {
        single: "request",
        plural: "requests",
        default_shape: DEFAULT_REQUEST_SHAPE,
        hotkey: "url",
	user_shape: "request_shape",
        handler: "_normalizeRequestItem",
        outKey: "_effectiveRequests"
    },

    INTERVAL: {
        single: "interval",
        plural: "intervals",
        default_shape: DEFAULT_INTERVAL_SHAPE,
        hotkey: null,
	user_shape: "interval_shape",
        handler: "_normalizeIntervalItem",
        outKey: "_effectiveIntervals"
    },

    PIPELINE: {
        single: "pipeline",
        plural: "pipelines",
        default_shape: DEFAULT_PIPELINE_SHAPE,
        hotkey: null,
	user_shape: "pipeline_shape",
        handler: "_normalizePipelineItem",
        outKey: "_effectivePipelines"
    }
};

export default {
    REQUEST, INTERVAL,
    MERGE_OPTS_V1,
    DEFAULT_REQUEST_SHAPE,
    DEFAULT_PIPELINE_SHAPE,
    DEFAULT_INTERVAL_SHAPE,
    BLOCK_NORMALIZERS,
    
};
