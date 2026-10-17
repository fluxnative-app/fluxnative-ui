# @fluxnative/ui-mcp

## 0.1.0

### Minor Changes

- 056b419: The catalog now carries one canonical list of screen archetypes (`ARCHETYPES`: OpenDesign's 30 plus `ai-chat`, `ai-generate`, `ai-scan`, `ai-voice`, `ai-insight`) and a generated `registry.archetypes.json` that maps each archetype to the recipes made for it (most evidence first) and the general ones that fit any screen, plus `behaviour`: those of `recipeKind` behaviour, which every screen of the archetype is expected to use (`mapVersion` 2). `pnpm tokens` writes it with `registry.json`, `pnpm tokens:check` keeps it fresh, and an archetype in `registry.meta.json` that is not on the list fails the build. The MCP server adds `get_archetype { archetype }`, which answers that entry with each recipe's import path, summary and use line and the `behaviour` names, so an agent that has assigned a screen its archetype can pick its recipes in one call instead of searching for every part.
- 50048fb: A new bin, `fluxnative-ui-grade [--root <files/>] [--expect <file.json>] [--json] <screen.tsx | dir>...`, runs every deterministic screen grader without MCP: dialect, typecheck, props, tokens, shadow-primitive and recipe coverage (`validate_screen` keeps its four). `--expect` sets the recipes and states each screen should cover, globally or per screen name; without one, coverage reports `na` instead of a pass. `--json` prints a versioned report (`{ version: 1, kit, pass, screens }`, each grader as `{ pass, score, details }`). It exits 0 when every screen passes, 2 when a grader fails and 1 on a usage or runtime error, including a typecheck that cannot run, which is reported as `unavailable` and never as a pass. `--root` grades a Flux template's screens as part of that template: its own components, data and theme resolve, `flux`, `flux/navigation` and `flux/glass` are typed, only errors in the screen's own file fail it, and props and coverage use the recipes its `.fluxnative-ui.json` lists. A local component named plain `Bar` is no longer reported as a re-implemented ScreenHeader.
- 8ec1e35: Both bins, `fluxnative-ui-grade` and `fluxnative-ui-mcp`, take `--version [--json]`, which prints `{"version", "commit"}` (the kit checkout's git `HEAD`, null when installed from npm), and `--doctor [--json]`, which checks Node 22.15 or newer, the installed dependencies the MCP server and the typecheck need, and that the MCP server answers `initialize` over stdio, exiting 1 with each failing item named. The grader's JSON report now carries the same `kit.commit`, so a template gate can prove it ran the kit its lock pins, and an agent lane fails at its start with a clear reason instead of a grader reading `unavailable` mid-gate. The repository root gains `pnpm mcp` and `pnpm grade` scripts (`pnpm --dir <kit> grade …` resolves paths against the caller), and the MCP README a "Run it in an agent lane" section: pinning a worktree by commit, the install command, the `.mcp.json` entry and the gate's grader call.
- 3d2e6b4: Every recipe and hook in the catalog now carries a `recipeKind` in `registry.meta.json` and `registry.json`: `behaviour` when it owns an interaction or system contract a hand-made copy tends to break (Press, TextField, Toggle, Sheet, StateView, Photo, MessageList, the AI and timing hooks…), `visual` when it is presentation only (Button, Chip, ScreenHeader, TabBar, the commerce pack…). The registry build fails on an entry without one. The screen graders use it so templates keep their own look without re-implementing behaviour: `coverage` passes when every expected behaviour recipe is rendered (its `score` stays the share of all expected recipes, and `details.behaviour` / `details.visual` list expected, used and missing), and `shadow-primitive` still fails a local copy of a behaviour recipe but reports a copy of a visual one under `details.warnings` without failing. An expected hook now counts as used when the screen calls it.

### Patch Changes

- 87f368f: `get_design_rules` serves CRAFT rules v0.3.0. Rule 5 now keeps a photo region of the reference a photo, from the template's own assets, the Unsplash API (hotlinked, author credited) or the team's `fluxnative-app/image` repo pinned by commit, with every raster a `Photo` with `alt` and `fallback`; picsum and placeholder services, stock-looking heroes and emoji icons stay banned. Rule 2 still bans decoration the reference does not have, but a signature it does have (a mesh gradient, a glossy orb, a glow) is built with depth instead of flattened. A review of 53 factory templates found photos replaced by vectors or initials in about 28 of them and glossy or mesh signatures flattened in about 8 of 10; the reasoning is in `docs/topics/craft.md`.
- Updated dependencies [056b419]
- Updated dependencies [7491251]
- Updated dependencies [9c3a2c9]
- Updated dependencies [8b56da6]
- Updated dependencies [3cfa035]
- Updated dependencies [3d2e6b4]
  - @fluxnative/catalog@0.1.0

## 0.0.1

### Minor Changes

- 1a908b7: The screen graders (dialect, props, tokens, shadow-primitive, coverage, typecheck, extract) move into `@fluxnative/ui-mcp` (`src/graders`), next to the `validate_screen` tool that uses them, and their tests now run in CI.

  The eval runner, the judges, the AI-look panels, `evolve` and the template-catalog `learn` command are now FluxBuilder's private tooling and leave this repository:

  - `fluxnative-catalog learn` is removed.
  - The `eval`, `evolve` and `judge` scripts are removed.
  - `docs/topics/evolution.md` is removed.

  The index gates every release must pass (no phantom name, every component documented, every recipe with evidence) are now a catalog test.

- 1a908b7: `@fluxnative/ui-mcp`, an MCP server over the catalog layer: `search_components`, `get_component`, `get_index`, `get_design_rules`, `list_tokens` and `validate_screen`, all answered from `registry.json`, the two indexes and the eval graders, so an agent can look recipes up and check a screen instead of guessing. Runs from a checkout over stdio (`node packages/mcp/src/bin.js`).

### Patch Changes

- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [e6edb0f]
- Updated dependencies [1a908b7]
- Updated dependencies [61c3566]
- Updated dependencies [1a908b7]
  - @fluxnative/catalog@0.0.1
