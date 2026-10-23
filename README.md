# gen-bin

A [Claude Code plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces) with
skills and agents for spec-driven development, extracted from DevDigest.

Browse and search it at **<https://yrazub.github.io/gen-bin/>**.

## Install

Inside a Claude Code session:

```
/plugin marketplace add yrazub/gen-bin
/plugin install <plugin>@gen-bin
```

From a shell, the same steps are `claude plugin marketplace add yrazub/gen-bin` and
`claude plugin install <plugin>@gen-bin`.

Claude Code clones over SSH when `ssh -T git@github.com` works and over HTTPS otherwise.
On a machine without a GitHub SSH key, set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`: installs and
updates from `/plugin` do not fall back to HTTPS on their own.

### Share with a team repository

Run once in the repository and commit the `.claude/settings.json` it writes:

```
claude plugin marketplace add yrazub/gen-bin --scope project
```

Everyone who trusts the folder then has the marketplace registered.

## Updates

Auto-update is off by default for third-party marketplaces. Turn it on in `/plugin` →
**Marketplaces** → `gen-bin` → **Enable auto-update**, or update by hand:

```
/plugin marketplace update gen-bin
```

A plugin updates only when its `version` changes; run `/reload-plugins` to load it in a
running session.

## Plugins

| Plugin | What it adds | Version |
|---|---|---|
| [`sdd-engineering`](plugins/sdd-engineering/) | Spec-driven chain: six agents (spec, plan, implement, test, verify, document), `run-plan`, `workflow-retro`; pulls in the three below | 1.0.0 |
| [`engineering-paved-path`](plugins/engineering-paved-path/) | Ten skills: React, Next.js, Fastify, Zod, TypeScript, testing, security, onion and frontend architecture, Mermaid | 1.0.0 |
| [`research-tools`](plugins/research-tools/) | Read-only `researcher` agent for repository and external research | 1.0.0 |
| [`architecture-review`](plugins/architecture-review/) | Read-only `architecture-reviewer` agent; uses `engineering-paved-path` | 1.0.0 |

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## Catalog site

[`site/`](site/) builds the catalog site from this repository's own files (search, a page per
plugin, a team setup generator, release notes with an RSS feed) and
[`.github/workflows/pages.yml`](.github/workflows/pages.yml) publishes it to GitHub Pages on every
push to `main`. See [`site/README.md`](site/README.md) to run it locally.

## License

[MIT](LICENSE), except where a plugin's own directory states another license.
