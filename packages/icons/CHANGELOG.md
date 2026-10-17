# @fluxnative/icons

## 0.1.0

### Patch Changes

- Updated dependencies [7491251]
  - @fluxnative/tokens@0.1.0

## 0.0.1

### Minor Changes

- 1a908b7: Catalog layer and the closed `flux/glass` contract.

  - `@fluxnative/catalog` (new): emits a dependency-free `theme/tokens.ts`, `components/Icon.tsx` and ten primitives (Press, Reveal, Skeleton, Scrim, Sheet, Chip, Button, IconButton, StateView, SectionHeader) into a Flux template, with colour overrides and a `.fluxnative-ui.json` manifest; `emit --check` catches drift.
  - `@fluxnative/icons` (new): one closed icon table (SF Symbol, Material Symbol, SVG path) and an `<Icon>`; `FluxTabs.Tab` takes `iconName`.
  - `@fluxnative/glass`: the `flux/glass` contract (`contract.ts`) with generated host files for the FluxBuilder web preview and FluxNative Expo under `hosts/`, checked in CI.
  - `@fluxnative/tokens`: `destructive-foreground`.
  - `@fluxnative/tw-runtime`: shadows, leading/tracking, transforms, border-x/y, max-w-\*, screen sizes.
  - `@fluxnative/ui`: `AppBar backLabel`, `TabBar shape` (Material 3 bar on Android), component render tests; `react-native-svg` is now a required peer.

- 1a908b7: What an OpenAI model (gpt-6.1-sol, through Codex CLI) misread in the catalog index, its first cross-vendor run:

  - `arrow-down-right` icon (SF `arrow.down.right`, Material `south_east`): the falling trend beside `arrow-up-right`. The model reached for it and the table had no such glyph.
  - `Photo` `height` takes a `DimensionValue` like `width`, so `height="100%"` fills the parent. The model wrote it in two runs.
  - Index rule 7: a recipe before a hand-drawn view (`MessageList` for a chat, `ListRow` for a row, `TabBar` for tabs, `StateView` for empty and error). The model's coverage was the lowest of every model run.

### Patch Changes

- 1a908b7: `Icon` no longer passes `accessible` / `accessibilityLabel` / `accessibilityRole` to `<Svg>`: react-native-svg's web build forwards unknown props to the DOM `<svg>` and React logs "Received `false` for a non-boolean attribute `accessible`" for every icon. A decorative icon is now a bare `<Svg>`; a labelled one is wrapped in a `View` that carries the accessibility props (role `image`). Same change in the catalog-emitted `components/Icon.tsx`.
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
  - @fluxnative/tokens@0.0.1
