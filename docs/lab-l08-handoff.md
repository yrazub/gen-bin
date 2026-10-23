# L08 lab handoff: marketplace, release, cost experiment

Written 2026-10-23 so a new chat can continue without the previous one. Everything here was
checked in that chat unless marked **unverified**. Not committed on purpose: it belongs to the next
feature, not to PR #4.

## 1. Where things stand

| Item | State |
|---|---|
| Repository | `/Users/yrazub/Projects/gen-bin`, remote `https://github.com/yrazub/gen-bin` |
| Branch | `feature/sdd-plugins`, 8 commits ahead of `origin/main` (`d30d431`), pushed |
| Pull request | #4 (`feature/sdd-plugins` → `main`). On the last screenshot: all checks passed (2 successful, 1 skipped), no conflicts, not yet merged. Check the real state on GitHub before assuming |
| Catalog site | <https://yrazub.github.io/gen-bin/> (deployed from `main` by `pages.yml`) |
| Test project | `~/Projects/ai-sandbox`, remote `https://github.com/yrazub/ai-sandbox`, `main` pushed at `7bffd97` with the noreply author email |
| Tags | none yet (`git tag -l` is empty) |
| Marketplace on this machine | `gen-bin` is registered from GitHub (`yrazub/gen-bin`), no plugins installed |

### What PR #4 contains
Four plugins, all `1.0.0`, `version` only in `plugin.json`, catalog entries without `version`:

| Plugin | Contents | Depends on |
|---|---|---|
| `engineering-paved-path` | 10 skills: react-best-practices, next-best-practices, fastify-best-practices, frontend-ui-architecture, onion-architecture, react-testing-library, security, zod, typescript-expert, mermaid-diagram | none |
| `research-tools` | agent `researcher` | none |
| `architecture-review` | agent `architecture-reviewer` | `engineering-paved-path ^1.0.0` |
| `sdd-engineering` | agents spec-creator, implementation-planner, implementer, plan-verifier, test-writer, doc-writer; skills run-plan, workflow-retro; hook; scripts; README | the other three, `^1.0.0` |

Other things in the PR: `.github/scripts/check-no-devdigest.mjs` (forbidden strings under
`plugins/`), `.github/scripts/check-namespaces.mjs` (every `plugin:component` reference resolves
and the plugin depends on the one it names), `validate.yml` with `--strict`, a step that runs the
scripts' tests, spec `docs/specs/sdd-plugins.md` (`SPEC-2026-10-22-sdd-plugins`, decisions D-1…D-6)
and plan `docs/plans/sdd-plugins.md` (phases 1–6 done; phase 7 not done).

Plan phase 7, still open: local load with `--plugin-dir`, hook check in a real session, tags
`<plugin>--v1.0.0`, clean-machine install check. It must not be started without the user.

### Facts about the implementation worth knowing
- Hook: `plugins/sdd-engineering/hooks/hooks.json`, `PreToolUse`, matcher `Write|Edit`, runs
  `node "${CLAUDE_PLUGIN_ROOT}/scripts/specs-only-guard.mjs"`. The guard exits 0 at once unless
  `agent_type` ends with `spec-creator`; for that agent it allows only `.md` files under a
  directory named `specs`, never under `plans`. Tested with 7 cases. **Unverified in a real
  session:** that Claude Code sends `agent_type` for a plugin agent in this form.
- Scripts live in `plugins/sdd-engineering/scripts/`: `plan-phase.mjs`, `state.mjs`,
  `specs-only-guard.mjs`, `lib/plan.mjs`, `test/*.test.mjs` (32 tests). Project root is
  `process.cwd()`; state goes to `.sdd/<feature>/` (`SDD_STATE_DIR` overrides).
- Run the tests with a glob: `node --test "plugins/sdd-engineering/scripts/test/"*.test.mjs`
  (`node --test <directory>` fails on Node 25).
- Defaults in a foreign repo: specs `docs/specs/`, plans `docs/plans/`, state `.sdd/<feature>/`.
- Not shipped on purpose (D-2): `pr-self-review`, `engineering-insights`, database skills. The last
  steps of `run-plan` (`e2e`, `insights`, `self-review`) run the project's own tools if it has
  them, else are marked `skipped`.
