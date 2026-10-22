import MiniSearch from 'minisearch';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildCatalog } from '../../src/lib/catalog';
import { buildSearchData } from '../../src/lib/search/build';
import { highlightParts, queryTerms } from '../../src/lib/search/highlight';
import { miniSearchOptions } from '../../src/lib/search/options';
import type { SearchCard } from '../../src/lib/search/card';

let ms: MiniSearch;
let cards: SearchCard[];

beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const catalog = buildCatalog(fileURLToPath(new URL('../fixtures/basic', import.meta.url)));
  const data = buildSearchData(catalog, 'abc1234');
  cards = data.cards;
  // The same path the browser takes: serialise, then load with the shared options.
  ms = MiniSearch.loadJS(JSON.parse(JSON.stringify(data.index)), miniSearchOptions);
});

const names = (q: string) => ms.search(q).map((r) => cards[r.id].name);

describe('search index', () => {
  it('AC-1: holds one entry per artifact', () => {
    expect(ms.documentCount).toBe(18);
    expect(cards).toHaveLength(18);
  });

  it('AC-3: matches prefixes, case-insensitively', () => {
    expect(names('fasti')).toContain('fastify-best-practices');
    expect(names('FASTIFY')).toContain('fastify-best-practices');
  });

  it('AC-3: allows one typo from 5 letters, none below', () => {
    expect(names('fastofy')).toContain('fastify-best-practices');
    expect(names('reect')).toContain('react-best-practices');
    expect(names('nade')).toEqual([]);
  });

  it('AC-3: matches tags, the parent plugin name and body text', () => {
    expect(names('pull-request')).toContain('pr-review');
    expect(names('backend')).toContain('fastify-best-practices');
    expect(names('encapsulation')).toEqual(['fastify-best-practices']);
  });

  it('AC-3: all words of a query must match', () => {
    expect(names('fastify drizzle').sort()).toEqual(['drizzle-orm-patterns', 'node-backend']);
  });

  it('AC-4: ranks a name match above a description match above a body match', () => {
    const order = names('fastify');
    const at = (n: string) => order.indexOf(n);
    expect(order[0]).toBe('fastify-best-practices');
    expect(at('drizzle-orm-patterns')).toBeGreaterThan(-1);
    expect(at('node-backend')).toBeGreaterThan(-1);
    expect(at('react-best-practices')).toBeGreaterThan(Math.max(at('drizzle-orm-patterns'), at('node-backend')));
  });
});

describe('highlightParts', () => {
  it('AC-7: marks words that start with a query word', () => {
    expect(highlightParts('Fastify best practices', queryTerms('fasti pract'))).toEqual([
      { text: 'Fastify', hit: true },
      { text: ' best ', hit: false },
      { text: 'practices', hit: true },
    ]);
  });

  it('returns the text whole when nothing matches or the query is empty', () => {
    expect(highlightParts('a b', queryTerms('zzz'))).toEqual([{ text: 'a b', hit: false }]);
    expect(highlightParts('a b', [])).toEqual([{ text: 'a b', hit: false }]);
  });

  it('keeps HTML characters as text', () => {
    const parts = highlightParts('<script>x</script>', queryTerms('script'));
    expect(parts.map((p) => p.text).join('')).toBe('<script>x</script>');
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(['script', 'script']);
  });
});

describe('cards', () => {
  const card = (name: string) => cards.find((c) => c.name === name)!;

  it('AC-5: carry the invocable name, parent plugin, version and install command', () => {
    expect(card('spec-creator')).toMatchObject({
      type: 'agent',
      invocable: '@agent-sdd-workflow:spec-creator',
      plugin: 'sdd-workflow',
      version: '0.1.0',
      install: '/plugin install sdd-workflow@gen-bin',
    });
    expect(card('execute-plan').invocable).toBe('/sdd-workflow:execute-plan');
    expect(card('node-backend')).toMatchObject({ type: 'plugin', invocable: 'node-backend@gen-bin' });
  });

  it('AC-5: link to the source file on GitHub at the commit', () => {
    expect(card('spec-creator').sourceHref).toBe(
      'https://github.com/yrazub/gen-bin/blob/abc1234/plugins/sdd-workflow/agents/spec-creator.md',
    );
    expect(card('node-backend').sourceHref).toBe('https://github.com/yrazub/gen-bin/tree/abc1234/plugins/node-backend');
  });

  it('EC-7: cut a long description to 200 characters and an ellipsis', async () => {
    const { truncate } = await import('../../src/lib/search/card');
    const long = 'word '.repeat(60).trim();
    expect(truncate(long)).toHaveLength(200);
    expect(truncate(long).endsWith('…')).toBe(true);
    expect(truncate('short')).toBe('short');
  });
});
