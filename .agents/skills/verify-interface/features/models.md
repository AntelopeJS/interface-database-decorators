---
covers:
  - src/model.ts
docs:
  - docs/4.data-models.md
  - docs/1.introduction.md
journeys:
  - crud
  - conversion
  - validation
  - get-model
  - model-factory
  - extend-model
---

# Models

`BasicDataModel`, its CRUD methods, conversions, validation and `GetModel`.

## Sub-features

- `crud`: ids, counts and read-backs.
- `conversion`: the three static conversions save nothing; reads convert.
- `validation`: codecs, opt-in `validate`, partial patches.
- `get-model`: one cached model per class and instance id; instances stay apart.
- `model-factory`: the table name comes from the argument or `RegisterTable`.
- `extend-model`: a model subclass adds query methods.

## How to get to it (user POV)

- A module builds a model class from a table class and gets it with `GetModel`.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" models
```

## Gotchas

- `update` with a patch of one modified field erases the other modified fields of the row (bug, issue draft; not pinned).
