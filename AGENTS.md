# interface-database-decorators

`@antelopejs/interface-database-decorators`: decorators for tables, typed data models and field modifiers on top of `@antelopejs/interface-database`. It runs inside the consumer's module and has no implementing module of its own.

## Layout

- Each module in `src/` and `src/modifiers/`, except `index.ts` and `antelope.test.ts`, is a public subpath; `src/index.ts` is the root export. A new module needs an entry in both `exports` and `typesVersions` in [package.json](./package.json). Modules under `src/modifiers/internal/` are private: they have no entry and open with `/** @internal @packageDocumentation */`.
- Tests import the module under test by relative path (`antelopejs/no-self-import-in-tests`). `tsconfig.json` maps the package name onto `src` for the `docs/` code fences.

## Versioning

`@antelopejs/interface-api`, `interface-core` and `interface-database` are peer dependencies with a `>=minimum <1.0.0` range. The matching devDependency carries the same minimum; raise both together.

## Tests

- Suites live in `src/tests/`. They compile to `dist/tests` and ship in the package, so implementing modules can run them as a conformance suite; `src/tests/codec_helpers.ts` and `src/tests/helpers/` are part of that surface.
- The model tests fetch routes from the `@antelopejs/api` module on `DECORATORS_TEST_API_PORT`, 5010 when unset. A project that runs the suite serves `api` on that same port, so suites that each set their own port run in parallel on one machine.
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

CI runs `pnpm run checks` in full on every pull request and reports what failed. The commit hook formats and lints the staged files. Locally, check only what you touched, one test file and not the suite, as the [`verify-changes`](.agents/skills/verify-changes/SKILL.md) skill says.

### Comments

Say it in code: a constraint in a type, a lint rule or a test, a public item's contract in TSDoc. Other comments are lint directives naming their rules, `@ts-expect-error <reason>`, `SAFETY: <reason>` above a type assertion, and license or tool directives. A reason states what the code does now.

### Tests

Each test names the wrong implementation it fails on, or is deleted. Drive behaviour through the public interface. An invariant over many files is a lint rule.

### Review

No tool checks these:

- A type guard checks the nested elements and values it claims.
- A no-upward import rule rejects same-tier peers; probe it with an import.
- A finding only an evasion or a patched internal can trigger goes under Attention and never blocks.

### Suppressions

`guardrails.suppressions.json` caps lint directives, `@ts-expect-error`, `SAFETY:` comments and rules a lint config turns off. Over a cap, fix the code or remove another suppression of that kind; only the operator raises a number. After removing suppressions, run `pnpm run suppressions:update` and commit the file.

<!-- antelopejs-guardrails:end -->
