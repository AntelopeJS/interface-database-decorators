<a href="https://github.com/AntelopeJS/antelopejs"><img data-illustration src="./.github/readme/strip.svg" width="100%" alt="INTERFACE · DATABASE DECORATORS: part of AntelopeJS, hexagonal architecture beyond your own code. A glowing button reads Star AntelopeJS."></a>

<div align="center">

# `@antelopejs/interface-database-decorators`

<a href="https://www.npmjs.com/package/@antelopejs/interface-database-decorators"><img data-illustration alt="npm" src="https://img.shields.io/npm/v/@antelopejs/interface-database-decorators?style=for-the-badge&labelColor=000000&color=000000"></a> <a href="./LICENSE"><img data-illustration alt="License" src="https://img.shields.io/npm/l/@antelopejs/interface-database-decorators?style=for-the-badge&labelColor=000000&color=000000"></a> <a href="https://discord.gg/g4pFt6eXqu"><img data-illustration alt="Discord" src="https://img.shields.io/badge/Discord-18181B?logo=discord&style=for-the-badge&color=000000"></a> <a href="https://interfaces.antelopejs.com/docs/database-decorators"><img data-illustration alt="Docs" src="https://img.shields.io/badge/Docs-18181B?style=for-the-badge&color=000000"></a> <a href="https://github.com/AntelopeJS/antelopejs"><img data-illustration alt="Star AntelopeJS" src="https://img.shields.io/github/stars/AntelopeJS/antelopejs?label=Star%20AntelopeJS&style=for-the-badge&labelColor=000000&color=000000&logo=github"></a>

**Database tables and data models as TypeScript classes for AntelopeJS. Declare fields and indexes with decorators, then read and write rows through a typed model.**

