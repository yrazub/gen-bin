# Enforcement with dependency-cruiser

A rule that exists only in prose drifts. The import-direction rules are therefore best checked
mechanically. This file describes the setup this skill recommends; if the project already has an
architecture check, use that and map the rule IDs from `SKILL.md` onto its rules.

## Files

| File | What |
|---|---|
| `.dependency-cruiser.cjs` | the rules; name each rule after its ID from `SKILL.md` |
| `.dependency-cruiser-known-violations.json` | the baseline: every leak that existed when the rules were introduced |
| `package.json` scripts | one to check (fails on any violation not in the baseline), one to rewrite the baseline |
| CI workflow | a step that runs the check, with a path filter that includes every folder the rules cover |

## Commands

```bash
npx depcruise --config .dependency-cruiser.cjs --output-type err --ignore-known .dependency-cruiser-known-violations.json src
                      # fails on any violation NOT in the baseline
npx depcruise --config .dependency-cruiser.cjs --output-type err src
                      # every violation, baselined ones included
```

`--ignore-known` takes an optional file argument. Always pass the file explicitly, or the next
positional argument (`src`) is read as the baseline path and the run fails with `EISDIR`.

## Machine-checked rules

`dep-domain-framework-free` · `core-stays-pure` · `core-no-node-io` · `core-public-api-only` ·
`db-only-in-repository` · `dep-no-cross-module` · `edge-fastify-in-routes-only` ·
`di-narrow-deps` · `adapter-no-app-layers` · `platform-no-modules` · `no-circular`.

The rest are review-only because an import graph cannot see them:
- what a repository returns (`db-return-domain-types`);
- where a transaction opens;
- whether a handler holds business logic;
- whether code reads `process.env`.

## Baseline workflow

- **A new violation fails CI. Fix the code.** Never rewrite the baseline to make a new leak pass.
  That erases the check.
- **When a change fixes a baselined leak,** rewrite the baseline in the same change. The file
  shrinks, and the diff shows reviewers which leak was fixed.
- **Adding a rule:** add it, run the full cruise, decide whether the hits are real, then
  baseline. Mention the count in the change description.
- The baseline matches on exact file paths. Renaming or moving a file that is in the baseline
  makes its entry stale, and the moved file fails. That is intended: moving a file is the moment
  to fix its leak.
- Target `src/db/` rather than `drizzle-orm` in the `db-only-in-repository` rule: the resolved
  package path contains the package-manager version, which would break baseline entries on every
  upgrade.

## Further reading

- dependency-cruiser [rules tutorial](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-tutorial.md)
  and [rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md).
- [Validate Dependencies According to Clean Architecture](https://betterprogramming.pub/validate-dependencies-according-to-clean-architecture-743077ea084c).
- [Avoid Cross Module Dependencies with Dependency Cruiser](https://dev.to/jacobandrewsky/avoid-cross-module-dependencies-with-dependency-cruiser-3b0b).
