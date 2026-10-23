#!/usr/bin/env node
// Content guard: the plugins were extracted from a private project and must not carry its
// names, paths or tooling. Fails when any text file under plugins/ contains a forbidden string.
// Usage: node .github/scripts/check-no-devdigest.mjs [dir]   (default plugins)

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN = [
  { re: /devdigest/i, why: 'DevDigest name or path (covers .devdigest and @devdigest)' },
  { re: /\$CLAUDE_PROJECT_DIR/, why: '$CLAUDE_PROJECT_DIR (use ${CLAUDE_PLUGIN_ROOT})' },
  { re: /pnpm arch:check/, why: 'pnpm arch:check (project-specific command)' },
  { re: /wrapUntrusted/, why: 'wrapUntrusted (project-specific helper)' },
  { re: /groundFindings/, why: 'groundFindings (project-specific helper)' },
  { re: /execute-plan/, why: 'bare execute-plan (the skill is sdd-engineering:run-plan)' },
];
const SKIP_DIRS = new Set(['node_modules', '.git']);
const root = process.argv[2] || 'plugins';
const errors = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path);
    } else if (entry.isFile()) {
      const buf = readFileSync(path);
      if (buf.includes(0)) continue; // binary
      const lines = buf.toString('utf8').split('\n');
      lines.forEach((line, i) => {
        for (const { re, why } of FORBIDDEN) {
          if (re.test(line)) errors.push(`${path}:${i + 1}: ${why}`);
        }
      });
    }
  }
}

walk(root);
if (errors.length) {
  for (const error of errors) console.error(`::error::${error}`);
  process.exit(1);
}
console.log(`No forbidden strings under ${root}/.`);
