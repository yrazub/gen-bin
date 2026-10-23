import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const guard = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'specs-only-guard.mjs');
const root = mkdtempSync(path.join(tmpdir(), 'sdd-guard-'));
mkdirSync(path.join(root, 'docs/specs'), { recursive: true });
mkdirSync(path.join(root, 'src'), { recursive: true });

const call = (input) => spawnSync('node', [guard], { input: typeof input === 'string' ? input : JSON.stringify(input), encoding: 'utf8' });
const write = (agent_type, file) => call({ cwd: root, tool_name: 'Write', tool_input: { file_path: file }, ...(agent_type ? { agent_type } : {}) });

test('spec-creator writing outside a specs folder is blocked (exit 2)', () => {
  const r = write('spec-creator', 'src/a.ts');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /not a Markdown file/);
});

test('the plugin-prefixed agent name is matched too', () => {
  assert.equal(write('sdd-engineering:spec-creator', 'src/a.ts').status, 2);
});

test('spec-creator writing Markdown in docs/specs is allowed', () => {
  assert.equal(write('spec-creator', 'docs/specs/a.md').status, 0);
  assert.equal(write('spec-creator', path.join(root, 'server/specs/b.md')).status, 0);
});

test('spec-creator may not write a Markdown file outside specs, or inside a plans folder', () => {
  assert.equal(write('spec-creator', 'docs/readme.md').status, 2);
  assert.equal(write('spec-creator', 'docs/plans/a.md').status, 2);
  assert.equal(write('spec-creator', 'docs/specs/plans/a.md').status, 2);
});

test('spec-creator may not escape the project, directly or through a symlink', () => {
  assert.equal(write('spec-creator', '../outside/specs/a.md').status, 2);
  const outside = mkdtempSync(path.join(tmpdir(), 'sdd-outside-'));
  symlinkSync(outside, path.join(root, 'docs/specs/link'));
  assert.equal(write('spec-creator', 'docs/specs/link/a.md').status, 2);
});

test('the main session and other agents are never blocked', () => {
  assert.equal(write(undefined, 'src/a.ts').status, 0);
  assert.equal(write('implementer', 'src/a.ts').status, 0);
  assert.equal(write('sdd-engineering:implementer', 'src/a.ts').status, 0);
});

test('unparseable input blocks only when it names spec-creator', () => {
  assert.equal(call('not json').status, 0);
  assert.equal(call('{"agent_type":"spec-creator" oops').status, 2);
});
