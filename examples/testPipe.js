//for testing the expression resolver
export const testPipes = {
  patch: {
    run: [
      // normalized strings
      { op: "confirm", args: { message: "Continue as ${ds.user}?" } },          // template expr
      { op: "form.prepare", args: null },
      { op: "form.collect", args: { mode: "default" } },

      // explicit op object with mixed args
      {
        op: "dom.patch",
        args: {
          // plain
          "style.font-weight": "bold",
          "style.color": "red",

          // template (string output)
          "title": "Hello ${ds.name} - id=${job.id}",

          // encapsulated (raw output)
          "data-user-id": "${ds.userId}",

          // nested: hash + arrays mixed
          "data-meta": {
            lastAction: "patch:${ticket.pipelineKey}",
            when: "${ctx.now}",                 // encapsulated
            tags: ["a", "${ds.tag}", "x-${ds.x}"] // mixed array values
          }
        }
      },

      // submit, with a mix of nested + expressions
      {
        op: "form.submit",
        args: {
          contentType: "json",
          requestName: "save-${job.name}",     // template
          headers: {
            "X-CSRF": "${ds.csrf}",            // encapsulated
            "X-Trace": "job=${job.id} ts=${ctx.now}" // template
          },
          // array args example (if you want to test array-shape args too)
          debug: ["a", "${ds.debug}", "b-${ctx.now}"],
        }
      }
    ],

    onError: [
      { op: "error.dump", args: { throw: true, includeCtx: true } }
    ]
  },

  // example of “run is a string list” style but already normalized into op objects
  // (if you prefer to keep run: "hover_on hover_b", your normalizer would expand it into this)
  hover_on: {
    run: [
      { op: "target.reset", args: null },

      // demonstrate target traversal
      { op: "target.closest", args: ".card" },

      // patch with expressions
      {
        op: "dom.patch",
        args: {
          "class": "card hover-on",
          "data-hover": "${ctx.hoverState}",        // encapsulated
          "title": "hover on by ${ds.user}"         // template
        }
      }
    ],

    onError: [
      { op: "error.dump", args: { throw: false, console: true } }
    ]
  },

  hover_off: {
    run: [
      { op: "target.reset", args: null },
      { op: "target.closest", args: ".card" },
      {
        op: "dom.patch",
        args: {
          "class": "card hover-off",
          "title": "hover off at ${ctx.now}"        // template
        }
      }
    ],
    onError: [
      { op: "error.dump", args: { throw: false } }
    ]
  }
};


export default testPipes;
