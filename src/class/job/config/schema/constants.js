/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

//arr_to_opts duplicated from the main constants...
export const ARR_TO_OPTS = {split:/\s+/,trim:true};

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
export const EVENT = {
    POPSTATE_MODES: ["push", "set"],
    POPSTATE_MODE_DEFAULT: "push",
};
// Arrays are replaced (NOT concatenated), and array+scalar overwrites (NOT push).
export const MERGE_OPTS_V1 = {
    disp: {
	aa: function (l, r) { return r; }, // array + array  => replace
	as: function (l, r) { return r; }  // array + scalar => overwrite
	// hh recursion already uses merge(l,r,opts) per your fixed implementation
    }
};

/**
 * Default Request Shape
 * ---------------------
 *
 * Canonical default configuration shape for a Job-level request definition.
 *
 * PURPOSE
 * -------
 * Provides the baseline structure used by the REQUEST block normalizer.
 * User-defined request entries are merged against this shape to ensure
 * consistent runtime expectations.
 *
 * This object defines structure only.
 * It does not perform network I/O.
 * It does not serialize bodies.
 *
 *
 * FIELD SEMANTICS
 * ---------------
 * transport
 *   Transport family identifier.
 *   Typical values: "http", "ws", "sse", "webrtc", "tcp", "udp", "custom".
 *
 * op
 *   Transport operation intent.
 *   Typical values: "connect", "send", "subscribe", "receive", "close".
 *
 * endpoint
 *   Canonical endpoint descriptor.
 *   May be expressed as full URL or decomposed host/port/path parts.
 *
 * method / headers / body / encoding / credentials
 *   Request-style fields.
 *   These are optional and may be ignored by non-request transports.
 *
 * timeoutMs / retry
 *   Runtime control knobs for timeout and retry strategy.
 *
 * connection
 *   Persistent connection/session options (protocols, channels, handshake, etc).
 *
 * response
 *   Response handling policy container.
 *   Default shape is intentionally empty to avoid imposing HTTP semantics
 *   on non-HTTP transports.
 *   Typical HTTP policy keys are provided as inline commented examples in
 *   `DEFAULT_REQUEST_SHAPE.response` and can be copied into user config.
 *
 * stream
 *   Streaming mode flags for event/message/chunk/datagram flows.
 *
 * protocolOptions
 *   Transport-specific extension bag (escape hatch).
 *
 * flags / meta
 *   Caller-defined control and metadata bags.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * This shape must remain transport-agnostic.
 * This shape must not include runtime state.
 * This shape must be safe to deep-merge during normalization.
 */

export const DEFAULT_REQUEST_SHAPE = {
    transport: "http", // Transport family: http | ws | sse | webrtc | tcp | udp | custom
    op: "send", // Operation intent: connect | send | subscribe | receive | close

    endpoint: {
	url: undefined, // Canonical endpoint URL (preferred when available)
	scheme: undefined, // Protocol/scheme hint: https | wss | udp | etc
	host: undefined, // Hostname or IP
	port: undefined, // Numeric port (transport-specific)
	path: undefined, // Path/resource/route segment
	query: {}, // Query bag merged/encoded by transport layer
	params: {}, // Template/path params for route interpolation
    },

    method: undefined, // HTTP verb when applicable (ignored by non-HTTP transports)
    headers: {}, // Header bag (HTTP/WS handshake style metadata)
    body: undefined, // Payload to send (shape/encoding decided by transport)
    encoding: undefined, // Encoding hint: json | urlencoded | formdata | binary | text
    credentials: {
	mode: undefined, // Credential mode hint (transport-specific policy)
	withCredentials: false, // XHR-style credential flag for cookie-bearing requests
	token: undefined, // Bearer/API token or opaque auth token
	username: undefined, // Basic/session username if applicable
	password: undefined, // Basic/session password if applicable
    },

    timeoutMs: undefined, // Per-operation timeout in milliseconds
    retry: {
	max: 0, // Max retry attempts (0 disables retries)
	delayMs: 0, // Base delay between attempts
	backoff: "none", // Backoff strategy: none | linear | exponential
	jitter: false // Add random jitter to retry delay
    },

    connection: {
	persistent: false, // Keep connection/session open across operations
	keepAlive: undefined, // Keepalive policy/interval (transport-defined)
	protocols: [], // Protocol/subprotocol preferences (e.g. WS subprotocols)
	channel: undefined, // Logical stream/topic/channel identifier
	binaryType: undefined, // Binary mode hint (blob | arraybuffer | bytes, etc)
	handshake: {} // Transport-specific connect/handshake options
    },

    // Response policy can vary by transport.
    // Keep this empty by default to avoid mangling non-HTTP transport outputs.
    response: {
	/*
	// Typical HTTP response policy example.
	// Leave these commented in default shape; copy into user request_shape when needed.
	parse: "auto", // Parse mode: auto | json | text | raw | blob | arrayBuffer
	requireOk: false, // If true, non-2xx HTTP responses should be treated as errors
	acceptedStatus: [], // Optional explicit allowlist for acceptable status codes
	return: "payload", // Return view: payload | body | json | text | headers | status
	path: undefined // Optional deep-pick path (typically against response body/payload)
	*/
    },

    stream: {
	enabled: false, // Enable streaming semantics for this request
	mode: undefined // Stream mode: events | messages | chunks | datagrams
    },

    protocolOptions: {}, // Escape hatch for transport-specific knobs
    flags: {}, // Boolean-ish behavior toggles for runtime/pipeline policy
    meta: {} // Opaque caller metadata (diagnostics/tracing/labels)
};

