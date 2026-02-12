export class LogError extends Error {
    /**
     * @param {string} message
     * @param {object} details
     * @param {any} [details.record]
     * @param {string} [details.bucket]
     * @param {string} [details.manager]
     * @param {any} [details.data]
     * @param {any} [details.opts]
     * @param {any} [details.cause]
     */
    constructor(message, details = {}) {
        // Use native `cause` if provided (Node 16+ / modern browsers)
        super(message, details && "cause" in details ? { cause: details.cause } : undefined);

        this.name = "LogError";
        this.code = "E_LOG_THROW";

        // Attach structured context for catch blocks
        this.record = details.record ?? null;
        this.bucket = details.bucket ?? null;
        this.manager = details.manager ?? null;

        // Optional: keep original inputs (handy for debugging, but can be big)
        this.data = details.data;
        this.opts = details.opts;

        // Best-effort stack cleanup (optional)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, LogError);
        }
    }

    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            bucket: this.bucket,
            manager: this.manager,
            record: this.record,
        };
    }
}

export function _throwLoggedError({ manager, bucket, record, data, opts }) {
    // Prefer record header info if present
    const at = record?.header?.at;
    const src = record?.header?.source || bucket;
    const lvl = record?.header?.level || "error";

    const msg = `[log] ${lvl}() (throwOnError enabled) bucket=${String(src)}${at ? ` at=${at}` : ""}`;

    throw new LogError(msg, {
        record,
        bucket: src,
        manager: manager?.name ?? null,
        data,
        opts,
        // If caller passed a cause, we’ll preserve it
        cause: opts?.cause,
    });
}
