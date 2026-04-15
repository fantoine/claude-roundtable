#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  loadAllPersonas,
  loadPersonaBodies,
  loadPersonasFromDir,
  filterByExpertise,
  buildRoundtablePrompt,
  rebuildManifest,
} from './personas.js';
import {
  discoverAgents,
  buildConversionPrompt,
  personaOutputPath,
} from './convert.js';
import {
  browseRepo,
  fetchRemoteAgent,
  buildRemoteConversionPrompt,
} from './registry.js';

const VERSION = '__VERSION__';

const server = new McpServer({
  name: 'roundtable',
  version: VERSION,
});

// --- Prompts ---

server.prompt(
  'start-roundtable',
  'Start a multi-persona roundtable discussion with all available personas',
  { topic: z.string().optional().describe('Optional topic to filter personas by expertise') },
  async ({ topic }) => {
    const personas = await loadAllPersonas(process.cwd());

    const selected = topic
      ? filterByExpertise(personas, topic)
      : personas;

    if (selected.length === 0) {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'No personas found. Install some Claude agents and run the convert-agent tool first.',
            },
          },
        ],
      };
    }

    // Load full bodies for selected personas only
    const selectedWithBodies = await loadPersonaBodies(selected);

    const roster = selectedWithBodies
      .map((p) => `${p.metadata.icon} **${p.metadata.name}** · *${p.metadata.title}*`)
      .join('\n');

    const topicLine = topic
      ? `🎯 **${topic}**\n\n`
      : '';

    const startInstruction = topic
      ? `Present the participant lineup above, then immediately start the first discussion round on the topic without asking what to discuss.`
      : `Present the participant lineup above, then ask the user what they would like to discuss in a warm, conversational tone.`;

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `${buildRoundtablePrompt(selectedWithBodies)}\n\n---\n\n${topicLine}🎉 Roundtable started with ${selectedWithBodies.length} personas!\n\n${roster}\n\n${startInstruction}`,
          },
        },
      ],
    };
  },
);

// --- Tools ---

const SOURCES_URL = 'https://raw.githubusercontent.com/fantoine/claude-roundtable/main/sources.json';

interface Source {
  repo: string;
  description: string;
  categories: string[];
}

server.tool(
  'list_sources',
  'List curated repositories of agents that can be imported as roundtable personas. Use browse_agents to explore a specific source.',
  {},
  async () => {
    try {
      const resp = await fetch(SOURCES_URL, { headers: { 'User-Agent': 'roundtable-mcp' } });
      if (!resp.ok) {
        return {
          content: [{ type: 'text', text: `❌ Failed to fetch sources: HTTP ${resp.status}` }],
        };
      }
      const data = (await resp.json()) as { sources: Source[] };

      const lines = data.sources.map(
        (s) => `- **${s.repo}** — ${s.description}\n  categories: ${s.categories.join(', ')}`,
      );

      return {
        content: [
          {
            type: 'text',
            text: `📚 Available agent sources (${data.sources.length}):\n\n${lines.join('\n\n')}\n\nUse \`browse_agents\` with a repo name to explore and import personas.`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `❌ Failed to fetch sources: ${String(err)}` }],
      };
    }
  },
);

server.tool(
  'list_personas',
  'List all available roundtable personas with their metadata',
  {},
  async () => {
    const personas = await loadAllPersonas(process.cwd());

    if (personas.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No personas found. Convert Claude agents first using the convert_agent tool.',
          },
        ],
      };
    }

    const lines = personas.map(
      (p) =>
        `${p.metadata.icon} ${p.metadata.name} — ${p.metadata.title} [${p.level}]\n   source: ${p.metadata.source} | expertise: ${p.metadata.expertise.join(', ')}`,
    );

    return {
      content: [
        {
          type: 'text',
          text: `🎭 Roundtable Personas (${personas.length})\n\n${lines.join('\n\n')}`,
        },
      ],
    };
  },
);

server.tool(
  'discover_agents',
  'Scan for Claude agents that can be converted to personas',
  {},
  async () => {
    const agents = await discoverAgents(process.cwd());
    const personas = await loadAllPersonas(process.cwd());
    const existingIds = new Set(personas.map((p) => p.metadata.source));

    const lines = agents.map((a) => {
      const hasPersona = existingIds.has(a.id);
      const status = hasPersona ? '✅' : '🔄';
      const note = hasPersona ? 'has persona' : 'needs conversion';
      return `${status} ${a.id} (${a.level}) — ${a.frontmatter.description}\n   ${note} → ${personaOutputPath(a)}`;
    });

    return {
      content: [
        {
          type: 'text',
          text: `Agents found: ${agents.length}\n\n${lines.join('\n\n')}`,
        },
      ],
    };
  },
);

