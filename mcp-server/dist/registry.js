import { parse as parseYaml } from 'yaml';
const AGENT_PATTERNS = [
    /^agents\//,
    /^commands\//,
    /^skills\//,
    /^plugin\/commands\//,
    /^plugin\/agents\//,
    /^src\/agents\//,
    /^src\/commands\//,
    /^src\/skills\//,
    /^\.claude\/agents\//,
    // Nested agents inside skill/tool directories
    /\/agents\//,
    // SKILL.md files (e.g. BMAD-METHOD pattern)
    /SKILL\.md$/,
];
function parseRepoUrl(input) {
    // Handle "owner/repo" shorthand
    const shorthand = input.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
    if (shorthand) {
        return { owner: shorthand[1], repo: shorthand[2], ref: 'main' };
    }
    // Handle full GitHub URLs
    const urlMatch = input.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:\/tree\/([^/]+))?(?:\/|$)/);
    if (urlMatch) {
        return { owner: urlMatch[1], repo: urlMatch[2], ref: urlMatch[3] ?? 'main' };
    }
    return null;
}
function isAgentCandidate(path) {
    if (!path.endsWith('.md'))
        return false;
    // Skip common non-agent markdown files
    const filename = path.split('/').pop().toLowerCase();
    const SKIP_FILES = ['readme.md', 'changelog.md', 'contributing.md', 'license.md', 'workflow.md', 'index.md', 'security.md', 'trademark.md'];
    if (SKIP_FILES.includes(filename))
        return false;
    // Skip docs, tests, github dirs
    if (path.startsWith('docs/') || path.startsWith('.github/') || path.startsWith('test'))
        return false;
    return AGENT_PATTERNS.some((pattern) => pattern.test(path));
}
function parseAgentContent(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
        // Some agents have no frontmatter — treat the whole file as the system prompt
        // if it looks like instructions (has headers or bullet points)
        if (content.length > 100 && (content.includes('# ') || content.includes('- '))) {
            return {
                frontmatter: {},
                systemPrompt: content.trim(),
            };
        }
        return null;
    }
    try {
        const frontmatter = parseYaml(match[1]);
        return { frontmatter, systemPrompt: match[2].trim() };
    }
    catch {
        return null;
    }
}
async function fetchJsonFile(owner, repo, ref, path) {
    try {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
        const resp = await fetch(rawUrl, { headers: { 'User-Agent': 'roundtable-mcp/0.1.0' } });
        if (!resp.ok)
            return null;
        return await resp.json();
    }
    catch {
        return null;
    }
}
function normalizePaths(value) {
    if (!value)
        return [];
    const arr = Array.isArray(value) ? value : [value];
    return arr.map((p) => p.replace(/^\.\//, '').replace(/\/$/, ''));
}
async function findDeclaredAgentPaths(tree, owner, repo, ref) {
    const paths = [];
    // Look for .claude-plugin/plugin.json
    const hasPluginJson = tree.some((e) => e.path === '.claude-plugin/plugin.json');
    if (hasPluginJson) {
        const data = (await fetchJsonFile(owner, repo, ref, '.claude-plugin/plugin.json'));
        if (data) {
            paths.push(...normalizePaths(data.commands));
            paths.push(...normalizePaths(data.agents));
            paths.push(...normalizePaths(data.skills));
            // Default directories if plugin.json exists but doesn't declare paths
            if (paths.length === 0) {
                if (tree.some((e) => e.path.startsWith('commands/')))
                    paths.push('commands');
                if (tree.some((e) => e.path.startsWith('agents/')))
                    paths.push('agents');
                if (tree.some((e) => e.path.startsWith('skills/')))
                    paths.push('skills');
            }
        }
    }
    // Look for .claude-plugin/marketplace.json
    const hasMarketplace = tree.some((e) => e.path === '.claude-plugin/marketplace.json');
    if (hasMarketplace) {
        const data = (await fetchJsonFile(owner, repo, ref, '.claude-plugin/marketplace.json'));
        if (data?.plugins) {
            for (const plugin of data.plugins) {
                const source = typeof plugin.source === 'string' ? plugin.source.replace(/^\.\//, '') : '';
                if (source && source !== '.') {
                    // Plugin source points to a subdirectory — scan it
                    paths.push(source);
                }
            }
        }
    }
    // Also check for plugin/commands/ pattern (nested plugin dir)
    const hasNestedPlugin = tree.some((e) => e.path === 'plugin/.claude-plugin/plugin.json');
    if (hasNestedPlugin) {
        const data = (await fetchJsonFile(owner, repo, ref, 'plugin/.claude-plugin/plugin.json'));
        if (data) {
            for (const p of normalizePaths(data.commands)) {
                paths.push(`plugin/${p}`);
            }
            for (const p of normalizePaths(data.agents)) {
                paths.push(`plugin/${p}`);
            }
            // Default
            if (paths.filter((p) => p.startsWith('plugin/')).length === 0) {
                if (tree.some((e) => e.path.startsWith('plugin/commands/')))
                    paths.push('plugin/commands');
                if (tree.some((e) => e.path.startsWith('plugin/agents/')))
                    paths.push('plugin/agents');
            }
        }
    }
    return paths;
}
export async function browseRepo(input) {
    const parsed = parseRepoUrl(input);
    if (!parsed) {
        return { agents: [], repo: input, error: 'Invalid repository format. Use "owner/repo" or a GitHub URL.' };
    }
    const { owner, repo, ref } = parsed;
    const repoId = `${owner}/${repo}`;
    // Fetch tree
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`;
    let tree;
    try {
        const response = await fetch(treeUrl, {
            headers: { 'User-Agent': 'roundtable-mcp/0.1.0' },
        });
        if (!response.ok) {
            if (response.status === 403) {
                return { agents: [], repo: repoId, error: 'GitHub API rate limit exceeded. Try again later.' };
            }
            return { agents: [], repo: repoId, error: `GitHub API error: ${response.status}` };
        }
        tree = (await response.json());
    }
    catch (err) {
        return { agents: [], repo: repoId, error: `Failed to fetch repository: ${String(err)}` };
    }
    // Try to find plugin/marketplace metadata for smarter discovery
    const declaredPaths = await findDeclaredAgentPaths(tree.tree, owner, repo, ref);
    // Find agent candidates: declared paths first, then pattern-based fallback
    let candidates;
    if (declaredPaths.length > 0) {
        // Use declared directories from plugin.json / marketplace.json
        candidates = tree.tree.filter((entry) => {
            if (entry.type !== 'blob' || !entry.path.endsWith('.md'))
                return false;
            const filename = entry.path.split('/').pop().toLowerCase();
            if (['readme.md', 'changelog.md', 'contributing.md', 'license.md'].includes(filename))
                return false;
            return declaredPaths.some((dp) => entry.path.startsWith(dp));
        });
    }
    else {
        candidates = tree.tree
            .filter((entry) => entry.type === 'blob' && isAgentCandidate(entry.path));
    }
    // Fetch and parse each candidate (in parallel, max 10)
    const agents = [];
    // Fetch in parallel with concurrency limit
    const batch = candidates;
    const results = await Promise.allSettled(batch.map(async (entry) => {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${entry.path}`;
        const resp = await fetch(rawUrl, { headers: { 'User-Agent': 'roundtable-mcp/0.1.0' } });
        if (!resp.ok)
            return null;
        const content = await resp.text();
        const parsed = parseAgentContent(content);
        if (!parsed)
            return null;
        return {
            path: entry.path,
            name: parsed.frontmatter.name ?? entry.path.split('/').pop().replace('.md', ''),
            description: parsed.frontmatter.description ?? '',
        };
    }));
    for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
            agents.push(result.value);
        }
    }
    return { agents, repo: repoId };
}
export async function fetchRemoteAgent(repoInput, agentPath) {
    const parsed = parseRepoUrl(repoInput);
    if (!parsed)
        return null;
    const { owner, repo, ref } = parsed;
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${agentPath}`;
    try {
        const resp = await fetch(rawUrl, { headers: { 'User-Agent': 'roundtable-mcp/0.1.0' } });
        if (!resp.ok)
            return null;
        const content = await resp.text();
        const parsed2 = parseAgentContent(content);
        if (!parsed2)
            return null;
        return {
            path: agentPath,
            name: parsed2.frontmatter.name ?? agentPath.split('/').pop().replace('.md', ''),
            description: parsed2.frontmatter.description ?? '',
            rawUrl,
            systemPrompt: parsed2.systemPrompt,
        };
    }
    catch {
        return null;
    }
}
export function buildRemoteConversionPrompt(agent) {
    return `You are a persona generator. Convert the following Claude agent definition into a rich roundtable persona.

## Agent: ${agent.name}

**Description**: ${agent.description}
**Source**: ${agent.rawUrl}

**System prompt**:
${agent.systemPrompt}

## Your task

Generate a persona file in this exact format (output ONLY the file content, nothing else):

\`\`\`
---
name: {a short memorable first name that evokes the domain}
icon: {single Unicode emoji character, e.g. 🔒 🧠 🎨 — NEVER use text shortcodes like :sparkles:}
title: {concise professional title}
source: ${agent.name.toLowerCase().replace(/\s+/g, '-')}
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