/**
 * Default Interval Shape
 * ----------------------
 *
 * Canonical default configuration shape for a Job-level interval definition.
 *
 * PURPOSE
 * -------
 * Provides the baseline structure used by the INTERVAL block normalizer.
 * User-defined interval entries are merged against this shape to ensure
 * predictable runtime semantics.
 *
 * This object defines logical configuration only.
 * It does not create timers.
 * It does not execute pipelines.
 *
 *
 * FIELD SEMANTICS
 * ---------------
 * enabled
 *   Master logical switch for the interval definition.
 *   If false, the interval will not be activated even if on() is called.
 *
 * autorun
 *   List of pipeline keys to enqueue during interval autorun.
 *   "__DEFAULT__" is resolved to the default pipeline at runtime.
 *
 * repeat
 *   Interval cadence in milliseconds.
 *   A value of 0 indicates the interval is not runnable until configured.
 *
 * max
 *   Maximum number of executions.
 *   A value of 0 indicates no execution limit.
 *
 * pipeline
 *   Pipeline key executed on each interval tick.
 *   Resolution and validation occur during runtime compilation.
 *
 * error
 *   Error handling policy.
 *   "stop"     pause interval on error
 *   "continue" keep interval running after error
 *
 * allowOverlap
 *   If true, a new execution may begin while a prior run is still active.
 *   If false, overlapping runs are prevented according to runtime policy.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * This shape must remain scheduler-agnostic.
 * This shape must not include runtime state.
 * This shape must be safe to deep-merge during normalization.
 */
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
    error: "stop",    // "stop" | "continue"
    allowOverlap: false // allow a new run while the previous is still running
};

