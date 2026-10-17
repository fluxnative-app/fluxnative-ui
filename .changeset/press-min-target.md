---
"@fluxnative/catalog": minor
---

`Press` now reaches the 44 pt touch target by itself: it measures its box with `onLayout` and grows the hit slop on each axis that is short of the new `minTarget` prop (default `MIN_TARGET`, 44), never under the brand's `interaction.press.hitSlop`, without changing layout or look. Templates no longer miss the 44 pt check because a caller forgot to add slop. An explicit `hitSlop` still wins, so recipes and templates that compute their own keep their behaviour, and `minTarget={false}` keeps the brand's slop for dense controls whose neighbours sit closer than the slop would reach. The per-axis computation is exported as `minTargetSlop(width, height, base, min)`; `textActionSlop()` is unchanged.
