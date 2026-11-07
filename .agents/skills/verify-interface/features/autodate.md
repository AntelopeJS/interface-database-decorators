---
covers:
  - src/modifiers/autodate.ts
  - .agents/skills/verify-interface/scenarios/localization.ts
  - package.json
  - pnpm-lock.yaml
  - tsconfig.json
  - src/index.ts
  - src/common.ts
  - src/modifiers/common.ts
  - src/modifiers/internal/**
  - src/internal/**
  - .agents/skills/verify-interface/runner.ts
  - .agents/skills/verify-interface/verify.config.ts
  - .agents/skills/verify-interface/package.json
  - .agents/skills/verify-interface/tsconfig.json
docs:
  - docs/3.table-modifiers.md
journeys:
  - autodate
  - autodate-object-update
---

# Auto dates

`CreationTime` and `UpdateTime`.

## Sub-features

- `autodate-object-update`: the update form that carries the primary key.
- `autodate`: insert, update and the stored dates.

## How to get to it (user POV)

- A table marks `Date` fields `@CreationTime()` and `@UpdateTime()`; no mixin.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" autodate
```

## Gotchas

- The update path waits 60 ms so the refreshed time differs.
