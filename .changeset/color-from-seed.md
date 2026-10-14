---
'@fluxnative/tokens': minor
'@fluxnative/catalog': minor
---

A brand can give one `seed` colour (`$extensions["dev.fluxnative.brand"].seed`, or `"seed"` in a `colors.json`). The accent roles it does not set are then derived from that seed in both schemes, readable by construction: `primary`, `primary-foreground`, `ring`, `tertiary`, `tertiary-foreground`, `accent` and `accent-foreground`.

- `primary` keeps the seed's hue and moves just far enough to reach 4.5:1 on every surface the brand ends up with.
- `deriveSeedRoles`, `readableAccent` and `readableOn` are exported from `@fluxnative/tokens/brand`.

A brand without a seed resolves exactly as before. Applying this to the 98-template catalog writes the same bytes as without it.
