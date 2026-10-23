# engineering-paved-path

Ten skills that describe the "paved path" for a TypeScript web project: how React, Next.js,
Fastify, Zod and tests are written, and where code lives. Other gen-bin plugins read them by name
(`architecture-review` uses the two architecture skills).

## Install

```bash
claude plugin marketplace add yrazub/gen-bin
claude plugin install engineering-paved-path@gen-bin
```

Skills are namespaced by the plugin: `engineering-paved-path:react-best-practices`, and so on.
Where the project has its own rules (a `CLAUDE.md`, an architecture document), they win over the
skills.

## Skills

| Skill | When it applies |
|---|---|
| `react-best-practices` | writing or reviewing React components, hooks, state and data fetching |
| `next-best-practices` | Next.js App Router work: file conventions, RSC boundaries, data patterns, metadata, bundling |
| `fastify-best-practices` | building or debugging a Fastify server: routes, plugins, schemas, hooks, errors |
| `frontend-ui-architecture` | deciding where components, hooks, constants and logic live in a React/Next.js app; import direction |
| `onion-architecture` | deciding the layer of backend code (routes, services, repositories, adapters), dependency direction, DI |
| `react-testing-library` | writing React component and hook tests with Vitest |
| `security` | reviewing code for OWASP Top 10 issues, auth, input handling, secrets |
| `zod` | defining Zod schemas, parsing, error handling |
| `typescript-expert` | type-level programming, tsconfig, performance, migrations |
| `mermaid-diagram` | drawing flowcharts, sequence, class, ER and state diagrams in Markdown |

`onion-architecture` and `frontend-ui-architecture` ship with evals under their `evals/` folder.

## Attribution

Four skills were taken from public repositories. Their upstream locations come from the
`skills-lock.json` of the project they were extracted from. No licence file or licence statement
was found inside any of the four skill folders, so none is reproduced here; check the upstream
repository for the terms before redistributing.

| Skill | Upstream repository | Path in upstream |
|---|---|---|
| `fastify-best-practices` | [mcollina/skills](https://github.com/mcollina/skills) | `skills/fastify/` |
| `next-best-practices` | [vercel-labs/next-skills](https://github.com/vercel-labs/next-skills) | `skills/next-best-practices/` |
| `zod` | [pproenca/dot-skills](https://github.com/pproenca/dot-skills) | `skills/.curated/zod/` |
| `typescript-expert` | [sickn33/antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills) | `skills/typescript-expert/` |

The other six skills are not listed in that lock file; they were written in the source project.
