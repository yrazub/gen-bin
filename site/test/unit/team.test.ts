import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSnippet } from '../../src/lib/team/snippet';
import { loadSelection, matchKnown, parseNames, parseStored, saveSelection } from '../../src/lib/team/selection';

const plugins = [
  { name: 'sdd-workflow', dependencies: [] },
  { name: 'pr-review', dependencies: [] },
  { name: 'node-backend', dependencies: [] },
  { name: 'react-frontend', dependencies: [{ name: 'node-backend' }, { name: 'left-pad-plugin' }] },
];

describe('buildSnippet', () => {
  it('AC-21: registers the marketplace and enables each selected plugin', () => {
    const s = buildSnippet(['pr-review', 'sdd-workflow'], plugins);
    expect(JSON.parse(s.json)).toEqual({
      extraKnownMarketplaces: { 'gen-bin': { source: { source: 'github', repo: 'yrazub/gen-bin' } } },
      enabledPlugins: { 'sdd-workflow@gen-bin': true, 'pr-review@gen-bin': true },
    });
    expect(s.json).toBe(
      [
        '{',
        '  "extraKnownMarketplaces": {',
        '    "gen-bin": {',
        '      "source": {',
        '        "source": "github",',
        '        "repo": "yrazub/gen-bin"',
        '      }',
        '    }',
        '  },',
        '  "enabledPlugins": {',
        '    "sdd-workflow@gen-bin": true,',
        '    "pr-review@gen-bin": true',
        '  }',
        '}',
      ].join('\n'),
    );
    expect(s).toMatchObject({ enabled: ['sdd-workflow', 'pr-review'], addedBy: {}, unknown: [] });
  });

  it('AC-22: adds a gen-bin dependency and says who needs it', () => {
    const s = buildSnippet(['react-frontend'], plugins);
    expect(s.enabled).toEqual(['node-backend', 'react-frontend']);
    expect(s.addedBy).toEqual({ 'node-backend': ['react-frontend'] });
    expect(JSON.parse(s.json).enabledPlugins).toEqual({
      'node-backend@gen-bin': true,
      'react-frontend@gen-bin': true,
    });
  });

  it('AC-22: a dependency that is also selected is not "added"', () => {
    const s = buildSnippet(['react-frontend', 'node-backend'], plugins);
    expect(s.enabled).toEqual(['node-backend', 'react-frontend']);
    expect(s.addedBy).toEqual({});
  });

  it('AC-22: follows dependencies of dependencies and survives cycles', () => {
    const chain = [
      { name: 'a', dependencies: [{ name: 'b@gen-bin' }] },
      { name: 'b', dependencies: [{ name: 'c' }, { name: 'a' }] },
      { name: 'c', dependencies: [{ name: 'x@other' }] },
    ];
    const s = buildSnippet(['a'], chain);
    expect(s.enabled).toEqual(['a', 'b', 'c']);
    expect(s.addedBy).toEqual({ b: ['a'], c: ['a'] });
  });

  it('EC-11: reports unknown names and leaves them out of the snippet', () => {
    const s = buildSnippet(['ghost', 'pr-review', 'ghost', '<script>'], plugins);
    expect(s.unknown).toEqual(['ghost', '<script>']);
    expect(s.enabled).toEqual(['pr-review']);
    expect(s.json).not.toContain('ghost');
  });

  it('an empty selection enables nothing', () => {
    const s = buildSnippet([], plugins);
    expect(s.enabled).toEqual([]);
    expect(JSON.parse(s.json).enabledPlugins).toEqual({});
  });
});

describe('selection', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses ?plugins= values', () => {
    expect(parseNames('a, b,,a')).toEqual(['a', 'b']);
    expect(parseNames(null)).toEqual([]);
    expect(parseNames('')).toEqual([]);
  });

  it('matches names against the catalog', () => {
    expect(matchKnown(['a', 'x', 'b'], ['a', 'b'])).toEqual({ selected: ['a', 'b'], unknown: ['x'] });
  });

  it('EC-18 style: stored values that are not a list of names are ignored', () => {
    expect(parseStored('{"a":1}')).toEqual([]);
    expect(parseStored('not json')).toEqual([]);
    expect(parseStored('["a", 1, null, "a"]')).toEqual(['a']);
    expect(parseStored(null)).toEqual([]);
  });

  it('EC-15: keeps the selection in memory when storage throws', () => {
    const blocked = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    };
    vi.stubGlobal('localStorage', blocked);
    expect(loadSelection(['a', 'b'])).toEqual([]);
    expect(() => saveSelection(['a', 'ghost'])).not.toThrow();
    expect(loadSelection(['a', 'b'])).toEqual(['a']);
  });

  it('EC-15: drops stored names that are no longer in the catalog', () => {
    const store = new Map<string, string>([['gen-bin:team', '["a","gone"]']]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    expect(loadSelection(['a', 'b'])).toEqual(['a']);
  });
});
