---
name: roundtable:refresh
description: "Rescan all persona files at both levels and rebuild the roundtable manifest from scratch."
disable-model-invocation: false
---

**Language rule**: Respond in the same language the user used.

Call the `refresh_manifest` MCP tool and present the result.

If no persona files are found, suggest running `/roundtable:convert` to generate personas first.
