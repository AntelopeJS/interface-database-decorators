---
covers:
  - src/modifiers/encryption.ts
  - .agents/skills/verify-interface/scenarios/encryption.ts
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
  - encryption-at-rest
  - encryption-dates
  - encryption-keys
---

# Encryption

`EncryptionModifier` and `@Encrypted`.

## Sub-features

- `encryption-at-rest`: base64 ciphertext, iv and auth tag; only the key opens it.
- `encryption-dates`: a `Date` returns with whole-second precision.
- `encryption-keys`: the key is a UTF-8 string, so a hex key is refused.

## How to get to it (user POV)

- A table extends `Table.with(EncryptionModifier)` and marks fields `@Encrypted`.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" encryption
```

## Gotchas

- The scenario decrypts the stored triple with Node's crypto alone.
