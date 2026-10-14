---
'@fluxnative/catalog': minor
---

Defaults the template factory's batch-02 had to fork or wrap (fluxbuilder-template, 13 October 2026):

- `Rating` `countFormat="full"` shows every digit ("1,186 reviews"); 'short' ("1.2K") stays the default.
- `Press` adds its press scale after the caller's `transform`, so a tilted card keeps its rotate.
- `StatTile` `labelRole` sets the label's type role (default 'bodySm').
- `PageDots`: the faded dots are at 55% in the pill variant too. That reaches 3:1 against the ground on all 72 catalog palettes; 30% reached none. Visual change: darker dots.
- `StateView`: the action is primary in every tone. A secondary fill rested near 1.2:1 on a card. Visual change: the neutral state's button is filled.
- `ProgressBar`: an indeterminate bar under Reduce Motion holds a still run in the middle instead of an empty track.
