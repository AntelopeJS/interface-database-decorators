---
covers:
  - src/database.ts
  - src/schema.ts
  - src/internal/bound-schema.ts
  - src/table.ts
docs:
  - docs/2.table-definitions.md
  - docs/1.introduction.md
journeys:
  - register-schema
  - fixtures
  - fixture-race
  - table-access
---

# Registration

`RegisterSchema`, `Fixture` and `Table.table()`.

## Sub-features

- `register-schema`: provisioning, binding and the unknown-schema error.
- `fixtures`: fixtures fill an empty table once, with generated ids and the insert conversion.
- `fixture-race`: two starts write each row once; a subclass gets its parent's fixture.
- `table-access`: `Table.table` for the default, a named, the cross-instance and a held instance, and its two errors.

## How to get to it (user POV)

- A module calls `await RegisterSchema(id)` during initialization.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" registration
```

## Gotchas

- A stored fixture row without an id is keyed `<table>:fixture:<position>`.
