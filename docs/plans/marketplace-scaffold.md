# Plan: scaffold an empty Claude Code plugin marketplace in gen-bin

Status: approved; phases 1–4 done on `chore/marketplace-scaffold`, phase 5 pending
Scope: turn `yrazub/gen-bin` into a valid, installable marketplace with **no plugins yet**.
Moving the DevDigest skills and agents in is a separate, later plan. This plan lists
what that move will need to deal with ("Notes for the migration plan") so the scaffold
doesn't block it.

Sources: [Create a marketplace](https://code.claude.com/docs/en/plugin-marketplaces),
[Marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference),
[Host and maintain](https://code.claude.com/docs/en/plugins/host-marketplace),
[Plugin loading](https://code.claude.com/docs/en/plugins/loading),
[anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official).

## Decisions

| # | Decision | Proposal | Why |
|---|---|---|---|
| D1 | Marketplace `name` | `gen-bin` | Users type it after `@` (`x@gen-bin`). It's a valid, unreserved name. Renaming it later forces every user to re-add the marketplace, so settle it now. |
| D2 | Plugin layout | Each plugin's files live in this repo under `plugins/<name>/` and are referenced by a relative path `./plugins/<name>`. | A git-hosted marketplace clones the whole tree, so relative paths resolve. `metadata.pluginRoot` would need Claude Code ≥ 2.1.239 on every user's machine; explicit `./` paths work everywhere. |
| D3 | Version policy | Semver `version` goes **only** in each plugin's `plugin.json`, never in its `marketplace.json` entry. Every change to a plugin bumps it. CI enforces the bump (phase 4). | Users get an update only when the computed version changes. If `version` is set in both files, `plugin.json` silently wins and the two drift. Omitting `version` (commit SHA) would also work, but then every commit to the repo counts as a new version of every plugin. |
| D4 | License | MIT for content written here. A third-party skill keeps its upstream license; see migration note M5. | A public marketplace needs an explicit license. |
| D5 | Repository visibility | Public, as the GitHub repository already is. | A public repo needs no credentials; the README only mentions `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` for machines without a GitHub SSH key. |
| D6 | `dev-digest.code-workspace` | Leave it out of the repo through `.gitignore`. | It points at `../dev-digest`, a path that exists only on this machine. |

## Target tree after this plan

```
gen-bin/
├── .claude-plugin/
│   └── marketplace.json          # the catalog; empty plugins array
├── plugins/
│   └── .gitkeep                  # plugin roots go here: plugins/<name>/
├── docs/plans/marketplace-scaffold.md
├── .github/workflows/validate.yml
├── CLAUDE.md                     # maintainer rules (repo root, not inside a plugin)
├── CHANGELOG.md
├── LICENSE
├── README.md
└── .gitignore
```

## Phase 1: Catalog file

Create `.claude-plugin/marketplace.json`:

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "gen-bin",
  "description": "Skills and agents for spec-driven development with Claude Code, extracted from DevDigest",
  "owner": {
    "name": "Iurii Razubaiev",
    "url": "https://github.com/yrazub"
  },
  "plugins": []
}
```

- Leave `renames` and `forceRemoveDeletedPlugins` out until a plugin is first renamed or removed.
- Leave `owner.email` out unless you want it published.

**Verify:** `claude plugin validate .` passes. The only expected warning is
`Marketplace has no plugins defined`.

## Phase 2: Repository files

1. **`.gitignore`**: `.DS_Store`, `node_modules/`, `dev-digest.code-workspace`.
2. **`LICENSE`**: MIT, copyright Iurii Razubaiev, 2026.
3. **`README.md`**:
   - what the marketplace is for;
   - how to add it: `/plugin marketplace add yrazub/gen-bin`;
   - how to install a plugin: `/plugin install <plugin>@gen-bin`;
   - updates: auto-update is **off** by default for third-party marketplaces. Enable it in `/plugin` → Marketplaces → gen-bin, or run `/plugin marketplace update gen-bin`;
   - users without a GitHub SSH key set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`;
   - a plugin table, empty for now;
   - for a team repository, register the marketplace for everyone with `claude plugin marketplace add yrazub/gen-bin --scope project` and commit the resulting `.claude/settings.json`.
4. **`CHANGELOG.md`**: a `# Changelog` heading. Each later release adds `## <plugin> X.Y.Z` with New / Changed / Fixed sections that name the skills or agents affected.
5. **`CLAUDE.md`** (maintainer rules, loaded when someone works on this repo; Claude Code ignores a `CLAUDE.md` inside a plugin):
   - an entry's `name` in `marketplace.json` equals the `name` in that plugin's `plugin.json`, in kebab-case;
   - `source` is `./plugins/<name>`, never contains `..`, and uses forward slashes;
   - `version` lives only in `plugin.json`. Any change under `plugins/<name>/` bumps it and adds a `CHANGELOG.md` entry, in the same commit;
   - inside a plugin, paths are written as `${CLAUDE_PLUGIN_ROOT}/...`. A plugin never reads files outside its own directory, because they aren't copied into the cache. State goes in `${CLAUDE_PLUGIN_DATA}`;
   - no `bin/` at a plugin root (it blocks claude.ai org sync; use `scripts/`); no Git LFS; Node dependencies only through a `package-lock.json` (pnpm and yarn lockfiles are ignored);
   - never change a published plugin's `name`. Change `displayName` instead. If a rename can't be avoided, add a `renames` entry; that map only ever grows;
   - run `claude plugin validate .` before every push.

## Phase 3: Local verification

Run these from the shell:

1. `claude plugin validate .`: passes.
2. `claude plugin marketplace add /Users/yrazub/Projects/gen-bin`: prints `Successfully added marketplace: gen-bin`.
3. `claude plugin marketplace list`: shows `gen-bin`.
4. `claude plugin marketplace remove gen-bin`. **Required.** Only one marketplace per name can be registered, so the local copy has to go before the GitHub copy can be added in phase 5.

An empty marketplace has nothing to install, so the full install loop is first tested with the first migrated plugin.

## Phase 4: CI

Create `.github/workflows/validate.yml`:

- **Triggers:** `pull_request` and `push` to `main`, with **no** `paths:` filter. The repo is small. The official marketplace's workflow shows the trap a filter sets: `*` doesn't cross `/`, so with a filter a required check can wait forever for a status that never comes.
- **Permissions:** `contents: read`.
- **Steps:**
  1. checkout with `fetch-depth: 0`;
  2. setup-node 22;
  3. `npm i -g @anthropic-ai/claude-code@<pinned version>`;
  4. `claude plugin validate .`;
  5. for each `plugins/*/`, `claude plugin validate plugins/<name>`;
  6. **version-bump guard** (a short Node script in `.github/scripts/`): for each plugin directory changed against the base branch, fail if its `plugin.json` `version` didn't change and `CHANGELOG.md` has no `## <name> <version>` heading.
- Add `--strict` (warnings fail the build) once the first plugin is in. Before that, the empty-catalog warning would fail every run.
- Pin action versions by SHA, as the official repository does.

**Checked:** `claude plugin validate` runs without an Anthropic API key. It was run with CLI 2.1.306, an empty `HOME` and no auth variables, and passed. The workflow pins that CLI version.

## Phase 5: Publish and verify remotely

1. Work on a branch `chore/marketplace-scaffold` with one commit: `chore: scaffold empty plugin marketplace`.
2. Push and open a PR. CI must be green. Merge.
3. From any directory, run `claude plugin marketplace add yrazub/gen-bin`. It must print `Successfully added marketplace: gen-bin`. If the repository is private, this also proves the git credentials work.
4. Run `claude plugin marketplace remove gen-bin`, or keep it if you want to test from it.

**Done when:**
- `main` holds the tree above;
- CI is green;
- the GitHub add command succeeds;
- `claude plugin validate .` reports no errors.

## Notes for the migration plan (not in this scope)

Found while reading DevDigest's `.claude/` against the plugin docs. These shape how plugins get cut. The scaffold doesn't depend on any of them.

- **M1. Plugin agents ignore `permissionMode`, `hooks`, `mcpServers` and `initialPrompt` in their frontmatter.**
  - `spec-creator`'s `specs-only-guard.mjs` hook would silently stop running.
  - `permissionMode: acceptEdits` on `doc-writer`, `implementer`, `spec-creator` and `test-writer` would be dropped.
  - The guard has to move into the plugin's `hooks/hooks.json`, which applies to every session, so it must match on the subagent itself. Check that the hook input identifies the agent.
- **M2. Names gain a prefix.**
  - Agents become `<plugin>:<agent>` and skills become `/<plugin>:<skill>`.
  - `execute-plan`, `.claude/agents/README.md` and `pr-self-review`'s routing refer to agents and skills by bare names, and those references need updating.
- **M3. Project-relative paths break.**
  - Hooks and skills use `"$CLAUDE_PROJECT_DIR"/.claude/...`, for example the `pr-self-review` gate in DevDigest's `.claude/settings.json` and the `execute-plan` and `pr-self-review` scripts.
  - Inside a plugin these become `${CLAUDE_PLUGIN_ROOT}/...`.
  - A plugin-level `PreToolUse` gate fires in **every** project that enables the plugin, not only DevDigest. Decide whether the gate ships at all.
- **M4. DevDigest-specific content.**
  - `onion-architecture`, `frontend-ui-architecture`, `pr-self-review` and the SDD agents name DevDigest paths (`server/`, `specs/`, `TESTING.md`, module `CLAUDE.md` files).
  - Each must be either generalized or shipped as an explicitly DevDigest-flavoured plugin.
- **M5. Third-party skills.**
  - DevDigest's `skills-lock.json` lists `drizzle-orm-patterns`, `fastify-best-practices`, `next-best-practices`, `postgresql-table-design`, `typescript-expert` and `zod` as coming from other GitHub repositories.
  - Prefer a `git-subdir` source pinned to `sha` over copying them, which keeps their license and authorship.
  - Only vendor a skill if its license allows that, and add attribution if you do.
  - Check where `mermaid-diagram`, `react-*` and `security` came from.
- **M6. Script dependencies.** If any `.mjs` script needs npm packages, its plugin must ship a `package-lock.json`. Claude Code installs from that lockfile without running scripts.
- **M7. Plugin grouping.** Decide this in the migration plan. One candidate split:
  - an SDD workflow plugin (agents, `execute-plan`, `workflow-retro`, `engineering-insights`);
  - a review plugin (`pr-self-review`);
  - stack-knowledge plugins (React/Next, Node/Fastify/DB).

  Plugins can declare `dependencies` on each other.
- **M8. After the move,** DevDigest itself consumes the marketplace through `extraKnownMarketplaces` and `enabledPlugins` in its committed `.claude/settings.json`. The copies in `.claude/` are then removed, so the same skill doesn't load twice.
