# Feature map

One file per feature. `covers:` lists the source globs it owns, `docs:` the pages a verdict judges, `journeys:` the journeys it runs, and `seeded-breaks/<feature>.patch` the break its journeys must catch. `pnpm exec antelopejs-verify map` checks that every user-facing file is covered.

Every journey runs a scenario inside `ajs module test` with `@antelopejs/mongodb` against a MongoDB container, then reads the database back with `mongosh`. The scenarios live in `scenarios/`, the runner in `runner.ts`.

| Feature | What the user does | Journeys |
|---|---|---|
| [autodate](autodate.md) | Creation and update timestamps are set on write. | autodate |
| [custom-modifiers](custom-modifiers.md) | A developer writes a one-way, two-way, container or events-only modifier. | one-way-modifier, two-way-modifier, container-modifier, modifier-events |
| [declarations](declarations.md) | The packed type declarations match the return types the docs list. | model-signatures, modifier-signatures |
| [encryption](encryption.md) | A field is stored encrypted and read back decrypted. | encryption-at-rest, encryption-dates, encryption-keys |
| [hashing](hashing.md) | A field is stored hashed and tested against a candidate. | hash-storage, hash-verify, hash-limits, hash-upgrade, hash-digest |
| [localization](localization.md) | A field keeps one text per locale with a fallback. | localize, localize-wildcard, localized-storage |
| [models](models.md) | A developer reads and writes rows through a typed model. | crud, conversion, validation, get-model, model-factory, extend-model |
| [parameter-decoration](parameter-decoration.md) | A controller gets a model injected per route, instance or property. | fixed-instance, per-request-instance, property-decoration, crud-controller |
| [registration](registration.md) | A module registers its schema, fills fixtures and opens tables from their classes. | register-schema, fixtures, fixture-race, table-access |
| [smoke](smoke.md) | The fixed journeys every verdict runs. | register-schema, crud, minor-bump |
| [tables](tables.md) | A developer describes a table with Field, Index and Relation, and subclasses it. | index-options, group-flags, field-types, relation-metadata, inheritance, table-with |

## Not driven

| Documented behaviour | Why no journey drives it |
|---|---|
| A model "stays on the declaring module's database even when another module calls `GetModel`" (docs/4, GetModel) | Needs two modules with two databases behind one provider; one container serves one database here. |
| `testHash` and `testHashAsync` spend one scrypt run whatever the row holds, and the time of a refusal does not tell the row's format (docs/3, HashModifier) | A timing claim; a journey comparing wall-clock times would be flaky on a shared machine. |
| A digest field's test spends no scrypt run (docs/3) | Same: a timing claim. |
| A stored scrypt string with `ln` of at least 16 × `r` refuses every candidate (docs/3) | Node's own scrypt cannot compute such a hash, so no correct candidate exists to refuse; the boundary just below it is driven. |
| Encrypted fields keep whole-second dates only (docs/3) | Driven (`encryption-dates`). |
| `Fixture` generator for a class that does not extend the decorated one throws "does not extend" | Not reachable through the public API; the generator is wrapped by the decorator. |
| Queries that read a modified field through `model.table` (`unlockrequest`, locale fallback in AQL) | The docs only say `model.table` returns AQL results; they describe no query behaviour of the modifiers. |
| `@Model` on a method of a controller outside a request | Docs state the property is unset outside a request (driven in `property-decoration`); no other claim. |
| Updating one of several modified fields keeps the others | Documented only for a hashed field left out of the patch (driven in `hash-upgrade`). Updating one modified field beside another erases the other: bug, see the issue draft `interface-database-decorators-partial-update-drops-modified-fields`; not pinned. |
| `toDatabase` "has no prototype" (docs/4) | The result is a plain object with `Object.prototype`; the journey checks it is not an instance of the table class. The wording is loose, noted in the hand-back. |
| Database-driver behaviours: a driver that cannot enforce a unique secondary index refuses the schema (docs/2) | Belongs to the database module (rethinkdb); this repository only passes `unique` to the provider (driven through MongoDB in `index-options`). |
| `CROSS_INSTANCE` indexes and `between()` on a real driver beyond the schema definition | The cross-instance index is checked in the definition and in MongoDB's index list; query speed is not observable. |
