---
covers:
docs:
  - README.md
journeys:
  - register-schema
  - crud
---

# Smoke

The fixed journeys every verdict runs, whatever the diff touches: provision a schema from decorated tables, write and read rows through a model in a live MongoDB,.

## Sub-features

- `register-schema`: as in [registration](registration.md).
- `crud`: as in [models](models.md).

## How to get to it (user POV)

- A module that imports `@antelopejs/interface-database-decorators`, declares a table and calls `RegisterSchema`, in a project with a database module.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" smoke
```

## Gotchas

- The smoke feature covers no glob, so it never marks a file as mapped.
- The pack's `minor-bump` journey is not in this feature. It fails at the current head: the pack names a `unique symbol` property key by the TypeScript checker's internal symbol id (`__@MixinSymbol@<id>`), and that id differs between the packed head and the published version. `[MixinSymbol]` on `EncryptionModifier`, `HashModifier` and `LocalizationModifier` then reads as removed and added, even though the head's `dist` matches the published 0.2.2 byte for byte. Add `minor-bump` to `smoke` once `@antelopejs/tooling-configs` names such keys stably.
- `every-function` is not part of this feature: the package exports decorators, classes and plain functions, and no interface proxy a stub provider could answer. The scenarios below it drive the real functions against MongoDB instead.
