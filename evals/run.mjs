#!/usr/bin/env node
// Runs the sdd-engineering eval cases (cases.mjs) with `claude -p`.
//
//   node evals/run.mjs [--ref <git ref>] [-n <runs>] [case …]
//
// --ref  test the plugins as they were at a tag or commit (git archive), e.g.
//        sdd-engineering--v1.0.0; default: the plugins in the working tree
// -n     runs per case (default 1); a case passes only when every run passes
//
// Environment: EVAL_MODEL (default claude-haiku-5-5). Authentication is whatever the claude CLI
// finds: ANTHROPIC_API_KEY, CLAUDE_CODE_OAUTH_TOKEN, or a local login.
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cases } from './cases.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = process.env.EVAL_MODEL || 'claude-haiku-5-5';

function parseArgs(argv) {
  const opts = { ref: null, runs: 1, only: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ref') opts.ref = argv[++i];
    else if (argv[i] === '-n') opts.runs = Number(argv[++i]);
    else opts.only.push(argv[i]);
  }
  if (!Number.isInteger(opts.runs) || opts.runs < 1) throw new Error('-n needs a positive number');
  return opts;
}

/** The plugins folder under test: the working tree, or a git archive of a ref. */
function pluginsDir(ref) {
  if (!ref) return path.join(REPO, 'plugins');
  const dir = mkdtempSync(path.join(tmpdir(), 'sdd-eval-plugins-'));
  const tar = execFileSync('git', ['-C', REPO, 'archive', ref, 'plugins']);
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  return path.join(dir, 'plugins');
}

function describePlugin(plugins) {
  const root = path.join(plugins, 'sdd-engineering');
  const manifest = JSON.parse(readFileSync(path.join(root, '.claude-plugin/plugin.json'), 'utf8'));
  return {
    root,
    version: manifest.version,
    dependencies: (manifest.dependencies ?? []).map((d) => (typeof d === 'string' ? d : d.name)),
    agents: readdirSync(path.join(root, 'agents')).filter((f) => f.endsWith('.md')),
  };
}

const older = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i];
  return false;
};

/** The agent's Markdown body without its frontmatter, used as the system prompt. */
const agentBody = (plugin, name) => readFileSync(path.join(plugin.root, 'agents', `${name}.md`), 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');

function parseTrace(stdout) {
  const trace = { init: null, toolUses: [], resultText: null, resultSubtype: null, cost: 0 };
  for (const line of stdout.split('\n')) {
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (e.type === 'system' && e.subtype === 'init') trace.init = e;
    if (e.type === 'assistant' && Array.isArray(e.message?.content)) {
      for (const b of e.message.content) if (b.type === 'tool_use') trace.toolUses.push({ name: b.name, input: b.input });
    }
    if (e.type === 'result') {
      trace.resultSubtype = e.subtype;
      trace.resultText = e.subtype === 'success' ? e.result : null;
      trace.cost = e.total_cost_usd ?? 0;
    }
  }
  return trace;
}

function runOnce(c, plugins, plugin) {
  const dir = mkdtempSync(path.join(tmpdir(), `sdd-eval-${c.name}-`));
  for (const [file, text] of Object.entries(c.files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), text);
  }
  const ctx = {
    git: (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'eval', GIT_AUTHOR_EMAIL: 'eval@example.com', GIT_COMMITTER_NAME: 'eval', GIT_COMMITTER_EMAIL: 'eval@example.com' } }),
    state: (...args) => execFileSync('node', [path.join(plugin.root, 'scripts/state.mjs'), ...args], { cwd: dir, encoding: 'utf8' }),
  };
  c.setup?.(ctx);

  const args = ['-p', c.prompt, '--output-format', 'stream-json', '--verbose', '--model', MODEL,
    '--plugin-dir', plugins, '--setting-sources', 'project', '--permission-mode', 'bypassPermissions', ...c.args];
  if (c.agent) {
    // Outside the session's directory, so the agent does not read its own prompt as project code.
    const promptFile = path.join(mkdtempSync(path.join(tmpdir(), 'sdd-eval-agent-')), `${c.agent}.md`);
    writeFileSync(promptFile, agentBody(plugin, c.agent));
    args.push('--system-prompt-file', promptFile);
  }
  const res = spawnSync('claude', args, { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_AUTHOR_NAME: 'eval', GIT_AUTHOR_EMAIL: 'eval@example.com', GIT_COMMITTER_NAME: 'eval', GIT_COMMITTER_EMAIL: 'eval@example.com' } });
  if (res.error) throw res.error;
  const trace = parseTrace(res.stdout);
  const read = (f) => (existsSync(path.join(dir, f)) ? readFileSync(path.join(dir, f), 'utf8') : '');
  const readJson = (f) => (existsSync(path.join(dir, f)) ? JSON.parse(read(f)) : null);
  const fails = trace.init ? c.check({ trace, plugin, read, readJson }) : [`no session started: ${res.stderr.trim().split('\n').pop() || `exit ${res.status}`}`];
  if (!process.env.EVAL_KEEP) for (const d of [dir, ...(c.agent ? [path.dirname(args.at(-1))] : [])]) rmSync(d, { recursive: true, force: true });
  return { fails, cost: trace.cost };
}

const opts = parseArgs(process.argv.slice(2));
const plugins = pluginsDir(opts.ref);
const plugin = describePlugin(plugins);
const selected = opts.only.length ? cases.filter((c) => opts.only.includes(c.name)) : cases;
console.log(`sdd-engineering ${plugin.version}${opts.ref ? ` (${opts.ref})` : ' (working tree)'} · model ${MODEL} · ${opts.runs} run(s) per case\n`);

let failed = 0;
let cost = 0;
for (const c of selected) {
  const results = [];
  for (let i = 0; i < opts.runs; i++) results.push(runOnce(c, plugins, plugin));
  cost += results.reduce((s, r) => s + r.cost, 0);
  const passes = results.filter((r) => r.fails.length === 0).length;
  const expectFail = c.since && older(plugin.version, c.since);
  let verdict;
  if (expectFail) verdict = passes === 0 ? `FAIL as expected (behaviour since ${c.since})` : `UNEXPECTED PASS ${passes}/${opts.runs} on a version before ${c.since}`;
  else verdict = passes === opts.runs ? 'PASS' : 'FAIL';
  if (verdict === 'FAIL' || verdict.startsWith('UNEXPECTED')) failed++;
  console.log(`${verdict.padEnd(9)} ${passes}/${opts.runs}  ${c.name} — ${c.what}`);
  for (const [i, r] of results.entries()) for (const f of r.fails) console.log(`          run ${i + 1}: ${f}`);
}
if (opts.ref) rmSync(path.dirname(plugins), { recursive: true, force: true });
console.log(`\n${selected.length - failed}/${selected.length} cases as expected · cost $${cost.toFixed(2)}`);
process.exit(failed ? 1 : 0);
