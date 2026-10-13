---
'@fluxnative/catalog': minor
---

Fifteen recipes, each shaped after real apps on Mobbin and after the copies the 52 catalog templates had written by hand (the evidence is in `packages/catalog/registry.meta.json`):

- `ScreenHeader` (back, title, trailing actions, a large title), `SearchField` (glyph, clear, Cancel), `TextField` (`kind` picks the keyboard; password Show/Hide; helper and error), `ListRow` and `ListGroup` (settings and menu rows on one card with inset rules), `SegmentedControl` (a sliding thumb or an underline), `Notice` (inline info / success / warning / error with an action or a dismiss), `Stepper` (one adjustable element for screen readers), `BottomBar` (the pinned action bar with a summary line or a leading slot), `Avatar` (photo, else initials on a palette tone; a status dot), `ProgressBar` (eased fill, indeterminate sweep), `PageDots`, `Rating` (halves, value, count, input mode), `Photo` (skeleton while loading, fallback on error), `Divider`, and the `useCountdown` hook.
- All read the token roles (`type`, `shape`, `space`, `elevation`, the palette) and the interaction profile, respect Reduce Motion, and carry a screen-reader name. Nothing existing changed.
- `fluxnative-catalog registry` writes `registry.json`: every component with its props (read from the sources), relative imports, when to use it, screen archetypes, the hand-written names it replaces and the evidence it was shaped from. `pnpm tokens` regenerates it and `pnpm tokens:check` fails on drift.
- `CATALOG.index.md` lists all 40 components and stays under 8 KB: the palette folds each `x` / `x-foreground` pair, `on*` props drop their `(fn)` marker, node slots are listed once in a legend, and a `ButtonVariant`-style alias names the row that spells it out.