- Known gaps: no licence file was found in the four third-party skill folders
  (`fastify-best-practices`, `next-best-practices`, `zod`, `typescript-expert`); the README names
  the upstream repositories only. `ICON_MISSING` appears as a non-blocking warning in
  `claude plugin validate` for each plugin.

## 2. The homework (main task only; the optional Agent Performance Dashboard task is out of scope)

Page: <https://www.edu.goit.global/learn/53989320/53167848/53168026/homework> (login needed;
read it with the chrome-devtools MCP, see the memory note about the browser). The page shows a
deadline of 23:45, 18 Oct; today is 23 Oct, so ask the user whether it was extended.

Task: bring the marketplace, release, cost experiment, installation into another project and a
rollback rehearsal to a working state.

**Deliverables**
1. Demo video: repository marketplace, catalog UI, installation of `sdd-engineering@1.0.0`, a
   verified workflow, update to `1.1.0`, return through the stable channel.
2. Link to the repository with manifests, plugins, docs, release tags and GitHub Pages.
3. Link to a pull request or commit in the project where the plugin is installed.
4. `docs/COST-BASELINE.md` with a baseline, one optimization and a quality gate.

**Acceptance criteria**
1. `sdd-engineering@1.0.0` works without local DevDigest files.
2. Dependencies install and activate without errors in `claude plugin list --json`.
3. The catalog UI shows the current composition and version.
4. A trace or telemetry confirms the active version.
5. The new `1.1.0` behaviour passes an eval.
6. Cost per successful workflow is recorded before and after the optimization.
7. The stable channel returns the verified `1.0.0` and the smoke eval stays green.

### Status against the criteria

| # | Status | Next action |
|---|---|---|
| AC1 | partial | install in `ai-sandbox` (no DevDigest files there), run the workflow |
| AC2 | not checked | `claude plugin list --json` after install; needs tags for `^1.0.0` |
| AC3 | partial (local build lists 4 plugins with `1.0.0`) | check the live site after the merge |
| AC4 | not done | see section 4, `plugin_loaded` event |
| AC5 | not done | see lab step 11 |
| AC6 | not done | see lab step 8 |
| AC7 | not done | see lab step 11 |
| D1–D4 | not done | order in section 5 |

## 3. The lab, step by step

