/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

function loadContent(url, selector = "#main") {
    return [
        {
            op: "@http.send",
            args: {
                name: "default",
                url,
            },
        },
        {
            op: "@target.find",
            args: {
                selector,
                reset: true,
            },
        },
        {
            op: "@target.patch",
            args: {
                innerHTML: "${buffer}",
            },
        },
        {
            op: "@target.reset",
        },
    ];
}

export default {
    name: "popstate-nav",
    enabled: true,
    autorun: ["seed_index"],

    requests: {
        default: {
            transport: "http",
            endpoint: {
                url: "./content-index.html",
            },
            method: "GET",
            response: {
                parse: "text",
                return: "text",
                requireOk: true,
            },
        },
    },

    pipelines: {
        index: {
            run: [
                ...loadContent("./content-index.html"),
                {
                    op: "@popstate.push",
                    args: {
                        pipeline: "index",
                        url: "./",
                        title: true,
                    },
                },
            ],
            error: ["@error.dump"],
        },
        seed_index: {
            run: [
                {
                    op: "@popstate.seed",
                    args: {
                        pipeline: "index",
                        url: "./",
                        title: true,
                    },
                },
                ...loadContent("./content-index.html"),
            ],
            error: ["@error.dump"],
        },
        on_1: {
            run: [
                ...loadContent("./content-on-1.html"),
                {
                    op: "@popstate.push",
                    args: {
                        pipeline: "on_1",
                        url: "./on-1.html",
                        title: "on-1",
                    },
                },
            ],
            error: ["@error.dump"],
        },
        on_2: {
            run: [
                ...loadContent("./content-on-2.html"),
                {
                    op: "@popstate.push",
                    args: {
                        pipeline: "on_2",
                        url: "./on-2.html",
                        title: "on-2",
                    },
                },
            ],
            error: ["@error.dump"],
        },
        on_3: {
            run: [
                ...loadContent("./content-on-3.html"),
                {
                    op: "@popstate.push",
                    args: {
                        pipeline: "on_3",
                        url: "./on-3.html",
                        title: "on-3",
                    },
                },
            ],
            error: ["@error.dump"],
        },
        fragment_1: {
            run: [
                {
                    op: "@popstate.seed",
                    args: {
                        seedKey: "fragment-main:index",
                        pipeline: "fragment_index",
                        mode: "push",
                        onSeed: "continue",
                        url: false,
                        title: false,
                    },
                },
                ...loadContent("./fragment-1.html", "#fragment-main"),
                {
                    op: "@popstate.push",
                    args: {
                        pipeline: "fragment_1",
                        url: false,
                        title: false,
                    },
                },
            ],
            error: ["@error.dump"],
        },
        fragment_2: {
            run: [
                {
                    op: "@popstate.seed",
                    args: {
                        seedKey: "fragment-main:index",
                        pipeline: "fragment_index",
                        mode: "push",
                        onSeed: "continue",
                        url: false,
                        title: false,
                    },
                },
                ...loadContent("./fragment-2.html", "#fragment-main"),
                {
                    op: "@popstate.push",
                    args: {
                        pipeline: "fragment_2",
                        url: false,
                        title: false,
                    },
                },
            ],
            error: ["@error.dump"],
        },
        fragment_3: {
            run: [
                {
                    op: "@popstate.seed",
                    args: {
                        seedKey: "fragment-main:index",
                        pipeline: "fragment_index",
                        mode: "push",
                        onSeed: "continue",
                        url: false,
                        title: false,
                    },
                },
                ...loadContent("./fragment-3.html", "#fragment-main"),
                {
                    op: "@popstate.push",
                    args: {
                        pipeline: "fragment_3",
                        url: false,
                        title: false,
                    },
                },
            ],
            error: ["@error.dump"],
        },
        fragment_index: {
            run: loadContent("./fragment-index.html", "#fragment-main"),
            error: ["@error.dump"],
        },
    },

    events: {
        index_click: {
            event: "click",
            selector: "#loadIndex",
            pipeline: "index",
            options: {
                passive: false,
            },
            policy: {
                prevent: true,
            },
        },
        on_1_click: {
            event: "click",
            selector: "#loadOn1",
            pipeline: "on_1",
            options: {
                passive: false,
            },
            policy: {
                prevent: true,
            },
        },
        on_2_click: {
            event: "click",
            selector: "#loadOn2",
            pipeline: "on_2",
            options: {
                passive: false,
            },
            policy: {
                prevent: true,
            },
        },
        on_3_click: {
            event: "click",
            selector: "#loadOn3",
            pipeline: "on_3",
            options: {
                passive: false,
            },
            policy: {
                prevent: true,
            },
        },
        fragment_1_click: {
            event: "click",
            selector: "#loadFragment1",
            pipeline: "fragment_1",
        },
        fragment_2_click: {
            event: "click",
            selector: "#loadFragment2",
            pipeline: "fragment_2",
        },
        fragment_3_click: {
            event: "click",
            selector: "#loadFragment3",
            pipeline: "fragment_3",
        },
    },
};
