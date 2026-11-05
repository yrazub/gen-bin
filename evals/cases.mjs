// Eval cases for sdd-engineering. Each case runs one `claude -p` session in a fresh temp directory
// with the plugins under test and is judged from the session trace or the files it left — never by
// another model.
//
//   files    written into the temp directory before the session
//   setup    optional; runs after the files are written (ctx.state runs the plugin's state.mjs)
//   since    the sdd-engineering version that introduced the behaviour; an older version is
//            expected to fail the case, which shows the case tells the versions apart
//   check    returns a list of failed expectations; empty means pass

const TINY_PROJECT = {
  'package.json': JSON.stringify({ name: 'demo', type: 'module', scripts: { test: 'node --test' } }, null, 2) + '\n',
  'src/greet.js': "export function greet(name) {\n  return `Hello, ${name}!`;\n}\n",
  'test/greet.test.js':
    "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { greet } from '../src/greet.js';\n\n" +
    "test('greets by name', () => {\n  assert.equal(greet('Ann'), 'Hello, Ann!');\n});\n",
  'CLAUDE.md': '# demo\n\nA tiny Node library. `src/` holds the code, `test/` the `node --test` tests. Run `npm test`.\n',
};

const GREETING_SPEC = `# Spec: greeting language

Spec ID: SPEC-1
Status: approved (2026-11-04)

## Goal

\`greet\` can greet in Ukrainian as well as in English.

## Requirements

- R1: \`greet(name, lang)\` takes an optional second argument \`lang\`, \`'en'\` or \`'uk'\`. The default is \`'en'\`.
- R2: With \`'uk'\` it returns \`Привіт, <name>!\`.
- R3: Any other \`lang\` throws a \`RangeError\` that names the value.

## Acceptance criteria

- AC-1 (R1): WHEN \`greet('Ann')\` is called THEN it returns \`Hello, Ann!\`.
- AC-2 (R2): WHEN \`greet('Ann', 'uk')\` is called THEN it returns \`Привіт, Ann!\`.
- AC-3 (R3): WHEN \`greet('Ann', 'fr')\` is called THEN it throws a \`RangeError\` whose message contains \`fr\`.

## Out of scope

- Other languages.
`;

const toolUses = (trace) => trace.toolUses;
const sddCalls = (trace) =>
  toolUses(trace).filter(
    (t) =>
      (t.name === 'Skill' && String(t.input?.skill ?? '').startsWith('sdd-engineering:')) ||
      (t.name === 'Agent' && String(t.input?.subagent_type ?? '').startsWith('sdd-engineering:')),
  );

export const cases = [
  {
    name: 'plugin-loads',
    what: 'the session loads sdd-engineering at the expected version, with its dependencies, agents and skills',
    files: {},
    prompt: 'Reply with the single word OK.',
    args: ['--tools', '', '--max-turns', '1'],
    check({ trace, plugin }) {
      const fails = [];
      const init = trace.init;
      if (!init) return ['no init event in the trace'];
      const sdd = init.plugins?.find((p) => p.name === 'sdd-engineering');
      if (!sdd) fails.push('sdd-engineering is not among the loaded plugins');
      else if (sdd.version !== plugin.version) fails.push(`loaded version ${sdd.version}, expected ${plugin.version}`);
      for (const dep of plugin.dependencies) {
        if (!init.plugins?.some((p) => p.name === dep)) fails.push(`dependency ${dep} is not loaded`);
      }
      const agents = (init.agents ?? []).filter((a) => a.startsWith('sdd-engineering:'));
      if (agents.length !== plugin.agents.length) fails.push(`${agents.length} sdd-engineering agents, expected ${plugin.agents.length}`);
      if (!(init.skills ?? []).includes('sdd-engineering:run-plan')) fails.push('skill sdd-engineering:run-plan is not loaded');
      return fails;
    },
  },
  {
    name: 'typo-stays-out-of-sdd',
    what: 'a request unrelated to feature work does not start the SDD workflow',
    files: {
      ...TINY_PROJECT,
      'README.md': '# demo\n\nThis projct greets people by name.\n',
    },
    prompt: 'Fix the typo in README.md.',
    args: ['--tools', 'Read,Edit,Glob,Grep,Skill,Agent', '--max-turns', '8'],
    check({ trace, read }) {
      const fails = [];
      const calls = sddCalls(trace);
      if (calls.length) fails.push(`started the SDD workflow: ${calls.map((c) => c.input.skill ?? c.input.subagent_type).join(', ')}`);
      if (!read('README.md').includes('This project greets')) fails.push('the typo is not fixed, so the session did not do the task');
      return fails;
    },
  },
  {
    name: 'planner-states-phase-count',
    what: 'implementation-planner states the number of phases and why (**Phases:** n — reason)',
    since: '1.1.1',
    files: { ...TINY_PROJECT, 'docs/specs/greeting.md': GREETING_SPEC },
    agent: 'implementation-planner',
    prompt:
      'Pass: plan. Spec: `docs/specs/greeting.md` (approved). The review pass found no open questions. ' +
      'Execution mode: single-agent. Write the Implementation Plan for this spec and return it as your answer.',
    args: ['--tools', 'Read,Grep,Glob', '--max-turns', '20'],
    check({ trace }) {
      if (!trace.resultText) return [`no plan returned (${trace.resultSubtype ?? 'no result'})`];
      return /\*\*Phases:\*\*\s*\d+\s*\S/.test(trace.resultText) ? [] : ['the plan has no "**Phases:** <n> <reason>" line'];
    },
  },
  {
    name: 'run-plan-closes-spec',
    what: 'once the final checks pass, run-plan sets the spec to Status: done and records the spec step',
    since: '1.1.0',
    files: {
      ...TINY_PROJECT,
      'docs/specs/greeting.md': GREETING_SPEC,
      'docs/plans/greeting.md':
        '# Implementation Plan: greeting language\n\n' +
        '**Goal:** greet in Ukrainian · **Spec:** `docs/specs/greeting.md`, SPEC-1 · **Execution mode:** multi-agent\n\n' +
        '## Phases\n\n### 1 · `lang` argument\n\nAdd `lang` to `greet` with its tests.\n\n## Out of scope\n- Other languages.\n',
      '.gitignore': '.sdd/\n',
    },
    setup(ctx) {
      ctx.git('init', '-q');
      ctx.git('add', '-A');
      ctx.git('commit', '-q', '-m', 'chore: demo with plan');
      const plan = 'docs/plans/greeting.md';
      ctx.state('start', plan);
      ctx.state('phase', plan, '1', 'committed', '--commit', ctx.git('rev-parse', 'HEAD').trim());
      ctx.state('start', plan); // the new chat for the final checks
      ctx.state('final', plan, 'verify', 'pass');
      ctx.state('final', plan, 'arch', 'pass');
    },
    prompt: '/sdd-engineering:run-plan docs/plans/greeting.md',
    // No Agent tool: the case is about the step after the checks, and no subagent should start.
    args: ['--tools', 'Bash,Read,Edit,Write,Glob,Grep,Skill', '--max-turns', '25'],
    check({ read, readJson }) {
      const fails = [];
      if (!/^Status:\s*done/m.test(read('docs/specs/greeting.md'))) fails.push('the spec does not say "Status: done"');
      const status = readJson('.sdd/greeting/state.json')?.final?.spec?.status;
      if (status !== 'done') fails.push(`the state's final spec step is ${status ?? 'missing'}, expected done`);
      return fails;
    },
  },
];
