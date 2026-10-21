#!/usr/bin/env node
// Catalog guard: enforces the version and naming rules from CLAUDE.md that
// `claude plugin validate` does not check.
//   - a catalog entry sets no `version` (it lives only in plugin.json)
//   - a relative-path entry's name equals the name in its plugin.json
//   - every plugin changed since <base-ref> has a new `version` in plugin.json
//     and a matching `## <name> <version>` heading in CHANGELOG.md
// Usage: node .github/scripts/check-version-bump.mjs [base-ref]   (default origin/main)

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] || 'origin/main';
const errors = [];

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const manifestPath = (name) => join('plugins', name, '.claude-plugin', 'plugin.json');

function baseVersion(name) {
  try {
    return JSON.parse(git('show', `${base}:${manifestPath(name)}`)).version;
  } catch {
    return undefined; // plugin is new on this branch
  }
}

const catalog = readJson('.claude-plugin/marketplace.json');
for (const entry of catalog.plugins ?? []) {
  if (entry.version !== undefined) {
    errors.push(`${entry.name}: remove "version" from the catalog entry; set it in plugin.json only`);
  }
  if (typeof entry.source === 'string') {
    const manifest = join(entry.source, '.claude-plugin', 'plugin.json');
    if (existsSync(manifest) && readJson(manifest).name !== entry.name) {
      errors.push(`${entry.name}: catalog name differs from "name" in ${manifest}`);
    }
  }
}

const changed = new Set(
  git('diff', '--name-only', `${base}...HEAD`)
    .split('\n')
    .map((file) => file.match(/^plugins\/([^/]+)\//)?.[1])
    .filter(Boolean),
);

const changelog = existsSync('CHANGELOG.md') ? readFileSync('CHANGELOG.md', 'utf8') : '';
for (const name of changed) {
  if (!existsSync(manifestPath(name))) continue; // plugin removed on this branch
  const { version } = readJson(manifestPath(name));
  if (!version) {
    errors.push(`${name}: plugin.json has no "version"`);
    continue;
  }
  if (version === baseVersion(name)) {
    errors.push(`${name}: files changed but version is still ${version}; bump it in plugin.json`);
  }
  if (!changelog.includes(`## ${name} ${version}\n`)) {
    errors.push(`${name}: CHANGELOG.md has no "## ${name} ${version}" heading`);
  }
}

if (errors.length) {
  for (const error of errors) console.error(`::error::${error}`);
  process.exit(1);
}
console.log(`Catalog guard passed (${changed.size} changed plugin(s) since ${base}).`);
