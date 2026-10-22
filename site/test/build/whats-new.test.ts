import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildFrom, dist, text, type Dist } from './helpers';

const basicFixture = fileURLToPath(new URL('../fixtures/basic', import.meta.url));

/**
 * A copy of the basic fixture with a real git history, so release dates are known:
 * sdd-workflow and a since-removed plugin on 2026-01-10, pr-review 02-10, node-backend 0.1.0 03-10,
 * node-backend 0.2.0 04-10, and react-frontend 0.1.0 left uncommitted (Unreleased).
 */
function releaseRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'site-releases-'));
  cpSync(basicFixture, root, { recursive: true });
  const sections: Record<string, string> = {
    'react-frontend': '## react-frontend 0.1.0\n\n### New\n- React best-practices skill\n- Handles <script>alert(1)</script> inline\n',
    'node-backend 0.2.0': '## node-backend 0.2.0\n\n### New\n- Drizzle ORM patterns skill\n\n### Fixed\n- Fastify skill fix\n',
    'node-backend 0.1.0': '## node-backend 0.1.0\n\n### New\n- Fastify best-practices skill\n',
    'pr-review': '## pr-review 0.1.0\n\n### New\n- Architecture reviewer agent\n',
    'sdd-workflow': '## sdd-workflow 0.1.0\n\n### New\n- Spec creator agent\n',
    'removed-plugin': '## removed-plugin 1.0.0\n\n### Changed\n- Was renamed away\n',
  };
  const write = (keys: string[]) =>
    writeFileSync(join(root, 'CHANGELOG.md'), `# Changelog\n\n${keys.map((k) => sections[k]).join('\n')}`);
  const git = (date: string | undefined, ...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      cwd: root,
      stdio: 'ignore',
      env: { ...process.env, ...(date ? { GIT_AUTHOR_DATE: `${date}T12:00:00Z`, GIT_COMMITTER_DATE: `${date}T12:00:00Z` } : {}) },
    });
  git(undefined, 'init', '-q');
  const stages: [string, string[]][] = [
    ['2026-01-10', ['sdd-workflow', 'removed-plugin']],
    ['2026-02-10', ['pr-review', 'sdd-workflow', 'removed-plugin']],
    ['2026-03-10', ['node-backend 0.1.0', 'pr-review', 'sdd-workflow', 'removed-plugin']],
    ['2026-04-10', ['node-backend 0.2.0', 'node-backend 0.1.0', 'pr-review', 'sdd-workflow', 'removed-plugin']],
  ];
  for (const [date, keys] of stages) {
    write(keys);
    git(date, 'add', '.');
    git(date, 'commit', '-q', '-m', `release ${date}`);
  }
  write(['react-frontend', 'node-backend 0.2.0', 'node-backend 0.1.0', 'pr-review', 'sdd-workflow', 'removed-plugin']);
  return root;
}

let site: Dist;
let html: string;
let feed: string;

beforeAll(() => {
  site = dist(buildFrom(releaseRoot(), 'releases'));
  html = site.read('whats-new/index.html');
  feed = site.read('rss.xml');
});

const order = [
  ['react-frontend', '0.1.0'],
  ['node-backend', '0.2.0'],
  ['node-backend', '0.1.0'],
  ['pr-review', '0.1.0'],
  ['sdd-workflow', '0.1.0'],
  ['removed-plugin', '1.0.0'],
];

const rows = () => html.split('<li class="release"').slice(1);

