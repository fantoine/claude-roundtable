# Roundtable

Multi-persona discussions for Claude. Convert any Claude agent into a rich persona and orchestrate collaborative mono-LLM conversations where multiple expert characters discuss topics together.

## Claude Code Plugin

A Claude Code plugin providing slash commands:

- `/roundtable:start` — Launch a multi-persona discussion
- `/roundtable:convert` — Convert Claude agents into roundtable personas
- `/roundtable:list` — List all available personas
- `/roundtable:refresh` — Rescan persona files and rebuild the manifest

### Install

```bash
claude plugin install fantoine/claude-roundtable
```

## Claude Desktop Extension (MCP Server)

An MCP server exposing the same functionality to Claude Desktop, Cursor, VS Code, and any MCP-compatible client.

### Install

```bash
cd extension/mcp-server
npm install
npm run build
```

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "roundtable": {
      "command": "node",
      "args": ["/absolute/path/to/extension/mcp-server/dist/index.js"]
    }
  }
}
```

### MCP Capabilities

| Type | Name | Description |
|------|------|-------------|
| Prompt | `start-roundtable` | Start a roundtable discussion (optional `topic` filter) |
| Tool | `list_personas` | List all personas with metadata |
| Tool | `discover_agents` | Scan for convertible Claude agents |
| Tool | `get_conversion_prompt` | Generate conversion prompt for an agent |
| Resource | `roundtable://personas` | JSON list of all personas |

## Persona Format

Personas are stored as markdown files with YAML frontmatter:

- **Global**: `~/.claude/roundtable/personas/*.md`
- **Project**: `.claude/roundtable/personas/*.md` (overrides global)

```markdown
---
name: Atlas
icon: 🧠
title: LLM Architect
source: llm-architect
expertise:
  - llm-systems
  - rag
  - model-selection
  - inference-optimization
---

# Atlas 🧠 — LLM Architect

Identity: Senior LLM architect with deep expertise in designing
production AI systems.

Communication style: Thinks in system diagrams and trade-off matrices.
Speaks with measured precision.

Principles:
- Start with the simplest architecture that solves the problem
- Latency, cost, and reliability are first-class design constraints
- Every LLM call should be observable and measurable
```

## How It Works

1. **Install Claude agents** as usual in `.claude/agents/` or `~/.claude/agents/`
2. **Convert** them to personas: `/roundtable:convert` (plugin) or `get_conversion_prompt` tool (MCP)
3. **Launch** roundtable: `/roundtable:start` (plugin) or `start-roundtable` prompt (MCP)
4. **Discuss** — Claude orchestrates the conversation, selecting 2-3 relevant personas per message, each responding in character

The discussion is **mono-LLM**: a single Claude instance plays all roles, guided by the persona definitions. This gives natural cross-talk, shared context, and zero latency between agents.

## Project Structure

```
.claude/
  plugin.json          # Claude Code plugin manifest
  commands/            # Slash commands
extension/
  manifest.json        # MCP extension manifest
  icon.svg
  mcp-server/          # MCP server (TypeScript)
  pack.sh              # Packaging script
```

## License

MIT
