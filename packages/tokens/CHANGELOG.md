# @fluxnative/tokens

## 0.1.0

### Minor Changes

- 7491251: A brand can give one `seed` colour (`$extensions["dev.fluxnative.brand"].seed`, or `"seed"` in a `colors.json`). The accent roles it does not set are then derived from that seed in both schemes, readable by construction: `primary`, `primary-foreground`, `ring`, `tertiary`, `tertiary-foreground`, `accent` and `accent-foreground`.

  - `primary` keeps the seed's hue and moves just far enough to reach 4.5:1 on every surface the brand ends up with.
  - `deriveSeedRoles`, `readableAccent` and `readableOn` are exported from `@fluxnative/tokens/brand`.

  A brand without a seed resolves exactly as before. Applying this to the 98-template catalog writes the same bytes as without it.

## 0.0.1

### Minor Changes

- 1a908b7: A brand's named font family now works on Android. React Native takes one family name per role, and Android ships none of the named families a brand may use (Georgia, Menlo, Courier), so a template's display face silently fell back to the system sans there. A template's `theme/tokens.ts` now picks per platform at run time: iOS draws the named family, Android the stack's generic (`serif`, `monospace`), the web the whole stack. It imports `Platform` from react-native only when a role names a family; the kit's own tokens are unchanged.
- 1a908b7: Brand files work end to end with manifest v2. `emit`, `update` and `check` take `--brand`; the manifest records `inputs.brand`, `brandPath` and `brandFiles` (a sha256 per brand file, so another tool can verify the DNA without resolving it), `check` names the brand file that changed, and `update` re-renders from the recorded `brandPath`. The brand reader, validator and sys emitters move to `@fluxnative/tokens/brand`, so the package's main entry is only the generated constants an app bundles.
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

- 1a908b7: The default light `destructive` is `#d70015` instead of `#ff3b30`: 5.4:1 on white and white on it, so error titles, error helpers and danger fills pass 4.5:1 (the old red was 3.55:1). Visual change: error states are a deeper red. Templates that set their own `destructive` are unchanged. Found by the pairwise judge on the first real eval run.
- 1a908b7: New `fluxnative-tokens` command for apps outside this repo: `npx fluxnative-tokens global-css --out src/global.css` writes the Uniwind CSS entry file (the `tailwindcss` and `uniwind` imports plus the theme) from the package's tokens, the same file `pnpm tokens` writes for the example app. `--check` writes nothing and exits 1 when the file is missing or stale. It refuses to write inside the package or any `node_modules` folder. The bin is a small JS launcher (`src/bin.js`) because Node does not strip TypeScript types under `node_modules`; it needs Node.js 22.15 or newer.
