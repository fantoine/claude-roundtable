# Roundtable

**Turn Claude into a room full of experts.**

Roundtable lets you run multi-persona discussions where Claude plays several distinct characters -- each with their own expertise, communication style, and personality. Instead of getting one generic answer, you get a debate between a security expert, a product strategist, and a performance engineer -- all in the same conversation.

<details>
<summary><strong>Example: "Should we build or buy our authentication system?"</strong></summary>

```
$ /roundtable-start Should we build or buy our authentication system?
```

Roundtable selects the right experts and kicks off the debate:

> 🏗️ **Baccio** · 🔒 **Luca** · ⚖️ **Angela** · 💰 **Amy**
>
> ⚖️ **Angela** — *Before we jump into pros and cons, let's agree on the decision criteria first. I'd propose four: total cost of ownership over 3 years, time-to-market, security risk profile, and strategic differentiation — is auth a core competency or commodity infrastructure for your business?*
>
> 🔒 **Luca** — *Authentication is the highest-value target in your entire system. If you build, you own every vulnerability. If you buy, you're outsourcing your most critical security boundary to a vendor whose incident response plan you probably haven't audited. Neither option is "safer" by default.*
>
> 🏗️ **Baccio** — *I'd add one criterion: integration cost. People massively underestimate this on the "buy" side. A managed auth provider isn't just a drop-in. It's a contract your entire system couples to — your session model, your authorization layer, your user data model.*

</details>

## 💡 Why?

When you ask Claude a question, you get one perspective. With Roundtable, you get structured disagreement. A UX designer will push back on the backend engineer's API design. A finance lead will challenge the growth marketer's budget. Personas build on each other's ideas, ask pointed questions, and surface blind spots you wouldn't have thought of.

This is particularly useful for:
- **Architecture decisions** -- get opposing trade-offs from different specialists
- **Strategy and planning** -- hear from product, marketing, finance, and engineering simultaneously
- **Code reviews** -- combine security, performance, and readability perspectives
- **Brainstorming** -- let different personalities riff on an idea together

## 📦 Installation

Roundtable is available as a **Claude Code plugin** and as a **Claude Desktop extension**.

### Claude Code

```bash
claude plugin marketplace add fantoine/claude-plugins
claude plugin install roundtable --scope user
```

The `--scope` flag controls where the plugin is available:

| Scope | Effect |
|-------|--------|
| `user` | Available in all your projects (recommended) |
| `project` | Only in the current project |
| `local` | Only in the current project, not committed to git |

We recommend `user` scope so Roundtable is available everywhere.

### Claude Desktop

