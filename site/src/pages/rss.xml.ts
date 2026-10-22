import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { loadCatalog } from '../lib/catalog';
import { releaseHtml } from '../lib/releases';
import { commitSha } from '../lib/repo';
import { url } from '../lib/url';

export function GET(context: APIContext) {
  const catalog = loadCatalog();
  const sha = commitSha();
  const known = new Set(catalog.plugins.map((p) => p.name));
  return rss({
    title: 'gen-bin releases',
    description: 'New versions of the plugins in the gen-bin Claude Code marketplace',
    site: new URL(url(), context.site ?? 'https://yrazub.github.io'),
    items: catalog.releases.map((r) => ({
      title: `${r.plugin} ${r.version}`,
      ...(r.date ? { pubDate: new Date(`${r.date}T00:00:00Z`) } : {}),
      // A removed or renamed plugin has no page, so its entry points at the release list (EC-10).
      link: known.has(r.plugin) ? url(`plugins/${r.plugin}/`) : url('whats-new/'),
      description: r.sections.flatMap((s) => s.items.map((i) => `${s.heading}: ${i}`)).join('\n'),
      content: releaseHtml(r, sha, 0),
    })),
  });
}
