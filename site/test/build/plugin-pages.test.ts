import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildFixture, dist, text, type Dist } from './helpers';

const fixtures = fileURLToPath(new URL('../fixtures', import.meta.url));
let basic: Dist;
let lone: Dist;
let external: Dist;
let wordy: Dist;
let duplicates: Dist;

beforeAll(() => {
  basic = dist(buildFixture('basic'));
  lone = dist(buildFixture('no-manifest'));
  external = dist(buildFixture('external'));
  wordy = dist(buildFixture('long-description'));
  duplicates = dist(buildFixture('duplicates'));
});

const page = (d: Dist, name: string) => d.read(`plugins/${name}/index.html`);

describe('plugin pages', () => {
  it('AC-12: one page per plugin, reachable from the plugin card and from every artifact card', () => {
    const home = basic.read('index.html');
    for (const name of ['sdd-workflow', 'pr-review', 'node-backend', 'react-frontend']) {
      expect(basic.has(`plugins/${name}/index.html`)).toBe(true);
      expect(home).toContain(`href="/gen-bin/plugins/${name}/"`);
    }
    const { cards } = JSON.parse(basic.read('search-index.json'));
    expect(cards).toHaveLength(18);
    for (const card of cards) {
      expect(card.pluginHref).toMatch(/^\/gen-bin\/plugins\/[\w-]+\/$/);
      expect(basic.has(card.pluginHref.replace('/gen-bin/', '') + 'index.html')).toBe(true);
    }
  });

  it('AC-13: shows name, description, version, author, licence and the README as HTML', () => {
    const html = page(basic, 'sdd-workflow');
    const t = text(html);
    expect(html).toMatch(/<h1[^>]*>SDD workflow<\/h1>/);
    expect(t).toContain('Spec-driven development: spec, plan and build a feature with agents.');
    expect(t).toContain('v0.1.0');
    expect(t).toContain('By yrazub');
    expect(t).toContain('License: MIT');
    expect(html).toMatch(/<h3>SDD workflow<\/h3>/);
    expect(html).toContain('href="https://github.com/yrazub/gen-bin/blob/');
    expect(html).toContain('/plugins/sdd-workflow/docs/guide.md"');
    expect(html).toContain('src="https://raw.githubusercontent.com/yrazub/gen-bin/');
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it('AC-14: lists every component with its invocable name and description', () => {
    const t = text(page(basic, 'sdd-workflow'));
    for (const s of [
      'spec-creator', '@agent-sdd-workflow:spec-creator', 'Turns a feature request into a spec',
      'implementer', '@agent-sdd-workflow:implementer', 'Builds one phase of an approved plan',
      'execute-plan', '/sdd-workflow:execute-plan', 'Executes an approved implementation plan',
      'engineering-insights', '/sdd-workflow:engineering-insights',
      'PreToolUse · Write|Edit', 'SessionStart',
    ]) {
      expect(t).toContain(s);
    }
    expect(t).toContain('2 skills · 2 agents · 2 hooks');
    const pr = text(page(basic, 'pr-review'));
    expect(pr).toContain('/pr-review:review-pr');
    expect(pr).toContain('devdigest');
  });

  it('AC-15: shows the three install commands', () => {
    const t = text(page(basic, 'node-backend'));
    expect(t).toContain('/plugin marketplace add yrazub/gen-bin');
    expect(t).toContain('/plugin install node-backend@gen-bin');
    expect(t).toContain('claude plugin install node-backend@gen-bin');
  });

  it('AC-16: links dependencies that are gen-bin plugins and lists the others as text', () => {
    const html = page(basic, 'react-frontend');
    expect(html).toMatch(/<a href="\/gen-bin\/plugins\/node-backend\/"[^>]*>node-backend<\/a>/);
    expect(html).toContain('left-pad-plugin');
    expect(html).not.toMatch(/<a [^>]*>left-pad-plugin/);
    expect(text(html)).toContain('^1.0.0');
    expect(page(basic, 'node-backend')).not.toContain('Dependencies');
  });

  it('AC-17: the runs panel lists hooks, MCP servers, bin files, and agent tools and models', () => {
    const sdd = text(page(basic, 'sdd-workflow'));
    expect(sdd).toContain('What this plugin runs');
    expect(sdd).toContain('PreToolUse');
    expect(sdd).toContain('matcher: Write|Edit');
    expect(sdd).toContain('${CLAUDE_PLUGIN_ROOT}/scripts/block-paths.sh');
    expect(sdd).toContain('node ${CLAUDE_PLUGIN_ROOT}/scripts/announce.mjs --quiet');
    expect(sdd).toContain('Read, Grep, Glob, Edit, Write, Bash, Skill');
    expect(sdd).toMatch(/implementer sonnet/);
    expect(sdd).toContain('2 agents can edit files · 1 can run shell commands');

    expect(text(page(basic, 'pr-review'))).toContain('node ${CLAUDE_PLUGIN_ROOT}/scripts/devdigest-mcp.mjs');
    expect(text(page(basic, 'node-backend'))).toContain('gen-schema');
    expect(text(page(basic, 'node-backend'))).toContain('1 agent can use the web');
  });

  it('AC-18: a plugin with nothing to run says so and still lists agent tools', () => {
    const t = text(page(lone, 'lone-agent'));
    expect(t).toContain('This plugin runs no hooks, MCP servers or executables.');
    expect(t).toContain('scout haiku Read, Grep');
    expect(t).not.toContain('matcher:');
  });

  it('AC-19: shows this plugin\'s release notes, newest first', () => {
    const html = page(basic, 'node-backend');
    const t = text(html);
    expect(t.indexOf('0.2.0')).toBeGreaterThan(-1);
    expect(t.indexOf('0.2.0')).toBeLessThan(t.indexOf('0.1.0'));
    expect(t).toContain('Drizzle ORM patterns skill');
    expect(t).toContain('Fastify best-practices skill');
    expect(t).not.toContain('React best-practices skill');
    expect(html).toContain('href="/gen-bin/whats-new/"');
  });

  it('EC-3: a plugin without a README omits the README section', () => {
    expect(page(lone, 'lone-agent')).not.toContain('>README<');
    expect(page(basic, 'sdd-workflow')).toContain('>README<');
    expect(text(page(lone, 'lone-agent'))).toContain('scout');
  });

  it('EC-4: a plugin without a version shows "unversioned"', () => {
    const t = text(page(duplicates, 'alpha'));
    expect(t).toContain('unversioned');
  });

  it('EC-6: an external plugin shows a notice, its source link and an uninspectable panel', () => {
    const html = page(external, 'remote-tool');
    const t = text(html);
    expect(t).toContain('Contents are hosted outside this repository');
    expect(html).toContain('href="https://github.com/someone/remote-tool"');
    expect(t).toContain("what it runs can't be inspected here");
    expect(t).not.toContain('This plugin runs no hooks');
    expect(t).not.toContain('Contents Skills');
    const { cards } = JSON.parse(external.read('search-index.json'));
    expect(cards).toHaveLength(1);
  });

  it('EC-7: a long description is whole on the page and cut on the card', () => {
    expect(text(page(wordy, 'wordy'))).toContain('tau ENDMARK');
    const { cards } = JSON.parse(wordy.read('search-index.json'));
    const card = cards.find((c: { type: string }) => c.type === 'plugin');
    const source = JSON.parse(readFileSync(join(fixtures, 'long-description/.claude-plugin/marketplace.json'), 'utf8'));
    const full: string = source.plugins[0].description;
    expect(full.length).toBeGreaterThan(200);
    expect(card.description).toBe(`${full.slice(0, 200).trimEnd()}…`);
    expect(card.description).not.toContain('ENDMARK');
    expect(card.description.length).toBeLessThanOrEqual(201);
    expect(text(wordy.read('index.html'))).not.toContain('ENDMARK');
  });

  it('AC-31: every internal link and asset sits under /gen-bin/', () => {
    for (const path of ['index.html', 'plugins/sdd-workflow/index.html', 'plugins/react-frontend/index.html']) {
      const html = basic.read(path);
      const urls = [...html.matchAll(/\b(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]);
      expect(urls.length).toBeGreaterThan(3);
      for (const u of urls) expect(u.startsWith('/gen-bin/'), `${path}: ${u}`).toBe(true);
    }
  });
});