server.tool(
  'get_conversion_prompt',
  'Generate the conversion prompt for a specific Claude agent. The LLM should then execute this prompt to produce the persona file.',
  { agent_id: z.string().describe('Agent identifier (filename without .md)') },
  async ({ agent_id }) => {
    const agents = await discoverAgents(process.cwd());
    const agent = agents.find((a) => a.id === agent_id);

    if (!agent) {
      return {
        content: [
          {
            type: 'text',
            text: `Agent "${agent_id}" not found. Run discover_agents to see available agents.`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: buildConversionPrompt(agent),
        },
        {
          type: 'text',
          text: `\n\n---\nOutput path: ${personaOutputPath(agent)}`,
        },
      ],
    };
  },
);

server.tool(
  'browse_agents',
  'Browse a GitHub repository to find Claude agents that can be imported as personas. Only use when the user explicitly asks to explore or import from a GitHub repo.',
  { repo: z.string().describe('GitHub repository (e.g. "owner/repo" or full URL)') },
  async ({ repo }) => {
    const result = await browseRepo(repo);

    if (result.error) {
      return {
        content: [{ type: 'text', text: `❌ ${result.error}` }],
      };
    }

    if (result.agents.length === 0) {
      return {
        content: [{ type: 'text', text: `No agents found in ${result.repo}. The repo may use a non-standard structure.` }],
      };
    }

    const lines = result.agents.map(
      (a) => `- **${a.name}** — ${a.description || '(no description)'}\n  path: \`${a.path}\``,
    );

    return {
      content: [
        {
          type: 'text',
          text: `🔍 Found ${result.agents.length} agents in **${result.repo}**:\n\n${lines.join('\n\n')}\n\nUse \`import_persona\` with the repo and path to convert any of these into a persona.`,
        },
      ],
    };
  },
);

server.tool(
  'import_persona',
  'Fetch a Claude agent from a GitHub repo and generate the conversion prompt to create a persona directly. Only use when the user explicitly asks to import a specific agent from a GitHub repo.',
  {
    repo: z.string().describe('GitHub repository (e.g. "owner/repo" or full URL)'),
    path: z.string().describe('Path to the agent .md file in the repo'),
  },
  async ({ repo, path }) => {
    const agent = await fetchRemoteAgent(repo, path);

    if (!agent) {
      return {
        content: [{ type: 'text', text: `❌ Could not fetch or parse agent at \`${path}\` in \`${repo}\`.` }],
      };
    }

    const outputDir = join(homedir(), '.claude', 'roundtable', 'personas');
    const outputPath = join(outputDir, `${agent.name.toLowerCase().replace(/\s+/g, '-')}.md`);

    return {
      content: [
        {
          type: 'text',
          text: buildRemoteConversionPrompt(agent),
        },
        {
          type: 'text',
          text: `\n\n---\n📥 Source: ${agent.rawUrl}\n📂 Output path: ${outputPath}\n\nAfter generating the persona content above, write it to the output path and update the manifest.`,
        },
      ],
    };
  },
);

server.tool(
  'save_persona',
  'Save a generated persona markdown file to disk. Use this after generating persona content with get_conversion_prompt or import_persona.',
  {
    name: z.string().describe('Persona name (used to derive the filename, e.g. "Atlas" becomes atlas.md)'),
    content: z.string().describe('The full persona markdown content (frontmatter + body)'),
  },
  async ({ name, content }) => {
    try {
      const filename = `${name.toLowerCase().replace(/\s+/g, '-')}.md`;
      const dir = join(homedir(), '.claude', 'roundtable', 'personas');
      const filePath = join(dir, filename);

      await mkdir(dir, { recursive: true });
      await writeFile(filePath, content, 'utf-8');

      return {
        content: [
          {
            type: 'text',
            text: `✅ Persona "${name}" saved to ${filePath}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to save persona: ${String(err)}`,
          },
        ],
      };
    }
  },
);

server.tool(
  'refresh_manifest',
  'Rescan all persona files and rebuild the manifest from scratch',
  {},
  async () => {
    const globalDir = join(homedir(), '.claude', 'roundtable', 'personas');
    const globalManifestPath = join(homedir(), '.claude', 'roundtable', 'manifest.json');
    const globalCount = await rebuildManifest(globalManifestPath, globalDir, 'global');

    const projectDir = process.cwd();
    const localDir = join(projectDir, '.claude', 'roundtable', 'personas');
    const localManifestPath = join(projectDir, '.claude', 'roundtable', 'manifest.json');

    let localCount = 0;
    try {
      const localPersonas = await loadPersonasFromDir(localDir, 'project');
      if (localPersonas.length > 0) {
        localCount = await rebuildManifest(localManifestPath, localDir, 'project');
      }
    } catch {
      // No local personas directory — that's fine
    }

    return {
      content: [
        {
          type: 'text',
          text: `✅ Manifest refreshed!\n\nGlobal: ${globalCount} personas → ${globalManifestPath}\nProject: ${localCount} personas → ${localManifestPath}`,
        },
      ],
    };
  },
);

// --- Resources ---

server.resource(
  'persona-list',
  'roundtable://personas',
  { mimeType: 'application/json', description: 'List of all available personas with metadata' },
  async () => {
    const personas = await loadAllPersonas(process.cwd());
    const data = personas.map((p) => ({
      id: p.id,
      ...p.metadata,
      level: p.level,
    }));

    return {
      contents: [
        {
          uri: 'roundtable://personas',
          mimeType: 'application/json',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  },
);

// --- Start ---

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error('Failed to start roundtable MCP server:', error);
  process.exit(1);
});
