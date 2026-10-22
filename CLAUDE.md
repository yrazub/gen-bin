# gen-bin

A Claude Code plugin marketplace. The catalog is `.claude-plugin/marketplace.json`; each
plugin lives in `plugins/<name>/` with its manifest at `plugins/<name>/.claude-plugin/plugin.json`.
Before changing the catalog or a plugin, read the matching official page:
[marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference),
[manifest reference](https://code.claude.com/docs/en/plugins-reference),
[host and maintain](https://code.claude.com/docs/en/plugins/host-marketplace).

## Rules

- **Names.** A catalog entry's `name` equals the `name` in that plugin's `plugin.json`,
  kebab-case. Never change a published `name` — change `displayName`. If a rename is
  unavoidable, add it to `renames` in `marketplace.json`; that map is append-only.
- **Sources.** An entry's `source` is `./plugins/<name>`: forward slashes, no `..`.
- **Versions.** `version` lives only in `plugin.json`, never in the catalog entry. Any change
  under `plugins/<name>/` bumps it (semver) and adds a `## <name> <version>` entry to
  `CHANGELOG.md`, in the same commit. CI fails otherwise.
- **Paths inside a plugin** are `${CLAUDE_PLUGIN_ROOT}/...`. A plugin is copied into a cache
  on install, so it must not read files outside its own directory. Persistent state goes in
  `${CLAUDE_PLUGIN_DATA}`.
- **Plugin agents** ignore `permissionMode`, `hooks`, `mcpServers` and `initialPrompt` in their
  frontmatter. Put hooks in the plugin's `hooks/hooks.json`.
- **No `bin/`** at a plugin root (claude.ai org sync rejects it) — use `scripts/`. No Git LFS.
  Node dependencies only through a `package-lock.json`; pnpm and yarn lockfiles are ignored.
- **Instructions for Claude** go in a skill. A `CLAUDE.md` inside a plugin is not loaded.
- **The catalog site** (`site/`) is built from the plugin files, so a plugin change needs no
  site change. It fails the build on a skill, agent, command or plugin without a `description`.

## Commands

| | |
|---|---|
| validate the catalog | `claude plugin validate .` |
| validate one plugin | `claude plugin validate plugins/<name>` |
| version guard | `node .github/scripts/check-version-bump.mjs origin/main` |
| try it locally | `claude plugin marketplace add "$PWD"`, then `claude plugin install <name>@gen-bin` |
| catalog site | `cd site && npm ci && npm run dev` — <http://localhost:4321/gen-bin/>; `npm test`, `npm run test:build`, `npm run test:e2e` |
| clean up after | `claude plugin marketplace remove gen-bin` — one marketplace per name, so remove the local copy before adding `yrazub/gen-bin` |

Run `claude plugin validate .` before every push. Commit messages are conventional,
`type(scope): subject`.
