function injectMarkupIntoTag({ buffer, job, lib } = {}) {
    const host = job && job.e;
    lib.dom.attempt(host, true);

    const html = lib.str.to(buffer.get(), true);
    lib.dom.set(host, "innerHTML", html);
    return true;
}

export default {
    name: "inject-from-file",
    enabled: true,
    autorun: true,
    pipeline: {
        run: [
	    "@buffer.dump:test",
            {
                op: "@http.send",
                args: {
                    adhoc: true,
                    request: {
                        transport: "http",
                        endpoint: {
                            url: "./fragment.html"
                        },
                        method: "GET",
                        response: {
                            parse: "text",
                            return: "text",
                            requireOk: true
                        }
                    }
                }
            },
	    "@buffer.dump",
            injectMarkupIntoTag
        ],
        error: [
            "@error.dump"
        ]
    },
    env: {
        section: "injectFromFile"
    }
};
