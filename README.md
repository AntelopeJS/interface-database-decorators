# @antelopejs/interface-database-decorators

<div align="center">
<a href="https://www.npmjs.com/package/@antelopejs/interface-database-decorators"><img alt="npm" src="https://img.shields.io/npm/v/@antelopejs/interface-database-decorators?style=for-the-badge&labelColor=000000&color=000000"></a>
<a href="./LICENSE"><img alt="License" src="https://img.shields.io/npm/l/@antelopejs/interface-database-decorators?style=for-the-badge&labelColor=000000&color=000000"></a>
<a href="https://discord.gg/sjK28QHrA7"><img alt="Discord" src="https://img.shields.io/badge/Discord-18181B?logo=discord&style=for-the-badge&color=000000"></a>
<a href="https://interfaces.antelopejs.com/docs/database-decorators"><img alt="Docs" src="https://img.shields.io/badge/Docs-18181B?style=for-the-badge&color=000000"></a>
</div>

Database tables and data models as TypeScript classes, on top of [`@antelopejs/interface-database`](https://github.com/AntelopeJS/interface-database): declare fields and indexes with decorators, then read and write rows through a typed model.

## What it offers

- `Table`, `@RegisterTable`, `@Field`, `@Index` and `@Fixture` declare tables, indexes and seed rows; `RegisterSchema` provisions them.
- `BasicDataModel` and `GetModel` give each table typed CRUD methods with optional validation.
- `@Encrypted`, `@Hashed`, `@Localized`, `@CreationTime` and `@UpdateTime` transform field values on write and read.
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

Requires AntelopeJS core `1.x` and the following peer dependencies:

<!-- docs-compat: ./package.json#peerDependencies -->

| Package                          | Range             |
| -------------------------------- | ----------------- |
| `@antelopejs/interface-api`      | `>=0.0.15 <1.0.0` |
| `@antelopejs/interface-core`     | `>=0.2.4 <1.0.0`  |
| `@antelopejs/interface-database` | `>=0.1.11 <1.0.0` |

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before you open a pull request. The local checks are:

```bash
pnpm install
pnpm lint
pnpm test
```

## License

[Apache-2.0](./LICENSE)
