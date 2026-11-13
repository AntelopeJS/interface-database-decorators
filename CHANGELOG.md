# Changelog

## v0.5.2

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.5.1...v0.5.2)

### 🩹 Fixes

- **database:** Run every query through run() for interface-database 0.4.0 ([#120](https://github.com/AntelopeJS/interface-database-decorators/pull/120))

### ❤️ Contributors

- Antony Rizzitelli ([@Upd4ting](http://github.com/Upd4ting))

## v0.5.1

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.5.0...v0.5.1)

### 🩹 Fixes

- **modifiers:** Compare the value testValue is given instead of returning the unlocked one ([#118](https://github.com/AntelopeJS/interface-database-decorators/pull/118))

### 📖 Documentation

- **changelog:** Upgrade notes of interface-database-decorators 0.5.0 ([#119](https://github.com/AntelopeJS/interface-database-decorators/pull/119))

### ❤️ Contributors

- Antony Rizzitelli ([@Upd4ting](http://github.com/Upd4ting))

## v0.5.0

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.4.1...v0.5.0)

### Upgrade notes

- The peer `@antelopejs/interface-database` is now `>=0.3.0 <1.0.0`: the modifier contracts use its `WriteValue` and `WriteDocument` types, from `@antelopejs/interface-database/common` ([#117](https://github.com/AntelopeJS/interface-database-decorators/pull/117)).
- **Breaking, custom modifiers:** `Modifier`, `OneWayModifier`, `TwoWayModifier` and `ContainerModifier` no longer take `Meta` and `Options` type parameters. Declare them on the subclass instead, with `declare public options: Options` and `declare protected meta: Meta`. `options` is now public. Replace `OneWayModifier<string, [], object, { prefix: string }>` with `OneWayModifier<string>` plus `declare public options: { prefix: string }` ([#117](https://github.com/AntelopeJS/interface-database-decorators/pull/117)).
- **Breaking, custom modifiers:** `LockedType` must be a `WriteValue`. `lock` and `test` take the field's value as a `WriteValue`, `unlock` returns one, and `unlockrequest` returns `ValueProxy<WriteValue>`. `ContainerModifier` locks a `WriteDocument`. Change `value: unknown` to `value: WriteValue` in your overrides ([#117](https://github.com/AntelopeJS/interface-database-decorators/pull/117)).
- **Breaking, types:** declare an object `LockedType`, `meta`, or a field value passed to `testValue`, `testHash`, `testHashAsync` or `setHashAsync` with `type`, not `interface` or `class`. A `WriteDocument` needs an index signature, which TypeScript gives only to an object `type`. A `Buffer` is not a `WriteValue` ([#117](https://github.com/AntelopeJS/interface-database-decorators/pull/117)).
- **Breaking, types:** `getMetadata` takes a `MetadataTarget` and no `TTarget` type parameter, a `MetadataClass` is constructed with that target, and `triggerEvent` takes no type parameter. Drop any explicit type arguments you pass them ([#117](https://github.com/AntelopeJS/interface-database-decorators/pull/117)).
- **Behavior change:** under the `"*"` key, such as `localize("*")`, a list or a date now throws a `TypeError`, as a single text already did. On a `@Localized() @Encrypted()` field, this replaces a write that stored `null` for every locale ([#117](https://github.com/AntelopeJS/interface-database-decorators/pull/117)).
- `LocalizationModifier.fallbackLocaleOf` returns `undefined` for a field attached with no options or a non-string `fallbackLocale`, and works across copies of the package ([#117](https://github.com/AntelopeJS/interface-database-decorators/pull/117)).

### 💅 Refactors

- Remove the unsafe-any directives and three SAFETY assertions ([#116](https://github.com/AntelopeJS/interface-database-decorators/pull/116))
- **modifiers:** ⚠️  Type the modifier contracts with WriteValue ([#117](https://github.com/AntelopeJS/interface-database-decorators/pull/117))

#### ⚠️ Breaking Changes

- **modifiers:** ⚠️  Type the modifier contracts with WriteValue ([#117](https://github.com/AntelopeJS/interface-database-decorators/pull/117))

### ❤️ Contributors

- Antony Rizzitelli ([@Upd4ting](http://github.com/Upd4ting))

## v0.4.1

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.4.0...v0.4.1)

### 📖 Documentation

- **readme:** Adopt the AntelopeJS framework README style ([#114](https://github.com/AntelopeJS/interface-database-decorators/pull/114))

### ✅ Tests

- **model:** Read the API port from DECORATORS_TEST_API_PORT ([#115](https://github.com/AntelopeJS/interface-database-decorators/pull/115))

### ❤️ Contributors

- Antony Rizzitelli ([@Upd4ting](http://github.com/Upd4ting))

## v0.4.0

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.3.2...v0.4.0)

### 🩹 Fixes

- **modifiers:** Read a stored field with no value as null at the end of the read ([#113](https://github.com/AntelopeJS/interface-database-decorators/pull/113))

### ❤️ Contributors

- Antony Rizzitelli ([@Upd4ting](http://github.com/Upd4ting))

## v0.3.2

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.3.1...v0.3.2)

### 🩹 Fixes

- **localized:** Read a record in plain data as its values by locale ([#112](https://github.com/AntelopeJS/interface-database-decorators/pull/112))

### ❤️ Contributors

- Antony Rizzitelli ([@Upd4ting](http://github.com/Upd4ting))

## v0.3.1

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.3.0...v0.3.1)

### 🩹 Fixes

- **localized:** Read an unset field of a request without a locale as null ([#111](https://github.com/AntelopeJS/interface-database-decorators/pull/111))

### ❤️ Contributors

- Antony Rizzitelli ([@Upd4ting](http://github.com/Upd4ting))

## v0.3.0

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.2.2...v0.3.0)

### 🚀 Enhancements

- **hash:** Add setHashAsync to hash a field off the event loop ([#110](https://github.com/AntelopeJS/interface-database-decorators/pull/110))

### 📖 Documentation

- **verify:** Retire the fixed #80 and #81 known findings and the 0.1.12 minor-bump note ([#107](https://github.com/AntelopeJS/interface-database-decorators/pull/107), [#80](https://github.com/AntelopeJS/interface-database-decorators/issues/80), [#81](https://github.com/AntelopeJS/interface-database-decorators/issues/81))
- **modifiers:** Document attachModifier and unlockrequest ([#108](https://github.com/AntelopeJS/interface-database-decorators/pull/108))

### 📦 Build

- **deps:** Bump @antelopejs/tooling-configs to 0.5.0 ([#106](https://github.com/AntelopeJS/interface-database-decorators/pull/106))
- **deps:** Bump @antelopejs/tooling-configs to 0.5.1 ([#109](https://github.com/AntelopeJS/interface-database-decorators/pull/109))

### ❤️ Contributors

- Antony Rizzitelli ([@Upd4ting](http://github.com/Upd4ting))

## v0.2.2

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.2.1...v0.2.2)

### 🚀 Enhancements

- **modifiers:** Declare the ContainerModifier key as string or undefined ([#101](https://github.com/AntelopeJS/interface-database-decorators/pull/101))
- **localization:** Type localize("*") fields as records by locale ([#102](https://github.com/AntelopeJS/interface-database-decorators/pull/102))

### 🔥 Performance

- **verify:** Wait for the index names @antelopejs/mongodb creates ([#94](https://github.com/AntelopeJS/interface-database-decorators/pull/94))
- **test:** Overlap the sync and async scrypt runs of each hash check ([#96](https://github.com/AntelopeJS/interface-database-decorators/pull/96))

### 🩹 Fixes

- **verify:** Run every feature when a shared file changes ([#95](https://github.com/AntelopeJS/interface-database-decorators/pull/95))
- **encryption:** Revive an encrypted Date of any year toUTCString writes ([#99](https://github.com/AntelopeJS/interface-database-decorators/pull/99))
- **modifiers:** List symbol-named modified fields ([#97](https://github.com/AntelopeJS/interface-database-decorators/pull/97))
- **localization:** Refuse a non-record value under the "*" key ([#100](https://github.com/AntelopeJS/interface-database-decorators/pull/100))
- **metadata:** Inherit the metadata of the nearest decorated ancestor ([#104](https://github.com/AntelopeJS/interface-database-decorators/pull/104))
- **hash:** Declare testHash as returning a boolean ([#98](https://github.com/AntelopeJS/interface-database-decorators/pull/98))
- **model:** Keep a row's other modified fields and salt on a partial update ([#103](https://github.com/AntelopeJS/interface-database-decorators/pull/103))

### 📦 Build

- **deps:** Bump @antelopejs packages to the 2026-11-06 releases ([#93](https://github.com/AntelopeJS/interface-database-decorators/pull/93))
- **deps:** Bump @antelopejs/tooling-configs to 0.4.0 ([#105](https://github.com/AntelopeJS/interface-database-decorators/pull/105))

### ❤️ Contributors

- Antony Rizzitelli ([@Upd4ting](http://github.com/Upd4ting))

## v0.2.1

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.2.0...v0.2.1)

### 🚀 Enhancements

- **skills:** Add the verify-interface verification skill ([#79](https://github.com/AntelopeJS/interface-database-decorators/pull/79))

### 🏡 Chore

- **verify:** Remove seeded runs from the verification skill ([#90](https://github.com/AntelopeJS/interface-database-decorators/pull/90))
- **ci:** Remove the weekly mutation caller ([#91](https://github.com/AntelopeJS/interface-database-decorators/pull/91))

### 🤖 CI

- Call ci-node.yml@v1 ([#92](https://github.com/AntelopeJS/interface-database-decorators/pull/92))

### ❤️ Contributors

- Antony Rizzitelli ([@Upd4ting](http://github.com/Upd4ting))

## v0.2.0

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.1.12...v0.2.0)

### 📖 Documentation

- **readme:** Link the package to AntelopeJS and AntelopeJS DMS ([82ae1bb](https://github.com/AntelopeJS/interface-database-decorators/commit/82ae1bb))

### 🏡 Chore

- Land the cleanup campaign on main ([#87](https://github.com/AntelopeJS/interface-database-decorators/pull/87))

### ❤️ Contributors

- Antony Rizzitelli ([@Upd4ting](http://github.com/Upd4ting))

## v0.1.12

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.1.11...v0.1.12)

### 🩹 Fixes

- **fixtures:** Let two processes register a fixture on an empty table ([#74](https://github.com/AntelopeJS/interface-database-decorators/pull/74))

### 💅 Refactors

- Clear the residual ratchet findings ([#46](https://github.com/AntelopeJS/interface-database-decorators/pull/46))

### 📖 Documentation

- **readme:** Use one Discord invite ([#68](https://github.com/AntelopeJS/interface-database-decorators/pull/68))
- **github:** Send questions and ideas to Discord ([#76](https://github.com/AntelopeJS/interface-database-decorators/pull/76))

### 📦 Build

- **deps:** Bump @antelopejs/tooling-configs to 0.2.17 ([#49](https://github.com/AntelopeJS/interface-database-decorators/pull/49))

### ❤️ Contributors

- Antony Rizzitelli ([@Upd4ting](http://github.com/Upd4ting))

## v0.1.11

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.1.10...v0.1.11)

### 🚀 Enhancements

- **database-decorators:** Accept any property key in the modifier metadata ([044563b](https://github.com/AntelopeJS/interface-database-decorators/commit/044563b))

### 💅 Refactors

- Clean the repo with the guardrail pack ([#39](https://github.com/AntelopeJS/interface-database-decorators/pull/39))
- Clear avoidable findings with pack 0.2.11 ([#41](https://github.com/AntelopeJS/interface-database-decorators/pull/41))

### 📖 Documentation

- **changelog:** Upgrade notes of interface-database-decorators 0.1.10 ([#35](https://github.com/AntelopeJS/interface-database-decorators/pull/35))

### 📦 Build

- Adopt the AntelopeJS guardrail pack ([#36](https://github.com/AntelopeJS/interface-database-decorators/pull/36))

### 🏡 Chore

- Configure Renovate with the shared preset ([#37](https://github.com/AntelopeJS/interface-database-decorators/pull/37))

### ✅ Tests

- **skills:** Add eval cases for database-decorators-interface ([#38](https://github.com/AntelopeJS/interface-database-decorators/pull/38))

### ❤️ Contributors

- Antony Rizzitelli ([@Upd4ting](http://github.com/Upd4ting))

## v0.1.10

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.1.9...v0.1.10)

### Upgrade notes

- `@Index({ unique: true })` emits `unique: true` in the index definition; for a group, one member setting it applies it to the whole group ([#32](https://github.com/AntelopeJS/interface-database-decorators/pull/32)). The peer `@antelopejs/interface-database` is now `>=0.1.11 <1.0.0`; the driver must enforce `unique` (`@antelopejs/mongodb` ≥ 1.5.0, `@antelopejs/postgres` ≥ 0.2.2; `@antelopejs/rethinkdb` refuses unique secondary indexes).
- **Behavior change:** with `@Localized({ fallbackLocale })`, an empty value counts as no value ([#33](https://github.com/AntelopeJS/interface-database-decorators/pull/33)). Writing `""` in one locale removes that locale, `localize("*")` drops empty entries, and filters and localized sorts fall back to the fallback locale. Rows saved before this release that still hold `""` read correctly in memory, but queries see `""` until the row is saved again (no migration).
- `LocalizationModifier.fallbackLocaleOf(TableClass, field)` returns the `fallbackLocale` a field declares, or `undefined` ([#34](https://github.com/AntelopeJS/interface-database-decorators/pull/34)).

### 🚀 Enhancements

- **index:** Unique option on @Index ([#32](https://github.com/AntelopeJS/interface-database-decorators/pull/32))
- **localization:** Read the fallback locale of a localized field ([#34](https://github.com/AntelopeJS/interface-database-decorators/pull/34))

### 🩹 Fixes

- **localization:** An empty value takes the fallback locale ([#33](https://github.com/AntelopeJS/interface-database-decorators/pull/33))

### 📖 Documentation

- Improve task-based onboarding and contract guidance ([#29](https://github.com/AntelopeJS/interface-database-decorators/pull/29))
- Clarify learning paths and illustrate real outcomes ([#31](https://github.com/AntelopeJS/interface-database-decorators/pull/31))

### ❤️ Contributors

- Antony Rizzitelli <rizzitelli.antony@pm.me>

## v0.1.9

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.1.8...v0.1.9)

### 📖 Documentation

- Rewrite the README ([#26](https://github.com/AntelopeJS/interface-database-decorators/pull/26))
- **agents:** Simplify repository guidance ([#27](https://github.com/AntelopeJS/interface-database-decorators/pull/27))
- Correct modifier examples and model contracts ([#28](https://github.com/AntelopeJS/interface-database-decorators/pull/28))

### ❤️ Contributors

- Antony Rizzitelli <rizzitelli.antony@pm.me>

## v0.1.8

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.1.7...v0.1.8)

### 🚀 Enhancements

- **table:** Open a table class's query object and share metadata keys across interface instances ([#24](https://github.com/AntelopeJS/interface-database-decorators/pull/24))

### ❤️ Contributors

- Thomas ([@Thomasims](http://github.com/Thomasims))

## v0.1.7

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.1.6...v0.1.7)

### 🚀 Enhancements

- **index:** Add crossInstance option to @Index ([#22](https://github.com/AntelopeJS/interface-database-decorators/pull/22))

### 📖 Documentation

- **readme:** Remove social card image ([#17](https://github.com/AntelopeJS/interface-database-decorators/pull/17))

### 🏡 Chore

- Replace Biome with oxlint, oxfmt and Knip ([#14](https://github.com/AntelopeJS/interface-database-decorators/pull/14))
- Align community files with the organization defaults ([#16](https://github.com/AntelopeJS/interface-database-decorators/pull/16))
- Remove .git-blame-ignore-revs ([#18](https://github.com/AntelopeJS/interface-database-decorators/pull/18))

### 🤖 CI

- Standardize npm releases ([#13](https://github.com/AntelopeJS/interface-database-decorators/pull/13))
- Use shared npm release workflow ([#15](https://github.com/AntelopeJS/interface-database-decorators/pull/15))
- **release:** Release next from a dedicated branch and restore requireCommits ([#19](https://github.com/AntelopeJS/interface-database-decorators/pull/19))
- **release:** Reference the shared release workflows through v1 ([#20](https://github.com/AntelopeJS/interface-database-decorators/pull/20))

### ❤️ Contributors

- Antony Rizzitelli <rizzitelli.antony@pm.me>
- Thomas ([@Thomasims](http://github.com/Thomasims))

## v0.1.6

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.1.5...v0.1.6)

### 🚀 Enhancements

- **skills:** Ship a consumer skill with the package ([#12](https://github.com/AntelopeJS/interface-database-decorators/pull/12))

### ❤️ Contributors

- Antony Rizzitelli <upd4ting@gmail.com>

## v0.1.5

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.1.4...v0.1.5)

### 🚀 Enhancements

- **modifiers:** Add AutoDateModifier with CreationTime and UpdateTime decorators ([#11](https://github.com/AntelopeJS/interface-database-decorators/pull/11))

### 📖 Documentation

- Declare table fields with @Field and @Relation decorators in examples ([#10](https://github.com/AntelopeJS/interface-database-decorators/pull/10))

### ✅ Tests

- Declare table fields with @Field decorator in test fixtures ([#9](https://github.com/AntelopeJS/interface-database-decorators/pull/9))

### ❤️ Contributors

- Antony Rizzitelli <upd4ting@gmail.com>
- Fabrice Cst <fabrice@altab.be>

## v0.1.4

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.1.3...v0.1.4)

### 🚀 Enhancements

- **relation:** Add Relation decorator for declarative table links ([#8](https://github.com/AntelopeJS/interface-database-decorators/pull/8))

### ❤️ Contributors

- Antony Rizzitelli <upd4ting@gmail.com>

## v0.1.3

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.1.2...v0.1.3)

## v0.1.2

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.1.1...v0.1.2)

### 🚀 Enhancements

- Declare interface as standalone ([4b41939](https://github.com/AntelopeJS/interface-database-decorators/commit/4b41939))

### 📖 Documentation

- Update schema registration to RegisterSchema(schemaId) ([cb552b3](https://github.com/AntelopeJS/interface-database-decorators/commit/cb552b3))

### ❤️ Contributors

- Thomasims <thomasims3@hotmail.fr>

## v0.1.1

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.1.0...v0.1.1)

### 🚀 Enhancements

- Align with interface-database lifecycle rollback; add @Field + opt-in validation ([#6](https://github.com/AntelopeJS/interface-database-decorators/pull/6))

### ✅ Tests

- Bump mongodb adapter to 1.2.1 and strip _instance in fixture assertion ([96be284](https://github.com/AntelopeJS/interface-database-decorators/commit/96be284))

### ❤️ Contributors

- Antony Rizzitelli <upd4ting@gmail.com>
- Thomas ([@Thomasims](http://github.com/Thomasims))

## v0.1.0

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.0.4...v0.1.0)

### 🚀 Enhancements

- Rename CreateDatabaseSchemaInstance to RegisterSchema and add @TenantScoped ([#5](https://github.com/AntelopeJS/interface-database-decorators/pull/5))

### ❤️ Contributors

- Antony Rizzitelli <upd4ting@gmail.com>

## v0.0.4

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.0.3...v0.0.4)

### 🏡 Chore

- Bump @antelopejs/interface-api to ^0.0.3 and @antelopejs/interface-database to ^0.0.4 ([8fff94a](https://github.com/AntelopeJS/interface-database-decorators/commit/8fff94a))

### ❤️ Contributors

- Antony Rizzitelli <upd4ting@gmail.com>

## v0.0.3

[compare changes](https://github.com/AntelopeJS/interface-database-decorators/compare/v0.0.2...v0.0.3)

### 💅 Refactors

- Switch test modules from local to npm packages ([c49f116](https://github.com/AntelopeJS/interface-database-decorators/commit/c49f116))

### 📖 Documentation

- Rewrite documentation for production readiness ([dc68876](https://github.com/AntelopeJS/interface-database-decorators/commit/dc68876))

### 🏡 Chore

- Update dependencies ([b52fdbe](https://github.com/AntelopeJS/interface-database-decorators/commit/b52fdbe))
- Package maintenance ([#4](https://github.com/AntelopeJS/interface-database-decorators/pull/4))

### 🤖 CI

- Add test step to CI workflow ([2008eda](https://github.com/AntelopeJS/interface-database-decorators/commit/2008eda))

### ❤️ Contributors

- Antony Rizzitelli <upd4ting@gmail.com>

## v0.0.2

### 🚀 Enhancements

- Add database decorators interface implementation ([f470fb9](https://github.com/AntelopeJS/interface-database-decorators/commit/f470fb9))

### 📖 Documentation

- Clarify current version status ([002c8e5](https://github.com/AntelopeJS/interface-database-decorators/commit/002c8e5))
- Update license section in README.md ([4bd700c](https://github.com/AntelopeJS/interface-database-decorators/commit/4bd700c))
- Updates badge URL ([868e6a8](https://github.com/AntelopeJS/interface-database-decorators/commit/868e6a8))
- Improved shields ([#1](https://github.com/AntelopeJS/interface-database-decorators/pull/1))
- Fix database-decorators@beta link in README.md ([#2](https://github.com/AntelopeJS/interface-database-decorators/pull/2))
- Wildcard and modifier events ([#3](https://github.com/AntelopeJS/interface-database-decorators/pull/3))

### 🏡 Chore

- Import existing codebase ([79442fc](https://github.com/AntelopeJS/interface-database-decorators/commit/79442fc))
- Rename version ([9266cbf](https://github.com/AntelopeJS/interface-database-decorators/commit/9266cbf))
- Rename license file ([566070a](https://github.com/AntelopeJS/interface-database-decorators/commit/566070a))

### ❤️ Contributors

- Antony Rizzitelli <upd4ting@gmail.com>
- Glastis ([@Glastis](http://github.com/Glastis))
