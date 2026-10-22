import { readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { CatalogError } from './errors';
import { asRecord, asString, asStrings, isDir, isFile, listFiles, posix, readJson, rel, type Ctx } from './files';
import { parseFrontmatter } from './frontmatter';
import type { PluginBase } from './read-marketplace';
import { BODY_LIMIT, type Artifact, type ArtifactType, type PluginSource } from './types';

export interface Components {
  artifacts: Artifact[];
  readme?: string;
  bin: string[];
}

const cap = (s: string): string => s.trim().slice(0, BODY_LIMIT);

export function readComponents(ctx: Ctx, base: PluginBase, source: Extract<PluginSource, { kind: 'local' }>): Components {
  const dir = join(ctx.root, source.dir);
  const artifact = (type: ArtifactType, name: string, file: string, extra: Partial<Artifact>): Artifact => ({
    type,
    name,
    plugin: base.name,
    description: '',
    invocable: name,
    file,
    body: '',
    tags: [],
    version: base.version,
    ...extra,
  });

  const artifacts: Artifact[] = [];

  const markdown = (abs: string, type: 'skill' | 'agent' | 'command', fallback: string): void => {
    const file = rel(ctx, abs);
    try {
      const { data, body } = parseFrontmatter(readFileSync(abs, 'utf8'), file);
      const name = asString(data.name) ?? fallback;
      const invocable =
        type === 'agent' ? `@agent-${base.name}:${name}` : `/${base.name}:${name}`;
      const extra: Partial<Artifact> = { description: asString(data.description) ?? '', invocable, body: cap(body) };
      if (type === 'agent') {
        extra.tools = asStrings(data.tools);
        extra.model = asString(data.model);
      }
      artifacts.push(artifact(type, name, file, extra));
    } catch (e) {
      if (e instanceof CatalogError) ctx.errors.push(e);
      else throw e;
    }
  };

  const skillsDir = join(dir, 'skills');
  if (isDir(skillsDir)) {
    for (const entry of readdirSync(skillsDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const skill = join(skillsDir, entry.name, 'SKILL.md');
      if (entry.isDirectory() && isFile(skill)) markdown(skill, 'skill', entry.name);
    }
  }
  for (const abs of listFiles(join(dir, 'agents'), '.md')) {
    markdown(abs, 'agent', basename(abs, '.md'));
  }
  for (const abs of listFiles(join(dir, 'commands'), '.md')) {
    const name = posix(relative(join(dir, 'commands'), abs)).replace(/\.md$/, '').split('/').join(':');
    markdown(abs, 'command', name);
  }

  artifacts.push(...hooks(ctx, base, dir, artifact), ...mcpServers(ctx, base, dir, artifact));

  const readmeAbs = join(dir, 'README.md');
  const binDir = join(dir, 'bin');
  const bin = isDir(binDir)
    ? readdirSync(binDir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name).sort()
    : [];
  return { artifacts, readme: isFile(readmeAbs) ? readFileSync(readmeAbs, 'utf8') : undefined, bin };
}

type Make = (type: ArtifactType, name: string, file: string, extra: Partial<Artifact>) => Artifact;

/** hooks/hooks.json and plugin.json `hooks`: one artifact per event + matcher. */
function hooks(ctx: Ctx, base: PluginBase, dir: string, make: Make): Artifact[] {
  const sources: { file: string; json: unknown }[] = [];
  const hooksFile = join(dir, 'hooks', 'hooks.json');
  if (isFile(hooksFile)) sources.push({ file: rel(ctx, hooksFile), json: readJson(ctx, hooksFile) });
  const declared = base.manifest.hooks;
  for (const d of Array.isArray(declared) ? declared : declared === undefined ? [] : [declared]) {
    if (typeof d === 'string') {
      const abs = join(dir, d);
      if (isFile(abs)) sources.push({ file: rel(ctx, abs), json: readJson(ctx, abs) });
    } else {
      sources.push({ file: base.file, json: d });
    }
  }

  const out: Artifact[] = [];
  for (const { file, json } of sources) {
    const root = asRecord(json);
    const events = asRecord(root?.hooks) ?? root ?? {};
    for (const [event, groups] of Object.entries(events)) {
      if (!Array.isArray(groups)) continue;
      for (const g of groups) {
        const group = asRecord(g);
        const matcher = asString(group?.matcher);
        const commands = (Array.isArray(group?.hooks) ? group.hooks : [])
          .map((h) => asString(asRecord(h)?.command) ?? asString(asRecord(h)?.url))
          .filter((c): c is string => !!c);
        if (!commands.length) continue;
        const command = commands.join('\n');
        out.push(
          make('hook', scriptName(commands[0]) ?? event, file, {
            description: command,
            command,
            event,
            matcher,
            invocable: matcher ? `${event} · ${matcher}` : event,
          }),
        );
      }
    }
  }
  return out;
}

function scriptName(command: string): string | undefined {
  const token = command.split(/\s+/).find((t) => !t.startsWith('-') && /[^\s/]+\.[A-Za-z0-9]+$/.test(t));
  return token ? basename(token) : undefined;
}

/** .mcp.json and plugin.json `mcpServers`. */
function mcpServers(ctx: Ctx, base: PluginBase, dir: string, make: Make): Artifact[] {
  const sources: { file: string; servers: Record<string, unknown> }[] = [];
  const mcpFile = join(dir, '.mcp.json');
  if (isFile(mcpFile)) {
    const json = asRecord(readJson(ctx, mcpFile));
    const servers = asRecord(json?.mcpServers) ?? json;
    if (servers) sources.push({ file: rel(ctx, mcpFile), servers });
  }
  const declared = base.manifest.mcpServers;
  if (typeof declared === 'string') {
    const abs = join(dir, declared);
    const json = asRecord(readJson(ctx, abs));
    const servers = asRecord(json?.mcpServers) ?? json;
    if (servers) sources.push({ file: rel(ctx, abs), servers });
  } else if (asRecord(declared)) {
    sources.push({ file: base.file, servers: declared as Record<string, unknown> });
  }

  const out: Artifact[] = [];
  for (const { file, servers } of sources) {
    for (const [name, raw] of Object.entries(servers)) {
      const server = asRecord(raw);
      if (!server) continue;
      const command = [asString(server.command), ...asStrings(server.args)].filter(Boolean).join(' ') || undefined;
      const url = asString(server.url);
      out.push(make('mcp', name, file, { description: command ?? url ?? '', command, url }));
    }
  }
  return out;
}
