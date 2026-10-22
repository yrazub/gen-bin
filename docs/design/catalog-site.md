# Design: gen-bin catalog site

Spec: [`docs/specs/catalog-site.md`](../specs/catalog-site.md) · Status: approved 2026-10-22

Mockups: [Claude Design canvas](https://claude.ai/artifact/RyuaZ8cV42m1MXvywKmXBt). It is
private to the maintainer, so this document is the reference the implementation follows. The
canvas uses sample data: real DevDigest skills and agents, split into four plugins
(`sdd-workflow`, `pr-review`, `node-backend`, `react-frontend`). That split is provisional, and the
versions and dates are invented.

## Direction

A neutral documentation style. White or near-black ground, one blue accent, system fonts, thin
borders instead of shadows, and no gradients or illustrations. Content is the visual weight: names,
descriptions and commands.

## Tokens

All colours are CSS custom properties on `<html>`. Dark values apply under
`prefers-color-scheme: dark` unless `data-theme="light"` is set, and `data-theme="dark"` forces them.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | `#ffffff` | `#0d1117` | page, cards |
| `--surface` | `#f6f8fa` | `#151b23` | panels, install box, secondary buttons |
| `--surface2` | `#eef1f4` | `#212830` | active nav item, pressed theme button |
| `--border` | `#d1d9e0` | `#3d444d` | every border and divider |
| `--fg` | `#1f2328` | `#f0f6fc` | text |
| `--muted` | `#59636e` | `#9198a1` | secondary text, labels |
| `--accent` | `#0969da` | `#4493f8` | links, search box border |
| `--btn` / `--btnFg` | `#0969da` / `#ffffff` | `#1f6feb` / `#ffffff` | primary buttons, pressed chips, count badge |
| `--mark` | `#fff8c5` | `#5a4500` | search match highlight (text keeps `--fg`) |
| `--code` | `#f6f8fa` | `#151b23` | command boxes, `<pre>` |
| `--ok` | `#1a7f37` | `#3fb950` | "In team setup", "added as a dependency" |

**Type badges.** Each badge is a pill with its label always written out (Plugin, Skill, Agent,
Command, Hook, MCP server). The colour only supports the label.

| Type | Light bg / fg | Dark bg / fg |
|---|---|---|
| Plugin | `#ddf4ff` / `#0550ae` | `#0f2a4a` / `#79c0ff` |
| Skill | `#dafbe1` / `#116329` | `#12301c` / `#7ee787` |
| Agent | `#fbefff` / `#6639ba` | `#2a1d47` / `#d2a8ff` |
| Command | `#eef1f4` / `#424a53` | `#212830` / `#c9d1d9` |
| Hook | `#fff8c5` / `#7d4e00` | `#3a2a07` / `#e3b341` |
| MCP server | `#d6f5f7` / `#0b5a63` | `#0b3237` / `#56d4dd` |

**Type.** These are system stacks only (NFR-6):
- sans: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;
- mono: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.

| Role | Size / line height | Weight |
|---|---|---|
| Page title (h1) | 32 / 1.25 | 600 |
| Section (h2) | 22 / 1.3 | 600 |
| Card name | 17 / 1.35 | 600 |
| Body | 15–16 / 1.55 | 400 |
| Small, meta | 13–14 | 400 |
| Code, commands | 12–13, mono | 400 |

**Space and shape.**
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64 px.
- Radius: 6 px on controls, 8 px on cards and panels, 10 px on pills.
- Content is at most 1200 px wide with a 24 px gutter.
- Every interactive target is at least 44 px.

## Shared layout

- **Header**, on every page, wraps on narrow screens. In order:
  - the logo (box icon + "gen-bin") linking to search;
  - the tagline "Claude Code plugin marketplace";
  - nav: Search, What's new, Team setup with a count badge of selected plugins, GitHub ↗. The
    current page's item has `--surface2` and `aria-current="page"`;
  - the theme control.
- **Theme control:** a `role="group"` with three 44 px icon buttons, System (monitor), Light (sun)
  and Dark (moon). Each has an `aria-label` and `aria-pressed`. System is the default. The choice is
  stored per browser and applied before first paint (AC-40–AC-43).
- **Footer:** "Built from yrazub/gen-bin at commit `<sha>`", an RSS feed link and the licence.

## Screens

### Search (home)

1. Title "Find a skill, agent or plugin for your task" and a one-line summary with live counts
   ("Search 4 plugins and everything inside them: 13 skills, 8 agents and 2 hooks.").
2. A marketplace bar: "First, add the marketplace in Claude Code:" with
   `/plugin marketplace add yrazub/gen-bin` and a copy button.
3. A visible label and a 52 px search input with a 2 px `--accent` border and a search icon.
4. Type filter chips (All, Plugins, Skills, Agents, Commands, Hooks, MCP servers). Each chip shows
   its match count and uses `aria-pressed`; the pressed chip is filled with `--btn`.
5. A status line in an `aria-live="polite"` region: "5 results for "review"" or "Showing all 4
   plugins".
6. A card grid, `repeat(auto-fill, minmax(300px, 1fr))` with a 16 px gap: one column on a phone,
   three at 1200 px.

**Card anatomy, top to bottom:**
1. Type badge, "in `<plugin>`" link (not on plugin cards), and `v<version>` on the right.
2. Name (17 px, 600), linking to the plugin page. Matched words are wrapped in `<mark>`.
3. Invocable name in mono, muted: `/<plugin>:<skill>`, `@agent-<plugin>:<agent>`,
   `<plugin>@gen-bin`, or `<Event> · <matcher>` for a hook.
4. Description, with matches marked. A hook shows its command text here, because hooks have no
   description field.
5. Install command box with a copy button (icon → "✓ Copied" for 2 s).
6. "Source ↗" link and, on plugin cards only, the "+ Add to team setup" / "✓ In team setup" toggle.

**States:**
- Empty query: one card per plugin.
- No matches: a dashed box with "No matches for "<query>"" and a "Clear search and filters"
  button.
- Empty marketplace: "No plugins published yet", with links to What's new and to the repository.
  The search box is hidden.

### Plugin page

1. A breadcrumb (Search / `<plugin>`), then a title block:
   - Plugin badge with the mono name;
   - display name as h1;
   - description;
   - a meta row: version, licence, author and source link;
   - the team toggle as a 44 px button on the right.
2. An Install panel (`--surface`) with three labelled command rows, each with a copy button:
   add the marketplace once, install in a session, install from a shell.
3. Two columns: the main column (`flex: 999 1 560px`) and an aside (`flex: 1 1 320px`). On narrow
   screens the aside stacks below the main column.
   - **Main column:**
     - Contents, with a summary line ("8 agents · 3 skills · 1 hook") and bordered lists per type.
       Each row shows the name, a model pill for agents, the invocable name right-aligned in mono,
       and the description;
     - README, rendered Markdown at 760 px max width;
     - Release notes for this plugin, with a link to all releases.
   - **Aside:**
     - "What this plugin runs":
       - an intro line;
       - Hooks: an event badge, the matcher and the full command in mono;
       - MCP servers;
       - Executables in `bin/`;
       - Agent tools, with a summary ("4 agents can edit files · 4 can run shell commands · 1 can
         use the web") and one line per agent: name · model, then its tools in mono;
       - "None" is written out wherever a section has no entries;
     - Dependencies, with a card per dependency linking to its page.

### Team setup

- An intro telling the user to commit the snippet to `.claude/settings.json`, and that everyone
  who trusts the folder gets the plugins.
- **Left (`flex: 1 1 380px`):** a fieldset of plugin rows, each with a 20 px checkbox, a label and
  a description. A checked row has a `--btn` border on `--surface`. A plugin pulled in by a
  dependency is checked and disabled, with "Added as a dependency of <plugin>" in `--ok`.
- **Right:**
  - the `.claude/settings.json` heading with a primary "Copy snippet" button, the JSON in `<pre>`,
    and a note to merge it into an existing file;
  - "Share this selection", with the `?plugins=` URL and a copy button;
  - "Prefer to install on one machine?", with the shell commands.
- **Nothing selected:** a dashed box with "No plugins selected" and a "Browse plugins" button.

### What's new

- A title, an intro that mentions auto-update is off by default, and a "Subscribe via RSS" button.
- An update hint bar showing `/plugin marketplace update gen-bin`.
- A release list, newest first. Each row has a 140 px date column (it wraps on a phone) and an
  article containing:
  - the plugin name linked to its page;
  - the version in mono;
  - a "Latest" badge on each plugin's newest release;
  - New / Changed / Fixed headings with bullet lists.

## Accessibility notes

- Every control is a real `<button>`, `<a href>`, `<input>` or `<label>`. Icon-only buttons have
  an `aria-label`, and toggles use `aria-pressed`.
- Text contrast is at least 4.5:1 in both themes, including muted 12–13 px text.
- Type is never shown by colour alone, because every badge carries its label.
- Headings form one outline per page: h1 page, then h2 sections, then h3 subsections.
