import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = fileURLToPath(new URL('../..', import.meta.url));

/** vitest exports BASE_URL, MODE and friends into process.env, and Vite would let them override the build's own. */
function childEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of ['BASE_URL', 'MODE', 'DEV', 'PROD', 'SSR']) delete env[key];
  return env;
}

/** Builds the site against the marketplace at `root` into a temp dir and returns that dir. */
export function buildFrom(root: string, label: string): string {
  const out = mkdtempSync(join(tmpdir(), `site-${label}-`));
  execFileSync(join(siteRoot, 'node_modules/.bin/astro'), ['build', '--outDir', out], {
    cwd: siteRoot,
    env: { ...childEnv(), CATALOG_ROOT: root },
    stdio: 'pipe',
  });
  return out;
}

/** Builds the site against a fixture marketplace. */
export const buildFixture = (name: string): string => buildFrom(join(siteRoot, 'test/fixtures', name), name);

export interface Dist {
  dir: string;
  has(path: string): boolean;
  read(path: string): string;
}

export function dist(dir: string): Dist {
  return {
    dir,
    has: (path) => existsSync(join(dir, path)),
    read: (path) => readFileSync(join(dir, path), 'utf8'),
  };
}

/** The visible text of an HTML string: tags dropped, entities for the few characters Astro escapes decoded. */
export function text(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ');
}
