---
name: roundtable:start
description: "Launch a multi-persona discussion. Agents take turns responding in character based on their expertise and communication style."
disable-model-invocation: false
---

Use the `start-roundtable` MCP prompt to initialize the roundtable session.

If $ARGUMENTS is provided, pass it as the `topic` parameter — it will be used to filter and pre-select the most relevant personas.

The prompt returns the full persona roster, their complete profiles, and all orchestration rules. Follow them exactly to run the discussion.
