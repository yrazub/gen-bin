import { resolve } from 'node:path';
import { CatalogFailure } from './errors';
import type { Ctx } from './files';
import { readChangelog } from './read-changelog';
import { readComponents } from './read-components';
import { readMarketplace } from './read-marketplace';
import type { Artifact, Catalog, Plugin } from './types';
import { validateCatalog } from './validate';

export * from './types';
export { CatalogError, CatalogFailure } from './errors';

const cache = new Map<string, Catalog>();

/** Reads the marketplace at `root` once per build; `CATALOG_ROOT` is for tests only (NFR-9). */
export function loadCatalog(root: string = process.env.CATALOG_ROOT ?? '..'): Catalog {
  const key = resolve(root);
  let catalog = cache.get(key);
  if (!catalog) {
    catalog = buildCatalog(key);
    cache.set(key, catalog);
  }
  return catalog;
}

export function clearCatalogCache(): void {
  cache.clear();
}

export function buildCatalog(root: string): Catalog {
  const ctx: Ctx = { root, marketplace: 'gen-bin', errors: [], warnings: [] };
  const bases = readMarketplace(ctx);

  const plugins: Plugin[] = [];
  const artifacts: Artifact[] = [];
  for (const base of bases) {
    const { manifest: _manifest, ...fields } = base;
    const local = base.source.kind === 'local' ? readComponents(ctx, base, base.source) : undefined;
    const components = local?.artifacts ?? [];
    const plugin: Plugin = {
      ...fields,
      readme: local?.readme,
      components,
      runs: {
        inspectable: !!local,
        hooks: components
          .filter((a) => a.type === 'hook')
          .map((a) => ({ event: a.event ?? '', matcher: a.matcher, command: a.command ?? '', file: a.file })),
        mcpServers: components
          .filter((a) => a.type === 'mcp')
          .map((a) => ({ name: a.name, command: a.command, url: a.url, file: a.file })),
        bin: local?.bin ?? [],
        agents: components
          .filter((a) => a.type === 'agent')
          .map((a) => ({ name: a.name, tools: a.tools ?? [], model: a.model })),
      },
    };
    plugins.push(plugin);
    artifacts.push(
      {
        type: 'plugin',
        name: plugin.name,
        plugin: plugin.name,
        description: plugin.description,
        invocable: `${plugin.name}@${ctx.marketplace}`,
        file: plugin.source.kind === 'local' ? plugin.source.dir : plugin.file,
        body: (plugin.readme ?? '').trim().slice(0, 2000),
        tags: plugin.tags,
        version: plugin.version,
      },
      ...components,
    );
  }

  ctx.errors.push(...validateCatalog({ plugins }));
  if (ctx.errors.length) throw new CatalogFailure(ctx.errors);

  const releases = readChangelog(ctx);
  for (const w of ctx.warnings) console.warn(`[catalog] ${w}`);
  return { marketplace: ctx.marketplace, plugins, artifacts, releases, warnings: ctx.warnings };
}
