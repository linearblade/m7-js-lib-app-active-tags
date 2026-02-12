Here’s the **Top-Level Job Config JSON Schema v1** (Draft 2020-12), **locked to the merge behavior** you confirmed:

* `request` + `requests` (default template + named bucket)
* `interval` + `intervals` (default template + named bucket)
* `enable.autorun` and `interval*.autorun` support `false | true | "a b" | ["a","b"]`

This schema matches the real v098 concepts (name/require/interval gating/etc.) while making v1 pipeline-native. 

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://m7.org/schemas/activetags/job-config.schema.v1.json",
  "title": "ActiveTags Job Config Schema v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["pipelines"],
  "properties": {
    "name": {
      "type": "string",
      "description": "Optional stable job name. If omitted, engine may derive from element id/name or generated id.",
      "minLength": 1
    },

    "selector": {
      "type": "string",
      "description": "Optional binding selector used by registrar/observer to attach this config to elements."
    },

    "require": {
      "description": "Job dependencies. Space-delimited string or array of job names. Execution/autorun should be gated until requirements are complete.",
      "oneOf": [
        { "type": "string", "minLength": 1 },
        {
          "type": "array",
          "minItems": 1,
          "items": { "type": "string", "minLength": 1 }
        }
      ]
    },

    "enable": {
      "type": "object",
      "additionalProperties": false,
      "description": "Enable gates for the job. autorun supports bool or pipeline selector list.",
      "properties": {
        "enabled": {
          "type": "boolean",
          "default": true,
          "description": "Master switch. If false, job is inert."
        },
        "autorun": {
          "$ref": "#/$defs/AutorunSelector",
          "default": true,
          "description": "false = autorun none; true = autorun default set; string/array = autorun those pipelines."
        }
      }
    },

    "confirm": {
      "description": "Baseline confirm gate. Trigger data-confirm and per-pipeline overrides may supersede this at runtime.",
      "oneOf": [
        { "type": "boolean" },
        { "type": "string", "minLength": 1 }
      ]
    },

    "pipelineConfirm": {
      "type": "object",
      "description": "Optional per-pipeline confirm overrides. Values: boolean or message string.",
      "propertyNames": {
        "type": "string",
        "minLength": 1,
        "pattern": "^[A-Za-z_][A-Za-z0-9_.-]*$"
      },
      "additionalProperties": {
        "oneOf": [
          { "type": "boolean" },
          { "type": "string", "minLength": 1 }
        ]
      }
    },

    "run": {
      "type": "object",
      "additionalProperties": false,
      "description": "Optional run defaults; used by autorun default set resolution (implementation-defined).",
      "properties": {
        "defaultPipeline": {
          "type": "string",
          "minLength": 1,
          "pattern": "^[A-Za-z_][A-Za-z0-9_.-]*$"
        },
        "plan": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "string",
            "minLength": 1,
            "pattern": "^[A-Za-z_][A-Za-z0-9_.-]*$"
          }
        },
        "allowConcurrent": {
          "type": "boolean",
          "default": false
        }
      }
    },

    "request": {
      "$ref": "#/$defs/RequestSpec",
      "description": "Default request template. Merges into named requests (requests.*)."
    },

    "requests": {
      "type": "object",
      "description": "Named request bucket. Each entry deep-merges with top-level request template.",
      "propertyNames": {
        "type": "string",
        "minLength": 1,
        "pattern": "^[A-Za-z_][A-Za-z0-9_.-]*$"
      },
      "additionalProperties": { "$ref": "#/$defs/RequestSpec" }
    },

    "interval": {
      "$ref": "#/$defs/IntervalBlock",
      "description": "Default interval template. Merges into named intervals (intervals.*)."
    },

    "intervals": {
      "type": "object",
      "description": "Named interval bucket. Each entry deep-merges with top-level interval template.",
      "propertyNames": {
        "type": "string",
        "minLength": 1,
        "pattern": "^[A-Za-z_][A-Za-z0-9_.-]*$"
      },
      "additionalProperties": { "$ref": "#/$defs/IntervalBlock" }
    },

    "pipelines": {
      "$ref": "https://m7.org/schemas/activetags/pipeline.schema.v1.json#/properties/pipelines",
      "description": "Map of pipeline name -> pipeline block (see pipeline schema v1)."
    },

    "env": {
      "type": "object",
      "description": "Recommended user/consumer space for arbitrary config/data. Engine should not interpret keys here by default.",
      "additionalProperties": true
    },

    "meta": {
      "type": "object",
      "description": "Arbitrary metadata (ignored by engine).",
      "additionalProperties": true
    }
  },

  "$defs": {
    "AutorunSelector": {
      "description": "Autorun selector: false/true or pipeline list (space-delimited string or array).",
      "oneOf": [
        { "type": "boolean" },
        { "type": "string", "minLength": 1 },
        {
          "type": "array",
          "minItems": 1,
          "items": { "type": "string", "minLength": 1 }
        }
      ]
    },

    "RequestSpec": {
      "type": "object",
      "description": "Request specification. Used as default template (request) and named entries (requests.*). Merge behavior is engine-defined but expected to be deep-merge with arrays replaced.",
      "additionalProperties": false,
      "properties": {
        "url": { "type": "string", "minLength": 1 },
        "action": {
          "type": "string",
          "minLength": 1,
          "description": "Legacy alias for url; engine may normalize action->url."
        },
        "method": { "type": "string", "minLength": 1 },
        "encoding": {
          "type": "string",
          "enum": ["urlencoded", "json", "formdata", "raw"]
        },
        "body": {
          "description": "String, object, or pairs. Serialization is controlled by encoding (implementation-defined).",
          "oneOf": [
            { "type": "string" },
            { "type": "object", "additionalProperties": true },
            {
              "type": "array",
              "items": {
                "type": "array",
                "minItems": 2,
                "maxItems": 2,
                "items": [{ "type": "string" }, {}]
              }
            }
          ]
        },
        "headers": {
          "type": "object",
          "additionalProperties": { "type": "string" }
        },
        "credentials": { "type": "boolean" },
        "timeoutMs": { "type": "integer", "minimum": 0 },
        "transport": { "type": "string", "minLength": 1 },
        "flags": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "urlencoded": { "type": "boolean" },
            "json": { "type": "boolean" }
          }
        }
      }
    },

    "IntervalBlock": {
      "type": "object",
      "description": "Interval specification. Used as default template (interval) and named entries (intervals.*). Each named interval deep-merges with default template.",
      "additionalProperties": false,
      "properties": {
        "enabled": { "type": "boolean", "default": true },
        "disabled": {
          "type": "boolean",
          "description": "Legacy flag. Engine may normalize disabled:true -> enabled:false."
        },

        "autorun": { "$ref": "#/$defs/AutorunSelector", "default": true },

        "repeat": {
          "type": "integer",
          "minimum": 1,
          "description": "Interval cadence in milliseconds. Required for enabled intervals at runtime."
        },

        "delay": {
          "type": "integer",
          "minimum": 0,
          "description": "Optional initial delay before first tick."
        },

        "pipeline": {
          "type": "string",
          "minLength": 1,
          "pattern": "^[A-Za-z_][A-Za-z0-9_.-]*$",
          "description": "Pipeline to execute on each tick. Required for enabled intervals at runtime."
        },

        "max": {
          "type": "integer",
          "minimum": 0,
          "description": "Max executions (0 or omitted = infinite)."
        },

        "onError": {
          "type": "string",
          "enum": ["stop", "continue"],
          "default": "stop"
        },

        "allowOverlap": {
          "type": "boolean",
          "default": false,
          "description": "If false, scheduler should not start a new tick while prior tick pipeline is still running."
        },

        "meta": {
          "type": "object",
          "additionalProperties": true
        }
      }
    }
  }
}
```

### Notes (part of the “lock”)

* This schema **permits** `request` + `requests` simultaneously (merge behavior).
* Same for `interval` + `intervals`.
* It intentionally does **not** enforce “repeat/pipeline required when enabled” at pure-schema level, because JSON Schema can’t easily express “required iff enabled==true across merged templates”. That requirement is part of the **runtime validation** rule we’ve locked.

If you want, next I can emit a tiny **runtime validator** spec (not code) that describes exactly what constitutes “invalid at runtime” after merge normalization (missing url, missing repeat/pipeline, unknown pipeline references, etc.).
