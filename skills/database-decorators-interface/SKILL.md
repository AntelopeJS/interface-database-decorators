---
name: database-decorators-interface
description: Provides decorator-based database table definitions for AntelopeJS - a Table base class with RegisterTable/Index/Field/Fixture/Relation decorators, field modifiers (Encrypted, Hashed, Localized, CreationTime, UpdateTime), BasicDataModel CRUD models with validation, RegisterSchema provisioning, and the Model decorator for injecting models into API controllers. Use when code imports @antelopejs/interface-database-decorators (root or /table, /schema, /database, /model, /relation, /common, /modifiers/* subpaths), or when asked to define a database table or data model class, add encrypted/hashed/localized/timestamp fields, seed fixture data, register a schema, or inject a data model into an interface-api controller.
category: antelopejs-interface
tags: [database, decorators, orm, models, antelopejs]
---

# Database Decorators Interface

Consumer-side decorator layer on top of `@antelopejs/interface-database` (AQL). This package itself has no proxy
points and no provider side — you never `ImplementInterface` it. All actual database access flows through
`Schema`/`Table` from `@antelopejs/interface-database`, which must be implemented by a database module (e.g. MongoDB).
Peer interfaces required: `@antelopejs/interface-core`, `@antelopejs/interface-api` (only for the `Model` controller decorator), `@antelopejs/interface-database`.

## Imports

```typescript
import { Table, Field, Index, Fixture } from "@antelopejs/interface-database-decorators/table";
import { RegisterTable, getTablesForSchema } from "@antelopejs/interface-database-decorators/schema";
import { RegisterSchema } from "@antelopejs/interface-database-decorators/database";
import { BasicDataModel, GetModel, Model } from "@antelopejs/interface-database-decorators/model";
import { Relation } from "@antelopejs/interface-database-decorators/relation";
import { DatumStaticMetadata, getMetadata } from "@antelopejs/interface-database-decorators/common";
import { CreationTime, UpdateTime } from "@antelopejs/interface-database-decorators/modifiers/autodate";
import { Encrypted, EncryptionModifier } from "@antelopejs/interface-database-decorators/modifiers/encryption";
import { Hashed, HashModifier } from "@antelopejs/interface-database-decorators/modifiers/hash";
import { Localized, LocalizationModifier } from "@antelopejs/interface-database-decorators/modifiers/localization";
import { Modifier, OneWayModifier, TwoWayModifier, attachModifier, toPlainData } from "@antelopejs/interface-database-decorators/modifiers/common";
```

The package root re-exports everything above and also imports `reflect-metadata` (see gotchas).

## Minimal usage

```typescript
@RegisterTable("recipes", "cookbook") // (tableName, schemaName)
class Recipe extends Table {
  // _id: string is inherited as the primary key
  @Index() @Field("string")
  declare slug: string;
  @Field("string")
  declare tagline: string;
}

const RecipeModel = BasicDataModel(Recipe); // table name taken from @RegisterTable
await RegisterSchema("cookbook"); // once at startup: provisions all tables registered for "cookbook", runs fixtures

const recipes = GetModel(RecipeModel); // cached per (model class, instanceId)
await recipes.insert({ slug: "grilled-halloumi", tagline: "Smoky skewers" }, { validate: true });
const bySlug = await recipes.getBy("slug", "grilled-halloumi");
const one = await recipes.get(bySlug[0]._id);
await recipes.update(one._id, { tagline: "Smoky halloumi skewers" });
await recipes.delete(one._id);
```

Controller injection (works as parameter or property decorator; second arg is a static `InstanceId` or a
`(ctx: RequestContext) => InstanceId | undefined` callback — returning `undefined` falls back to the default schema instance):

```typescript
class RecipesController extends Controller("/recipes") {
  @Get()
  async list(@Model(RecipeModel) recipes: InstanceType<typeof RecipeModel>) {
    return recipes.getAll();
  }
}
```

## Field modifiers

```typescript
class Chef extends Table.with(HashModifier, EncryptionModifier, LocalizationModifier) {
  @Hashed() declare passphrase: string;                   // one-way; test via instance.testHash("passphrase", value)
  @Encrypted({ secretKey }) declare supplierCode: string; // transparent encrypt/decrypt (autolock + autounlock)
  @Localized() declare motto: string;                     // read AND write via instance.localize("en", ["motto"])
  @CreationTime() declare hiredAt: Date;                  // set on insert, stripped from updates
  @UpdateTime() declare lastActiveAt: Date;               // refreshed on insert and update
}
```

## Gotchas

- Only the package root imports `reflect-metadata`; if you import only subpaths, ensure `reflect-metadata`
  is loaded once before decorators run (e.g. `import "@antelopejs/interface-database-decorators"`).
- `Hashed`, `Encrypted`, and `Localized` require the matching modifier class in `Table.with(...)`; `CreationTime`/`UpdateTime` are event-only and need no mixin.
- Modifier ordering matters: `attachModifier` throws if you stack a modifier after a one-way modifier (e.g. anything after `@Hashed` on the same field).
- Hashed fields cannot be read back or queried directly — only equality-tested with `testHash`.
- Localized fields must be written through a localized instance (`instance.localize(locale).field = ...`);
  values assigned before `localize()` are held in floating state and silently dropped on insert/update.
- `@Relation({ to: () => Target })` is declarative metadata only: no foreign-key enforcement, consumed by introspection tooling via `RelationStaticMetadata`.
- `Model.validate` (and `{ validate: true }` on insert/update) only checks fields whose `@Field` type is an
  io-ts-style codec with `.decode`; plain string field tokens are skipped. Update validates with
  `{ partial: true }` semantics.
- `update(obj)` without an explicit id asserts that the object carries the primary key (`_id` by default).
- `@Fixture` data is only inserted by `RegisterSchema` when the table is empty (count === 0).
- `GetModel` caches by model class + instanceId; the same pair always returns the same instance.
- Serialization of modified instances to plain JSON goes through `toPlainData` (auto-attached as `toJSON`).

Deeper reference: this package's `docs/` chapters — Introduction, Table Definitions, Table Modifiers,
Data Models, Parameter Decoration — and the shipped `.d.ts` files. Do not duplicate them here.
