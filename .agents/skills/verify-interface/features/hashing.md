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
  - hash-bounds
  - hash-memory
  - hash-sync-async
  - hash-outdated
  - hash-digest
---

# Hashing

`HashModifier` and `@Hashed`.

## Sub-features

- `hash-storage`: the scrypt format and parameters, checked with an independent scrypt.
- `hash-verify`: `testHash`, `testHashAsync`, `isHashOutdated`.
- `hash-bounds`: both edges of the `ln`, `r`, `p`, salt and key ranges.
- `hash-memory`: the 128 MiB limit at, under and over the line.
- `hash-sync-async`: `testHash` equals `testHashAsync` on current, legacy, low-cost, junk, empty and digest rows.
- `hash-outdated`: `isHashOutdated` for a changed `p`, `r` and `ln`.
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
