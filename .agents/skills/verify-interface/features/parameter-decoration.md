---
covers:
  - src/model.ts
docs:
  - docs/5.parameter-decoration.md
journeys:
  - fixed-instance
  - per-request-instance
  - custom-parameter-provider
  - property-decoration
  - crud-controller
---

# Parameter decoration

`@Model` on a controller parameter or property.

## Sub-features

- `fixed-instance`: an instance id.
- `per-request-instance`: a callback picks the instance, or `undefined` for the default.
- `custom-parameter-provider`: the docs' custom decorator example.
- `property-decoration`: a property is set while a request is handled.
- `crud-controller`: `@Model` beside `@Parameter` and `@RawBody` in a CRUD controller.

## How to get to it (user POV)

- A controller method declares `@Model(UserModel, "main")` on a parameter.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" parameter-decoration
```

## Gotchas

- The journeys also load `@antelopejs/api` on a free port picked per run.
