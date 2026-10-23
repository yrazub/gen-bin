#!/usr/bin/env node
// Namespace guard: every `<plugin>:<component>` reference in a plugin's agents and skills must
// name a component that exists in this repository, and the referring plugin must depend on the
// plugin it names (directly), or be that plugin.
// Usage: node .github/scripts/check-namespaces.mjs [dir]   (default plugins)

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] || 'plugins';
const errors = [];
const plugins = readdirSync(root).filter((n) => existsSync(join(root, n, '.claude-plugin', 'plugin.json')));

const components = (name) => {
  const set = new Set();
  const agents = join(root, name, 'agents');
  if (existsSync(agents)) for (const f of readdirSync(agents)) if (f.endsWith('.md')) set.add(f.slice(0, -3));
  const skills = join(root, name, 'skills');
  if (existsSync(skills)) for (const d of readdirSync(skills)) if (existsSync(join(skills, d, 'SKILL.md'))) set.add(d);
  return set;
};
const known = Object.fromEntries(plugins.map((n) => [n, components(n)]));
const deps = (name) => {
  const manifest = JSON.parse(readFileSync(join(root, name, '.claude-plugin', 'plugin.json'), 'utf8'));
  return new Set((manifest.dependencies ?? []).map((d) => (typeof d === 'string' ? d : d.name)));
};

const pattern = new RegExp(`(?<![\\w-])(${plugins.join('|')}):([a-z][a-z0-9-]*)`, 'g');

function walk(dir, visit) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, visit);
    else if (entry.endsWith('.md')) visit(path);
  }
}

for (const name of plugins) {
  const allowed = deps(name);
  for (const sub of ['agents', 'skills']) {
    const dir = join(root, name, sub);
    if (!existsSync(dir)) continue;
    walk(dir, (path) => {
      readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
        for (const [, plugin, component] of line.matchAll(pattern)) {
          if (!known[plugin].has(component)) errors.push(`${path}:${i + 1}: ${plugin}:${component} does not exist`);
          else if (plugin !== name && !allowed.has(plugin)) errors.push(`${path}:${i + 1}: ${name} uses ${plugin}:${component} but does not depend on ${plugin}`);
        }
      });
    });
  }
}

if (errors.length) {
  for (const error of errors) console.error(`::error::${error}`);
  process.exit(1);
}
console.log(`Namespaced references resolve across ${plugins.length} plugins.`);
