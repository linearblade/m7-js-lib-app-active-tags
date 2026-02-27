export default {
    name: "inject-from-file-string",
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
            run: "@http.send:name=default,url=./fragment.html;@target.find:selector=.inject-content;@target.patch:innerHTML=${buffer};@target.reset",
            error: "@error.dump"
        },
        new: {
            run: "@http.send:name=default,url=./fragment-new.html;@target.find:selector=.inject-content;@target.patch:innerHTML=${buffer};@target.reset",
            error: "@error.dump"
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
        section: "injectFromFileString"
    }
};