[Documentation](https://interfaces.antelopejs.com/docs/database-decorators) · [Implementations](#implementations) · [All interfaces and providers](https://github.com/AntelopeJS/antelopejs#ecosystem)

</div>

Database tables and data models as TypeScript classes, on top of [`@antelopejs/interface-database`](https://github.com/AntelopeJS/interface-database). Declare fields and indexes with decorators, then read and write rows through a typed model.

## What it offers

- `Table`, `@RegisterTable`, `@Field`, `@Index` and `@Fixture` declare tables, indexes and seed rows; `RegisterSchema` provisions them.
- `BasicDataModel` and `GetModel` give each table typed CRUD methods with optional validation.
- `@Encrypted`, `@Hashed`, `@Localized`, `@CreationTime` and `@UpdateTime` transform field values on write and read.
- `await row.setHashAsync(field, value)` and `await row.testHashAsync(field, value)` hash a password off the event loop. Use them on a server: assigning a `@Hashed` field blocks the event loop for about 150 ms. See [Table modifiers](./docs/3.table-modifiers.md#mixin-methods).
- `@Model` injects a model into an [`@antelopejs/interface-api`](https://github.com/AntelopeJS/interface-api) controller.

## Implementations

The package runs in your module and has no implementing module of its own. The project needs a module that implements `@antelopejs/interface-database`:

| Module                                                             | Notes     |
| ------------------------------------------------------------------ | --------- |
| [`@antelopejs/mongodb`](https://github.com/AntelopeJS/mongodb)     | MongoDB   |
| [`@antelopejs/rethinkdb`](https://github.com/AntelopeJS/rethinkdb) | RethinkDB |

## Install

Add the package to the module that declares tables:

```bash
pnpm add @antelopejs/interface-database-decorators
```

Then add a database module to the project:

```bash
ajs project modules add @antelopejs/mongodb
```

## Quick start

```ts
import {
  BasicDataModel,
  Field,
  GetModel,
  Index,
  RegisterSchema,
  RegisterTable,
  Table,
} from "@antelopejs/interface-database-decorators";

@RegisterTable("recipes", "cookbook")
class Recipe extends Table {
  @Index()
  @Field("string")
  declare slug: string;

  @Field("string")
  declare tagline: string;
}

class RecipeModel extends BasicDataModel(Recipe) {}

export async function construct() {
  await RegisterSchema("cookbook");
}

export async function start() {
  const recipes = GetModel(RecipeModel);
  await recipes.insert({ slug: "grilled-halloumi", tagline: "Smoky skewers" });
  const [recipe] = await recipes.getBy("slug", "grilled-halloumi");
  await recipes.update(recipe._id, { tagline: "Smoky halloumi skewers" });
}
```

`RegisterSchema` creates every table registered for the schema and inserts their fixtures. Call it once, in the module that declares the tables.

## Documentation

- [Introduction](./docs/1.introduction.md)
- [Table definitions](./docs/2.table-definitions.md)
- [Table modifiers](./docs/3.table-modifiers.md)
- [Data models](./docs/4.data-models.md)
- [Parameter decoration](./docs/5.parameter-decoration.md)

## Compatibility

The package declares these `@antelopejs/*` peer dependencies:

<!-- antelopejs-docs-compat:start -->

| Package                          | Supported         | Tested with |
| -------------------------------- | ----------------- | ----------- |
| `@antelopejs/interface-api`      | `>=0.0.15 <1.0.0` | `0.0.15`    |
| `@antelopejs/interface-core`     | `>=0.2.4 <1.0.0`  | `0.4.0`     |
| `@antelopejs/interface-database` | `>=0.1.11 <1.0.0` | `0.3.0`     |

<!-- antelopejs-docs-compat:end -->

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before you open a pull request. The local checks are:

```bash
pnpm install
pnpm lint
pnpm test
```

## Part of AntelopeJS

[AntelopeJS](https://github.com/AntelopeJS/antelopejs) is a TypeScript framework where modules depend on contracts and the application chooses the provider behind each one. [AntelopeJS DMS](https://github.com/AntelopeJS/dms), the open-source back office, is built on it.

<!-- antelopejs-framework-modules:start -->

| Area         | Contracts                                                                                                                                                                                                                                                                                                                                                       | Providers                                                                                                                                                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API          | [`interface-api`](https://github.com/AntelopeJS/interface-api) · [`interface-api-util`](https://github.com/AntelopeJS/interface-api-util) · [`interface-data-api`](https://github.com/AntelopeJS/interface-data-api)                                                                                                                                            | [`api`](https://github.com/AntelopeJS/api)                                                                                                                                                                                                          |
| Auth         | [`interface-auth`](https://github.com/AntelopeJS/interface-auth)                                                                                                                                                                                                                                                                                                | [`auth-jwt`](https://github.com/AntelopeJS/auth-jwt)                                                                                                                                                                                                |
| Database     | [`interface-database`](https://github.com/AntelopeJS/interface-database) · **`interface-database-decorators`** · [`interface-database-catalog`](https://github.com/AntelopeJS/interface-database-catalog) · [`interface-mongodb`](https://github.com/AntelopeJS/interface-mongodb) · [`interface-rethinkdb`](https://github.com/AntelopeJS/interface-rethinkdb) | [`postgres`](https://github.com/AntelopeJS/postgres) · [`mongodb`](https://github.com/AntelopeJS/mongodb) · [`rethinkdb`](https://github.com/AntelopeJS/rethinkdb)                                                                                  |
| Redis        | [`interface-redis`](https://github.com/AntelopeJS/interface-redis) · [`interface-redis-scheduler`](https://github.com/AntelopeJS/interface-redis-scheduler)                                                                                                                                                                                                     | [`redis`](https://github.com/AntelopeJS/redis)                                                                                                                                                                                                      |
| Email        | [`interface-email`](https://github.com/AntelopeJS/interface-email)                                                                                                                                                                                                                                                                                              | [`nodemailer`](https://github.com/AntelopeJS/nodemailer) · [`brevo`](https://github.com/AntelopeJS/brevo)                                                                                                                                           |
| File storage | [`interface-file-storage`](https://github.com/AntelopeJS/interface-file-storage)                                                                                                                                                                                                                                                                                | [`file-storage-local`](https://github.com/AntelopeJS/file-storage-local) · [`file-storage-s3`](https://github.com/AntelopeJS/file-storage-s3)                                                                                                       |
| Payments     | [`interface-payment`](https://github.com/AntelopeJS/interface-payment) · [`interface-subscriptions`](https://github.com/AntelopeJS/interface-subscriptions) · [`interface-stripe`](https://github.com/AntelopeJS/interface-stripe)                                                                                                                              | [`stripe`](https://github.com/AntelopeJS/stripe) · [`mollie`](https://github.com/AntelopeJS/mollie) · [`checkout-com`](https://github.com/AntelopeJS/checkout-com) · [`payment-subscriptions`](https://github.com/AntelopeJS/payment-subscriptions) |

<!-- antelopejs-framework-modules:end -->

## License

[Apache-2.0](./LICENSE)