export const DEFAULT_PIPELINE_SHAPE = {
    run: [],                   // ops list (string|array coerced later)
    error: []                // ops list (string|array coerced later)
};
/**
 * Default Event Shape
 * -------------------
 *
 * Canonical default configuration shape for a Job-level event definition.
 *
 * PURPOSE
 * -------
 * Provides the baseline structure used by the EVENT block normalizer.
 * User-defined event entries are merged against this shape to ensure
 * consistent runtime expectations.
 *
 * This object defines logical event binding configuration only.
 * It does not install delegated handlers.
 * It does not execute pipelines.
 *
 *
 * FIELD SEMANTICS
 * ---------------
 * enabled
 *   Master logical switch for the event definition.
 *   If false, the binding will not be installed even if on() is called.
 *
 * event
 *   DOM event type string.
 *   Examples include click, submit, pointerover, pointerout.
 *   Normalization to delegator-safe equivalents may occur during compilation.
 *
 * selector
 *   Semantic trigger selector.
 *   Empty string or "__SELF__" indicates the Job root element itself.
 *   Non-empty values are treated as sub-delegation filters, not raw CSS
 *   attachment points.
 *
 * pipeline
 *   Pipeline key to enqueue when the event fires.
 *
 * popstate
 *   Optional history behavior directive for the event.
 *   Supported forms:
 *     false              disable history handling
 *     "push" | "set"     shorthand mode selectors
 *     { ... }            full configuration object
 *
 *   Canonical full-form fields:
 *     mode   "push" | "set"
 *     url    false | true | string
 *            false = keep current URL
 *            true  = derive from request when available
 *            string = manual override
 *     title  false | true | string
 *            false = leave title unchanged
 *            true  = derive from request when available
 *            string = manual override
 *     state  optional lightweight stored payload
 *     inputs optional replay enqueue inputs
 *
 * listener
 *   Runtime listener configuration bag.
 *
 *   options
 *     Event listener options passed to the delegator layer.
 *     capture  use capture phase if true
 *     passive  hint that the handler will not call preventDefault
 *     once     auto-remove after first invocation
 *
 *   policy
 *     Optional opaque pass-through bag for low-level delegator fields.
 *     ActiveTags does not use `listener.policy.match`, `stop`, or `prevent`.
 *
 * matched
 *   ActiveTags matched-only policy bag.
 *
 *   match
 *     "closest" | "target" selector-resolution mode for the event selector.
 *   stop
 *     call stopImmediatePropagation() only after selector relevance is confirmed.
 *   prevent
 *     call preventDefault() only after selector relevance is confirmed.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * This shape must not include runtime state.
 * This shape must be safe to deep-merge during normalization.
 */

export const DEFAULT_EVENT_SHAPE = {
    // master switch for the event definition
    enabled: true,

    // DOM event type (pointerover, pointerout, click, submit, etc)
    event: "",

    // selector intent (NOT raw CSS semantics)
    // "" or "__SELF__" means “the job element itself”
    selector: "",

    // pipeline to enqueue when the event fires
    pipeline: "",

    // optional history behavior selector for this event
    popstate: false,

    // listener/delegator runtime config
    listener: {
        options: {
            capture: false,
            passive: true,
            once: false
        },
        policy: {}
    },

    // ActiveTags matched-only event policy
    matched: {
        match: "closest",
        stop: false,
        prevent: false
    }
};

/**
 * Block Normalizer Specifications
 * --------------------------------
 *
 * Declarative configuration describing how each top-level schema block
 * should be normalized during Phase 1 compilation.
 *
 * PURPOSE
 * -------
 * BLOCK_NORMALIZERS provides metadata used by Master._normalizeBlock()
 * to apply consistent normalization logic across different configuration
 * sections such as request, interval, pipeline, and event.
 *
 * Each entry defines:
 *   - Input keys
 *   - Default merge shape
 *   - Optional hotkey coercion
 *   - Optional per-item handler
 *   - Output storage key
 *
 *
 * SPEC FIELD SEMANTICS
 * --------------------
 * single
 *   Singular block key in user configuration.
 *   Example: "request"
 *
 * plural
 *   Plural block key in user configuration.
 *   Example: "requests"
 *
 * default_shape
 *   Canonical default object merged into each block item.
 *
 * hotkey
 *   Optional shorthand key.
 *   If defined and the user supplies a scalar instead of an object,
 *   the value is coerced into an object under this key.
 *
 * user_shape
 *   Optional configuration key allowing users to override the default shape.
 *
 * handler
 *   Name of the Master instance method used for per-item normalization.
 *   If defined, each item is passed through this method after merging.
 *
 * outKey
 *   Internal storage key used to expose the effective normalized block.
 *   Typically prefixed with "_effective".
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * This structure must remain declarative.
 * It must not contain executable logic.
 * It must not depend on runtime state.
 *
 * All behavioral semantics are implemented in Master._normalizeBlock().
 */

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
    },

    EVENT: {
	single: "event",
	plural: "events",
	default_shape: DEFAULT_EVENT_SHAPE,
	hotkey: null,
	user_shape: "event_shape",
	handler: "_normalizeEventItem",
	outKey: "_effectiveEvents"
    }
};

export default {
    REQUEST, INTERVAL, EVENT,
    MERGE_OPTS_V1,
    DEFAULT_REQUEST_SHAPE,
    DEFAULT_PIPELINE_SHAPE,
    DEFAULT_INTERVAL_SHAPE,
    DEFAULT_EVENT_SHAPE,
    BLOCK_NORMALIZERS,
    ARR_TO_OPTS
};
