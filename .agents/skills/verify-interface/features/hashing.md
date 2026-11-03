---
covers:
  - src/modifiers/hash.ts
docs:
  - docs/3.table-modifiers.md
journeys:
  - hash-storage
  - hash-verify
  - hash-limits
  - hash-upgrade
  - hash-digest
---

# Hashing

`HashModifier` and `@Hashed`.

## Sub-features

- `hash-storage`: the scrypt format and parameters, checked with an independent scrypt.
- `hash-verify`: `testHash`, `testHashAsync`, `isHashOutdated`.
- `hash-limits`: the limits a stored scrypt string must stay inside.
- `hash-upgrade`: older formats verify, are flagged and are rewritten.
- `hash-digest`: `algorithm` digests with the row's shared salt.

## How to get to it (user POV)

- A table extends `Table.with(HashModifier)` and marks fields `@Hashed`.

## Driving it with antelopejs-verify

```bash
pnpm exec antelopejs-verify journey "$RUN" hashing
```

## Gotchas

- Each scrypt run takes about 32 MiB and blocks the loop; the journeys take several seconds.
