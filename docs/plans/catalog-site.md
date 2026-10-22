# Implementation Plan: gen-bin catalog site

**Goal:** A static catalog of the gen-bin marketplace on GitHub Pages, built by Astro from the
repository's own files. It has:
- keyword search with cards;
- a page per plugin with a "What this plugin runs" panel;
- a team setup generator;
- "What's new" with an RSS feed;
- a System / Light / Dark theme control.

It runs locally with `npm run dev` / `npm run preview` under the same `/gen-bin/` base as
`https://yrazub.github.io/gen-bin/`.

| | |
|---|---|
| **Spec** | [`docs/specs/catalog-site.md`](../specs/catalog-site.md), SPEC-2026-10-22-catalog-site, approved and amended 2026-10-22 (AC-1–AC-47) |
| **Design** | [`docs/design/catalog-site.md`](../design/catalog-site.md) |
| **Branch** | `feature/catalog-site`. The spec, this plan and the code ship as one PR at the end. |
| **Execution mode** | Single-agent. gen-bin has no agent setup of its own, and DevDigest's agents are wired to DevDigest paths. |
| **Status** | done 2026-10-22 |

**Assumptions:**
- **Open questions** OQ-1–OQ-5 are resolved as the spec recommends:
  - release dates come from git;
  - body text is searchable, capped at 2,000 characters;
  - Pages is enabled by hand;
  - plugins with an external source are not fetched;
  - the site is built and deployed while the marketplace is still empty.
- **Deploy without `withastro/action`.** The spec's decision table named it, but the workflow uses
  `actions/upload-pages-artifact` + `actions/deploy-pages` instead, because the same job must also
  run the tests and build pull requests without uploading. Phase 9 amends that row of the spec.
- **Front matter** is parsed with `yaml` (maintained) behind a 15-line splitter, not `gray-matter`
  (last released 2023).
- **Markdown** goes through `unified` → `remark-parse` → `remark-gfm` → `remark-rehype` (raw HTML
  dropped) → `rehype-sanitize` (custom schema) → `rehype-stringify`, plus a link-rewrite step. This
  is not Astro's content pipeline, because README files live outside `src/`.
- **Versions.** Every dependency is pinned exactly, to the newest release at least 14 days old when
  it is installed. On 2026-10-22 that is astro 7.3.7, @playwright/test 1.64.0, vitest 5.0.3,
  minisearch 7.2.0 and yaml 2.9.1. Re-check at install time.
- **Test-only variable.** The site reads the marketplace from the repository root (`..` from
  `site/`). Tests point it at fixtures with `CATALOG_ROOT`, which normal use never needs (NFR-9).

## Context read

- `docs/specs/catalog-site.md` and `docs/design/catalog-site.md`, both in full.
- `.claude-plugin/marketplace.json` (empty catalog), `CLAUDE.md` (marketplace rules), `.gitignore`.
- `.github/workflows/validate.yml` and `.github/scripts/check-version-bump.mjs`. The new workflow
  must not collide with them, and the guard only looks at `plugins/`.
