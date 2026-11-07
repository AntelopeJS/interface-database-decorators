---
covers:
  - src/modifiers/common.ts
  - src/modifiers/index.ts
  - src/modifiers/internal/**
  - .agents/skills/verify-interface/scenarios/custom.ts
  - package.json
  - pnpm-lock.yaml
  - tsconfig.json
  - src/index.ts
  - src/common.ts
  - src/internal/**
  - .agents/skills/verify-interface/runner.ts
  - .agents/skills/verify-interface/verify.config.ts
  - .agents/skills/verify-interface/package.json
  - .agents/skills/verify-interface/tsconfig.json
docs:
  - docs/3.table-modifiers.md
journeys:
  - one-way-modifier
  - two-way-modifier
  - container-modifier
  - container-query
  - metadata-class
  - legacy-metadata
  - modifier-helpers
  - modifier-events
---

# Custom modifiers

`Modifier`, `OneWayModifier`, `TwoWayModifier`, `ContainerModifier`, `attachModifier` and the modifier events.

## Sub-features

- `one-way-modifier`: transform on write; a second one-way modifier on a field is refused.
- `two-way-modifier`: transform on write, unlock on read.
- `modifier-helpers`: the exported helpers of the modifier machinery.
- `container-query`: the key used in a query.
- `metadata-class`: `inherit` and `upgrade` of a published `MetadataClass`.
- `legacy-metadata`: metadata stored by an older copy of the package.
- `container-modifier`: values by key and the wildcard.
- `modifier-events`: event order for insert, update and reads; events-only modifiers add no accessor.

## How to get to it (user POV)

- A developer extends a modifier class and registers it with `attachModifier`.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" custom-modifiers
```

## Gotchas

- Scenarios define the modifiers in plain JavaScript with the same method names as the docs.
