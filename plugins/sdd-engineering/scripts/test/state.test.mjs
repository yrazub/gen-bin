import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, UsageError } from '../state.mjs';

const PLAN = 'docs/plans/demo.md';
const phases = (...titles) => titles.map((t, i) => `### ${i + 1} · ${t}\n\nbody ${i + 1}\n`).join('\n');
const planText = (mode, body) => `# Implementation Plan: demo\n\n**Goal:** g${mode ? ` · **Execution mode:** ${mode}` : ''}\n\n## Phases\n\n${body}\n## Out of scope\n- x\n`;

let root;
const write = (text) => writeFileSync(path.join(root, PLAN), text);
const cli = (...args) => run(args, root);
const next = (out) => out.split('\n').find((l) => l.startsWith('NEXT: '));
const state = () => JSON.parse(readFileSync(path.join(root, '.sdd/demo/state.json'), 'utf8'));

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'sdd-state-'));
  mkdirSync(path.join(root, 'docs/plans'), { recursive: true });
  write(planText('multi-agent', phases('Contracts', 'Server', 'e2e flow') + '\n| Nothing — test-writer only | | | |\n'));
});

test('start creates the state; the first step is the implementer with a baseline', () => {
  const out = cli('start', PLAN);
  assert.match(out, /^Created \.sdd\/demo\/state\.json\./);
  assert.equal(next(out), `NEXT: Run sdd-engineering:implementer: plan ${PLAN}, phase 1. It runs the baseline itself (first phase of this plan).`);
  assert.equal(state().mode, 'multi-agent');
  assert.equal(state().phases[2].test_writer_only, true);
});

test('a phase walks implementer → test-writer → commit, and the next phase gets the closing lines', () => {
  cli('start', PLAN);
  assert.match(next(cli('phase', PLAN, '1', 'code-done', '--deviation', 'renamed x to y')), /Run sdd-engineering:test-writer: plan .*, phase 1, with the implementer/);
  assert.match(next(cli('phase', PLAN, '1', 'green', '--verify', 'Tests 10 passed (10)', '--verify', 'tsc clean')), /^NEXT: Commit phase 1/);
  assert.equal(next(cli('phase', PLAN, '1', 'committed', '--commit', 'abc1234def')), `NEXT: Run sdd-engineering:implementer: plan ${PLAN}, phase 2. Tell it phase 1 closed green: Tests 10 passed (10) · tsc clean.`);
  assert.match(cli('show', PLAN, '--notes'), /phase 1: renamed x to y/);
});

