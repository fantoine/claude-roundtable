---
name: roundtable:convert
description: "Convert Claude agents into rich roundtable personas. Scans for agents without personas and generates display name, icon, communication style, and principles."
disable-model-invocation: false
---

**Language rule**: All responses MUST be in the same language the user used. Persona file content should also be in the user's language. Only persona names, icons, expertise tags, and YAML keys remain in English.

Arguments: $ARGUMENTS (optional agent name, `--force` to overwrite existing, `--global` to force global output)

## Steps

1. Call `discover_agents` to get the list of agents and their conversion status.

2. If $ARGUMENTS contains a specific agent name, filter to that agent only. If `--force` is not in $ARGUMENTS, skip agents that already have a persona.

3. Present the list and ask for confirmation before proceeding.

4. For each agent to convert:
   - Call `get_conversion_prompt` with the agent's id to get the generation instructions.
   - Execute the returned prompt to generate the full persona content (frontmatter + body).
   - Call `save_persona` with the persona name and the generated markdown content.

5. When all conversions are done, call `refresh_manifest` to update the index.

6. Report a summary table with icon, name, title, and output path for each converted persona.
