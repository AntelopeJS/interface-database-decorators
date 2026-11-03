---
covers:
docs:
  - README.md
journeys:
  - register-schema
  - crud
  - minor-bump
---

# Smoke

The fixed journeys every verdict runs, whatever the diff touches: provision a schema from decorated tables, write and read rows through a model in a live MongoDB, and compare the declared functions with the published version.

## Sub-features

- `register-schema`: as in [registration](registration.md).
- `crud`: as in [models](models.md).
- `minor-bump`: an added, changed or removed function releases as at least a new minor.

## How to get to it (user POV)

- A module that imports `@antelopejs/interface-database-decorators`, declares a table and calls `RegisterSchema`, in a project with a database module.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" smoke
```

## Gotchas

- The smoke feature covers no glob, so it never marks a file as mapped.
- `minor-bump` needs the npm registry; without it the journey is not verified.
- `every-function` is not part of this feature: the package exports decorators, classes and plain functions, and no interface proxy a stub provider could answer. The scenarios below it drive the real functions against MongoDB instead.
