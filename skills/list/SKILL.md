---
name: roundtable:list
description: "List all available roundtable personas with their metadata and source."
disable-model-invocation: false
---

**Language rule**: Respond in the same language the user used.

Call the `list_personas` MCP tool and present the results clearly, grouped by level (global / project).

If no personas are found, suggest running `/roundtable:convert` to generate some from Claude agents.
