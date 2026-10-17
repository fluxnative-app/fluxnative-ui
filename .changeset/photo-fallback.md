---
"@fluxnative/catalog": minor
---

`Photo` now degrades gracefully when a hotlinked picture disappears after a template ships: on the first error it shows `fallback`, or a well in the new `placeholderColor` (a closed set of surface roles, default `muted`) with a centred `fallbackIcon` (any `Icon` name or `'none'`, default `'image'`) in that role's readable ink, at the same size and radius, keeping `alt` on the frame and `children` overlays on top, with no retry or timer so web captures are deterministic. New `onLoad` and `onError` callbacks report the outcome, and a new `uri` in a recycled cell loads again. `Avatar` likewise retries a new `uri` and keeps its initials when the photo fails. Existing props and defaults are unchanged.
