/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

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
                {
                    op: "@target.find",
                    args: {
                        selector: ".inject-content"
                    }
                },
                {
                    op: "@target.patch",
                    args: {
                        innerHTML: "${buffer}"
                    }
                },
                {
                    op: "@target.reset"
                }
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
                {
                    op: "@target.find",
                    args: {
                        selector: ".inject-content"
                    }
                },
                {
                    op: "@target.patch",
                    args: {
                        innerHTML: "${buffer}"
                    }
                },
                {
                    op: "@target.reset"
                }
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