- The canvas mockups (Search, Plugin, Team setup, What's new, Tokens): markup, copy and states.
- DevDigest's `.claude/agents/*.md` and `.claude/skills/*/SKILL.md` frontmatter. This is the real
  shape the extractor will meet: `name`, `description`, `tools`, `model`, multi-line YAML
  descriptions, and agent frontmatter with `hooks`.

## Constraints

- **Package.** All site code lives in `site/`, an npm package with its own `package-lock.json`.
  Nothing in `plugins/`, `.claude-plugin/` or the catalog guard changes.
- **Build output.** `site/dist/` and `site/.astro/` are git-ignored. There is no `gh-pages` branch
  (NFR-5), and no committed binary is larger than 100 KB.
- **Base path.** `astro.config.mjs` sets `site: 'https://yrazub.github.io'`, `base: '/gen-bin'`,
  `trailingSlash: 'always'` and `output: 'static'`. Every internal URL is built from
  `import.meta.env.BASE_URL`, never hard-coded (AC-31).
- **No runtime network.** No fonts, scripts or APIs from another origin (NFR-6). The build makes no
  network call either (AC-46).
- **Untrusted inputs**, per the spec's Untrusted inputs table:
  - Astro expressions only, never `set:html`, except for the output of the sanitising Markdown
    renderer;
  - client code writes text with `textContent`, and highlighting builds `<mark>` nodes from
    escaped text;
  - stored values and URL parameters are validated against the catalog or a fixed list.
- **Tokens.** Colours, type, spacing and radii come from the design document's tables, as CSS
  custom properties in one `tokens.css`.
- **Commits.** One commit per phase on `feature/catalog-site`, a short conventional subject, no
  trailer. Push only when the user asks.

## Phases

### 1 · Site scaffold, layout, tokens and theme control

| File | Change |
|---|---|
| `site/package.json`, `site/package-lock.json` | new; scripts `dev`, `build`, `preview`, `test` (vitest), `test:build`, `test:e2e`; `engines.node >=22` |
| `site/astro.config.mjs`, `site/tsconfig.json` | new; config as in Constraints |
| `site/src/styles/tokens.css` | new; light tokens on `:root`, dark tokens under `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` and on `:root[data-theme="dark"]`; type, spacing, radius |
| `site/src/layouts/Base.astro` | new; `<head>` with an `is:inline` script that reads `localStorage['gen-bin:theme']`, accepts only `light`/`dark`, sets `data-theme` before paint, and catches storage errors; RSS `<link rel="alternate">` (AC-38); header, `<main>`, footer |
| `site/src/components/SiteHeader.astro`, `ThemeControl.astro`, `SiteFooter.astro` | new; header and footer as designed, nav with `aria-current`, Team setup count badge (filled by phase 6), footer commit SHA from `git rev-parse --short HEAD` (falls back to "local") |
| `site/src/scripts/theme.ts` | new; the control's three buttons set or clear `data-theme`, write storage in try/catch, keep `aria-pressed` in sync |
| `site/src/pages/index.astro` | new; placeholder search page on the layout |
| `site/README.md` | new; prerequisites (Node 22), `npm ci`, `dev`, `test`, `build`, `preview`, the `/gen-bin/` URL (AC-47) |
| `.gitignore` | add `site/dist/`, `site/.astro/`, `site/test-results/`, `site/playwright-report/` |

- **Tests:** none in this phase. The suites are set up in phases 2 and 8.
- **Verify:**
  - `cd site && npm ci && npm run build`;
  - `npm run dev` serves `http://localhost:4321/gen-bin/`;
  - `npm run preview` serves the same;
  - the theme control switches the theme and keeps it across a reload.
- **Done when:** AC-44, AC-45, AC-47 and NFR-9 hold. AC-40–AC-43 are clickable; their tests come
  in phase 8.

### 2 · Catalog extraction (`site/src/lib/catalog/`)

| File | Change |
|---|---|
| `types.ts` | `Catalog`, `Plugin`, `Artifact` (`type: plugin \| skill \| agent \| command \| hook \| mcp`), `Release`, `RunsPanel` |
| `frontmatter.ts` | split `---` blocks and parse with `yaml`; throws `CatalogError(file, message)` on malformed YAML (EC-13) |
| `read-marketplace.ts` | read `.claude-plugin/marketplace.json`. For each entry: a relative source resolves inside the root, otherwise the entry is marked external (EC-6). Merge `plugin.json` over the entry per Claude Code's precedence; with no `plugin.json` the entry is the manifest (EC-2). A missing version becomes "unversioned" (EC-4). |
| `read-components.ts` | collect the plugin's components: `skills/*/SKILL.md`; `agents/**/*.md` (name from frontmatter or file, `tools`, `model`); `commands/**/*.md`; hooks from `hooks/hooks.json` and `plugin.json` `hooks`, one artifact per event+matcher, named after the script file in the command; MCP servers from `.mcp.json` and `plugin.json` `mcpServers`; `bin/` file names. Body text is capped at 2,000 characters (NFR-2). |
| `validate.ts` | fail on a missing `description` for a skill, agent, command or plugin, naming the file (AC-29); collect every error before throwing |
| `read-changelog.ts` | parse `## <plugin> <version>` sections and their New / Changed / Fixed bodies. Dates come from `git log -S"## <plugin> <version>" --format=%cs --reverse -- CHANGELOG.md`, and anything unresolved (uncommitted, shallow clone, no git) is "Unreleased" with a build warning (EC-16, EC-17). |
| `index.ts` | `loadCatalog(root = process.env.CATALOG_ROOT ?? '..')`, memoised per build |
| `site/test/fixtures/{basic,empty,no-manifest,external,broken-yaml,missing-description,duplicates}/` | new fixture marketplaces. `basic` mirrors the design's sample data: 4 plugins, agents, skills, 2 hooks, one MCP server, a `bin/` file and a CHANGELOG. |
| `site/test/unit/catalog.test.ts` | new |

- **Tests (`unit (site)`):**
  - AC-1: every component type is counted;
  - AC-29: missing descriptions, all files named;
  - AC-30: the empty fixture builds an empty catalog;
  - EC-2, EC-4, EC-5 (same skill name in two plugins);
  - EC-6: external entry only;
  - EC-13: broken YAML names the file;
  - EC-16/17: an uncommitted entry is Unreleased. The test runs `git init` in a temp copy.
- **Verify:** `npm test`.
- **Done when:** the extractor returns the fixture catalogs exactly as the tests state, and fails
  with messages naming every bad file.

### 3 · Safe Markdown (`site/src/lib/markdown.ts`)

| File | Change |
|---|---|
| `site/src/lib/markdown.ts` | `renderMarkdown(md, { repoPath, commitSha })`: the unified pipeline from Assumptions; sanitize schema with `href` protocols `http`, `https`, `mailto` only and `src` protocols `https` only; relative links rewritten to `https://github.com/yrazub/gen-bin/blob/<sha>/<dir>/<path>` and relative images to `https://raw.githubusercontent.com/yrazub/gen-bin/<sha>/<dir>/<path>` (EC-8) |
| `site/test/unit/markdown.test.ts` | new |

- **Tests (`unit (site)`):**
  - `<script>`, inline event handlers, `<iframe>` and raw HTML blocks are dropped;
  - `javascript:` and `data:` links lose their `href`;
  - relative links and images are rewritten;
  - GFM tables and code blocks render.
- **Verify:** `npm test`.
- **Done when:** these tests pass. This covers the Untrusted inputs rows for Markdown and EC-8.

### 4 · Search: index and page

| File | Change |
|---|---|
| `site/src/lib/search/options.ts` | shared MiniSearch options for both the build and the browser: fields `name`, `description`, `tags`, `plugin`, `body`; boosts name 6 · description 3 · tags 2 · plugin 1.5 · body 1; `prefix: true`; `fuzzy: (term) => term.length >= 5 ? 1 : 0`; `combineWith: 'AND'`; English tokenizer splitting on non-alphanumerics |
| `site/src/lib/search/highlight.ts` | `highlightParts(text, terms)` returns `{text, hit}[]` using the same prefix rule (AC-7) |
| `site/src/lib/search/invocable.ts` | invocable names and install commands per type (AC-5) |
| `site/src/pages/search-index.json.ts` | static endpoint: the serialised index plus a slim card store per artifact |
| `site/src/components/Card.astro`, `TypeBadge.astro`, `CopyCommand.astro` | the card anatomy from the design; the copy button falls back to selecting the text with "Press Ctrl/Cmd+C" (EC-12) |
| `site/src/pages/index.astro` | title, live counts, marketplace bar, labelled search form, type chips, `aria-live` status, the card grid server-rendered with one card per plugin (AC-9, AC-39), `<noscript>` notice, empty-marketplace state (AC-30) |
| `site/src/scripts/search.ts` | lazy-load the index on first focus or input; 150 ms debounce; render cards with DOM APIs and `textContent`; chip counts and filter (AC-8, AC-34); `history.replaceState` for `q`/`type` and reading them on load (AC-11, AC-35); ignore unknown `type`; the "No matches" state and its clear control (AC-10); copy (AC-6) |
| `site/test/unit/search.test.ts` | new |

- **Tests (`unit (site)`), on the `basic` fixture:**
  - AC-3: prefix (`fasti` finds `fastify`), a one-typo match at 5+ letters, none below 5, case;
  - AC-4: the ranking order name > description > body;
  - AC-7: highlight parts;
  - AC-5: invocable names.
- **Verify:**
  - `npm test`;
  - `CATALOG_ROOT=test/fixtures/basic npm run build && npm run preview`, then search by hand.
- **Done when:** AC-1–AC-11, AC-34, AC-35 and AC-39 work on the `basic` fixture. Their e2e tests
  come in phase 8.

### 5 · Plugin pages

| File | Change |
|---|---|
| `site/src/pages/plugins/[name]/index.astro` | `getStaticPaths` from the catalog. Shows: breadcrumb; title block; meta row (http(s) `homepage`/`repository` only); team toggle; Install panel with three commands (AC-15); Contents lists (AC-14); README via `renderMarkdown` when present (EC-3); this plugin's release notes (AC-19); external-source notice (EC-6). |
| `site/src/components/RunsPanel.astro` | hooks with event, matcher and command text; MCP servers with command or URL; `bin/` files; agent tools with the edit / shell / web summary; "None" lines; the exact AC-18 sentence; the "can't be inspected here" text for external sources |
| `site/src/components/Dependencies.astro` | gen-bin dependencies link to their pages, others are listed as text (AC-16) |
| `site/test/build/plugin-pages.test.ts` | new; reads `dist/` after a fixture build |

- **Tests (`build (site)`):**
  - AC-12: one page per plugin, reachable from cards;
  - AC-13, AC-14, AC-16, AC-17, AC-18 (the `no-manifest` fixture has no hooks), AC-19;
  - EC-3, EC-6, EC-7: a 200+ character description is full on the page and cut on the card.
- **Verify:** `npm run test:build`.
- **Done when:** these build tests pass.

### 6 · Team setup

| File | Change |
|---|---|
| `site/src/lib/team/snippet.ts` | `buildSnippet(selected, catalog)` returns `{ json, enabled, addedBy, unknown }`, adding gen-bin dependencies and reporting unknown names (AC-21, AC-22, EC-11) |
| `site/src/lib/team/selection.ts` | browser selection store: `localStorage['gen-bin:team']` in try/catch, entries matched against the catalog (EC-15) |
| `site/src/pages/team/index.astro` | intro, plugin fieldset, snippet with copy, share URL, shell commands, "No plugins selected" state (AC-24); reads `?plugins=` on load (AC-37) and writes it on change (AC-23) |
| `site/src/scripts/team.ts`, update to `SiteHeader.astro` / `Card.astro` / plugin page | toggles on plugin cards and plugin pages (AC-20); header count (AC-36) |
| `site/test/unit/team.test.ts` | new |

- **Tests (`unit (site)`):**
  - AC-21: the snippet's exact JSON;
  - AC-22: dependency added and labelled;
  - EC-11: unknown names.
- **Verify:** `npm test`, then by hand in the preview.
- **Done when:** these unit tests pass and the page works in the preview.

### 7 · What's new and RSS

| File | Change |
|---|---|
| `site/src/pages/whats-new/index.astro` | the release list newest first, dates or "Unreleased", the "Latest" badge per plugin, links only for plugins still in the catalog (EC-10), RSS button, update hint |
| `site/src/pages/rss.xml.ts` | `@astrojs/rss`: one item per release, title `<plugin> <version>`, `pubDate` (omitted when Unreleased), link to the plugin page, sanitised HTML notes as escaped content (AC-26) |
| `site/test/build/whats-new.test.ts` | new |

- **Tests (`build (site)`):**
  - AC-25: order and fields;
  - AC-26: valid RSS with N items;
  - AC-38: the `<link rel="alternate">` on every page;
  - EC-10.
- **Verify:** `npm run test:build`.
- **Done when:** these build tests pass.

### 8 · Browser tests (`site/test/e2e/`, Playwright)

| File | Change |
|---|---|
| `site/playwright.config.ts` | Chromium only; `webServer` runs `CATALOG_ROOT=test/fixtures/basic npm run build && npm run preview` on port 4321; `baseURL` `http://localhost:4321/gen-bin/` |
| `site/test/e2e/search.spec.ts` | AC-2 (results within 300 ms of the last keystroke), AC-5, AC-6 (clipboard permission granted; "Copied" then back after 2 s), AC-7, AC-8, AC-9, AC-10, AC-11, AC-34, AC-35, EC-9 (`<script>` in the query shows as text) |
| `site/test/e2e/team.spec.ts` | AC-20, AC-23, AC-24, AC-36, AC-37, EC-15 (storage blocked through an init script) |
| `site/test/e2e/theme.spec.ts` | AC-40, AC-41 (`colorScheme: 'dark'` emulation with System), AC-42 (persists across navigation), AC-43 (`data-theme` set on `<html>` before first paint, checked from the HTML response plus the inline script's effect on a paused page), EC-18 |
| `site/test/e2e/no-js.spec.ts` | AC-32, AC-39 with `javaScriptEnabled: false` |
| `site/test/e2e/empty.spec.ts` | AC-30 on the `empty` fixture build |
| `site/test/e2e/a11y.spec.ts` | keyboard reachability of every control (NFR-4) |

- **Verify:** `npx playwright install chromium`, then `npm run test:e2e`.
- **Done when:** all e2e specs pass locally.

### 9 · CI, deploy and documentation

| File | Change |
|---|---|
| `.github/workflows/pages.yml` | new. Triggers: `push` to `main`, `pull_request`, `workflow_dispatch`, with no `paths:` filter (as in `validate.yml`). A **build** job runs, in order: checkout with `fetch-depth: 0` (release dates); setup-node 22 with npm cache on `site/package-lock.json`; `npm ci`; `npm test`; `npm run build` with no network (below); `npm run test:build`; Playwright install and `npm run test:e2e`; and, on `main` only, `actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5.0.0` with `path: site/dist`. A **deploy** job on `main` only (`needs: build`; environment `github-pages`; permissions `pages: write`, `id-token: write`) runs `actions/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346 # v5.0.1`. Checkout and setup-node use the SHAs already pinned in `validate.yml`. |
| network-off build (AC-46) | the build step runs as `sudo unshare --net -- sudo -u "$USER" env "PATH=$PATH" npm run build`. If the runner refuses `unshare`, the step falls back to a plain build and AC-46 is verified by hand with the network off, recorded in the PR. |
| `README.md` | link to `https://yrazub.github.io/gen-bin/` (AC-33) and a "Catalog site" section pointing to `site/README.md` |
| `CLAUDE.md` | a Commands row for the site (`cd site && npm run dev`) and a rule: the site reads plugin files, so a plugin change needs no site change |
| `docs/specs/catalog-site.md`, `docs/specs/README.md` | amend the Deploy row of the decision table (see Assumptions); mark the spec implemented and this plan done |

- **Manual step:** before the first deploy, the maintainer sets Settings → Pages → Source to
  **GitHub Actions** (OQ-3).
- **Verify:**
  - the PR run builds and tests without deploying (AC-28);
  - after merge, the `main` run deploys and `https://yrazub.github.io/gen-bin/` shows the
    empty-marketplace state (AC-27, AC-30);
  - `claude plugin validate .` still passes, so the marketplace itself is untouched.
- **Done when:** AC-27, AC-28, AC-33 and AC-46 hold.

## Acceptance criteria → phase

| Phase | Criteria |
|---|---|
| 1 | AC-31, AC-44, AC-45, AC-47 (theme AC-40–43 built here, tested in 8) |
| 2 | AC-1, AC-29, AC-30 (data), EC-2, EC-4, EC-5, EC-6, EC-13, EC-16, EC-17 |
| 3 | EC-8, the Markdown rows of Untrusted inputs |
| 4 | AC-2–AC-11, AC-34, AC-35, AC-39, EC-9, EC-12 |
| 5 | AC-12–AC-19, EC-3, EC-6, EC-7 |
| 6 | AC-20–AC-24, AC-36, AC-37, EC-11, EC-15 |
| 7 | AC-25, AC-26, AC-38, EC-10 |
| 8 | the e2e verification of phases 1, 4 and 6, plus AC-32, AC-40–AC-43, EC-18, NFR-4 |
| 9 | AC-27, AC-28, AC-33, AC-46 |

NFR-1 (≤ 60 KB JS gzip), NFR-2 (index ≤ 500 KB gzip) and NFR-3 (≤ 50 ms per query) are checked in
phase 8: a build test measures the gzip sizes on the `basic` fixture, and an e2e test times
queries on a generated 300-artifact fixture.

## Out of scope

The spec's non-goals still apply:
- non-English or semantic search;
- deferred features (package.json recommendations, workflow diagram, issue links, `llms.txt`,
  badges);
- fetching external plugin sources;
- a custom domain.

Moving the DevDigest skills and agents into `plugins/` is also out: that is the separate migration
plan. Until it happens the deployed site shows the empty state.

## Risks

| Risk | Mitigation |
|---|---|
| `site/package-lock.json` and source add to every marketplace clone (NFR-5) | No binaries and no committed build output. Measure `git count-objects -vH` before and after the PR and report it in the PR. |
| MiniSearch boosts don't guarantee AC-4's strict ordering | The AC-4 unit test fixes the expectation. If boosts alone fail it, sort ties by match field after scoring. |
| `unshare` is not allowed on the GitHub runner | The fallback in phase 9 keeps CI green, and AC-46 is verified by hand. |
| Real DevDigest frontmatter has shapes the fixtures miss (multi-line descriptions, `hooks` in agent frontmatter) | Fixtures copy real frontmatter blocks from DevDigest, and the extractor ignores unknown keys. |
| Playwright adds a heavy browser download locally on a 16 GB laptop | Chromium only. e2e runs once per phase-8 iteration, not in watch mode. |

## Open questions

None blocking. If the Pages setting (OQ-3) is not set by phase 9, the deploy job fails while the
build job still passes.
