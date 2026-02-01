/**
 * Capture a stack trace.
 *
 * @param {Object} [opts]
 * @param {number} [opts.skip=0]
 *        Number of stack frames to skip from the top.
 *
 * @param {boolean} [opts.full=false]
 *        If true, return full stack string instead of a single line.
 *
 * @param {boolean} [opts.parsed=false]
 *        If true, return parsed frame objects instead of strings.
 *
 * @param {RegExp|Function|null} [opts.prune=null]
 *        Optional prune rule:
 *        - RegExp: frames matching are removed
 *        - Function: (line|frame) => boolean (true = drop)
 *
 * @returns {string|string[]|Object[]|null}
 */
export function captureStack(opts = {}) {
    try {
        const skip   = Number.isFinite(opts.skip) ? opts.skip : 0;
        const prune  = opts.prune || null;
        const parsed = !!opts.parsed;
        const full   = !!opts.full;

        const err = new Error();
        if (!err.stack) return null;

        let lines = err.stack.split('\n');

        // Remove the first line ("Error")
        lines = lines.slice(1 + skip);

        // Prune frames if requested
        if (prune) {
            lines = lines.filter(line => {
                try {
                    if (prune instanceof RegExp) return !prune.test(line);
                    if (typeof prune === 'function') return !prune(line);
                } catch {
                    return true;
                }
                return true;
            });
        }

        if (!full && !parsed) {
            return lines[0] || null;
        }

        if (parsed) {
            const frames = lines
                  .map(parseStackLine)
                  .filter(Boolean);

            return full ? frames : frames[0] || null;
        }

        return full ? lines.join('\n') : lines[0] || null;

    } catch {
        return null;
    }
}


/**
 * Parse a single stack line into a structured frame.
 *
 * Best-effort parsing. Returns null if format is unknown.
 *
 * @param {string} line
 * @returns {{
 *   raw: string,
 *   fn?: string,
 *   file?: string,
 *   line?: number,
 *   col?: number
 * }|null}
 */
export function parseStackLine(line) {
    if (!line || typeof line !== 'string') return null;

    try {
        const raw = line.trim();

        // Chrome / Edge / Firefox style
        // e.g. "at fn (file.js:10:5)"
        // e.g. "fn@file.js:10:5"
        let fn, file, lineNo, colNo;

        let m = raw.match(/at\s+(.*?)\s+\((.*?):(\d+):(\d+)\)/) ||
            raw.match(/^(.*?)@(.*?):(\d+):(\d+)/) ||
            raw.match(/at\s+(.*?):(\d+):(\d+)/);

        if (m) {
            fn     = m[1]?.trim();
            file   = m[2];
            lineNo = Number(m[3]);
            colNo  = Number(m[4]);
        }

        if (!file) return { raw };

        return {
            raw,
            fn,
            file,
            line: Number.isFinite(lineNo) ? lineNo : undefined,
            col:  Number.isFinite(colNo)  ? colNo  : undefined
        };

    } catch {
        return null;
    }
}

export default {
    captureStack,
    parseStackLine
};
