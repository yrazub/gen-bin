# Plan: SDD plugins for gen-bin

Status: approved (2026-10-22)
Spec: [`../specs/sdd-plugins.md`](../specs/sdd-plugins.md) (`SPEC-2026-10-22-sdd-plugins`, approved)
Branch: `feature/sdd-plugins`, cut from `origin/main` at `d30d431`. One PR carries spec, plan and code.
Source of every file moved: the DevDigest checkout at `/Users/yrazub/Projects/dev-digest/.claude/`
(read-only; nothing is changed there), at `origin/main` `a572ba0` (PR #22, the retro fixes, is
merged; the working tree of that checkout equals it). Called **SRC** below. Before phase 2,
`git fetch` there and check that `.claude` has no diff against `origin/main`.

## Context read

- gen-bin `CLAUDE.md`: version only in `plugin.json`; `${CLAUDE_PLUGIN_ROOT}` paths; no `bin/`;
  agent frontmatter `hooks`/`permissionMode` ignored; a plugin `CLAUDE.md` is not loaded.
- `.github/scripts/check-version-bump.mjs` and `validate.yml` (version guard, per-plugin validate).
- Plugin docs: dependencies (tags `<plugin>--v<version>`), manifest reference.
- Hooks docs: a hook inside a subagent receives `agent_id` and `agent_type`; in the main session
  `agent_type` is absent unless the session was started with `--agent`. This closes spec risk
  RK-1: the guard can be scoped to `spec-creator`.
- SRC: the eight agent files, `skills/execute-plan`, `skills/workflow-retro`, the ten paved-path
  skills, `agents/scripts/` (`plan-phase.mjs`, `specs-only-guard.mjs`, `lib/plan.mjs`, `test/`).

## Decisions fixed by the spec

Six agents in `sdd-engineering`; no `pr-self-review`, no `engineering-insights`; `architecture-review`
depends on `engineering-paved-path`; defaults `docs/specs/`, `docs/plans/`, `.sdd/<feature>/`;
ten paved-path skills; one new eval (AC-16).

## Constraints that shape the work

1. **`pr-self-review` is not shipped, but the sources lean on it.** `onion-architecture` and
   `frontend-ui-architecture` point at `pr-self-review/references/critical-rules.md` and
   `routing.json`; `architecture-reviewer`, `implementer`, `implementation-planner`,
   `test-writer` and `execute-plan` route skills through `routing.json`. Each such reference is
   replaced by one of: a rules file copied into the skill's own `references/`, or the line
   "the skills the project names for these files".
2. **Hook scope.** `hooks/hooks.json` applies to every session while the plugin is enabled. The
   guard reads `agent_type` from stdin and exits 0 at once unless it names `spec-creator`
   (the plugin form may be `sdd-engineering:spec-creator`; match on the `spec-creator` suffix).
3. **Spec folders are not fixed.** The guard allows `.md` files under any directory named
   `specs` (so `docs/specs/`, `server/specs/`), and still refuses a path under a `plans` folder.
4. **Scripts live inside the plugin.** `sdd-engineering/scripts/` holds `plan-phase.mjs`,
   `specs-only-guard.mjs`, `state.mjs` and `lib/plan.mjs`, so their relative imports keep working.
   Skills and agents call them as `${CLAUDE_PLUGIN_ROOT}/scripts/...`. (The skill-local
   `${CLAUDE_SKILL_DIR}` form works too, but would need `lib/plan.mjs` copied twice.)
5. **Commit rule.** Each plugin is a new directory, so its first commit sets `version: 1.0.0` and
   adds its `## <plugin> 1.0.0` entry to `CHANGELOG.md` in the same commit, or the version guard fails.
6. **Copy, then rewrite.** Moves use `cp -R`, never regeneration; rewriting is by edit, so
   upstream wording survives. No pnpm/yarn lockfiles; Node scripts use no dependencies.

## Target tree

```
plugins/
├── engineering-paved-path/
│   ├── .claude-plugin/plugin.json
│   ├── README.md
│   └── skills/<10 skills>/        (evals/ kept where the source had one)
├── research-tools/
│   ├── .claude-plugin/plugin.json
│   ├── README.md
│   └── agents/researcher.md
├── architecture-review/
│   ├── .claude-plugin/plugin.json
│   ├── README.md
│   └── agents/architecture-reviewer.md
└── sdd-engineering/
    ├── .claude-plugin/plugin.json          (dependencies: the three above, ^1.0.0)
    ├── README.md
    ├── agents/{spec-creator,implementation-planner,implementer,plan-verifier,test-writer,doc-writer}.md
    ├── hooks/hooks.json
    ├── scripts/{plan-phase.mjs,specs-only-guard.mjs,state.mjs,lib/plan.mjs,test/*.test.mjs}
    └── skills/{run-plan,workflow-retro}/
.github/scripts/check-no-devdigest.mjs      (new, AC-7)
```

## Phase 1: Scaffold the four plugins and the catalog

