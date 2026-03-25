---
description: "Rescan all persona files at both levels and rebuild the roundtable manifest from scratch."
---

# Refresh Roundtable Manifest

**Language rule**: All responses MUST be in the same language the user used when invoking this command.

You are rebuilding the persona manifest by performing a full rescan of all persona files at both global and project levels.

## Step 1: Scan all persona files

Scan at both levels (use the actual resolved `$HOME` path for global):
- **Global**: `$HOME/.claude/roundtable/personas/*.md`
- **Project**: `.claude/roundtable/personas/*.md`

For each `.md` file found, read the YAML frontmatter and extract: `name`, `icon`, `title`, `source`, `expertise`.

Skip files with missing or malformed frontmatter — note each skipped file.

## Step 2: Build manifests

Build two separate manifest objects, one per level.

**Global manifest** (`$HOME/.claude/roundtable/manifest.json`):
```json
{
  "generated": "{current ISO 8601 timestamp}",
  "personas": [
    {
      "id": "{filename without .md}",
      "name": "{name}",
      "icon": "{emoji}",
      "title": "{title}",
      "source": "{source}",
      "expertise": ["{tag1}", "..."],
      "level": "global"
    }
  ]
}
```

**Project manifest** (`.claude/roundtable/manifest.json`), only if `.claude/roundtable/personas/` exists and contains files:
Same structure with `"level": "project"` for all entries.

## Step 3: Write manifests

Write each manifest file (pretty-printed JSON, 2-space indent). Create directories as needed.

Only write the project manifest if project-level persona files were found.

## Step 4: Report

Display a summary:

```
✅ Manifest refreshed!

Global: {count} personas → $HOME/.claude/roundtable/manifest.json
Project: {count} personas → .claude/roundtable/manifest.json

{icon} {name} — {title} [global|project]
...

⚠ Skipped: {filename} — {reason}
```

If no persona files are found at either level:
```
No persona files found. Run /roundtable:convert-agent to generate personas first.
```
