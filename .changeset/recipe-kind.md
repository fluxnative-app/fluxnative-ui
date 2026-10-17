---
"@fluxnative/catalog": minor
"@fluxnative/ui-mcp": minor
---

Every recipe and hook in the catalog now carries a `recipeKind` in `registry.meta.json` and `registry.json`: `behaviour` when it owns an interaction or system contract a hand-made copy tends to break (Press, TextField, Toggle, Sheet, StateView, Photo, MessageList, the AI and timing hooks…), `visual` when it is presentation only (Button, Chip, ScreenHeader, TabBar, the commerce pack…). The registry build fails on an entry without one. The screen graders use it so templates keep their own look without re-implementing behaviour: `coverage` passes when every expected behaviour recipe is rendered (its `score` stays the share of all expected recipes, and `details.behaviour` / `details.visual` list expected, used and missing), and `shadow-primitive` still fails a local copy of a behaviour recipe but reports a copy of a visual one under `details.warnings` without failing. An expected hook now counts as used when the screen calls it.