test('a test-writer-only phase skips the implementer', () => {
  cli('start', PLAN);
  for (const n of ['1', '2']) cli('phase', PLAN, n, 'committed', '--commit', `c${n}`);
  cli('start', PLAN); // new chat
  assert.match(next(cli('show', PLAN)), /Run sdd-engineering:test-writer: plan .*, phase 3 \(the phase only adds tests/);
});

test('phases close in order, and committed / blocked need their evidence', () => {
  cli('start', PLAN);
  assert.throws(() => cli('phase', PLAN, '2', 'green'), /Phase 1 is not committed yet/);
  assert.throws(() => cli('phase', PLAN, '1', 'committed'), /needs --commit/);
  assert.throws(() => cli('phase', PLAN, '1', 'blocked'), /needs --reason/);
  assert.throws(() => cli('phase', PLAN, '9', 'green'), /Phase 9 is not in the plan/);
  assert.match(next(cli('phase', PLAN, '1', 'blocked', '--reason', 'red baseline')), /Phase 1 is blocked \(red baseline\)\. Take it to the user/);
});

test('the checkpoint asks for a new chat after per-chat committed phases, and start resets it', () => {
  cli('start', PLAN, '--per-chat', '2');
  cli('phase', PLAN, '1', 'committed', '--commit', 'c1');
  assert.match(next(cli('phase', PLAN, '2', 'committed', '--commit', 'c2')), /^NEXT: CHECKPOINT — 2 phases committed in this chat\. .*\/sdd-engineering:run-plan docs\/plans\/demo\.md \(1 phases left\)/);
  assert.match(next(cli('start', PLAN)), /Run sdd-engineering:test-writer: plan .*, phase 3/);
});

test('after the last phase: verifier and reviewer in parallel, then docs, e2e, insights, self-review', () => {
  cli('start', PLAN, '--per-chat', '9');
  for (const n of ['1', '2', '3']) cli('phase', PLAN, n, 'committed', '--commit', `c${n}`);
  cli('start', PLAN); // the final checks run in a new chat
  assert.match(next(cli('show', PLAN)), /Run sdd-engineering:plan-verifier and architecture-review:architecture-reviewer in parallel: plan .*, base origin\/main/);
  cli('final', PLAN, 'verify', 'pass');
  assert.match(next(cli('final', PLAN, 'arch', 'pass')), /Run sdd-engineering:doc-writer/);
  assert.match(next(cli('final', PLAN, 'docs', 'skipped', '--note', 'nothing documented changed')), /end-to-end suite/);
  assert.match(next(cli('final', PLAN, 'e2e', 'pass')), /notes file or skill/);
  assert.match(next(cli('final', PLAN, 'insights', 'done')), /project's own review/);
  assert.match(next(cli('final', PLAN, 'self-review', 'pass')), /All steps are done\. Ask the user before pushing/);
});

test('final checks cannot start before the last phase; a failure routes to a plan amendment', () => {
  cli('start', PLAN);
  assert.throws(() => cli('final', PLAN, 'verify', 'pass'), /Phases 1, 2, 3 are not committed/);
  for (const n of ['1', '2', '3']) cli('phase', PLAN, n, 'committed', '--commit', `c${n}`);
  assert.match(next(cli('final', PLAN, 'verify', 'fail')), /verify failed\. .*new phase \(sdd-engineering:implementation-planner, pass amend\).*--accept-plan-change/);
});

test('a changed plan is refused until accepted; a new phase resets the final checks', () => {
  cli('start', PLAN, '--per-chat', '9');
  for (const n of ['1', '2', '3']) cli('phase', PLAN, n, 'committed', '--commit', `c${n}`);
  cli('final', PLAN, 'verify', 'fail');
  write(planText('multi-agent', phases('Contracts', 'Server', 'e2e flow', 'Review fixes')));
  assert.match(cli('show', PLAN), /WARNING: the plan changed/);
  assert.throws(() => cli('start', PLAN), (e) => e instanceof UsageError && /added phases: 4; removed: none/.test(e.message));
  const out = cli('start', PLAN, '--accept-plan-change');
  assert.match(out, /Plan change accepted .* Final checks reset to pending\./);
  assert.equal(next(out), `NEXT: Run sdd-engineering:implementer: plan ${PLAN}, phase 4. Tell it phase 3 closed green: (no result lines recorded — paste them from the Test report).`);
  assert.equal(state().final.verify.status, 'pending');
  assert.equal(state().phases[0].commit, 'c1');
});

test('removing a phase that has work recorded is refused even with --accept-plan-change', () => {
  cli('start', PLAN);
  cli('phase', PLAN, '1', 'committed', '--commit', 'c1');
  write(planText('multi-agent', phases('Server')));
  // phase numbers 2 and 3 disappear; 2 and 3 are pending, so only titles change — allowed
  assert.match(cli('start', PLAN, '--accept-plan-change'), /removed: 2, 3/);
  write(planText('multi-agent', '### 2 · Server\n'));
  assert.throws(() => cli('start', PLAN, '--accept-plan-change'), /Phases 1 were removed .* already have work recorded/);
});

test('single-agent mode: the main session builds each phase; the checks are optional', () => {
  write(planText('single-agent', phases('Only')));
  assert.match(next(cli('start', PLAN)), /Build phase 1 yourself — run plan-phase\.mjs/);
  cli('phase', PLAN, '1', 'committed', '--commit', 'c1');
  cli('start', PLAN); // the final checks run in a new chat
  assert.match(next(cli('show', PLAN)), /In single-agent mode both are optional/);
});

test('the final checks start in a new chat, also after a fix phase; a resumed chat goes straight to them', () => {
  cli('start', PLAN, '--per-chat', '9');
  for (const n of ['1', '2', '3']) cli('phase', PLAN, n, 'committed', '--commit', `c${n}`);
  assert.match(next(cli('show', PLAN)), /^NEXT: CHECKPOINT — all phases are committed \(3 in this chat\)\. .*\/sdd-engineering:run-plan docs\/plans\/demo\.md for the final checks\./);
  assert.match(next(cli('start', PLAN)), /Run sdd-engineering:plan-verifier and architecture-review:architecture-reviewer/);
  cli('final', PLAN, 'verify', 'fail');
  write(planText('multi-agent', phases('Contracts', 'Server', 'e2e flow', 'Review fixes')));
  cli('start', PLAN, '--accept-plan-change');
  assert.match(next(cli('phase', PLAN, '4', 'committed', '--commit', 'c4')), /CHECKPOINT — all phases are committed \(1 in this chat\)/);
});

// A plan whose file tables touch source code (phases 1–2), documentation (phase 3) and tests only (phase 4).
const row = (file) => `| File | Change | Skills | Rules |\n|---|---|---|---|\n${file.map((f) => `| \`${f}\` | x | s | r |`).join('\n')}\n`;
const areaPlan = (mode = 'multi-agent', extra = '') =>
  planText(
    mode,
    [
      `### 1 · Contracts\n\n${row(['src/shared/x.ts'])}`,
      `### 2 · Service\n\n${row(['src/modules/a/service.ts', 'lib/b.ts'])}`,
      `### 3 · Docs\n\n${row(['docs/guide.md'])}`,
      '### 4 · e2e flow\n\n| Nothing — test-writer only | | | |\n',
      extra,
    ].join('\n'),
  );