Source: the course page "Hands-On Lab (video 2) — Cost Surgery live"
(<https://www.edu.goit.global/uk/learn/53989320/53167848/53168026/training?blockId=53203570>), and
the transcript `~/Downloads/L08. Лабораторна робота.sbv` (54:19, Ukrainian, auto-generated, noisy).
The page's timecode list is two parallel chats interleaved, so it is not in order and `32:34`
appears twice; timecodes are right within 1–2 minutes. What the video shows: a marketplace repo,
the four plugins, a catalog site, install into a second project (a small blog repo), then a patch
release of `research-tools` (`1.0.2`) to test auto-update. The video does **not** show a cost
experiment, evals, a stable channel or telemetry; those are only in the page text below.

Prerequisites listed on the page: DevDigest after L07; an empty marketplace repository; another
existing repository with its own instructions and test commands but without our components; drafts
of the three dependency plugins; **one fixed scenario** ("the user asks for a spec and a plan for a
small feature"); **a small eval set** for it with acceptance criteria.

1. **Repository.** Separate from the product. Expected layout: `.claude-plugin/marketplace.json`,
   `.github/workflows/{validate,pages}.yml`, `plugins/<four>`, `docs/{PLUGIN-GUIDELINES,SITE-SPEC,
   SECURITY,RELEASES,COST-BASELINE}.md`, `scripts/build-index.mjs`, `site/`, `CODEOWNERS`,
   `CONTRIBUTING.md`, `README.md`. `SECURITY.md` forbids secrets and absolute paths and defines
   what to do after a bad release; `RELEASES.md` explains SemVer, tags, update, release channels
   and rollback. Check: a new author can prepare a PR without asking where files go.
2. **Split portable from local.** Four groups: reusable (skills, agents, hooks, evals without
   product paths), project-specific (CLAUDE.md, product specs, module names), optional
   integrations (MCP, network, credentials), local leftovers (cache, memory, absolute paths).
   First release takes the SDD workflow. Each file must have an owner, a consumer scenario and a
   reason it updates with the plugin.
3. **Dependency graph.** `sdd-engineering` → `engineering-paved-path ^1.0.0`, `research-tools
   ^1.0.0`, `architecture-review ^1.0.0`; `architecture-review` → `engineering-paved-path`. Keep
   only skills that are needed ("a list for later" grows discovery context). Namespaced references.
   Check: `claude plugin list --json` has no `dependency-unsatisfied`, `range-conflict` or
   `no-matching-tag`.
4. **Assemble `sdd-engineering`.** Copy, then an editorial pass: remove DevDigest paths, make
   repository structure an explicit input, review each agent's tools and permissions, namespaced
   dependencies, document where spec and plan are created, define behaviour when no test command is
   found, `${CLAUDE_PLUGIN_ROOT}` for plugin files, `${CLAUDE_SKILL_DIR}` for a script inside a
   skill, no credentials in the manifest, remove duplicated instructions between agents and skills.
   Add `COMPATIBILITY.md` (Claude Code `>=2.1.110`, because of version-constrained dependencies),
   `CHANGELOG.md`, an `evals/` folder. Check: the plugin reads no undocumented DevDigest file.
5. **Register in `marketplace.json`** (four entries, `source: ./plugins/<name>`). Do not duplicate
   `version` between `plugin.json` and the entry. Check: `claude plugin validate .` sees four
   plugins and names match.
6. **Catalog on GitHub Pages.** `docs/SITE-SPEC.md`, `scripts/build-index.mjs` generating
   `index.json`, `releases.json`, `stats.json`, `bodies/`; React + TypeScript + Vite (this repo
   uses Astro instead, which is fine). Check: plugin and nested skills are searchable, version and
   dependencies match the manifest, "Copy install" copies the right command.
7. **Validate structure and behaviour.** `claude plugin validate ./plugins/sdd-engineering` and
   `claude plugin validate .`. Then load with `--plugin-dir` ×4 and check behaviour: spec-creator
   asks the needed questions and writes a spec without implementation details; implementation-
   planner reads the finished spec and does not invent requirements; run-plan hands tasks to
   implementer; the review gate calls the generalized architecture-reviewer; plan-verifier checks
   acceptance criteria; workflow-retro runs only on explicit request; namespaced skills load without
   warnings; **a non-relevant request does not activate the SDD workflow** (negative eval). Both
   schema validation and behaviour evals are needed. (The page says `--strict` is not in the
   documented command; the CLI here accepts it and CI is green with it.)
8. **Cost baseline and one optimization.** Run the fixed SDD scenario several times on the same
   model and eval set. In `docs/COST-BASELINE.md` record: plugin and commit SHA; model;
   input/output/cache tokens; number of API and tool calls; **median cost and latency**; pass rate;
   critical errors. Pick **one** change; the suggested one is removing duplicated instructions from
   agent prompts and leaving detail in skill references that load on demand. **Do not change the
   model and the routing at the same time.** Re-run the same eval set. The optimization passes if
   the quality gate is green, no critical false negatives were added, and cost or latency really
   dropped. If the difference is inside the noise, write that down; do not invent savings.
9. **Release `1.0.0`.** Dependencies first, then the consumer. Tags
   `engineering-paved-path--v1.0.0`, `research-tools--v1.0.0`, `architecture-review--v1.0.0`,
   `sdd-engineering--v1.0.0`; from each plugin directory `claude plugin tag --dry-run` then
   `claude plugin tag --push`. Review `CHANGELOG.md`, the commit SHA and eval results first. The tag
   must point at a commit that passed CI.
10. **Install in another project.** The target must have no local copies of the SDD agents/skills.
    `claude plugin marketplace add <owner>/<repo> --scope project`, then
    `claude plugin install sdd-engineering@<marketplace> --scope project`, then
    `claude plugin list --json`. New session or `/reload-plugins`. Walk a short feature: spec-creator
    available, spec in the documented path, planner builds the plan, run-plan starts implementer,
    researcher available, architecture-reviewer and plan-verifier form an independent gate,
    workflow-retro manual, **trace or telemetry shows plugin/version and dependencies**, references
    and scripts available after install, `analyze_journals.py` works via `${CLAUDE_SKILL_DIR}`,
    project instructions are not overridden. Check: a foreign repo passes the workflow without
    DevDigest files or manual copying.
11. **Update to `1.1.0` and rollback.** The `1.1.0` change is backward-compatible: **`spec-creator`
    does not finish a spec until every required requirement has an acceptance criterion.** Steps:
    change the agent instruction; add an eval; update the changelog; bump to `1.1.0`; run old and
    new evals; tag `sdd-engineering--v1.1.0`. In the target project:
    `claude plugin marketplace update <marketplace>` then
    `claude plugin update sdd-engineering@<marketplace> --scope project`; `/reload-plugins` or a
    new session; repeat the scenario; telemetry must show the new version and a spec without
    acceptance criteria must not pass. **Rollback rehearsal:** through a prepared `stable`
    marketplace pinned to a ref or SHA of release `1.0.0`: disable or remove the current channel,
    install `sdd-engineering` from stable, reload plugins, run the smoke eval. There is no
    `plugin rollback` command; do not invent one. Return to `latest` only after the command sequence
    is recorded and it is confirmed the user does not lose plugin data. If the plugin could change
    external state, describe its recovery separately.

**End-of-lab checklist (from the page):** marketplace lives apart from DevDigest; contribution,
security, releases and cost baseline documented; four plugins with boundaries, owners and
versions; dependencies resolve; Pages shows the current catalog with dependencies and READMEs;
architecture-reviewer has no DevDigest paths; sdd-engineering uses namespaced dependencies;
validation, behaviour evals and negative evals are green; `1.0.0` installs into another existing
project; supporting files and scripts are not lost in the plugin cache; the cost experiment has a
baseline, a quality gate and an honest result; catalog update and plugin update verified
separately; `1.1.0` behaviour confirmed by an eval; stable returns `1.0.0` and the smoke eval
passes. Final proof: a colleague adds the marketplace, installs `sdd-engineering`, passes a short
workflow, updates, and returns to the verified version without your local files or chat help.

### Gaps in this repository against the lab
Missing: `docs/RELEASES.md`, `docs/SECURITY.md`, `docs/PLUGIN-GUIDELINES.md`, `CONTRIBUTING.md`,
`CODEOWNERS`, `plugins/sdd-engineering/COMPATIBILITY.md`, `plugins/sdd-engineering/evals/`, the
fixed scenario and eval set, `docs/COST-BASELINE.md`, tags, a stable channel, telemetry evidence.
Present: marketplace, four plugins, validation CI, catalog site (Astro, not Vite), changelog.

## 4. Verified facts from the Claude Code documentation

- **No release-channel concept.** Run channels with two marketplaces whose entries point at
  different refs of the same plugin, or add one marketplace pinned with `#<ref>`, for example
  `/plugin marketplace add yrazub/gen-bin#stable`. Two marketplaces cannot share a `name`. Give the
  two refs different `version` values, because an update is detected by comparing versions.
  Source: <https://code.claude.com/docs/en/plugins/host-marketplace> (sections "Hold users on one
  version" and "Run release channels").
- **Updates.** A user gets a new copy of a plugin only when its computed version changes (from
  `plugin.json` first). Auto-update is off by default for third-party marketplaces; users turn it
  on in `/plugin` → Marketplaces → Enable auto-update, or run `/plugin marketplace update <name>` /
  `claude plugin update <plugin>@<name>`.
- **Dependency tags.** A dependency's version range resolves against git tags
  `<plugin>--v<version>`. Pinning a source: `ref` and `sha` on a plugin entry.
- **Telemetry.** The event `claude_code.plugin_loaded` is logged once per enabled plugin at session
  start with `plugin.name`, `marketplace.name`, `plugin.version` (from the manifest), `plugin.scope`
  and `enabled_via`. For a third-party marketplace `plugin.name` is replaced by `third-party`, and
  the version is then omitted, unless `OTEL_LOG_TOOL_DETAILS=1` is set. Cost: metric
  `claude_code.cost.usage` and `cost_usd` on `api_request` events (estimates); per-workflow grouping
  by `workflow.run_id`. Source: <https://code.claude.com/docs/en/monitoring-usage>. **Unverified:**
  the exact environment variables that switch telemetry export on; read that page first.
- `claude plugin eval` exists (mentioned in the Claude Code guide agent's description); its format
  and sandbox were **not** read. Check the docs before writing evals.
- `workflow-retro` (in `sdd-engineering`) can compute tokens and cost from session journals with
  `skills/workflow-retro/scripts/analyze_journals.py`; a candidate source for baseline numbers.

## 5. Suggested order of work

1. User merges PR #4 (use a merge commit, not squash; check the target branch is `main`).
2. In `~/Projects/ai-sandbox`: marketplace add and install with `--scope project`,
   `claude plugin list --json`, then check the hook in a real session (`spec-creator` must be
   blocked from writing `src/a.ts`, the main session must not be). Commit the resulting
   `.claude/settings.json` in `ai-sandbox`: this is deliverable 3.
3. Tags `<plugin>--v1.0.0` for all four, dependencies first, **only after step 2 passes and only
   when the user says so**. If `claude plugin tag` refuses because the catalog entry has no
   `version`, plain `git tag` and push works (plan risk RK-2).
4. Write the missing documents (RELEASES, SECURITY, GUIDELINES, CONTRIBUTING, CODEOWNERS,
   COMPATIBILITY).
5. Fixed scenario, eval set, behaviour and negative evals for `1.0.0`.
6. Cost baseline on `1.0.0`, one optimization (duplicated instructions), repeat, write
   `docs/COST-BASELINE.md`.
7. `1.1.0` (acceptance criterion per requirement in `spec-creator`), eval, changelog, tag.
8. Stable channel (`#stable` ref or a second marketplace with another name), update and rollback
   in `ai-sandbox`, smoke eval, telemetry evidence.
9. Demo video, saved on the Desktop as `hw8-<feature>-demo.mp4` (see the user's memory notes).

Steps 4–8 are a new feature: per the user's rule (one feature branch, one PR carrying spec, plan
and code), start with a spec and a plan on a new branch from `main`, not on `feature/sdd-plugins`.

## 6. Working rules and traps for the next chat

User's rules (from `CLAUDE.md` and memory):
- Talk to the user in Ukrainian; write artifacts, plans, specs, docs, code and commit messages in
  English.
- Commits are conventional, `type(scope): subject`, short, **no `Co-Authored-By` line**.
- One PR per feature branch. **Never push without the user's explicit command, and never offer to
  open a PR; the user opens PRs.** End a push report at the push, with no PR-status line unless it
  was just checked.
- Any change under `plugins/<name>/` needs a `version` bump in `plugin.json` and a `## <name> X.Y.Z`
  entry in `CHANGELOG.md` in the same commit, or `check-version-bump.mjs` fails.
- Run `claude plugin validate . --strict` before every push.
- Do not start the dev-digest stack; do not run heavy things in parallel (16 GB laptop, at most
  about 4 sub-agents).
- Do not assert unchecked state: say what was verified and what was not.

Traps hit in the previous chat:
- **Pushes outside this session's repositories are blocked** by the auto-mode classifier
  ("Out-of-Place Publication"). `gen-bin` pushes worked; `ai-sandbox` did not. The user ran that push
  themselves. Do not try to bypass it; ask the user to run the command (the `!` prefix in the chat
  input runs it as the user).
- **GitHub rejects pushes that publish the private email** (`GH007`). Use the noreply author
  `3244321+yrazub@users.noreply.github.com` in every repo; check `git config user.email` in new ones.
- The user may be frustrated by repeated questions; give the one concrete next step and do not offer
  menus. The user does not know shell details; spell commands out.
- The course pages are behind a login. Use the chrome-devtools MCP attached to the user's own
  Chrome (`--autoConnect`); open a tab, read it, close only the tab you opened.
- `ai-sandbox` is nearly empty (`package.json`, `src/items.ts`, `.gitignore` with `.sdd/` and
  `node_modules/`). The lab uses a real small project as the target; a richer one may make the
  workflow walk-through more convincing. That is the user's call.

## 7. Open questions for the user
- Was the deadline (18 Oct) extended?
- Is the first step still to merge PR #4 before testing the install, as agreed?
- Should the course's fixed scenario be a small feature of `ai-sandbox`?
- Telemetry: is an OpenTelemetry collector available, or is the console exporter enough as evidence?
