function injectMarkupIntoTag({ buffer, job, lib } = {}) {
    const host = job && job.e;
    lib.dom.attempt(host, true);

    const slot = host.querySelector(".inject-content");
    lib.dom.attempt(slot, true);

    const html = lib.str.to(buffer.get(), true);
    lib.dom.set(slot, "innerHTML", html);
    return true;
}

export default {
    name: "inject-from-file",
    enabled: true,
    autorun: false,
    requests: {
        default: {
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
    },
    pipelines: {
        original: {
            run: [
                {
                    op: "@http.send",
                    args: {
                        name: "default",
                        url: "./fragment.html"
                    }
                },
                injectMarkupIntoTag
            ],
            error: [
                "@error.dump"
            ]
        },
        new: {
            run: [
                {
                    op: "@http.send",
                    args: {
                        name: "default",
                        request: {
                            endpoint: {
                                url: "./fragment-new.html"
                            }
                        }
                    }
                },
                injectMarkupIntoTag
            ],
            error: [
                "@error.dump"
            ]
        }
    },
    events: {
        original_click: {
            event: "click",
            selector: "#loadOriginal",
            pipeline: "original"
        },
        new_click: {
            event: "click",
            selector: "#loadNew",
            pipeline: "new"
        }
    },
    env: {
        section: "injectFromFile"
    }
};
