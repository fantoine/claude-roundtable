import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, basename, dirname } from 'node:path';
import { glob } from 'glob';
import { parse as parseYaml } from 'yaml';
function parsePersonaFile(content) {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontmatterMatch) {
        return null;
    }
    const metadata = parseYaml(frontmatterMatch[1]);
    const body = frontmatterMatch[2].trim();
    if (!metadata.name || !metadata.icon || !metadata.title) {
        return null;
    }
    return {
        metadata: {
            name: metadata.name,
            icon: metadata.icon,
            title: metadata.title,
            source: metadata.source ?? '',
            expertise: metadata.expertise ?? [],
        },
        body,
    };
}
async function readManifest(manifestPath) {
    try {
        const content = await readFile(manifestPath, 'utf-8');
        const data = JSON.parse(content);
        if (!Array.isArray(data.personas))
            return null;
        return data;
    }
    catch {
        return null;
    }
}
export async function writeManifest(manifestPath, manifest) {
    await mkdir(dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}
export async function mergePersonaIntoManifest(manifestPath, entry) {
    const existing = (await readManifest(manifestPath)) ?? { generated: '', personas: [] };
    const filtered = existing.personas.filter((p) => p.source !== entry.source);
    filtered.push(entry);
    await writeManifest(manifestPath, {
        generated: new Date().toISOString(),
        personas: filtered,
    });
}
export async function rebuildManifest(manifestPath, dir, level) {
    const personas = await loadPersonasFromDir(dir, level);
    const entries = personas.map((p) => ({
        id: p.id,
        name: p.metadata.name,
        icon: p.metadata.icon,
        title: p.metadata.title,
        source: p.metadata.source,
        expertise: p.metadata.expertise,
        level: p.level,
    }));
    await writeManifest(manifestPath, {
        generated: new Date().toISOString(),
        personas: entries,
    });
    return entries.length;
}
export async function loadPersonasFromDir(dir, level) {
    const pattern = join(dir, '*.md');
    const files = await glob(pattern);
    const personas = [];
    for (const filePath of files) {
        const content = await readFile(filePath, 'utf-8');
        const parsed = parsePersonaFile(content);
        if (!parsed) {
            continue;
        }
        const id = basename(filePath, '.md');
        personas.push({
            id,
            metadata: parsed.metadata,
            body: parsed.body,
            filePath,
            level,
        });
    }
    return personas;
}
function manifestEntryToPersona(entry) {
    const level = entry.level;
    const filePath = level === 'global'
        ? join(homedir(), '.claude', 'roundtable', 'personas', `${entry.id}.md`)
        : join('.claude', 'roundtable', 'personas', `${entry.id}.md`);
    return {
        id: entry.id,
        metadata: {
            name: entry.name,
            icon: entry.icon,
            title: entry.title,
            source: entry.source,
            expertise: entry.expertise,
        },
        body: '',
        filePath,
        level,
    };
}
export async function loadPersonaBodies(personas) {
    return Promise.all(personas.map(async (p) => {
        try {
            const content = await readFile(p.filePath, 'utf-8');
            const parsed = parsePersonaFile(content);
            return parsed ? { ...p, body: parsed.body } : p;
        }
        catch {
            return p;
        }
    }));
}
export async function loadAllPersonas(projectDir) {
    const globalManifestPath = join(homedir(), '.claude', 'roundtable', 'manifest.json');
    const globalManifest = await readManifest(globalManifestPath);
    let projectManifest = null;
    if (projectDir) {
        const localManifestPath = join(projectDir, '.claude', 'roundtable', 'manifest.json');
        projectManifest = await readManifest(localManifestPath);
    }
    if (globalManifest || projectManifest) {
        const personaMap = new Map();
        for (const entry of globalManifest?.personas ?? []) {
            personaMap.set(entry.id, manifestEntryToPersona(entry));
        }
        for (const entry of projectManifest?.personas ?? []) {
            personaMap.set(entry.id, manifestEntryToPersona(entry));
        }
        return Array.from(personaMap.values());
    }
    // Fallback: file scan
    const globalDir = join(homedir(), '.claude', 'roundtable', 'personas');
    const globalPersonas = await loadPersonasFromDir(globalDir, 'global');
    const personaMap = new Map();
    for (const persona of globalPersonas) {
        personaMap.set(persona.id, persona);
    }
    if (projectDir) {
        const projectPersonaDir = join(projectDir, '.claude', 'roundtable', 'personas');
        const projectPersonas = await loadPersonasFromDir(projectPersonaDir, 'project');
        for (const persona of projectPersonas) {
            personaMap.set(persona.id, persona);
        }
    }
    return Array.from(personaMap.values());
}
export function filterByExpertise(personas, topic) {
    const topicLower = topic.toLowerCase();
    const keywords = topicLower.split(/[\s,]+/);
    const scored = personas.map((persona) => {
        const expertiseLower = persona.metadata.expertise.map((e) => e.toLowerCase());
        const titleLower = persona.metadata.title.toLowerCase();
        let score = 0;
        for (const keyword of keywords) {
            for (const tag of expertiseLower) {
                if (tag.includes(keyword) || keyword.includes(tag)) {
                    score += 2;
                }
            }
            if (titleLower.includes(keyword)) {
                score += 1;
            }
        }
        return { persona, score };
    });
    return scored
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((s) => s.persona);
}
export function buildRoundtablePrompt(personas) {
    const personaBlocks = personas
        .map((p) => p.body)
        .join('\n\n---\n\n');
    return `You are orchestrating a multi-persona discussion. Below are the participating personas. For each user message, select 2-3 most relevant personas and respond in character for each.

## Participating Personas

${personaBlocks}

## Orchestration Rules

1. **Agent selection**: For each user message, select 2-3 personas whose expertise best matches the topic. Rotate participation over time to keep the discussion diverse.

2. **In-character responses**: Each persona responds according to their documented communication style, tone of voice, principles, and identity. Pay special attention to each persona's **tone of voice** — use their verbal tics, catchphrases, and temperament consistently so the user can identify who is speaking from the writing style alone.

3. **Response format**: Use this exact structure for each persona turn to produce a rich, chat-like rendering with avatar. Use the persona's icon emoji as their avatar identifier:

   {icon} **{name}** *{title}*

   > {response text — use **bold** for key concepts, terms, or recommendations. Use numbered lists for steps or sequences. Keep it focused and structured.}

   Keep each response **short and punchy** — 2 to 4 sentences max. This is a conversation, not an essay. If a persona has more to say, they can chime in again in the next round.

4. **Cross-talk**: Personas should reference each other naturally and briefly:
   - Build on previous points: "{Name} is right, and I'd add..."
   - Respectful disagreement: "I see this differently than {Name}..."
   - Direct questions between personas are encouraged

5. **Rhythm**: After each round of 2-3 personas, pause and wait for the user's response before continuing. Do not chain multiple rounds without user input.

6. **Questions to user**: When a persona asks the user something, it ends their turn. Wait for the user's response.

7. **Language**: Respond in the same language the user writes in.

8. **Exit**: When the user says "exit", "quit", "end roundtable", or equivalent:
   - Have 2-3 of the most active personas give a brief, in-character farewell
   - Summarize the key discussion points
   - Then close with a **Questions for you** section: collect all the questions raised by personas throughout the discussion, reformulate them clearly if needed, and present them in a warm, conversational tone — indicating who asked each one. Format:

   ---
   💬 **A few questions the team would love your thoughts on:**

   {icon} **{name}** wonders: {reformulated question}
   {icon} **{name}** also asked: {reformulated question}
   ...

   No need to answer them all — just the ones that feel most useful to explore!

   - If the user responds to any of these questions, **do not end roundtable** — resume the discussion with the same personas and treat the response as a new message in the conversation loop.
   - Only end roundtable if the user explicitly confirms they want to stop (e.g. "yes, done", "that's all", "goodbye").`;
}
