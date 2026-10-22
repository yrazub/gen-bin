import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { generateLarge } from '../support/large-fixture.mjs';
import { buildFixture, buildFrom, dist, type Dist } from './helpers';

const gzip = (s: string | Buffer) => gzipSync(s).length;
const KB = 1024;

/** Every JavaScript file the build ships, gzipped. The search page loads a subset of these. */
function scripts(d: Dist): { file: string; gz: number }[] {
  const dir = join(d.dir, '_astro');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .map((file) => ({ file, gz: gzip(readFileSync(join(dir, file))) }));
}

let basic: Dist;
let large: Dist;

beforeAll(() => {
  basic = dist(buildFixture('basic'));
  large = dist(buildFrom(generateLarge(mkdtempSync(join(tmpdir(), 'site-large-src-'))), 'large'));
});

describe('size budgets', () => {
  it('NFR-1: the JavaScript the site ships is at most 60 KB gzipped, search index not counted', () => {
    // Astro inlines small scripts into the page, so count those too.
    const inline = [...basic.read('index.html').matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter(Boolean);
    const all = [...scripts(basic), { file: 'inline', gz: gzip(inline.join('\n')) }];
    const total = all.reduce((sum, s) => sum + s.gz, 0);
    console.log(`JS total ${(total / KB).toFixed(1)} KB gzip:`, all.map((s) => `${s.file}=${(s.gz / KB).toFixed(1)}`).join(' '));
    expect(all.length).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(60 * KB);
  });

  it('NFR-1: plugin and What\'s new pages load no search code', () => {
    const search = scripts(basic)
      .map((s) => s.file)
      .filter((f) => readFileSync(join(basic.dir, '_astro', f), 'utf8').includes('data-no-matches'));
    expect(search.length).toBe(1);
    for (const path of ['plugins/sdd-workflow/index.html', 'whats-new/index.html', 'team/index.html']) {
      expect(basic.read(path), path).not.toContain(search[0]);
      expect(basic.read(path), path).not.toContain('search-index.json');
    }
    expect(basic.read('index.html')).toContain(search[0]);
  });

  it('NFR-2: the index for 300 artifacts is at most 500 KB gzipped', () => {
    const json = large.read('search-index.json');
    const { cards } = JSON.parse(json);
    expect(cards.length).toBe(300);
    console.log(`index ${cards.length} artifacts: ${(Buffer.byteLength(json) / KB).toFixed(0)} KB raw, ${(gzip(json) / KB).toFixed(1)} KB gzip`);
    expect(gzip(json)).toBeLessThanOrEqual(500 * KB);
  });
});
