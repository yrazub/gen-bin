---
name: run-plan
description: "Executes an approved Implementation Plan with the sdd-engineering agents — implementer and test-writer phase by phase, then plan-verifier and architecture-reviewer, doc-writer, the project's end-to-end run, its insights notes and its own review — keeping the progress in a state file (.sdd/<feature>/state.json) so a fresh chat resumes where the last one stopped. Works in multi-agent or single-agent mode as the plan says. Use when the user runs /sdd-engineering:run-plan <plan>, or asks to build, execute, continue or resume an approved plan. Does not write specs or plans, and never pushes."
metadata:
  version: "1.0.0"
---

# Run a plan

You are the orchestrator. The agents do the work; you pass them paths, record what their reports
say in the state file, and bring the user what needs a person. The state file — not this
conversation — is the memory of the run, so a new chat loses nothing.

## Inputs and defaults

The user gives the plan path. Unless the task or the project says otherwise:

| What | Default | Override |
|---|---|---|
| plan | `docs/plans/<feature>.md` | the path in the command |
| specs | `docs/specs/` | named in the task |
| run state | `.sdd/<feature>/` (git-ignore it) | set `SDD_STATE_DIR=<dir>` in front of every `$S` and `plan-phase.mjs` call |

`$S` below is `node "${CLAUDE_PLUGIN_ROOT}/scripts/state.mjs"`, run from the repository root.
`$P` is `node "${CLAUDE_PLUGIN_ROOT}/scripts/plan-phase.mjs"`. Every command prints the summary and a `NEXT:` line. **Do what `NEXT` says**,
record the result with `$S`, and read the new `NEXT`.

## Keep your own context small

The orchestrating chat is the most expensive part of a run: every turn re-reads all of it. So:

- **Do not read the plan, the spec or the diff yourself.** Agents read them. You need the phase
  numbers and titles, which `$S show` prints.
- **Do not fix code or tests yourself** in multi-agent mode — send the finding back to the agent
  that owns it.
- **From each report take only what the state needs** (below), and tell the user the status line
  plus anything that needs a decision. Do not paste whole reports.
