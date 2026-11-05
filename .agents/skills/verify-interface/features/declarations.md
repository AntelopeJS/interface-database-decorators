---
covers:
  - src/index.ts
  - src/common.ts
  - src/model.ts
  - src/table.ts
  - src/relation.ts
  - src/database.ts
  - src/schema.ts
  - src/modifiers/*.ts
docs:
  - docs/4.data-models.md
journeys:
  - docs-examples
  - model-signatures
  - modifier-signatures
  - rejected-calls
  - packed-subpaths
---

# Declarations

The packed `.d.ts` files.

## Sub-features

- `docs-examples`: every complete TypeScript example of docs/ and README.md (blocks not marked `fragment`) compiles against the packed declarations.
- `model-signatures`: the return types of the model methods and `RegisterSchema`, the row aliases, `getBy` keys, `@Model` without an instance, async fixtures, `toDatabase` of plain data, and `X.with(...)` on a decorated class.
- `packed-subpaths`: the packed package, not the checkout, serves every subpath the skill file imports.
- `rejected-calls`: every wrong call listed in the journey is refused by tsc.
- `modifier-signatures`: the hash and localization mixin methods.

## How to get to it (user POV)

- A consumer compiles against `dist/index.d.ts` in strict mode.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" declarations
```

## Gotchas

- Needs no database.