describe("What's new", () => {
  it('AC-25: lists every release newest first with plugin, version, date and notes', () => {
    const list = rows();
    expect(list).toHaveLength(6);
    list.forEach((row, i) => {
      const t = text(row);
      expect(t).toContain(order[i][0]);
      expect(t).toContain(order[i][1]);
    });
    expect(text(list[0])).toContain('Unreleased');
    expect(list[0]).not.toContain('<time');
    expect(list[1]).toContain('<time datetime="2026-04-10"');
    expect(text(list[1])).toContain('10 Apr 2026');
    expect(list[2]).toContain('datetime="2026-03-10"');
    expect(list[3]).toContain('datetime="2026-02-10"');
    expect(list[4]).toContain('datetime="2026-01-10"');
    expect(list[1]).toMatch(/<h3>New<\/h3>[\s\S]*Drizzle ORM patterns skill[\s\S]*<h3>Fixed<\/h3>[\s\S]*Fastify skill fix/);
  });

  it('marks each plugin\'s newest release as Latest', () => {
    const latest = rows().map((r) => r.includes('>Latest<'));
    expect(latest).toEqual([true, true, false, true, true, true]);
  });

  it('EC-10: a plugin that is no longer in the catalog keeps its entry without a link', () => {
    const removed = rows()[5];
    expect(text(removed)).toContain('removed-plugin');
    expect(text(removed)).toContain('Was renamed away');
    expect(removed).not.toContain('/plugins/removed-plugin/');
    expect(rows()[1]).toContain('href="/gen-bin/plugins/node-backend/"');
  });

  it('links the feed, mentions auto-update and shows the update command', () => {
    const t = text(html);
    expect(html).toContain('href="/gen-bin/rss.xml"');
    expect(t).toContain('Auto-update is off by default');
    expect(t).toContain('/plugin marketplace update gen-bin');
  });

  it('shows an empty state when there are no releases', () => {
    const empty = dist(buildFrom(fileURLToPath(new URL('../fixtures/empty', import.meta.url)), 'empty'));
    expect(text(empty.read('whats-new/index.html'))).toContain('No releases yet');
    expect(empty.read('rss.xml')).not.toContain('<item>');
  });
});

describe('RSS feed', () => {
  const items = () => feed.split('<item>').slice(1);

  it('AC-26: is a feed with one item per release, titled <plugin> <version>', () => {
    expect(feed.startsWith('<?xml')).toBe(true);
    expect(feed).toMatch(/<rss [^>]*version="2.0"/);
    expect(feed.trimEnd().endsWith('</rss>')).toBe(true);
    expect(items()).toHaveLength(6);
    const titles = items().map((i) => /<title>([^<]*)<\/title>/.exec(i)![1]);
    expect(titles).toEqual(order.map(([p, v]) => `${p} ${v}`));
  });

  it('AC-26: carries the release date and a link to the plugin page', () => {
    const [unreleased, node02, , , , removed] = items();
    expect(unreleased).not.toContain('<pubDate>');
    expect(node02).toContain('<pubDate>Fri, 10 Apr 2026 00:00:00 GMT</pubDate>');
    expect(node02).toContain('<link>https://yrazub.github.io/gen-bin/plugins/node-backend/</link>');
    // EC-10: nothing to link to, so the entry points at the release list
    expect(removed).toContain('<link>https://yrazub.github.io/gen-bin/whats-new/</link>');
  });

  it('AC-26: carries the notes as escaped HTML and never raw markup', () => {
    const [unreleased, node02] = items();
    expect(node02).toContain('<content:encoded>&lt;h3&gt;New&lt;/h3&gt;');
    expect(unreleased).not.toMatch(/<script|onerror/i);
    expect(unreleased).not.toContain('alert(1)</script>');
    expect(feed.match(/<content:encoded>/g)).toHaveLength(6);
  });
});

describe('feed autodiscovery', () => {
  const pages = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? pages(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : [],
    );

  it('AC-38: every page links the feed in its <head>', () => {
    const all = pages(site.dir);
    expect(all.length).toBeGreaterThanOrEqual(7);
    for (const file of all) {
      const head = /<head>([\s\S]*?)<\/head>/.exec(readFileSync(file, 'utf8'))![1];
      expect(head, file).toMatch(/<link rel="alternate" type="application\/rss\+xml"[^>]*href="\/gen-bin\/rss\.xml"/);
    }
  });
});
