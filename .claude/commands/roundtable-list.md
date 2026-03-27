---
description: "List all available roundtable personas with their metadata and source."
disable-model-invocation: true
---

# List Personas

**Language rule**: All your responses (headers, labels, messages) MUST be in the same language the user used when invoking this command. Table column headers should be translated. Only persona names, icons, and source identifiers remain as-is.

List all available roundtable personas from both levels.

## Steps

1. **Load persona metadata** (manifest-first with fallback):

   a. Try reading manifest files (use the actual resolved `$HOME` path):
      - Global: `$HOME/.claude/roundtable/manifest.json`
      - Project: `.claude/roundtable/manifest.json`

   b. If at least one manifest exists: use manifests as the source. Merge both (project entries override global entries with the same `id`).

   c. If no manifest found: fall back to scanning `*.md` files at both levels and reading YAML frontmatter to extract: `name`, `icon`, `title`, `source`, `expertise`.

   d. Note the data source in the output footer: `(from manifest)` or `(from file scan — run /roundtable-refresh to generate manifest)`.

2. Group entries by level (`global` / `project`).

3. Display results as a markdown table, grouped by level:

```
🎭 Roundtable Personas

### Global

| Icon | Name | Title | Source | Expertise |
|------|------|-------|--------|-----------|
| {icon} | {name} | {title} | {source} | {tags} |
| ... | ... | ... | ... | ... |

### Project

| Icon | Name | Title | Source | Expertise | Override |
|------|------|-------|--------|-----------|----------|
| {icon} | {name} | {title} | {source} | {tags} | {⚡ if overrides global} |
| ... | ... | ... | ... | ... | |

Total: {count} personas ({global count} global, {project count} project, {override count} overrides)
```

4. If no personas found:

```
No personas found.
Run /roundtable-convert to generate personas from your Claude agents.
```
