import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, basename } from 'node:path';
import { glob } from 'glob';
import { parse as parseYaml } from 'yaml';
function parseAgentFile(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
        return null;
    }
    const frontmatter = parseYaml(match[1]);
    if (!frontmatter.name) {
        return null;
    }
    return {
        frontmatter,
        systemPrompt: match[2].trim(),
    };
}
async function scanAgentsInDir(dir, level) {
    const pattern = join(dir, '*.md');
    const files = await glob(pattern);
    const agents = [];
    for (const filePath of files) {
        const content = await readFile(filePath, 'utf-8');
        const parsed = parseAgentFile(content);
        if (!parsed) {
            continue;
        }
        agents.push({
            id: basename(filePath, '.md'),
            frontmatter: parsed.frontmatter,
            systemPrompt: parsed.systemPrompt,
            filePath,
            level,
        });
    }
    return agents;
}
export async function discoverAgents(projectDir) {
    const globalDir = join(homedir(), '.claude', 'agents');
    const agents = await scanAgentsInDir(globalDir, 'global');
    if (projectDir) {
        const projectAgents = await scanAgentsInDir(join(projectDir, '.claude', 'agents'), 'project');
        agents.push(...projectAgents);
    }
    return agents;
}
export function personaOutputPath(agent) {
    if (agent.level === 'global') {
        return join(homedir(), '.claude', 'roundtable', 'personas', `${agent.id}.md`);
    }
    return join('.claude', 'roundtable', 'personas', `${agent.id}.md`);
}
export function buildConversionPrompt(agent) {
    return `You are a persona generator. Convert the following Claude agent definition into a rich roundtable persona.

## Agent: ${agent.frontmatter.name}

**Description**: ${agent.frontmatter.description}

**System prompt**:
${agent.systemPrompt}

## Your task

Generate a persona file in this exact format (output ONLY the file content, nothing else):

\`\`\`
---
name: {a short memorable first name that evokes the domain}
icon: {single Unicode emoji character, e.g. 🔒 🧠 🎨 — NEVER use text shortcodes like :sparkles:}
title: {concise professional title}
source: ${agent.id}
expertise:
  - {4-6 domain tags extracted from the system prompt}
---

# {name} {icon} — {title}

Identity: {2-3 sentences synthesizing expertise, background, specialization. Reference specific technologies. Make it feel like a real person.}

Communication style: {2-3 sentences describing HOW they speak and think. Must be distinctive and domain-specific. Not generic.}

Tone of voice: {2-3 sentences describing their unique tone, temperament, and verbal habits. Include 2-3 concrete verbal tics or catchphrases that make them instantly recognizable in a group conversation. Feel natural and human, not caricatural.}

Principles:
- {5-7 opinionated beliefs extracted from the agent's patterns and philosophy}
- {each should start with an action verb or strong belief statement}
\`\`\`

Rules:
- The display name must be short (1 word), memorable, and evocative of the domain
- The communication style must be clearly distinguishable from other personas
- Principles must be opinionated and specific, not generic platitudes
- Extract real expertise from the system prompt, don't invent capabilities`;
}
