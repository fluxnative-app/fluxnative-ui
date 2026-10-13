---
'@fluxnative/catalog': minor
---

What `fluxnative-catalog learn` found the merged template catalog forking or wrapping (fluxbuilder-template, 72 templates, 13 October 2026):

- `Composer` (sinew-ai-coach's fork): the one-line field is 52 pt, so the 44 pt send sits 4 pt in; a tap on the send while the field is blank focuses the field; `disabled` no longer fades the field, so a placeholder that says why ("Plans refill at 06:00") stays legible, and the send dims as before. The `leading` and `trailing` slots centre on the one-line field. Visual change: a taller field.
- `SearchField` (orvia-health's fork): `readOnly`, not editable but at full strength; `disabled` still fades.
- `ProgressBar` (gridfront-weather's fork): `square`, radius 0 on the track and the run.
- `PageDots` (laudine-designer-boutique's fork): `variant="dots"`, equal round dots with the others at 55%, so the faded dots read at 3:1 against the ground and against the current one (30% is 2:1).
- Text actions reach 44 pt (dimity-assistant measured 34): `Notice`, `SectionHeader`, `Snackbar`, `SearchField` Cancel and `TextField` Show/Hide take `textActionSlop(type.label.lineHeight)` from `Press` (12 on the kit's 20 pt line, was 6 or 8). No visual change.

`CRAFT.index.md` rule 10: a locked field whose placeholder says why is not faded either.
