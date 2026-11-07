---
covers:
  - src/modifiers/localization.ts
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
  - localize
  - localized-query
  - localize-wildcard
  - localize-wildcard-replace
  - localized-storage
---

# Localization

`LocalizationModifier` and `@Localized`.

## Sub-features

- `localize`: switching locale, fallback, restricting fields.
- `localized-query`: `unlockrequest` with a fallback locale.
- `localize-wildcard-replace`: a wildcard write replaces what was stored.
- `localize-wildcard`: the `"*"` key.
- `localized-storage`: one value per locale in MongoDB.

## How to get to it (user POV)

- A table extends `Table.with(LocalizationModifier)` and marks fields `@Localized`.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" localization
```

## Gotchas

- An empty text counts as no text, so the fallback answers for it.
