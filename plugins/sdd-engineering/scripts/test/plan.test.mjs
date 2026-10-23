import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePlan, slicePhase, phaseBody, sddDir } from '../lib/plan.mjs';

const PLAN = `# Implementation Plan: demo

**Goal:** g · **Packages:** server · **Execution mode:** single-agent

## Constraints
- keep it

## Phases

Shared note for every phase.

### 1 · Contracts — server

| File | Change |
|---|---|
| a.ts | x |

\`\`\`markdown
### 9 · not a phase, inside a fence
## Not a section either
\`\`\`

### 2 · Client

#### Detail of phase 2

### Closing steps — not a phase

## Out of scope
- nothing
`;

test('phases are the numbered ### headings under ## Phases, fences ignored', () => {
  const p = parsePlan(PLAN);
  assert.equal(p.title, 'Implementation Plan: demo');
  assert.equal(p.mode, 'single-agent');
  assert.deepEqual(p.phases, [
    { n: 1, title: 'Contracts — server' },
    { n: 2, title: 'Client' },
  ]);
});

test('a slice keeps the shared sections and drops the other phases', () => {
  const s = slicePhase(PLAN, 2);
  for (const kept of ['## Constraints', 'Shared note for every phase.', '### 2 · Client', '#### Detail of phase 2', '### Closing steps', '## Out of scope']) {
    assert.ok(s.includes(kept), kept);
  }
  for (const dropped of ['### 1 · Contracts', '| a.ts | x |', 'not a phase, inside a fence']) assert.ok(!s.includes(dropped), dropped);
});

test('the fenced block stays with the phase it is in', () => {
  assert.ok(phaseBody(PLAN, 1).includes('### 9 · not a phase, inside a fence'));
  assert.ok(!phaseBody(PLAN, 1).includes('### 2 · Client'));
});

test('an unknown phase names the phases that exist', () => {
  assert.throws(() => slicePhase(PLAN, 7), /Phase 7 not found\. Phases in this plan: 1, 2\./);
});

test('a plan with no execution mode line reads as null', () => {
  assert.equal(parsePlan('# P\n\n## Phases\n\n### 1 · A\n').mode, null);
});

test('a plan with phases numbered 1..n slices every phase', () => {
  const ns = parsePlan(PLAN).phases.map((p) => p.n);
  assert.deepEqual(ns, ns.map((_, i) => i + 1));
  for (const n of ns) assert.ok(slicePhase(PLAN, n).length < PLAN.length);
});

test('the state directory is .sdd/<feature>/ under the root', () => {
  assert.equal(sddDir('demo', '/proj'), path.join('/proj', '.sdd', 'demo'));
});

test('the CLI writes the slice under .sdd/<feature>/ of the working directory', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-plan-'));
  mkdirSync(path.join(root, 'docs/plans'), { recursive: true });
  writeFileSync(path.join(root, 'docs/plans/demo.md'), PLAN);
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'plan-phase.mjs');
  const out = execFileSync('node', [script, 'docs/plans/demo.md', '2'], { cwd: root, encoding: 'utf8' });
  assert.match(out, /^\.sdd\/demo\/phase-2\.md \(\d+ lines, \d+ KB\)\n$/);
  assert.ok(readFileSync(path.join(root, '.sdd/demo/phase-2.md'), 'utf8').includes('### 2 · Client'));
});
