---
covers:
  - src/modifiers/autodate.ts
docs:
  - docs/3.table-modifiers.md
journeys:
  - autodate
---

# Auto dates

`CreationTime` and `UpdateTime`.

## Sub-features

- `autodate`: insert, update and the stored dates.

## How to get to it (user POV)

- A table marks `Date` fields `@CreationTime()` and `@UpdateTime()`; no mixin.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" autodate
```

## Gotchas

- The update path waits 60 ms so the refreshed time differs.