test('the last phase that touches code owes an architecture check before its commit', () => {
  write(areaPlan());
  cli('start', PLAN, '--per-chat', '9');
  assert.equal(next(cli('phase', PLAN, '1', 'green')), `NEXT: Commit phase 1 (code and tests together), then: state.mjs phase ${PLAN} 1 committed --commit <sha>.`);
  cli('phase', PLAN, '1', 'committed', '--commit', 'c1');
  assert.match(
    next(cli('phase', PLAN, '2', 'green')),
    /^NEXT: Before the commit, run architecture-review:architecture-reviewer, mode change, on the code so far — phase 2 .*git diff --name-status origin\/main -- src lib .*\.sdd\/demo\/.*state\.mjs gate docs\/plans\/demo\.md 2 pass\.$/,
  );
  assert.throws(() => cli('phase', PLAN, '2', 'committed', '--commit', 'c2'), /Phase 2 is the last code phase: record the architecture check first/);
  const out = cli('gate', PLAN, '2', 'pass');
  assert.match(out, /2 {2}green .* Service \[arch check code: pass\]/);
  assert.match(next(out), /^NEXT: Commit phase 2/);
  assert.deepEqual(state().phases.map((p) => p.areas), [['code'], ['code'], [], []]);
});

test('a finding sends the phase back to the implementer, and the check runs again on the new code', () => {
  write(areaPlan());
  cli('start', PLAN, '--per-chat', '9');
  cli('phase', PLAN, '1', 'committed', '--commit', 'c1');
  cli('phase', PLAN, '2', 'green');
  cli('phase', PLAN, '2', 'code-done'); // sdd-engineering:implementer fixed the findings
  assert.throws(() => cli('gate', PLAN, '2', 'pass'), /Phase 2 is code-done; the architecture check runs once its tests are green/);
  assert.match(next(cli('phase', PLAN, '2', 'green')), /^NEXT: Before the commit, run architecture-review:architecture-reviewer/);
  assert.throws(() => cli('gate', PLAN, '1', 'pass'), /Phase 1 has no architecture check/);
  assert.throws(() => cli('gate', PLAN, '2', 'fail'), /Gate status must be one of pass, skipped/);
});

test('phases added by an amendment skip the early check; the final checks cover them', () => {
  write(areaPlan());
  cli('start', PLAN, '--per-chat', '9');
  cli('phase', PLAN, '1', 'committed', '--commit', 'c1');
  cli('phase', PLAN, '2', 'green');
  cli('gate', PLAN, '2', 'pass');
  cli('phase', PLAN, '2', 'committed', '--commit', 'c2');
  cli('phase', PLAN, '3', 'committed', '--commit', 'c3');
  cli('phase', PLAN, '4', 'committed', '--commit', 'c4');
  cli('final', PLAN, 'arch', 'fail');
  write(areaPlan('multi-agent', `### 5 · Review fixes\n\n${row(['src/modules/a/service.ts'])}`));
  cli('start', PLAN, '--accept-plan-change');
  assert.match(next(cli('phase', PLAN, '5', 'green')), /^NEXT: Commit phase 5/);
  assert.equal(state().phases[4].added, true);
});

test('single-agent mode: the early check is optional', () => {
  write(areaPlan('single-agent'));
  cli('start', PLAN, '--per-chat', '9');
  cli('phase', PLAN, '1', 'committed', '--commit', 'c1');
  assert.match(next(cli('phase', PLAN, '2', 'green')), /In single-agent mode it is optional: .*state\.mjs gate … skipped\.$/);
  assert.match(next(cli('gate', PLAN, '2', 'skipped', '--note', 'user declined')), /^NEXT: Commit phase 2 \(code and tests\)/);
});

test('a plan without an execution mode line defaults to multi-agent and says so', () => {
  write(planText(null, phases('Only')));
  assert.match(cli('start', PLAN), /mode multi-agent \(not stated in the plan; default\)/);
});

test('the CLI exits 2 on a usage error', () => {
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'state.mjs');
  assert.throws(
    () => execFileSync('node', [script, 'show', 'docs/plans/does-not-exist.md'], { stdio: 'pipe' }),
    (e) => e.status === 2 && /does not exist/.test(e.stderr.toString()),
  );
});
