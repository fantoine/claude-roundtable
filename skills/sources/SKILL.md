---
name: roundtable:sources
description: "Browse curated agent repositories to discover and import personas."
disable-model-invocation: false
---

**Language rule**: Respond in the same language the user used. Repo names and technical identifiers remain as-is.

## Steps

1. Call `list_sources` to display the curated agent repositories.

2. Ask the user which source(s) to explore, or if they want to explore all at once.

3. For each selected source, call `browse_agents` with the repo name to list available agents.

4. Let the user pick which agents to import.

5. For each selected agent:
   - Call `import_persona` with the repo and path to get the generation instructions.
   - Execute the returned prompt to generate the full persona content.
   - Call `save_persona` with the persona name and generated markdown content.

6. Suggest running `/roundtable:refresh` to update the manifest.
