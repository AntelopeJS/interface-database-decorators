---
covers:
  - src/table.ts
  - src/relation.ts
  - src/common.ts
docs:
  - docs/2.table-definitions.md
journeys:
  - index-options
  - group-flags
  - field-types
  - relation-metadata
  - inheritance
  - table-with
---

# Tables

A table class with `Field`, `Index`, `Relation`, subclasses and `Table.with`.

## Sub-features

- `index-options`: plain, compound, cross-instance and unique indexes reach the provider and MongoDB.
- `group-flags`: `unique` and `crossInstance` on one field apply to the whole group.
- `field-types`: every field type goes through unchanged, in either decorator order.
- `relation-metadata`: `Relation` records links and enforces none.
- `inheritance`: a subclass copies its parent and never writes into it.
- `table-with`: mixin methods reach the subclass only.

## How to get to it (user POV)

- A module declares `Table` subclasses and registers them.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" tables
```

## Gotchas

- MongoDB creates indexes after the schema call returns, so the index read-back waits 2.5 seconds.
