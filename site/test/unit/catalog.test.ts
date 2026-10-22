import { execFileSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCatalog, CatalogFailure } from '../../src/lib/catalog';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

const failure = (name: string): CatalogFailure => {
  try {
    buildCatalog(fixture(name));
  } catch (e) {
    if (e instanceof CatalogFailure) return e;
    throw e;
  }
  throw new Error(`${name} should have failed`);
};

describe('catalog extraction', () => {
  const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => {});
  afterEach(() => vi.restoreAllMocks());

  it('AC-1: indexes every component type of the basic fixture', () => {
    quiet();
    const c = buildCatalog(fixture('basic'));
    const count = (type: string) => c.artifacts.filter((a) => a.type === type).length;
    expect(c.plugins.map((p) => p.name)).toEqual(['sdd-workflow', 'pr-review', 'node-backend', 'react-frontend']);
    expect({
      plugin: count('plugin'),
      skill: count('skill'),
      agent: count('agent'),
      command: count('command'),
      hook: count('hook'),
      mcp: count('mcp'),
    }).toEqual({ plugin: 4, skill: 6, agent: 4, command: 1, hook: 2, mcp: 1 });
  });

  it('names invocables per type and keeps hooks as event + matcher', () => {
    quiet();
    const c = buildCatalog(fixture('basic'));
    const by = (name: string) => c.artifacts.find((a) => a.name === name)!;
    expect(by('sdd-workflow').invocable).toBe('sdd-workflow@gen-bin');
    expect(by('execute-plan').invocable).toBe('/sdd-workflow:execute-plan');
    expect(by('spec-creator').invocable).toBe('@agent-sdd-workflow:spec-creator');
    expect(by('review-pr').invocable).toBe('/pr-review:review-pr');
    const hook = by('block-paths.sh');
    expect(hook).toMatchObject({ type: 'hook', event: 'PreToolUse', matcher: 'Write|Edit', invocable: 'PreToolUse · Write|Edit' });
    expect(hook.description).toBe('${CLAUDE_PLUGIN_ROOT}/scripts/block-paths.sh');
    expect(by('announce.mjs')).toMatchObject({ event: 'SessionStart', invocable: 'SessionStart' });
  });

  it('reads real frontmatter shapes: multi-line descriptions, tools, model, ignored hooks key', () => {
    quiet();
    const c = buildCatalog(fixture('basic'));
    const spec = c.artifacts.find((a) => a.name === 'spec-creator')!;
    expect(spec.description).toBe(
      'Use proactively when a feature needs a written specification before any plan or code exists. Turns a feature request into a spec with EARS acceptance criteria.',
    );
    expect(spec).toMatchObject({ tools: ['Read', 'Grep', 'Glob', 'Write', 'Edit'], model: 'opus' });
    expect(c.artifacts.find((a) => a.name === 'engineering-insights')!.invocable).toBe('/sdd-workflow:engineering-insights');
  });

  it('builds the runs panel and the plugin fields', () => {
    quiet();
    const c = buildCatalog(fixture('basic'));
    const sdd = c.plugins[0];
    expect(sdd).toMatchObject({ displayName: 'SDD workflow', version: '0.1.0', author: 'yrazub', license: 'MIT' });
    expect(sdd.runs.hooks.map((h) => h.event)).toEqual(['PreToolUse', 'SessionStart']);
    expect(sdd.runs.agents.find((a) => a.name === 'implementer')!.tools).toContain('Bash');
    expect(c.plugins[1].runs.mcpServers).toMatchObject([{ name: 'devdigest', command: 'node ${CLAUDE_PLUGIN_ROOT}/scripts/devdigest-mcp.mjs' }]);
    expect(c.plugins[2].runs.bin).toEqual(['gen-schema']);
    expect(c.plugins[3].dependencies).toEqual([{ name: 'node-backend' }, { name: 'left-pad-plugin', version: '^1.0.0' }]);
    expect(sdd.readme).toContain('# SDD workflow');
  });

  it('caps body text at 2,000 characters', () => {
    quiet();
    const root = mkdtempSync(join(tmpdir(), 'catalog-'));
    cpSync(fixture('basic'), root, { recursive: true });
    appendFileSync(join(root, 'plugins/node-backend/skills/fastify-best-practices/SKILL.md'), 'x'.repeat(5000));
    const c = buildCatalog(root);
    expect(c.artifacts.find((a) => a.name === 'fastify-best-practices')!.body).toHaveLength(2000);
    rmSync(root, { recursive: true });
  });

  it('AC-30: the empty fixture builds an empty catalog', () => {
    const c = buildCatalog(fixture('empty'));
    expect(c).toMatchObject({ plugins: [], artifacts: [], releases: [] });
  });

  it('EC-2, EC-4: a plugin without plugin.json uses its catalog entry; a missing version is "unversioned"', () => {
    const c = buildCatalog(fixture('no-manifest'));
    expect(c.plugins[0]).toMatchObject({ name: 'lone-agent', version: '0.3.0', description: 'A plugin that only has a catalog entry.' });
    expect(c.plugins[0].file).toBe('.claude-plugin/marketplace.json');
    expect(c.plugins[0].runs).toMatchObject({ hooks: [], mcpServers: [], bin: [] });
    expect(c.plugins[0].readme).toBeUndefined();

    quiet();
    const unversioned = buildCatalog(fixture('duplicates'));
    expect(unversioned.plugins[0].version).toBe('unversioned');
  });

  it('EC-5: the same skill name in two plugins gives two entries with distinct invocables', () => {
    const c = buildCatalog(fixture('duplicates'));
    const reviews = c.artifacts.filter((a) => a.type === 'skill' && a.name === 'review');
    expect(reviews.map((a) => [a.plugin, a.invocable])).toEqual([
      ['alpha', '/alpha:review'],
      ['beta', '/beta:review'],
    ]);
  });

  it('EC-6: an external entry yields the plugin only, from its catalog fields', () => {
    const c = buildCatalog(fixture('external'));
    expect(c.artifacts).toHaveLength(1);
    expect(c.plugins[0]).toMatchObject({
      name: 'remote-tool',
      source: { kind: 'external', type: 'github', link: 'https://github.com/someone/remote-tool' },
      components: [],
      runs: { inspectable: false },
    });
  });

  it('EC-6: a relative source that escapes the root is external', () => {
    const root = mkdtempSync(join(tmpdir(), 'catalog-'));
    cpSync(fixture('external'), root, { recursive: true });
    const manifest = join(root, '.claude-plugin/marketplace.json');
    const json = JSON.parse(readFileSync(manifest, 'utf8'));
    json.plugins[0].source = './../outside';
    writeFileSync(manifest, JSON.stringify(json));
    expect(buildCatalog(root).plugins[0].source.kind).toBe('external');
    rmSync(root, { recursive: true });
  });

  it('EC-13: broken YAML fails the build and names the file', () => {
    const f = failure('broken-yaml');
    expect(f.errors).toHaveLength(1);
    expect(f.message).toContain('plugins/broken/skills/bad/SKILL.md');
    expect(f.message).toContain('invalid frontmatter');
  });

  it('AC-29: missing descriptions fail the build, naming every file', () => {
    const f = failure('missing-description');
    expect(f.errors.map((e) => e.file).sort()).toEqual([
      'plugins/a/agents/g.md',
      'plugins/a/commands/c.md',
      'plugins/a/skills/s/SKILL.md',
      'plugins/b/.claude-plugin/plugin.json',
    ]);
  });

  describe('release dates (EC-16, EC-17)', () => {
    const dirs: string[] = [];
    const copy = () => {
      const root = mkdtempSync(join(tmpdir(), 'catalog-'));
      dirs.push(root);
      cpSync(fixture('basic'), root, { recursive: true });
      return root;
    };
    afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

    it('dates committed entries and shows an uncommitted one as Unreleased', () => {
      const warn = quiet();
      const root = copy();
      const git = (...args: string[]) =>
        execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: root, stdio: 'ignore' });
      git('init', '-q');
      git('add', '.');
      git('commit', '-q', '-m', 'init');
      appendFileSync(join(root, 'CHANGELOG.md'), '\n## sdd-workflow 0.2.0\n\n### New\n- Something fresh\n');

      const { releases } = buildCatalog(root);
      const fresh = releases.find((r) => r.version === '0.2.0')!;
      expect(fresh.date).toBeNull();
      expect(releases[0]).toBe(fresh);
      const committed = releases.filter((r) => r !== fresh);
      expect(committed).toHaveLength(5);
      for (const r of committed) expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('sdd-workflow 0.2.0'));
    });

    it('builds outside a git checkout and shows every date as Unreleased', () => {
      const warn = quiet();
      const { releases, warnings } = buildCatalog(copy());
      expect(releases.map((r) => r.date)).toEqual(Array(5).fill(null));
      expect(warnings).toHaveLength(5);
      expect(warn).toHaveBeenCalledTimes(5);
    });

    it('parses entries into sections', () => {
      quiet();
      const nb = buildCatalog(copy()).releases.find((r) => r.plugin === 'node-backend' && r.version === '0.2.0')!;
      expect(nb.sections).toEqual([
        { heading: 'New', items: ['Drizzle ORM patterns skill'] },
        { heading: 'Fixed', items: ['Fastify skill no longer suggests the removed `reply.sent` flag'] },
      ]);
    });
  });
});
