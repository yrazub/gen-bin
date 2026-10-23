# architecture-review

One read-only agent, `architecture-reviewer`, that checks a change or an existing module against
the project's architectural boundaries.

## Install

```bash
claude plugin marketplace add yrazub/gen-bin
claude plugin install architecture-review@gen-bin
```

Installing it also installs `engineering-paved-path`, because the agent reads two of its skills:
`engineering-paved-path:onion-architecture` (backend layers, dependency direction) and
`engineering-paved-path:frontend-ui-architecture` (frontend code organisation, import direction).
The project's own `CLAUDE.md` files and architecture documents win over the skills.

## What it does

`architecture-review:architecture-reviewer` runs in one of two modes:

- **change** — you pass the changed files (new ones marked) and, when you have it, a patch file.
- **audit** — you pass a directory or a module.

It returns findings, each with the rule, the file and line, and the quoted code, plus a table of
what it checked and what was left to the project's own machine check. Zero findings is a valid
result. Severity follows the skills' scale: CRITICAL only for rules the skill marks CRITICAL.

## What it does not do

- It has only `Read, Grep, Glob`: no commands, no edits.
- It does not replace a dependency-cruiser or lint run; pass the result line in if you have one.
- It does not review security, style, test quality or plan completeness.
- It gives advice, not a verdict that blocks anything.
