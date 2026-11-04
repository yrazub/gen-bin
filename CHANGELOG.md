# Changelog

Each release adds a `## <plugin> X.Y.Z` heading with New / Changed / Fixed sections
that name the skills and agents affected. Newest first.

## sdd-engineering 1.1.1

### Fixed

- `implementation-planner` split work into more phases than it needed: a contract always got its
  own phase, and only an upper bound limited phase size. In two runs of the same feature it
  planned 3 and 5 phases, and each extra phase costs a fresh implementer and test-writer run. The
  planner now uses as few phases as the criteria allow, puts a single-package contract into the
  phase that first uses it, and states the reason for the phase count in the plan header.

## sdd-engineering 1.1.0

### Changed

- `run-plan`: the final architecture review is skipped when the early architecture check of the
  last code phase passed and the code has not changed since. `state.mjs gate … pass` records a
  hash of the files under the plan's code directories; when the final checks begin on the same
  hash, the `arch` step is recorded as `skipped` with the reason, and `NEXT` asks only for
  `plan-verifier`. Changed code (a fix phase, a later edit) still gets the full review.

### Fixed

- `run-plan`: a verified feature now ends with its spec marked `Status: done`. Nobody owned that
  step before, so specs stayed `approved`. A new final step `spec` comes after `verify` and `arch`
  pass: `NEXT` names the spec from the plan's `**Spec:**` line, and `state.mjs final … spec done`
  is refused until the spec says `done`. A plan without a spec records the step as `skipped`.
  State files written by 1.0.0 resume with the step pending.

## sdd-engineering 1.0.0

### New

- Agents: `spec-creator`, `implementation-planner`, `implementer`, `plan-verifier`, `test-writer`,
  `doc-writer`. Calls between components use namespaced names.
- Skills: `run-plan` (state-file driven execution of a plan, resumable across chats) and
  `workflow-retro`.
- Hook `PreToolUse` on `Write|Edit` that confines `spec-creator` to Markdown files in a `specs`
  folder; it does nothing for any other agent or the main session.
- Scripts in `scripts/`: `plan-phase.mjs`, `state.mjs`, `specs-only-guard.mjs`, with tests.
- README with the dependency graph, the chain and its handovers, the hook and the limits.
- Defaults: specs in `docs/specs/`, plans in `docs/plans/`, run state in `.sdd/<feature>/`
  (`SDD_STATE_DIR` overrides it).

### Known limits

- No push gate and no insights skill: the final steps of `run-plan` use the project's own review
  and notes when it has them, and are skipped otherwise.

## architecture-review 1.0.0

### New

- Agent `architecture-reviewer`: read-only review of a change or a module against the layer and import rules of `engineering-paved-path:onion-architecture` and `engineering-paved-path:frontend-ui-architecture`.
- README.

## research-tools 1.0.0

### New

- Agent `researcher`: read-only repository and external research with a structured report.
- README.

## engineering-paved-path 1.0.0

### New

- Skills: `react-best-practices`, `next-best-practices`, `fastify-best-practices`,
  `frontend-ui-architecture`, `onion-architecture`, `react-testing-library`, `security`, `zod`,
  `typescript-expert`, `mermaid-diagram`.
- `onion-architecture` and `frontend-ui-architecture` are project-neutral and keep their evals;
  the engine reference is now `pure-engine.md`.
- README with the skill table and the upstream attribution for four skills.
