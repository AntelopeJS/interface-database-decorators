---
covers:
  - src/model.ts
  - .agents/skills/verify-interface/scenarios/models*.ts
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
  - docs/4.data-models.md
  - docs/1.introduction.md
journeys:
  - crud
  - conversion
  - validation
  - get-model
  - plain-data
  - compound-get-by
  - get-by-keys
  - autodate-object-update
  - partial-update-keeps-modified-fields
  - model-factory
  - extend-model
---

# Models

`BasicDataModel`, its CRUD methods, conversions, validation and `GetModel`.

## Sub-features

- `crud`: ids, counts and read-backs.
- `conversion`: the three static conversions save nothing; reads convert.
- `validation`: codecs, opt-in `validate`, partial patches, and a refusal that is an `Error`.
- `get-model`: one cached model per class and instance id; instances stay apart.
- `autodate-object-update`: the update form that carries the primary key, as in [autodate](autodate.md).
- `plain-data`: `toPlainData` output.
- `compound-get-by`: a three-field compound index, with text keys and with number, boolean and value proxy keys.
- `get-by-keys`: a number, a boolean and a value proxy key, as `Table.getAll` takes them.
- `partial-update-keeps-modified-fields`: updating one field keeps the row's other encrypted, hashed and localized fields.
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
