# interface-database-decorators

`@antelopejs/interface-database-decorators`: decorators for tables, typed data models and field modifiers on top of `@antelopejs/interface-database`. It runs inside the consumer's module and has no implementing module of its own.

## Layout

- Each module in `src/` and `src/modifiers/`, except `index.ts` and `antelope.test.ts`, is a public subpath; `src/index.ts` is the root export. A new module needs an entry in both `exports` and `typesVersions` in [package.json](./package.json).
- Tests import the package by its own name (`@antelopejs/interface-database-decorators/...`); `tsconfig.json` maps it onto `src`.

## Versioning

`@antelopejs/interface-api`, `interface-core` and `interface-database` are peer dependencies with a `>=minimum <1.0.0` range. The matching devDependency carries the same minimum; raise both together.

## Tests

- Suites live in `src/tests/`. They compile to `dist/tests` and ship in the package, so implementing modules can run them as a conformance suite; `src/tests/codec_helpers.ts` and `src/tests/helpers/` are part of that surface.
- `pnpm test` builds once, then runs `ajs module test .` with the project in `src/antelope.test.ts`: a MongoDB memory server, `@antelopejs/mongodb` and `@antelopejs/api` from npm, cached in `.antelope/cache`. The first run needs network access to fetch them and the `mongod` binary.
- `pnpm run checks` runs this whole suite. The documentation check runs only in CI (the `Check documentation` step of `ci-node.yml`). To run it locally, clone `AntelopeJS/tooling-configs` at `v0.0.9`, run `npm ci --prefix actions/docs --omit=dev`, then from this repository run `node <clone>/actions/docs/check.mjs --files $'README.md\ndocs' --typescript-project docs/tsconfig.json`.

## Shipped files

- `skills/` ships in the package and reaches users through `antelopeJs.skills`. When a change alters the public decorators or models, update `skills/database-decorators-interface/SKILL.md`.
- `docs/` is the source of interfaces.antelopejs.com. The documentation check covers its local links and its `docs-check` code fences, type-checked against `src` through `docs/tsconfig.json`.

## Releases

The release commit writes `CHANGELOG.md`. Upgrade notes for that version follow in a separate `docs(changelog)` pull request.

<!-- antelopejs-guardrails:start -->
<!-- Managed by @antelopejs/tooling-configs. `antelopejs-sync` rewrites everything between these markers; write repository-specific guidance outside them. -->

## Guardrails

Finish every change with `pnpm run checks`. It runs typecheck, lint, format, knip, tests, size, ratchet, and sync, and prints only what failed. The change is done when it prints no failure.

The tools enforce most rules, listed in the table at the end. The sections below hold the rules no tool checks.

### Comments

Say it in code. A constraint belongs in a type, a lint rule, or a test. A public item's contract belongs in TSDoc (`/** */`) on that item. The only other comments are lint directives that name their rules, `@ts-expect-error <reason>`, `SAFETY: <reason>` above a type assertion, `/*!` license headers, and bundler or formatter directives.

### Tests

Hold every test you write or keep to this checklist:

- Name the wrong implementation this test fails on. A test with no answer is deleted, not kept.
- No test reads the file it tests. Drive the behaviour through the public interface.
- An invariant over many files is a lint rule, not a test.

### Debt

`guardrails.ratchet.json` records the lint findings and oversize files this repository already had. Its numbers only go down. After you remove debt, run `pnpm run ratchet:update` and commit the lowered file. A rule listed there is off for `oxlint`. The ratchet counts it instead, and the pre-commit hook rejects it on every line you add.

### What enforces what

| Rule                                                                           | Enforced by                               |
| ------------------------------------------------------------------------------ | ----------------------------------------- |
| Formatting                                                                     | oxfmt                                     |
| Lint findings are errors; no rule warns                                        | oxlint preset                             |
| Comments are TSDoc, directives, or `SAFETY:` only                              | `antelopejs/no-comments`                  |
| Every test asserts                                                             | `antelopejs/require-assertion`            |
| Tests read no files outside fixtures, helpers, locales                         | `antelopejs/no-fs-read-in-tests`          |
| No assertion that restates a constant                                          | `antelopejs/no-constant-value-assertion`  |
| No test whose only check is "is a function"                                    | `antelopejs/no-typeof-function-only-test` |
| Params ≤ 5, function ≤ 120 lines, file ≤ 500 lines, depth ≤ 4, complexity ≤ 20 | `eslint/max-*`, `eslint/complexity`       |
| Files ≤ 20,000 bytes, tests included                                           | `antelopejs-check-size` (pre-commit)      |
| Existing debt only shrinks                                                     | `antelopejs-ratchet`                      |
| Types check                                                                    | `tsc` (pre-push)                          |
| No dead files, exports, or dependencies                                        | knip                                      |
| Managed files match the pack                                                   | `antelopejs-sync --check`                 |
| A test names the wrong implementation it catches                               | review; no tool                           |

<!-- antelopejs-guardrails:end -->
