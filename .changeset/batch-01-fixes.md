---
'@fluxnative/catalog': minor
---

Five fixes the template factory's first batch (fluxbuilder-template, process 3.2.0) found by forking or replacing recipes:

- `Composer`: the send button is 44 pt (was 36 in a 42 pt pill) and keeps its full colour at rest; an empty send does nothing instead of fading the button below 3:1. Visual change: the send no longer dims while the field is empty.
- `SegmentedControl`: tracks are 36 / 44 px (were 32 / 40) and each segment's touch target is padded to 44. Visual change: taller controls.
- `StatTile`: `valueRole` (the value in a brand's `numeric` face, a mono family) and `valueColor`.
- `ScreenHeader`: `backIcon` ('platform' by default, or 'chevron' / 'arrow' on every platform when the design draws one).
- `AiBadge`: `mark`, the brand's own glyph, or `null`; the default sparkle is a generic tell.

`CRAFT.index.md` rule 10 adds non-text contrast: 3:1 for icons, borders and a control's resting fill.
