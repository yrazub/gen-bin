# Evals

Behaviour evals for `sdd-engineering`. Each case runs one `claude -p` session in a fresh temp
directory with the plugins under test (`--plugin-dir`, user settings ignored) and is judged from the
session trace or the files the session left. No model judges another model.

```bash
node evals/run.mjs                                   # the plugins in the working tree
node evals/run.mjs --ref sdd-engineering--v1.0.0     # the plugins at a tag or commit
node evals/run.mjs -n 3 planner-states-phase-count   # one case, three runs
```

| Variable | |
|---|---|
| `EVAL_MODEL` | model for every session; default `claude-haiku-5-5` |
| `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` | authentication; without either, the local `claude` login is used |
| `EVAL_KEEP=1` | keep the temp directories for inspection |

Needs the `claude` CLI, Node ≥ 22 and git. Exit code 0 when every case behaves as expected.

## Cases

| Case | Checks | Since |
|---|---|---|
| `plugin-loads` | the `init` event lists `sdd-engineering` at the version in its `plugin.json`, its three dependencies, all its agents and the `run-plan` skill | — |
| `typo-stays-out-of-sdd` | "Fix the typo in README.md" fixes the typo and calls no `sdd-engineering` skill or agent | — |
| `planner-states-phase-count` | `implementation-planner` (its body as the system prompt) writes a plan with a `**Phases:** <n> <reason>` line | 1.1.1 |
| `run-plan-closes-spec` | with the final checks recorded as passed, `/sdd-engineering:run-plan` sets the spec to `Status: done` and records the `spec` step; the `Agent` tool is off, so no subagent starts | 1.1.0 |

A case with **Since** is expected to fail on an older version; the runner reports that as
`FAIL as expected`, and a pass there as `UNEXPECTED PASS`, which counts as a failure because the case
no longer tells the versions apart.

## Results (2026-11-04, `claude-haiku-5-5`, 3 runs per case)

| Case | 1.1.1 | 1.0.0 |
|---|---|---|
| `plugin-loads` | 3/3 pass | 3/3 pass |
| `typo-stays-out-of-sdd` | 3/3 pass | 3/3 pass |
| `planner-states-phase-count` | 3/3 pass | 0/3, fails as expected |
| `run-plan-closes-spec` | 3/3 pass | 0/3, fails as expected |

Cost: $0.06 per series of 12 sessions, about 4–6 minutes.

## CI

`.github/workflows/evals.yml` runs the cases once on PRs that touch `plugins/` or `evals/`, and on
demand (with an optional `ref` and model). The model goes through OpenRouter's Anthropic-compatible
endpoint: secret `OPENROUTER_API_KEY`, repository variable `EVAL_MODEL`, default
`anthropic/claude-haiku-4.5`. On that model, with the CLI version the workflow installs, all four
cases passed 3 of 3 times on `1.1.1`, at $0.30–0.60 per series.
