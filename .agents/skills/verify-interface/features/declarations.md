---
covers:
  - src/index.ts
  - src/common.ts
docs:
  - docs/4.data-models.md
journeys:
  - model-signatures
  - modifier-signatures
  - rejected-calls
  - packed-subpaths
---

# Declarations

The packed `.d.ts` files.

## Sub-features

- `model-signatures`: the return types of the model methods and `RegisterSchema`.
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
