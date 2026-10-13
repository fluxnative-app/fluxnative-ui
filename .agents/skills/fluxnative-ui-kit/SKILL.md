---
name: fluxnative-ui-kit
description: Write a Flux template screen or an Expo screen on FluxNative UI correctly on the first try: read the catalog index and the craft rules, pick recipes from the registry instead of hand-writing them, keep to the template dialect and the token roles, then validate before finishing. Use whenever a task writes or changes React Native UI in a fluxbuilder-template template or in an app that uses @fluxnative/*.
metadata:
  version: "0.2.0"
  kit: "@fluxnative/catalog 0.2"
---

# Write a screen on FluxNative UI

## Read first

1. `docs/llm/CATALOG.index.md` (template dialect) or `docs/llm/AGENTS.index.md` (Expo app with `className`). Each is under 9 KB and lists every component with its props and closed values. Prefer it over anything you remember: the kit is newer than your training data.
2. `docs/llm/CRAFT.index.md`: the twelve design rules. They are what separates a designed screen from a generated one and what store review compares.
3. If the MCP server is connected (`fluxnative-ui`), call `get_index`, then `search_components` for each part of the screen.

## Build

- One default-exported component per screen file. Take `previewState` and render `Skeleton` / `StateView` for loading, empty and error (plus streaming and quota on AI screens).
- Every part of the screen that the registry has a recipe for uses the recipe: header → `ScreenHeader`, search → `SearchField`, form fields → `TextField`, settings → `ListGroup` + `ListRow` (+ `Toggle`), tabs within a screen → `SegmentedControl`, inline messages → `Notice`, quantities → `Stepper`, the pinned CTA → `BottomBar`, people → `Avatar`, progress → `ProgressBar`, pagers → `PageDots`, stars → `Rating`, pictures → `Photo`, rules → `Divider`, countdowns → `useCountdown`. Check `packages/catalog/registry.json` (`use`, `archetypes`, `aliases`) before writing a local component; a local wrapper around a recipe is a composition and is declared in `.fluxnative-ui.json`.
- Colours only through `usePalette()`; text through `type.<role>`; radii through `shape.<role>`; spacing through `space[n]`; shadows through `elevation[n]`. No hex, no rgb, no font sizes, no radii as numbers in a screen.
- Imports: `react`, `react-native`, `react-native-svg`, `flux`, `flux/navigation` and relative files. No `className`, `div`, `span`, `fetch`, `Modal`.
- Every control has an `accessibilityLabel`. Animate `transform` and `opacity` only; the recipes already respect Reduce Motion.
- Tabs are host chrome (`flux/navigation`), never a hand-drawn tab bar.

## Finish

- MCP: `validate_screen` with the file's source; fix every line of `next`.
- Without MCP, in a fluxbuilder-template checkout: `npm run check:templates` and `python3 tool/check_craft.py templates/<id>`; in fluxnative-ui: `node packages/catalog/src/cli.ts check --to <template>/files`.
- Copy is product words (rule 4 of the craft index), data looks real, images come from the template's assets, and the template has its own mark and `brandName`.