Download the latest `.mcpb` file from the [Releases page](https://github.com/fantoine/claude-roundtable/releases/latest), then double-click it to install.

## 🚀 Getting started

Roundtable needs **personas** to work. Personas are character profiles that define how each expert thinks, speaks, and what they care about.

Personas are generated from **Claude agents** -- the markdown files that give Claude specialized expertise (typically stored in `.claude/agents/`). If you're not familiar with Claude agents, see the [official documentation](https://code.claude.com/docs/en/sub-agents). There are hundreds of community-built agents available on GitHub, covering everything from software architecture to competitive analysis.

Roundtable takes any Claude agent definition and transforms it into a rich persona with a unique name, personality, tone of voice, and communication style -- so that each expert feels distinct in a conversation.

### 📚 Import agents from community sources

Roundtable comes with a curated list of agent repositories you can browse and import from.

**Claude Code:**

```
/roundtable-sources
```

**Claude Desktop:**

> "List the available agent sources for Roundtable"

This shows repositories like [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) (134+ agents) or [Roberdan/convergio-community](https://github.com/Roberdan/convergio-community) (strategy, legal, business ops). You can then browse a source and pick which agents to convert into personas.

**Claude Desktop -- step by step:**

> "Browse the agents from VoltAgent/awesome-claude-code-subagents"

> "Import the competitive-analyst, market-researcher, and trend-analyst as personas"

Each agent definition will be analyzed and transformed into a persona with a distinctive name, personality, and communication style, then saved to `~/.claude/roundtable/personas/`.

### 🔄 Convert your own agents

If you already have Claude agents installed locally (in `.claude/agents/` or `~/.claude/agents/`), you can convert them into personas directly.

**Claude Code:**

```
/roundtable-convert
```

**Claude Desktop:**

> "Discover my local agents and convert them to Roundtable personas"

### 🎯 Start a discussion

Once you have personas installed:

**Claude Code:**

```
/roundtable-start
```

or with a topic:

```
/roundtable-start Should we migrate our monolith to microservices?
```

**Claude Desktop:**

> "Start a roundtable discussion about our pricing strategy for the enterprise segment"

Roundtable will select the most relevant personas, present the lineup, and kick off the conversation. You can steer the discussion, ask follow-up questions, or add/remove participants at any time.

## 🎭 Managing personas

### 📂 Where personas are stored

| Level | Path | Scope |
|-------|------|-------|
| Global | `~/.claude/roundtable/personas/*.md` | Available everywhere |
| Project | `.claude/roundtable/personas/*.md` | Current project only (overrides global) |

In **Claude Desktop**, personas are always saved globally. In **Claude Code**, they follow the same level as the source agent (global agent = global persona, project agent = project persona).

### ⚡ Commands reference

**Claude Code:**

| Command | Description |
|---------|-------------|
| `/roundtable-list` | List all installed personas |
| `/roundtable-sources` | Browse and import from community agent repos |
| `/roundtable-convert` | Convert local agents into personas |
| `/roundtable-refresh` | Rebuild the persona manifest after manual edits |

**Claude Desktop** exposes the same capabilities via MCP tools. Just ask in natural language:

| Tool | Example prompt |
|------|---------------|
| `list_sources` | "Show me the available agent sources for Roundtable" |
| `list_personas` | "List all my Roundtable personas" |
| `browse_agents` | "Browse agents from VoltAgent/awesome-claude-code-subagents" |
| `import_persona` | "Import the competitive-analyst agent from VoltAgent/awesome-claude-code-subagents" |
| `discover_agents` | "Scan my local Claude agents that can be converted to personas" |
| `get_conversion_prompt` | "Generate a persona from my llm-architect agent" |
| `refresh_manifest` | "Rebuild the Roundtable persona manifest" |

### 🌐 Custom sources

The built-in sources are just a starting point. You can convert agents from **any public GitHub repository** that contains Claude agent definitions:

**Claude Desktop:**

> "Browse the agents from owner/repo and import the ones related to data engineering"

**Claude Code** (in the `/roundtable-sources` flow):

> Provide a custom repo URL when prompted, e.g. `https://github.com/owner/repo`

### ✏️ Create a persona from scratch

You can also write a persona file manually. Create a `.md` file in the personas directory:

```markdown
---
name: Nova
icon: 🧠
title: LLM Architect
source: custom
expertise:
  - llm-systems
  - rag
  - model-selection
---

# Nova 🧠 -- LLM Architect

Identity: Senior LLM architect with deep expertise in production AI systems.
Specializes in model selection, RAG architectures, and multi-model orchestration.

Communication style: Thinks in system diagrams and trade-off matrices.
Speaks with measured precision -- every architectural decision backed by a clear rationale.

Tone of voice: Calm and deliberate, often pausing with "let's think about this systematically..."
Frames every problem as inputs, outputs, and constraints. Fond of saying "it depends" before
giving a surprisingly definitive answer.

Principles:
- Start with the simplest architecture that solves the problem
- Latency, cost, and reliability are first-class design constraints
- Every LLM call should be observable and measurable
- Design for graceful degradation: fallback models, circuit breakers
- Benchmark before you optimize, measure before you benchmark
```

After creating or editing persona files manually, run `/roundtable-refresh` (Claude Code) or ask Claude Desktop to refresh the manifest.

## License

Apache 2.0