| File | Change |
|---|---|
| `plugins/<name>/.claude-plugin/plugin.json` ×4 | `name`, `version: "1.0.0"`, `description`, `author`, `license: MIT`, `repository`. `sdd-engineering` adds `dependencies`: `{ "name": "engineering-paved-path", "version": "^1.0.0" }`, same for `research-tools`, `architecture-review`. `architecture-review` depends on `engineering-paved-path` the same way. |
| `.claude-plugin/marketplace.json` | four entries: `name`, `source: "./plugins/<name>"`, `description`; no `version` |
| `CHANGELOG.md` | four `## <name> 1.0.0` headings (New: the components, filled as phases land) |

The plugins have no components yet, so validation of a manifest-only plugin may warn; that is
expected until phase 2–4.

**Verify:** `claude plugin validate .`; `claude plugin validate plugins/<name>` ×4;
`node .github/scripts/check-version-bump.mjs origin/main`.
**Done when:** AC-1, AC-2, AC-3 (manifest part).

## Phase 2: `engineering-paved-path`

| File | Change |
|---|---|
| `plugins/engineering-paved-path/skills/<skill>/` ×10 | `cp -R` from SRC `skills/`: `react-best-practices`, `next-best-practices`, `fastify-best-practices`, `frontend-ui-architecture`, `onion-architecture`, `react-testing-library`, `security`, `zod`, `typescript-expert`, `mermaid-diagram`. Keep each `evals/` (`onion-architecture`, `frontend-ui-architecture`). |
| `onion-architecture/**`, `frontend-ui-architecture/**` | remove DevDigest facts (`server/`, `reviewer-core/`, `pnpm arch:check`, `.claude/skills/` paths). Copy the rules the skills cite from `pr-self-review/references/critical-rules.md` into the skill's own `references/critical-rules.md`; drop `routing.json` mentions. Make the dependency-cruiser parts generic ("if the project has an architecture check, run it"). |
| `onion-architecture/evals/evals.json`, `frontend-ui-architecture/evals/` | strip DevDigest paths; drop `results-1.0.0.md` if it records DevDigest runs |
| other skills | remove only strings that AC-7 forbids; do not rewrite content |
| `plugins/engineering-paved-path/README.md` | the ten skills in a table (name, when it applies); install command; attribution table for `fastify-best-practices`, `next-best-practices`, `zod`, `typescript-expert` with upstream repository from SRC `skills-lock.json` and the licence found in the folder (AC-17) |

**Verify:** `claude plugin validate plugins/engineering-paved-path`;
`grep -rniE 'devdigest|\.devdigest|CLAUDE_PROJECT_DIR|arch:check|wrapUntrusted|groundFindings|execute-plan' plugins/engineering-paved-path` returns nothing.
**Done when:** AC-6 (paved-path part), AC-7, AC-15, AC-17 for this plugin.

## Phase 3: `research-tools` and `architecture-review`

| File | Change |
|---|---|
| `plugins/research-tools/agents/researcher.md` | copy from SRC; remove the one `server/` example; keep tools `Read, Grep, Glob, Bash, WebSearch, WebFetch`, `model: sonnet` |
| `plugins/architecture-review/agents/architecture-reviewer.md` | copy; generalize: reads the architecture skills by namespaced name (`engineering-paved-path:onion-architecture`, `engineering-paved-path:frontend-ui-architecture`) and the project's own `CLAUDE.md` rules; remove `pnpm arch:check`, `routing.json`, `pr-self-review` mentions and DevDigest folder rules; keep read-only `Read, Grep, Glob`, output template unchanged |
| the two `README.md` files | what the agent does, how to call it (`research-tools:researcher`), what it does not do |

**Verify:** `claude plugin validate` on both; the same grep as phase 2 over both directories.
**Done when:** AC-6, AC-7, AC-9 for these two plugins.

## Phase 4: `sdd-engineering`

| File | Change |
|---|---|
| `scripts/plan-phase.mjs`, `scripts/lib/plan.mjs`, `scripts/specs-only-guard.mjs` | copy from SRC `agents/scripts/` |
| `scripts/state.mjs`, `scripts/test/**` | copy from SRC `skills/execute-plan/scripts/` and `agents/scripts/test/`; fix the `../../../agents/scripts/lib/plan.mjs` import to `./lib/plan.mjs`; default state dir `.sdd/<feature>/` instead of `.devdigest/sdd/` |
| `scripts/specs-only-guard.mjs` | rewrite per constraints 2 and 3: parse stdin; exit 0 unless `agent_type` ends with `spec-creator`; then allow only `.md` under a `specs` directory inside the project, never under `plans`; keep symlink resolution and fail-closed parsing for the `spec-creator` case |
| `hooks/hooks.json` | `PreToolUse`, matcher `Write\|Edit`, command `node "${CLAUDE_PLUGIN_ROOT}/scripts/specs-only-guard.mjs"` |
| `agents/*.md` ×6 | copy from SRC; remove `hooks:` and `permissionMode:` from frontmatter; replace bare agent and skill names by `sdd-engineering:…`, `engineering-paved-path:…`, `research-tools:researcher`, `architecture-review:architecture-reviewer`; replace fixed folders by the D-4 defaults and "unless the task says otherwise"; remove `pnpm`, `server/`, `client/`, `reviewer-core/`, `mcp/`, `TESTING.md`, `INSIGHTS.md`, `routing.json`, `wrapUntrusted`, `groundFindings`; script calls become `${CLAUDE_PLUGIN_ROOT}/scripts/plan-phase.mjs` |
| `skills/run-plan/SKILL.md` | from SRC `execute-plan`: rename; namespaced agent calls; plan path and state dir as inputs with D-4 defaults; final steps per D-2; scripts via `${CLAUDE_PLUGIN_ROOT}/scripts/state.mjs`; keep the "new chat every three phases" rule |
| `skills/workflow-retro/**` | copy; ledger path becomes an input defaulting to `docs/retros/ledger.md`; keep `analyze_journals.py` and `tile.json` only if `claude plugin validate` accepts the latter, else drop it |

