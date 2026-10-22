// Builds the basic, empty and large (300 artifacts) marketplaces and serves each under /gen-bin/:
// basic on 4321, empty on 4322, large on 4323. Playwright's webServer runs this once.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateLarge } from '../support/large-fixture.mjs';

const site = fileURLToPath(new URL('../..', import.meta.url));
const BASE = '/gen-bin/';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.svg': 'image/svg+xml' };

const tmp = mkdtempSync(join(tmpdir(), 'site-e2e-'));
const env = { ...process.env };
for (const key of ['BASE_URL', 'MODE', 'DEV', 'PROD', 'SSR']) delete env[key];

const targets = [
  { name: 'basic', port: 4321, root: join(site, 'test/fixtures/basic') },
  { name: 'empty', port: 4322, root: join(site, 'test/fixtures/empty') },
  { name: 'large', port: 4323, root: generateLarge(join(tmp, 'large-src')) },
];

for (const t of targets) {
  t.out = join(tmp, t.name);
  execFileSync(join(site, 'node_modules/.bin/astro'), ['build', '--outDir', t.out], {
    cwd: site,
    env: { ...env, CATALOG_ROOT: t.root },
    stdio: 'ignore',
  });
}

function handler(dir) {
  return (req, res) => {
    const { pathname } = new URL(req.url, 'http://x');
    if (!pathname.startsWith(BASE)) return void res.writeHead(404).end('not found');
    const file = normalize(join(dir, decodeURIComponent(pathname.slice(BASE.length))));
    if (file !== dir && !file.startsWith(dir + sep)) return void res.writeHead(403).end();
    let target = file;
    if (existsSync(target) && statSync(target).isDirectory()) {
      if (!pathname.endsWith('/')) return void res.writeHead(301, { Location: `${pathname}/` }).end();
      target = join(target, 'index.html');
    }
    if (!existsSync(target)) return void res.writeHead(404).end('not found');
    res.writeHead(200, { 'Content-Type': TYPES[extname(target)] ?? 'application/octet-stream' }).end(readFileSync(target));
  };
}

for (const t of targets) http.createServer(handler(t.out)).listen(t.port);

const stop = () => {
  rmSync(tmp, { recursive: true, force: true });
  process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
