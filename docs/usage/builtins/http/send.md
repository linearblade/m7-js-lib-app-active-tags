# `http.send`

[Builtins Index](../INDEX.md) -> [HTTP Module](./INDEX.md)

Source:

* [../../../../src/builtins/http/httpSend.js](../../../../src/builtins/http/httpSend.js)

## Args

Parsed with:

```js
lib.args.parse(args, { adhoc: false }, { parms: "name buffer request adhoc url", pop: true })
```

Fields:

* `name`: request name in `job.config.schema.requests` (`default` when `adhoc:false` and empty)
* `buffer`: boolish merge toggle for `buffer.get()`
* `request`: inline request override
* `adhoc`: allow unnamed request mode
* `url`: shorthand override for `request.endpoint.url`

Merge order:

1. named request
2. buffer
3. inline request
4. url shorthand -> `request.endpoint.url`

## Side Effects

* Sends HTTP request through `lib.request.send(...)`.
* Writes projected response to `buffer` and `inputs.response`.
* Writes request/response/policy meta to `buffer.meta().http`.

## Return Contract

* `ok`: request was configured and dispatched far enough to produce an HTTP
  status; response-policy result is exposed in `buffer.meta().http.responsePolicy`.
* `error`: unsupported transport, bad request config, or transport/setup
  failure before a real HTTP status was obtained.

Note:

* response-policy mismatches do not change stage status once a real HTTP
  response exists.
* transport/network failures normalized as `{ ok:false, status:0 }` still
  return `error` at stage level.

## See also

* [HTTP Send Guide](../../HTTP_SEND.md)
