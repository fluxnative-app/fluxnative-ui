---
"@fluxnative/ui-mcp": patch
---

`get_design_rules` serves CRAFT rules v0.3.0. Rule 5 now keeps a photo region of the reference a photo, from the template's own assets, the Unsplash API (hotlinked, author credited) or the team's `fluxnative-app/image` repo pinned by commit, with every raster a `Photo` with `alt` and `fallback`; picsum and placeholder services, stock-looking heroes and emoji icons stay banned. Rule 2 still bans decoration the reference does not have, but a signature it does have (a mesh gradient, a glossy orb, a glow) is built with depth instead of flattened. A review of 53 factory templates found photos replaced by vectors or initials in about 28 of them and glossy or mesh signatures flattened in about 8 of 10; the reasoning is in `docs/topics/craft.md`.
