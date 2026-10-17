# Catalog layer (`@fluxnative/catalog`)

Flux templates (the FluxBuilder catalog, FluxNative imports) are written in
a narrower dialect than an Expo app: `import React from 'react'`, only
`react`, `react-native`, `react-native-svg`, `flux`, `flux/navigation` and
relative imports; no `className`, no build step; strict `tsc` with
`noUncheckedIndexedAccess`. `@fluxnative/catalog` emits FluxNative UI's
tokens, icon set and primitives **in that dialect**, so a template carries
them as plain files and still matches the library's design.

```mermaid
flowchart LR
  T[@fluxnative/tokens<br/>DTCG JSON] --> C[fluxnative-catalog emit]
  I[@fluxnative/icons<br/>table] --> C
  P[packages/catalog/files<br/>primitives, hand-written] --> C
  O[templates/id/colors.json<br/>optional overrides] --> C
  C --> F[templates/id/files/<br/>theme/ components/ .fluxnative-ui.json]
```

## Emit into a template

```bash
# from the fluxnative-ui checkout
node packages/catalog/src/cli.ts emit --to <catalog repo>/templates/<id>/files [--colors <catalog repo>/templates/<id>/colors.json] [--only Button,Sheet]
node packages/catalog/src/cli.ts update --to <catalog repo>/templates/<id>/files [--dry-run]   # after a catalog change; hand edits are reported, never overwritten
node packages/catalog/src/cli.ts check --to <catalog repo>/templates/<id>/files [--upstream]   # exit 1 on a hand edit, nothing written
```

`emit` writes:

| path | content |
|---|---|
| `theme/tokens.ts` | generated: `colors` (light + dark), `lockedScheme`, `space`, `radius`, `text`, `fontWeight`, `duration`, `easing`, `glass`, `chrome`; imports nothing |
| `theme/usePalette.ts` | `useScheme()` and `usePalette()` (honours `lockedScheme`) |
| `components/Icon.tsx` | generated from the icon table; `<Icon name="bag" size={22} filled />` |
| `components/*.tsx` | the primitives below |
| `.fluxnative-ui.json` | the [manifest](#the-manifest-fluxnative-uijson): catalog version and commit, inputs, sha256 per file, the template's forks and compositions |

Every file under `components/` and `theme/` starts with a [header](#the-header)
that names it. `--only` keeps the named components and everything they import
(found by following relative imports); the theme files always ship. Without
`--only`, `emit` keeps the manifest's selection, and `check` reads everything
from the manifest, so a template's CI only needs `check --to …` (plus
`--colors` while its manifest is still schema 1).

## Update a template

```bash
node packages/catalog/src/cli.ts update --to <files> [--colors <json>] [--only A,B | +A,-B] [--dry-run] [--json] [--merge --base-dir <dir>]
```

`update` brings a template to the catalog in this checkout without losing
what its owner changed. Per file, from `.fluxnative-ui.json`:

| file | `update` |
|---|---|
| missing, or matches its `files` hash (pristine) | writes the catalog's copy |
| equals the catalog's copy | leaves it |
| differs from its hash (a hand edit) | leaves it and reports `drift` with a diff (local → catalog); `--merge` merges it instead |
| no longer emitted (dropped by the catalog or by `--only`) | deletes it when pristine; otherwise leaves it, reports `keptLocal` and stops tracking it |
| declared in `forks` | never writes it; reports a stale fork when the catalog copy no longer hashes to `upstream` |
| declared in `compositions` | never touches it |

It then writes a schema 2 manifest (a schema 1 manifest is upgraded). Exit
0: in sync. Exit 2: drift, a conflict or a stale fork; nothing was lost and a
person decides. Exit 1: an error. `--dry-run` writes nothing. `--json`
prints `{ from, to, dryRun, written, merged, deleted, unchanged, drift: [{ path, reason, diff }], conflicts, staleForks: [{ path, upstream, current }], keptLocal, warnings }`;
no report file is written into the template.

- **Inputs.** Without `--colors`, `update` reuses the manifest's `colorsPath`
  (relative to the files dir) and fails when the manifest records overrides
  whose file is gone. A schema 1 manifest has no `colorsPath`: pass
  `--colors` once.
- **`--only`.** Absent keeps the manifest's selection, `A,B` replaces it,
  `+A,-B` changes it. Dependencies are resolved afterwards: `+StateView` also
  brings `Button` and `Press`, and `-Press` keeps `Press` (with a warning)
  while a selected component imports it.
- **`--merge --base-dir <dir>`.** A drifted file is merged with
  `git merge-file -p --zdiff3 <local> <base> <catalog>`, the base being
  `<dir>/<path>`: the copy that was emitted, whose hash must equal the
  manifest's `files` entry (a checkout of the template at its last update, or
  an `emit` from the recorded `catalog.commit` into a temporary dir). A clean
  merge is written; a conflict is written with markers (exit 2). A merged file
  still carries its hand edit, so `check` keeps reporting it until it is
  reverted or declared a fork: catalog files are meant to be pristine or
  declared forks, and the merge is the escape hatch, not the main path.

