# @fluxnative/tw-runtime

## 0.0.1

### Minor Changes

- 1a908b7: Catalog layer and the closed `flux/glass` contract.

  - `@fluxnative/catalog` (new): emits a dependency-free `theme/tokens.ts`, `components/Icon.tsx` and ten primitives (Press, Reveal, Skeleton, Scrim, Sheet, Chip, Button, IconButton, StateView, SectionHeader) into a Flux template, with colour overrides and a `.fluxnative-ui.json` manifest; `emit --check` catches drift.
  - `@fluxnative/icons` (new): one closed icon table (SF Symbol, Material Symbol, SVG path) and an `<Icon>`; `FluxTabs.Tab` takes `iconName`.
  - `@fluxnative/glass`: the `flux/glass` contract (`contract.ts`) with generated host files for the FluxBuilder web preview and FluxNative Expo under `hosts/`, checked in CI.
  - `@fluxnative/tokens`: `destructive-foreground`.
  - `@fluxnative/tw-runtime`: shadows, leading/tracking, transforms, border-x/y, max-w-\*, screen sizes.
  - `@fluxnative/ui`: `AppBar backLabel`, `TabBar shape` (Material 3 bar on Android), component render tests; `react-native-svg` is now a required peer.

- 1a908b7: Token contract v0.1: a template's design DNA beyond colour.

  - `@fluxnative/tokens`: the DTCG reader takes `fontFamily`, `typography` and `shadow`, with aliases inside composite values. New sys groups `font`, `type`, `shape`, `elevation`, `interaction` and `layout` (constants plus `TypeRole`, `ShapeRole` and `ElevationLevel`) default to what the catalog primitives do today. Eight colour roles join both schemes: `foreground-soft`, `border-soft`, `success-foreground`, `warning-foreground`, `inverse`, `inverse-foreground`, `tertiary` and `tertiary-foreground`. Brand files (`brand.tokens.json`, `brand.dark.tokens.json`, or a subset of DTCG Resolver 2025.10) load through `readBrandFiles`. `validateBrand` and `resolveBrand` check them with deterministic rules: contrast, the type scale, system fonts only, shape, elevation, motion, interaction, layout and closed keys. The Uniwind theme adds `rounded-<shape>` and `text-<role>`.
  - `@fluxnative/tw-runtime`: resolves `rounded-<shape>` and `text-<role>`. As in Tailwind, `leading-*`, `tracking-*` and `font-*` win over a role.
  - `@fluxnative/catalog`: `emit --brand <file | resolver | folder>` (exclusive with `--colors`), `render({ brand })`, `emitTokens({ brand })` and `loadBrand`. `theme/tokens.ts` appends the sys sections and `density`. With no brand, the existing sections don't change apart from the new colour roles.

### Patch Changes

- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
  - @fluxnative/tokens@0.0.1