**Verify:** `node --test plugins/sdd-engineering/scripts/test/` passes;
`claude plugin validate plugins/sdd-engineering`; the phase 2 grep over the directory, plus
`grep -rnE '(^|[^:/-])(test-writer|implementer|plan-verifier|doc-writer|spec-creator|implementation-planner)' plugins/sdd-engineering/skills`
shows no un-namespaced agent call; hook check below.
**Hook check (AC-10):** pipe three JSON inputs into the guard: `agent_type: "spec-creator"` with a
`src/a.ts` path → exit 2; same agent with `docs/specs/a.md` → exit 0; no `agent_type` with
`src/a.ts` → exit 0. Add them to `scripts/test/` as a test file.
**Done when:** AC-5, AC-7, AC-8, AC-9, AC-10, AC-19.

## Phase 5: README and release notes

| File | Change |
|---|---|
| `plugins/sdd-engineering/README.md` | install command; dependency graph (Mermaid); the chain spec → plan → implement → review → verify → doc with what each agent hands over and which paved-path skills it uses; defaults and how to override (D-4); what is not included and why (D-2); the hook and what it blocks; how to update and re-enable a disabled dependency (EC-3); link to `CHANGELOG.md` |
| `README.md` (root) | replace the "No plugins published yet" row by four rows with version and one-line purpose |
| `CHANGELOG.md` | complete the four entries: skills and agents added, hook, known limits |

**Verify:** `claude plugin validate .`; every relative link in the READMEs resolves; the catalog
site builds (`cd site && npm ci && npm run build`) and lists four plugins.
**Done when:** AC-11, AC-12.

## Phase 6: Checks that keep the result honest

| File | Change |
|---|---|
| `.github/scripts/check-no-devdigest.mjs` | fail if any file under `plugins/` contains a forbidden string from AC-7, or a bare `execute-plan` |
| `.github/workflows/validate.yml` | add a step running it; add `--strict` to both validate steps now that the catalog is non-empty and delete the TODO (AC-14) |
| `plugins/sdd-engineering/skills/run-plan/evals/` or `.github/scripts/check-namespaces.mjs` | AC-16: for each plugin, every `plugin:name` reference in agents and skills points at a component that exists in this repository. Use `claude plugin eval` if the CLI version pinned in `validate.yml` supports it, else the script |

**Verify:** both scripts exit 0 on the tree and exit 1 after a one-line deliberate break (run, then revert);
`claude plugin validate . --strict`.
**Done when:** AC-14, AC-16, AC-7 enforced in CI.

## Phase 7: Walk-through and release (after review; the user pushes and merges)

1. Local load (AC-18): `claude --plugin-dir plugins/sdd-engineering --plugin-dir plugins/engineering-paved-path --plugin-dir plugins/research-tools --plugin-dir plugins/architecture-review`
   in a scratch repository; run `spec-creator` discovery, then `implementation-planner` review on a
   toy request; confirm the hook blocks a write to `src/`. Record the transcript in the PR.
2. After the PR is merged: from each plugin directory on `main`, `claude plugin tag --dry-run`,
   then `claude plugin tag --push` ×4 (AC-13). If the command refuses because the catalog entry has
   no `version` (RK-2), use `git tag <plugin>--v1.0.0` and push the tags.
3. Clean machine check: `claude plugin marketplace add yrazub/gen-bin`, `claude plugin install sdd-engineering@gen-bin`,
   `claude plugin list` shows all four (AC-4).

**Done when:** AC-4, AC-13, AC-18.

## Out of scope

`pr-self-review`, `engineering-insights`, the database skills, `site/` changes, any edit in the
DevDigest repository, a custom domain.

## Risks

- **Agent name form.** If Claude Code reports `agent_type` without the plugin prefix, the suffix
  match still works; if it reports something else, phase 7 step 1 catches it. Fallback: drop the
  hook and rely on `spec-creator`'s tool list (`Read, Grep, Glob, Write, Edit`) and prompt.
- **Skills that cite removed neighbours.** Phase 2–4 greps catch names; they do not catch prose
  that depends on `pr-self-review` behaviour. Review each edited skill once, by reading the diff.
- **Size of the rewrite.** The six agent files total about 1,500 lines; keep edits to the strings
  listed above and report anything larger as a deviation.

## Open questions

None.
