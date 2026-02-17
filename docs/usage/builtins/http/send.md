# `http.send`

[Builtins Index](../INDEX.md) -> [HTTP Module](./INDEX.md)

Source:

* [../../../../src/builtins/http/httpSend.js](../../../../src/builtins/http/httpSend.js)

## Args

Parsed with:

```js
lib.args.parse(args, { adhoc: false }, { parms: "name buffer request adhoc", pop: true })
```

Fields:

* `name`: request name in `job.config.schema.requests` (`default` when `adhoc:false` and empty)
* `buffer`: boolish merge toggle for `buffer.get()`
* `request`: inline request override
* `adhoc`: allow unnamed request mode

Merge order:

1. named request
2. buffer
3. inline request

## Side Effects

* Sends HTTP request (`fetch`, fallback to `lib._http.request`).
* Writes projected response to `buffer` and `inputs.response`.
* Writes request/response/policy meta to `buffer.meta().http`.

## Return Contract

* `ok`: request sent and response policy passed.
* `error`: unsupported transport, bad request config, transport failure, or response-policy failure.

## See also

* [HTTP Send Guide](../../HTTP_SEND.md)
