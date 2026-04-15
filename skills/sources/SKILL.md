---
name: roundtable:sources
description: "Browse curated agent repositories to discover and import personas."
disable-model-invocation: false
---

# Sources

**Language rule**: All your responses MUST be in the same language the user used when invoking this command. Only repo names and technical identifiers remain as-is.

List curated agent repositories that can be used to import roundtable personas.

## Steps

1. **Fetch sources**: Read the file `https://raw.githubusercontent.com/fantoine/claude-roundtable/main/sources.json` using a web fetch.

2. **Display sources** as a markdown table:

```
📚 Agent Sources

| Repo | Description | Categories |
|------|-------------|------------|
| {repo} | {description} | {categories} |
| ... | ... | ... |

Total: {count} sources
```

3. **Ask the user** which source they want to explore, or if they want to explore all sources at once.

4. **Browse the selected source(s)** using the standard agent discovery flow:
   - For each repo, fetch the GitHub tree and identify agent markdown files.
   - Display agents found with their name and description.

5. **Let the user pick** which agents to import as personas.
   - For each selected agent, generate the conversion prompt and save the resulting persona using the standard persona format.
   - Save personas to `$HOME/.claude/roundtable/personas/`.

6. After all imports, suggest running `/roundtable:refresh` to update the manifest.
