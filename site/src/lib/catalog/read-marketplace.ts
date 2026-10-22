import { isAbsolute, join, resolve, sep } from 'node:path';
import { CatalogError } from './errors';
import { asRecord, asString, asStrings, isFile, readJson, rel, type Ctx } from './files';
import type { Dependency, PluginSource } from './types';

export interface PluginBase {
  name: string;
  displayName: string;
  description: string;
  version: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  tags: string[];
  dependencies: Dependency[];
  source: PluginSource;
  file: string;
  /** Parsed plugin.json, for the hooks and mcpServers it may declare. */
  manifest: Record<string, unknown>;
}

const MANIFEST = '.claude-plugin/marketplace.json';

export function readMarketplace(ctx: Ctx): PluginBase[] {
  const abs = join(ctx.root, MANIFEST);
  if (!isFile(abs)) throw new CatalogError(MANIFEST, 'file not found');
  const json = readJson(ctx, abs);
  const root = asRecord(json);
  if (!root) throw new CatalogError(MANIFEST, 'expected a JSON object with a "plugins" array');
  ctx.marketplace = asString(root.name) ?? ctx.marketplace;
  const entries = Array.isArray(root.plugins) ? root.plugins : [];
  const out: PluginBase[] = [];
  entries.forEach((raw, i) => {
    const entry = asRecord(raw);
    const name = asString(entry?.name);
    if (!entry || !name) {
      ctx.errors.push(new CatalogError(MANIFEST, `plugins[${i}] has no name`));
      return;
    }
    out.push(resolveEntry(ctx, entry, name));
  });
  return out;
}

function resolveEntry(ctx: Ctx, entry: Record<string, unknown>, name: string): PluginBase {
  const source = resolveSource(ctx, entry.source);
  let manifest: Record<string, unknown> = {};
  let file = MANIFEST;
  if (source.kind === 'local') {
    const manifestAbs = join(ctx.root, source.dir, '.claude-plugin', 'plugin.json');
    if (isFile(manifestAbs)) {
      manifest = asRecord(readJson(ctx, manifestAbs)) ?? {};
      file = rel(ctx, manifestAbs);
    }
  }
  // plugin.json wins over the catalog entry; without one the entry is the manifest (EC-2).
  const merged = { ...entry, ...manifest };
  return {
    name,
    displayName: asString(merged.displayName) ?? name,
    description: asString(merged.description) ?? '',
    version: asString(merged.version) ?? 'unversioned',
    author: author(merged.author),
    license: asString(merged.license),
    homepage: asString(merged.homepage),
    repository: repository(merged.repository),
    tags: [...new Set([...asStrings(merged.keywords), ...asStrings(merged.tags)])],
    dependencies: dependencies(merged.dependencies),
    source,
    file,
    manifest,
  };
}

function resolveSource(ctx: Ctx, raw: unknown): PluginSource {
  if (typeof raw === 'string' && raw.startsWith('./')) {
    const abs = resolve(ctx.root, raw);
    if (!isAbsolute(raw) && abs.startsWith(ctx.root + sep)) return { kind: 'local', dir: rel(ctx, abs) };
    return { kind: 'external', type: 'path' };
  }
  const obj = asRecord(raw);
  const type = asString(obj?.source) ?? 'unknown';
  return { kind: 'external', type, link: externalLink(type, obj) };
}

function externalLink(type: string, obj: Record<string, unknown> | undefined): string | undefined {
  if (!obj) return undefined;
  const repo = asString(obj.repo);
  const url = asString(obj.url);
  const pkg = asString(obj.package);
  const link =
    type === 'github' && repo ? `https://github.com/${repo}` : url ? url : type === 'npm' && pkg ? `https://www.npmjs.com/package/${pkg}` : undefined;
  return link && /^https?:\/\//.test(link) ? link : undefined;
}

function author(v: unknown): string | undefined {
  return asString(v) ?? asString(asRecord(v)?.name);
}

function repository(v: unknown): string | undefined {
  return asString(v) ?? asString(asRecord(v)?.url);
}

function dependencies(v: unknown): Dependency[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((d): Dependency[] => {
    const name = asString(d) ?? asString(asRecord(d)?.name);
    if (!name) return [];
    const version = asString(asRecord(d)?.version);
    return [version ? { name, version } : { name }];
  });
}
