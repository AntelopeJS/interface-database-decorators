---
covers:
  - src/modifiers/encryption.ts
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