- **On `CHECKPOINT`, stop.** Tell the user to open a new chat and run the command it names. The
  default is a new chat every 3 committed phases (`--per-chat <n>` on `start` changes it), and the
  final checks always begin in a new chat — also after a fix phase. Do not re-run `start` in the
  same chat to get past it. If the user asks to continue here anyway, say once what it costs
  (every later turn re-reads the whole chat, and in a measured run the one chat that kept going
  was about 70% of the feature's tokens), then do as they decide.

## 1. Start or resume

```bash
git fetch origin && git merge-base origin/main HEAD && git rev-parse origin/main
node $S start docs/plans/<feature>.md            # first run: --base <ref> when not origin/main
```

If the branch is behind `origin/main`, say so before any phase runs. If `start` refuses because
the plan changed, ask the user whether the changed plan was approved; only then re-run with
`--accept-plan-change`. A plan is changed by `sdd-engineering:implementation-planner`, never by hand.

## 2. Each phase (multi-agent)

**sdd-engineering:implementer** — `NEXT` gives the plan path, the phase and the baseline statement; pass all
three. From its Implementation report:

| Report says | Record |
|---|---|
| `complete` | `$S phase <plan> <n> code-done`, one `--deviation "<text>"` per Deviations row |
| `partial` or `blocked` | `$S phase <plan> <n> blocked --reason "<one line>"`, then take the report to the user |
| Insight candidates / For reviewers | `$S note <plan> insight "<text>"` / `$S note <plan> reviewer "<text>"`, one per line |

**sdd-engineering:test-writer** — pass the plan path, the phase and the implementer's "Existing tests failing"
table, copied as it is (the only part of a report you hand over verbatim). From its Test report:

- `green` → `$S phase <plan> <n> green --verify "<result line>"`, one `--verify` per Verification
  row; the next phase's `sdd-engineering:implementer` gets these lines as its baseline.
- Suspected regressions, suspected product bugs or "Needs a production change" → run
  `sdd-engineering:implementer` again for the same phase with those items, then `sdd-engineering:test-writer` again.
- "Existing tests edited" is not empty → check that every row quotes a plan or spec item; a row
  without one goes to the user.
- Insight candidates → `$S note … insight`.

**manual check** — if the phase has a `Verify (manual, screenshots)` line, hand it to a
short-lived `general-purpose` sub-agent once `sdd-engineering:test-writer` is green, before the commit. Images
stay in the context that looked at them, and every later turn of this chat would re-read them.
Ask the user to start the app if it is down — neither you nor the sub-agent starts it. Give the sub-agent:

- the plan path and the phase — it reads the line with `$P <plan> <n>` — and the paths to the
  design files and the spec;
- the browser rules: whichever browser tool the project has set up, one new tab, closed at the end;
  screenshots scaled or of a region, never full-page, saved to
  `.sdd/<feature>/screenshots/phase-<n>-<what>.png`; no accessibility-tree dumps; the console
  messages for warnings;
- the report to return, and nothing else: one row per item of the line — what was compared, the
  value the spec or design gives, the value measured, `match` or `mismatch`, the screenshot path —
  plus the console warnings.

Read the report, not the screenshots; open one only to show the user a mismatch. A mismatch goes
back to `sdd-engineering:implementer` for the same phase, with its rows.

**architecture check** — on the last phase of the plan that touches source code, `NEXT` asks for
`architecture-review:architecture-reviewer` once the phase is green and before its commit;
`committed` is refused until it is recorded. Give it mode `change`, the file list and a patch of
that code against the base, as `NEXT` says. A CRITICAL or WARNING finding goes back to
`sdd-engineering:implementer` for the same phase — it may touch a file of an earlier phase and
records that as a deviation — then `sdd-engineering:test-writer`, then the check again. Clean →
`$S gate <plan> <n> pass`. This is where layer and placement mistakes are cheap; found only in the
final review they cost amend rounds. Phases added by an amendment have no such check; the final checks run right after them.

**commit** — stage the files both reports list, commit them together, record the commit:

```bash
git add <files> && git commit -m "<type>(<scope>): <what the phase delivers>"
node $S phase <plan> <n> committed --commit "$(git rev-parse HEAD)"
```

One short conventional subject line, no body unless it is needed, no `Co-Authored-By` trailer.

**single-agent mode** — `NEXT` says to build the phase yourself: run
`$P <plan> <n>`, read that slice only, build the file
table and the test work order with the skills each row names, run `Verify (phase)`, then record
`green` and commit as above. The architecture check is optional here: ask, and record a declined
one with `$S gate <plan> <n> skipped`.

## 3. After the last phase

Follow `NEXT` in this order; record each with `$S final <plan> <step> <status> [--note "…"]`.

1. **`verify` and `arch` in parallel.** Give `sdd-engineering:plan-verifier` the plan path, the base and the
   declared deviations from `$S show <plan> --notes`. Give `architecture-review:architecture-reviewer` mode `change`,
   the changed-file list (`git diff --name-status <base>...HEAD`) and a patch written to
   `.sdd/<feature>/change.patch` (`git diff <merge-base> > …`). PASS / no CRITICAL or
   WARNING → `pass`. Otherwise `fail`, and the fix round below. In single-agent mode both checks
   are optional: ask, and record `skipped` when the user declines.

   **Fix round.** Run `sdd-engineering:implementation-planner` with pass `amend`, the plan path and the gaps (the
   Gaps section of the Verification report, the CRITICAL and WARNING findings of the review, each
   with its ID). Show the user its Plan amendment; its "For the user" items — spec gaps go to
   `sdd-engineering:spec-creator` — are settled first. On approval, apply each Replacement as one exact-match
   edit, insert the New phase after the last phase and before `## Out of scope`, commit the plan,
   and run `$S start <plan> --accept-plan-change`: the new phase comes up as the next step and
   every final check starts again.
2. **`docs`** — `sdd-engineering:doc-writer` with the plan path and the changed-file list; apply its "For the main
   session" items. `skipped` when nothing documented changed.
3. **`e2e`** — the project's end-to-end suite, if it has one (find its command in the plan's Verify
   lines or the project docs; ask the user to stop a dev server if the suite needs the port).
   `pass` only on a full pass; `skipped` when there is none.
4. **`insights`** — if the project has a notes file or a skill for recurring findings, record the
   insight candidates (`$S show <plan> --notes`) there and commit what is left, then `done`;
   otherwise `skipped`. This plugin ships no insights skill.
5. **`self-review`** — the project's own review, if it has one (a review skill, a checklist, a
   CI-equivalent command). `pass` only on a pass verdict; `skipped` when there is none. This plugin
   ships no push gate: never push without the user's say.

When `NEXT` says all steps are done, report to the user and ask before any push or PR.

## Commands

| Command | Use |
|---|---|
| `$S start <plan> [--base <ref>] [--per-chat <n>] [--accept-plan-change]` | create or resume; resets the per-chat count |
| `$S show <plan> [--notes] [--json]` | the summary; `--notes` lists deviations, insight candidates and reviewer notes |
| `$S phase <plan> <n> <pending\|code-done\|green\|committed\|blocked> [--verify …] [--deviation …] [--commit <sha>] [--reason …]` | record a phase |
| `$S gate <plan> <n> <pass\|skipped> [--note …]` | record the architecture check of a green phase that owes one |
| `$S note <plan> <insight\|reviewer> "<text>"` | record a note |
| `$S final <plan> <verify\|arch\|docs\|e2e\|insights\|self-review> <pending\|pass\|fail\|skipped\|done> [--note …]` | record a final step |

The rules the script enforces: phases close in order; `committed` needs `--commit`, `blocked`
needs `--reason`; the last original phase that touches source code (read from the file table)
needs its architecture check recorded before `committed`, and new code for it (`code-done`)
clears that record; final steps wait for the last phase; a phase committed after the final checks
started resets them; a plan that changed is refused until accepted, and a phase with recorded
work cannot disappear from it. Tests:
`node --test "${CLAUDE_PLUGIN_ROOT}/scripts/test/"*.test.mjs`.
