# Cost baseline: sdd-engineering

What one feature costs when `sdd-engineering` builds it, on `1.0.0` and on `1.1.1` after one
optimization, and the quality gate both versions passed.

## Scenario

| | |
|---|---|
| Project | [`yrazub/ai-sandbox`](https://github.com/yrazub/ai-sandbox), with no DevDigest files |
| Feature | "session usage tally": a `GET /api/usage` endpoint and a usage footer in the web UI (about 15 files, server and web) |
| Base commit | `70be2dc` for runs 3–7, `51c9cbd` for run 1 (see [Caveats](#caveats)) |
| Workflow | headless `claude -p`, one call per stage: discovery → spec → plan review → plan → `run-plan` chats until every final check is closed (at most 8) |
| Manual steps | emulated as counted stages. In `1.0.0` the user sets the spec to `Status: done` after `run-plan`, so the driver sends that as its own prompt (stage `s6-spec-done`, ≈0.16 M tokens in run 4). `1.1.x` does it inside `run-plan` |
| Main session model | `claude-sonnet-5-5`, effort `high` |
| Agent models | from each agent's frontmatter, the same in both versions: Opus for `spec-creator`, `implementation-planner`, `plan-verifier`, `architecture-reviewer`; Sonnet for `implementer`, `test-writer`, `doc-writer` |
| Plugin versions | `sdd-engineering--v1.0.0` → `ad47570`, `sdd-engineering--v1.1.1` → `4666cb4`; loaded from a `git archive` of the tag with `--plugin-dir`, with the installed copy disabled |

### How it is measured

- **Tokens and requests:** every assistant message in the main session and subagent transcripts,
  counted once per `message.id`. Claude Code writes one transcript event per content block, each
  repeating the message's usage, so a plain sum over events over-counts 2.3–2.7×.
- **Tool calls:** unique `tool_use` ids in the same transcripts.
- **Cost:** `total_cost_usd` that the CLI reports per session, summed. It is an API-equivalent
  estimate; the runs were paid by subscription.
- **Latency:** wall time from the first stage start to the last stage end.

## Results

Three successful runs per version. The cost per successful workflow equals the cost per run,
because every run passed the quality gate.

| Run | Version | Phases | Tokens | Cost | Requests | Tool calls | Wall | Architecture reviews |
|---|---|---|---:|---:|---:|---:|---:|---:|
| 1 | 1.0.0 | 3 | 15.63 M | $12.78 | 266 | 483 | 48.1 min | 2 |
| 3 | 1.0.0 | 4 | 15.03 M | $12.16 | 269 | 501 | 42.6 min | 2 |
| 4 | 1.0.0 | 3 + 1 fix | 19.91 M | $15.00 | 340 | 617 | 85.5 min ¹ | 3 |
| 5 | 1.1.1 | 2 | 12.12 M | $10.06 | 201 | 391 | 38.3 min | 1 |
| 6 | 1.1.1 | 2 + 1 fix | 15.21 M | $12.51 | 257 | 467 | 45.8 min | 2 |
| 7 | 1.1.1 | 2 | 13.42 M | $11.08 | 212 | 431 | 42.0 min | 1 |

¹ Includes about 20 minutes in which `claude -p` stayed idle after its last chat before exiting.
The median does not change without it: 65.5 minutes is still the largest of the three runs.

### Medians

| | 1.0.0 | 1.1.1 | Change |
|---|---:|---:|---:|
| Tokens, total | 15.63 M | 13.42 M | −14% |
| · input (uncached) | 568 | 439 | |
| · cache write | 1.42 M | 1.20 M | −16% |
| · cache read | 13.90 M | 11.95 M | −14% |
| · output | 319 k | 268 k | −16% |
| **Cost per successful workflow** | **$12.78** | **$11.08** | **−13%** |
| API requests | 269 | 212 | −21% |
| · main session | 98 | 64 | −35% |
| Tool calls | 501 | 431 | −14% |
| **Latency (wall)** | **48.1 min** | **42.0 min** | **−13%** |
| Architecture reviews | 2 | 1 | |
| Pass rate | 3/3 | 3/3 | |

## The optimization

Both changes cut repeated work inside the workflow. Models, efforts and agent routing stayed the
same, so only the workflow changed.

- **1.1.0, skip the duplicate review.** The final architecture check is skipped when the code is
  unchanged since it passed the last per-phase architecture gate (same code hash). Before, the
  same code was reviewed twice. `run-plan` also gets a final `spec` step that sets the spec to
  `Status: done`, the step the user did by hand in `1.0.0`.
- **1.1.1, fewer phases.** The planner uses as few phases as the work allows and states the
  count with a reason (`**Phases:** n — why`). Every phase costs an implementer, a test-writer,
  verify commands and a commit. In run 2 (`1.1.0`, below) the planner split this feature into 5
  phases, and that cost about 3 M tokens more than run 1's 3 phases, so it hid the 1.1.0 saving.

What the runs show: `1.1.1` built this feature in 2 phases every time (`1.0.0`: 3, 4, 3). The
final architecture check was skipped in runs 5 and 7, where nothing changed after the gate. In
run 6 it ran, because a fix phase changed the code after the gate.

## Quality gate

A run passes when the first five checks hold; all six runs passed. The behaviour evals check the
plugin version itself, not a run: `1.1.1` passes all of them, and they show that the new behaviour
is really missing from `1.0.0`.

| Check | 1.0.0 (runs 1, 3, 4) | 1.1.1 (runs 5, 6, 7) |
|---|---|---|
| Every final check of `run-plan` is closed | yes | yes |
| `plan-verifier`: pass, no open gaps; only manual UI checks skipped, which a headless run cannot do | pass (2–3 manual skips per run) | pass (2–4 manual skips per run) |
| `npm run typecheck`, `npm test`, `npm run build` pass after the last phase | 236 / 257 / 265 tests | 259 / 248 / 244 tests |
| Architecture check passes: the final review, or the last per-phase gate when the code did not change after it | pass | pass |
| Spec ends `Status: done` | runs 1 and 3 ended `approved` (driver gap, see [Caveats](#caveats)); run 4 `done` | `done`, set by `run-plan` |
| Behaviour evals ([`evals/`](../evals/README.md), 3 runs per case): plugin loads, no SDD on an unrelated request, planner states the phase count, `run-plan` closes the spec | the first two pass 3/3; the last two fail 0/3, as expected for behaviour added in `1.1.x` | 4 of 4 pass 3/3 |

**No critical false negatives added:** the gaps the final checks found were still found and
fixed after the optimization. Run 4 (`1.0.0`) and run 6 (`1.1.1`) each got one review-fix phase.
In run 6 the gap was a missing assertion for acceptance criterion AC-5. Skipping the final
architecture check removes only a review of code that already passed the same review.

**Verdict:** the gate is green, the behaviour evals pass on `1.1.1`, and cost, requests and
latency all went down. The optimization
passes, with the caveat that the ranges overlap (below).

## Caveats

- **Three runs per version, and the ranges overlap.** Tokens: `1.0.0` 15.0–19.9 M, `1.1.1`
  12.1–15.2 M. Run 6 (`1.1.1`) cost more than run 3 (`1.0.0`). The medians point one way, but
  three samples do not prove a 13% saving.
- **`1.0.0` → `1.1.1` is two changes**, the duplicate-review skip and fewer phases, so the
  saving is not split between them.
- **Run 1 is on an older base** (`51c9cbd`), where agents ran `source ~/.nvm/nvm.sh` before
  every npm command and got permission denials. `70be2dc` tells them to skip nvm. With runs 3
  and 4 only, the `1.0.0` median would be 17.47 M tokens, which favours `1.1.1` even more.
- **Runs 1 and 3 have no `s6-spec-done` stage**, because the driver did not emulate it yet.
  Adding it (≈0.16 M) would not change the median.
- **Run 2 (`1.1.0`, 5 phases, 18.1 M tokens) is not counted.** It is the run that showed the
  phase count, not the review, drives the cost. 1.1.1 was made from it.
- **Raw data** (transcripts, per-stage streams, workflow state files) stays on the machine that
  ran the experiment and is not in this repository.
