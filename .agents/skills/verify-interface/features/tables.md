---
covers:
  - src/table.ts
  - src/relation.ts
  - src/common.ts
  - .agents/skills/verify-interface/scenarios/tables.ts
  - package.json
  - pnpm-lock.yaml
  - tsconfig.json
  - src/index.ts
  - src/modifiers/common.ts
  - src/modifiers/internal/**
  - src/internal/**
  - .agents/skills/verify-interface/runner.ts
  - .agents/skills/verify-interface/verify.config.ts
  - .agents/skills/verify-interface/package.json
  - .agents/skills/verify-interface/tsconfig.json
docs:
  - docs/2.table-definitions.md
journeys:
  - index-options
  - group-flags
  - field-types
  - relation-metadata
  - forward-relation
  - inheritance
  - table-with
  - table-with-subclass
  - table-with-keeps-fields
  - subclass-modifiers
  - combine-modifiers
---

# Tables

A table class with `Field`, `Index`, `Relation`, subclasses and `Table.with`.

## Sub-features

- `index-options`: plain, compound, cross-instance and unique indexes reach the provider and MongoDB.
- `group-flags`: `unique` and `crossInstance` on one field apply to the whole group.
- `field-types`: every field type goes through unchanged, in either decorator order.
- `forward-relation`: the thunk allows forward references.
- `relation-metadata`: `Relation` records links and enforces none.
- `inheritance`: a subclass copies its parent and never writes into it.
- `combine-modifiers`: three modifiers on one table.
- `table-with-subclass`: the result of `with` extends the class it was called on.
- `table-with-keeps-fields`: known finding #81, fails until fixed.
- `subclass-modifiers`: modifier and event lists are copied per subclass.
- `table-with`: mixin methods reach the subclass only.

## How to get to it (user POV)

- A module declares `Table` subclasses and registers them.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" tables
```

## Gotchas

- MongoDB creates indexes after the schema call returns, so the index read-back waits 2.5 seconds.
