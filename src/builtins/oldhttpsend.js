// builtins/oldhttpsend.js
import httpSend from "./http/httpSend.js";

/**
 * Legacy compatibility alias for historical `httpSend` module path.
 *
 * Current behavior delegates to `builtins/http/httpSend.js`, so runtime
 * semantics stay in sync with the active `http.send` implementation.
 */
export default async function oldHttpSend(ctx = {}) {
    return httpSend(ctx);
}