## Check a template

```bash
node packages/catalog/src/cli.ts check --to <files> [--colors <json>]          # the template against its own manifest
node packages/catalog/src/cli.ts check --to <files> --upstream [--strict]     # and what `update` would change
```

`check` compares the template with **its own manifest**, not with the
catalog, so it stays green when the catalog moves on. Every file in `files`
must exist with the recorded hash (`stale: <path>` otherwise; forks and
compositions are skipped), and the colour overrides (`--colors`, or the
manifest's `colorsPath`) must still hash to `inputs.colors`; exit 1
otherwise. `--upstream` also renders the current catalog with the template's
inputs and prints `update available: <path> (changed|added|removed)` and the
forks behind the catalog; it exits 0 unless `--strict`. `emit --check` keeps
its meaning: exit 1 when `emit` would change any byte, the manifest (and its
`catalog.commit`) included.

## The manifest (`.fluxnative-ui.json`)

```json
{
  "schema": 2,
  "catalog": { "version": "0.1.0", "commit": "10b77de…", "repo": "fluxnative-app/fluxnative-ui" },
  "inputs": { "colors": "<sha256>", "colorsPath": "../colors.json", "brand": null, "brandPath": null, "brandFiles": null, "only": ["Press", "Icon"] },
  "files": { "components/Press.tsx": "<sha256>" },
  "forks": { "components/Sheet.tsx": { "reason": "own drag handle", "since": "0.1.0", "upstream": "<sha256>" } },
  "compositions": { "components/CtaButton.tsx": { "wraps": "Button", "reason": "60 px checkout CTA" } },
  "applied": { "codemods": [] }
}
```

- `catalog.commit`: `HEAD` of the catalog checkout when packages/catalog,
  packages/tokens and packages/icons have no local changes; otherwise
  `gitHead` from package.json, else `null`. `FLUXNATIVE_CATALOG_COMMIT`
  overrides it (empty means `null`). This package's own copy
  (`packages/catalog/files/.fluxnative-ui.json`) always records `null`, so CI
  does not go stale on every commit.
- `files`: per path, the hash of the catalog copy the file was last synced
  to, header included. A file that matches it is pristine.
- `inputs.brand*` (with `--brand`): `brandPath` is the argument relative to
  the files dir (`../design`), `brandFiles` maps every file the brand was
  read from to the sha256 of its text, and `brand` is the sha256 of the
  sorted `<path> <sha256>\n` lines. A checker in another language verifies
  the DNA from `brandFiles` alone; `check` names the brand file that changed
  and `update` re-renders from it.
- `forks` and `compositions` are written by the template's owner; `emit` and
  `update` keep them and never write their paths. To fork a primitive, move
  its `files` hash into `forks` as `upstream`, with a `reason` and the catalog
  version as `since`. After porting a newer catalog change into the fork, set
  `upstream` to the new hash (`update --json` lists it). A composition is a
  template file that wraps a catalog component (`CtaButton` around `Button`)
  instead of copying it.
- `applied.codemods` is reserved for release codemods in a later release;
  it is kept as is.
- No timestamps, a fixed key order and maps sorted by key: the bytes change
  only when the content does. Paths must stay inside the files dir.

## The header

Every emitted file under `components/` and `theme/` names itself, so a reader
(or a model) that finds it in a template knows where it came from:

```ts
// FluxNative UI catalog · components/Button.tsx · https://github.com/fluxnative-app/fluxnative-ui/blob/main/docs/topics/catalog.md
// Emitted by fluxnative-catalog — declare a fork in .fluxnative-ui.json instead of editing.
```

The generated `theme/tokens.ts` and `components/Icon.tsx` carry the first
line above their own "do not edit by hand" header. There is no version
number, so a release leaves an unchanged file byte-identical; the hashes
cover the header. The sources in `packages/catalog/files/` have none: `emit`
adds it.

## Colour overrides

A template that is designed for one palette keeps a `colors.json` next to its
files and passes it with `--colors`:

```json
{
  "scheme": "light",
  "light": { "background": "#FFFFFF", "primary": "#111111", "primary-foreground": "#FFFFFF", "muted": "#F2F2F2" }
}
```

- `scheme`: `light`, `dark` or `system` (default). `light`/`dark` sets
  `lockedScheme` so `usePalette()` ignores the OS setting.
- `light` / `dark`: any subset of the token colour names (`ColorName`), values
  `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()` or `transparent`. Unknown
  names and other formats fail the emit with every problem listed.

`--colors` overrides colours only. A template whose DNA goes further keeps a
brand file instead, and passes it with `--brand` (the two flags are
exclusive):

```bash
node packages/catalog/src/cli.ts emit --to <template>/files --brand <template>/design   # brand.tokens.json (+ brand.dark.tokens.json), or brand.resolver.json
```

- Overridable through `--brand`: the colour roles (light, and dark in
  `brand.dark.tokens.json`), `font`, `type`, `shape`, `elevation`,
  `duration`, `easing`, `interaction` and `layout`, plus the metadata
  `scheme`, `density`, `haptic` and `skeleton`. The format and an example
  are in [tokens.md](tokens.md#brand-files-a-templates-dna).
- Kit-only: spacing (`space`), the `radius`, `text` and `fontWeight` scales,
  `glass` and `chrome` stay the library's, which keeps every template on one
  scale. A brand file that sets them fails.
- The brand is validated first ([rules](tokens.md#validator-rules)): an
  error stops the emit with every problem listed, warnings are printed. The
  manifest records it under `inputs.brand`, `brandPath` and `brandFiles`;
  `update` and `check` reuse `brandPath` when `--brand` is not given.
- `theme/tokens.ts` appends `font`, `type`, `shape`, `elevation`,
  `interaction`, `layout` and `density` after `chrome`, with or without a
  brand; with one, `colors`, `lockedScheme`, `duration` and `easing` carry
  its values too.

## Primitives

All default exports, all with a required `accessibilityLabel` where a control
needs one, all respecting Reduce Motion. Defaults come from `theme/tokens`:
the `interaction` profile, `type` roles and `shape` roles, so a brand
restyles them; with the kit's tokens they draw exactly as before.

| component | props |
|---|---|
| `Icon` | `name`(IconName) `size?`(24) `color?` `strokeWidth?`(2) `filled?` `accessibilityLabel?` — generated from the icon table (`ICONS`); a labelled icon is wrapped in a View that carries the accessibility props, a bare one is decorative |
| `Press` | `onPress` `onLongPress?` `accessibilityLabel` `accessibilityRole?` `haptic?`('none'\|'light'\|'selection'\|'medium') `activeScale?` `hitSlop?` `disabled?` — defaults and spring from `interaction.press` (kit: 'none', 0.96, 0) |
| `Reveal` | `index?` `delay?` `offset?` — entrance; offset, duration and `stagger(index)` (capped at 7 steps) from `interaction.reveal` |
| `Skeleton` | `width?` `height?` `radius?`(`shape.well`) `circle?` — `interaction.skeleton`: an `opacity` pulse, or `color` between two palette roles |
| `Scrim` | `progress`(Animated) `active` `onPress?` `accessibilityLabel?` |
| `Sheet` | `open` `onClose` `title?` `trailing?` `footer?` `height?` `closeLabel?` — spring up, drag or scrim closes; absolute inside the screen, never `Modal`; `shape.sheet`, `type.title` |
| `Chip` | `label` `selected?` `onPress?` `size?`('sm'\|'md') `round?` `struck?` `leading?` `accessibilityRole?` — `shape.chip`, `type.label` |
| `Button` | `label` `onPress` `variant?`('primary'\|'secondary'\|'outline'\|'ghost'\|'destructive') `size?`('sm'\|'md'\|'lg'\|'xl'; px in `buttonHeight`) `labelRole?`(a `type` role, used as is) `loading?` `leading?` `trailing?` `block?` — `shape.control` |
| `IconButton` | `children`(icon) `onPress` `accessibilityLabel` `variant?`('plain'\|'tonal'\|'filled'\|'translucent'\|'outline'\|'outline-on-surface') `size?` `badge?`(number\|string\|boolean; a count joins the label) `dot?` `selected?` |
| `StateView` | `title` `body?` `actionLabel?` `onAction?` `tone?`('neutral'\|'error') `icon?` `badge?`(icon in an `accent` circle) `variant?`('inline'\|'card') `inline?` — empty and error states |
| `SectionHeader` | `title` `eyebrow?` `action?` `onAction?` — `type.caps`, `type.title`, `type.label` |
| `Toggle` | `value` `onValueChange` `accessibilityLabel` `size?`('sm'\|'md') `disabled?` `haptic?` — a switch on Press |
| `Snackbar` | `visible` `message` `actionLabel?` `onAction?` `onDismiss` `bottom?` `duration?`(4000; 0 stays) — inside the screen like `Sheet`; read out by screen readers |
| `useCountUp` | `useCountUp(target, { duration?, delay?, enabled? })` → number; Reduce Motion or `enabled: false` give `target` at once |
| `ProductCard` | `product`(`{ id, name, price, currency?, image, compareAt?, badge? }`) `width` `onOpen` `onHeart?` `saved?` `footer?` `badgeSlot?`; `formatPrice(value, currency?)` |
| `ScreenHeader` | `title?` `onBack?` `backIcon?`('platform'\|'chevron'\|'arrow') `backLabel?` `leading?` `trailing?` `align?`('center'\|'start') `large?` `eyebrow?` `buttonVariant?` — the row of a screen the template owns, `chrome.appBarHeight` tall; back is a chevron on iOS and an arrow elsewhere (`backIcon()`) |
| `SearchField` | `value` `onChangeText` `placeholder?` `onSubmit?` `onCancel?` `trailing?` `variant?`('pill'\|'field') `size?`('md'\|'lg'; px in `searchFieldHeight`) `autoFocus?` `disabled?` — clear button once there is text; Cancel beside it with `onCancel` |
| `TextField` | `value` `onChangeText` `label?` `placeholder?` `helper?` `error?` `kind?`('text'\|'name'\|'email'\|'phone'\|'number'\|'url'\|'password') `variant?`('filled'\|'outline') `leading?` `trailing?` `multiline?` `maxLength?` `onSubmit?` — `kind` sets the keyboard and capitalisation; 'password' adds Show / Hide; an error paints `destructive` and is read with the field |
| `ListRow` | `title` `subtitle?` `leading?` `leadingTile?` `value?` `trailing?`('chevron'\|'none'\|node) `onPress?` `destructive?` `accessibilityRole?` — a Press with `onPress`, else a plain View so a `Toggle` in `trailing` is never inside another pressable; no horizontal padding of its own |
| `ListGroup` | `children` `title?` `footer?` `variant?`('inset'\|'plain') `ruleInset?` — rows on a `card` (`shape.card`) with inset `Divider`s, or edge to edge; each row gets the gutter |
| `SegmentedControl` | `segments` `selectedIndex` `onChange` `variant?`('track'\|'line') `size?`('sm'\|'md'; 36 / 44 px in `segmentedHeight`, each segment's target padded to 44) `disabled?` `accessibilityLabel?` — tabs for screen readers; the thumb springs (Reduce Motion snaps) |
| `Notice` | `message` `title?` `tone?`('info'\|'success'\|'warning'\|'error') `icon?` `actionLabel?` `onAction?` `onDismiss?` — the tone colour under `card` at 12 % with a 3 px leading rule (`noticeColor(tone, palette)`); an alert for screen readers; `shape.cardInner` |
| `Stepper` | `value` `onChange` `accessibilityLabel` `min?`(0) `max?`(99) `step?`(1) `size?`('sm'\|'md'; px in `stepperButton`) `variant?`('outline'\|'tonal') `format?` — one adjustable element with increment / decrement actions; buttons stop at the bounds |
| `BottomBar` | `primaryLabel` `onPrimary` `primaryVariant?` `primaryDisabled?` `primaryLoading?` `secondaryLabel?` `onSecondary?` `secondaryVariant?` `arrange?`('row'\|'stacked') `leading?` `summaryLabel?` `summaryValue?` `children?` `floating?` `bottom?` — in the screen's column after the scroll view; `floating` lifts it on a card with `elevation[3]`; placed over the content (`style` with `position: 'absolute'`) it reports its height to the nearest `DockInsetProvider` |
| `Avatar` | `name` `uri?` `size?`('xs'\|'sm'\|'md'\|'lg'\|'xl'; px in `avatarSize`) `rounded?` `status?`('online'\|'away'\|'offline') `tone?` `badge?` — initials (`initialsOf`) on a tone picked from the name (`toneOf`), the photo over them; `shape.avatar` or `shape.cardInner` |
| `ProgressBar` | `progress`(0–1) `tone?` `height?`(`progressBarHeight`) `label?` `valueLabel?` `indeterminate?` — a `muted` pill track; the run eases with `duration.normal` and `easing.standard`; screen readers get the percentage |
| `PageDots` | `count` `index` `size?`('sm'\|'md'; px in `pageDotSize`) `onPhoto?` — the current dot stretches to a pill; `onPhoto` uses the scheme's lightest neutral; "Page 2 of 5" |
| `Rating` | `value` `max?`(5) `size?`('sm'\|'md'\|'lg'; px in `ratingStar`) `showValue?` `count?` `countLabel?` `onChange?` — stars in `warning`, halves clipped; `onChange` makes it an input (radios in an adjustable group); `formatCount(3800)` → "3.8K" |
| `Photo` | `uri` `alt?` `aspectRatio?` `width?` `height?` `radius?`(`shape.card`) `fit?`('cover'\|'contain') `placeholder?`('skeleton'\|'muted'\|'none') `fallback?` `children?` — a `Skeleton` until the image loads, a glyph on `muted` when it fails; `alt: ''` is decorative |
| `Divider` | `inset?`(px or `true` for the gutter) `strong?` `vertical?` `margin?` — a hairline in `border-soft` (`border` when strong) that screen readers skip |
| `SkeletonRows` | `count?`(4) `leading?`('circle'\|'square'\|'none') `lines?`(1–3, 2) `trailing?` `dividers?` `size?`(44) `accessibilityLabel?`('Loading') — a list while it loads: each bar a `Skeleton`, the second shorter; one busy "Loading" element for screen readers (Instagram, Quizlet, Wise on Mobbin; 17 templates drew it by hand) |
| `TabBar` | `items`(2–5 `{ key, label, icon?, badge? }`) `activeKey`(null outside the tabs) `onSelect` `onReselect?` `shape?`('floating'\|'bar') `labels?`('always'\|'active'\|'none') `indicator?`('lens'\|'solid'\|'tint') `tone?`('default'\|'inverse'\|'glass') `action?`(`placement` 'end'\|'center') `overlay?` `bottom?` — the tabs at the foot of an app: a tablist of tabs, the current one selected, its kit glyph filled, badge counts in the names; over the content it reports its height to the nearest `DockInsetProvider` (`useDockInset`; `tabBarClearance()` is the static estimate) (TIDE, GitHub, Craft, Strava, Docusign on Mobbin; 53 templates drew one by hand) |
| `StatTile` | `label` `value` `unit?` `delta?` `trend?`('up'\|'down'\|'neutral'; from the sign of `delta`) `caption?` `variant?`('card'\|'plain') `size?`('md'\|'lg') `valueRole?`(a brand's `numeric` face) `valueColor?` `align?` `onPress?` — one number: tabular figures in the headline (or display) role, a change chip filled in `success`/`destructive`/`muted` with its ink, one spoken element (Substack, Fitbit, Tonal on Mobbin; a local `Stat` in 8 templates) |
| `useReducedMotion` | `useReducedMotion()` → boolean; the OS reduce-motion setting, read once and followed; every animated recipe asks it first |
| `useCountdown` | `useCountdown(target, { interval?, enabled? })` → `{ total, days, hours, minutes, seconds, dd, hh, mm, ss, done }`; `countdownParts(ms)` is the pure breakdown |
| `useDockInset` | `useDockInset()` → number, the bottom padding scroll content needs so nothing rests under a dock: the largest reported dock's height + its lift + a 16 pt gap (`DOCK_GAP`), 0 with none or outside a provider; `DockInsetProvider` (same file) wraps the screen; `useReportDock({ bottom?, safeBottom?, active? })` → the `onLayout` for a template's own dock; `dockInset({ height, bottomOffset?, safeBottom?, gap? })` is the pure sum |

### Content under a dock

A dock over the content (the overlay `TabBar`, a `BottomBar` placed
absolutely, a template's own `TabDock`) covers the last rows at rest unless
the scroll content pads by its height. The docks report it; the screen opts
in. Without a provider every dock draws and behaves as before.

```tsx
import useDockInset, { DockInsetProvider, useReportDock } from '../components/useDockInset';

export default function HomeScreen() {
  return (
    <DockInsetProvider>
      <Feed />
      <TabBar items={TABS} activeKey="home" onSelect={go} />
    </DockInsetProvider>
  );
}

function Feed() {
  const inset = useDockInset(); // the TabBar's height + its bottom + 16
  return <ScrollView contentContainerStyle={{ paddingBottom: inset }}>{/* … */}</ScrollView>;
}

// A template's own dock reports the same way: its height plus its `bottom`.
function TabDock() {
  const onLayout = useReportDock({ bottom: space[4] });
  return <View onLayout={onLayout} style={{ position: 'absolute', left: 16, right: 16, bottom: space[4] }}>{/* … */}</View>;
}
```

The hook reads the provider above it, so call it in a child of
`DockInsetProvider` (or put the provider in the tab shell around the
screens). The home indicator is counted once: the kit's docks carry it in
`bottom`; a template dock passes `safeBottom` only for space under it that
neither its height nor its `bottom` includes.

`ProductCard` ships as `components/commerce/ProductCard.tsx`; a component in
a sub-folder is named by its file (`--only ProductCard`).

Each recipe was shaped from two sources, both recorded in
`packages/catalog/registry.meta.json`: the copies the catalog templates had
written by hand before it existed (its `aliases`, with counts), and real
apps on Mobbin (`mobbin`, one link per screen it follows). The
`shadow-primitive` grader (`packages/mcp/src/graders`) reads the
aliases, so a template that writes its own `SearchPill` or `QtyStepper` is
pointed at the recipe.

## The registry (`registry.json`)

`fluxnative-catalog registry` writes `packages/catalog/registry.json`, the
machine-readable catalogue behind `CATALOG.index.md`: every component with
its `kind` (component, hook, module), `path`, `from` (the import a screen
writes), `summary`, `props` (name, optional, type, read from
`export interface <Name>Props`), named `exports`, transitive `deps`, and the
metadata of `registry.meta.json`: `since`, `use`, `archetypes` (OpenDesign's
30 plus the five AI ones; `*` means any screen), `aliases`, `evidence` and
`mobbin`. It also carries the dialect (allowed imports, forbidden constructs)
and the token keys. `pnpm tokens` regenerates it and `pnpm tokens:check`
fails on drift; a component without a `registry.meta.json` entry fails the
build, so every recipe ships with its evidence. The MCP server
([`packages/mcp`](../../packages/mcp/README.md)) and tools outside this
repo read it instead of parsing sources.

The bridge to the host (`components/bridge.ts`) is optional-chained
everywhere: `bridge()?.ui?.haptic?.('light')`, `bridge()?.ui?.toast?.(…)`,
`bridge()?.storage?.get?.(key)`.

## AI pack

For templates that declare the `ai` capability: the host does the AI
(`bridge.ai`, read with `ai()`), the pack does the screen. The contract,
the hooks' states and what each component guarantees are in
[ai.md](ai.md).

| file | what |
|---|---|
| `useAiChat` | `({ purpose?, system?, initialMessages? })` → `{ messages, status, streamingId, error, retryAfterMs, send, stop, retry, reset }` |
| `useAiTask` | `(run)` → `{ status, result, progress, error, retryAfterMs, start, cancel, reset }` for `describeImage`, `generateImage`, `transcribe` |
| `StreamingText` | `text` `streaming` `role?` `color?` `markdown?` `accessibilityLabel?` — a reply as it arrives, announced once |
| `Composer` | `value` `onChangeText` `onSend` `onStop` `streaming` `disabled?` `placeholder?` `leading?` `trailing?` — a 44 pt send at full colour (an empty send does nothing); send and stop in one button, above the keyboard |
| `MessageList` | `messages` `streamingId?` `renderMessage?` `emptyState?` `footer?` `onScrollToEnd?` — anchored to the bottom; `MessageBubble` is the default bubble |
| `ScanFrame` | `scanning?` `children?` `tint?` `accessibilityLabel?` — viewfinder corners and scan line |
| `AiBadge` | `label?` `mark?`(the brand's glyph, or `null`; default the sparkle) `variant?` `accessibilityLabel?` — "Generated by AI" |
| `aiState`, `markdown` | the pure state machines and Markdown reader behind them, no React |

Without the capability the hooks report `status: 'unavailable'` and never
throw. `--only` follows imports, so `--only useAiChat,MessageList,Composer`
ships everything a chat screen needs.

## Hosts for `flux/glass`

The `flux/glass` module a template may import is specified in
`packages/glass/src/contract.ts` and generated into
`packages/glass/hosts/web/glass.tsx` (FluxBuilder's react-native-web preview)
and `packages/glass/hosts/expo/glass.tsx` (FluxNative Expo projects). Host
repos vendor those two files; `pnpm tokens:check` fails when they drift from
the contract.

## Develop

```bash
pnpm catalog build          # regenerate packages/catalog/files (tokens.ts, Icon.tsx, manifest)
pnpm catalog build --check  # part of pnpm tokens:check
pnpm --filter @fluxnative/catalog test typecheck   # node:test + tsc over src/ and files/ (template dialect)
```

Primitives are edited in `packages/catalog/files/components/` directly; the
`files/` tsconfig has no path aliases and `jsx: react`, so what passes there
passes a template's `tsc`.
