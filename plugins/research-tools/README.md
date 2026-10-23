# research-tools

One read-only agent, `researcher`, for questions that need investigation before any code is written.

## Install

```bash
claude plugin marketplace add yrazub/gen-bin
claude plugin install research-tools@gen-bin
```

## What it does

`research-tools:researcher` runs in one of two modes and returns a structured report with findings,
evidence, references, and explicit "Not found" and "Not checked" sections:

- **Repository research** — where something lives, how a flow works, what a convention is, what a
  change would affect. Every finding cites `path:line`.
- **External research** — library and API behaviour, documentation, version differences,
  comparing options. Every finding cites a source it opened, with a date and a confidence level.

If the task is only a topic, or the question is ambiguous, it replies with clarifying questions and
does no research.

## How to call it

Ask Claude to use it, or name it: `use research-tools:researcher to find out how requests reach the
database`. Give a concrete question, the scope (directory, package, library and version) and what a
finished answer looks like.

## What it does not do

- It never changes files: its tools are `Read, Grep, Glob, Bash, WebSearch, WebFetch`, and its
  prompt limits Bash to inspection.
- It does not write plans, specs or code; someone else decides what to do with the report.
- It does not guess to fill a gap; what it could not find is listed as such.

The `sdd-engineering` plugin calls it as part of the spec and planning steps.
