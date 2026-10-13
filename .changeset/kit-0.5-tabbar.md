---
'@fluxnative/catalog': minor
---

`TabBar`: the tabs at the foot of an app. The template catalog drew 53 of them by hand: 29 floating capsules and 24 edge bars, 15 with wrong tablist, tab or selected roles. The recipe covers both shapes, matching the iOS 26 and Material 3 tab bars on Mobbin (TIDE, GitHub, Fresha, Craft, Strava, Docusign).

- `shape`: 'floating' (an inset capsule over the content) or 'bar' (full width under a hairline).
- `labels`: 'always', 'active' or 'none'.
- `indicator`: 'lens' (`accent` behind the tab, an M3 well on a bar), 'solid' (`primary`) or 'tint'. In 'tint' the glyph is `primary` and the label `foreground`, because `primary` on `card` is 4.0:1, under 4.5:1 for an 11 px label.
- `tone`: 'default', 'inverse' or 'glass'.
- `action`: a round button at the end, or a disc raised between the tabs.
- `overlay` and `bottom`, plus `tabBarClearance()` to pad content under an overlay bar.

Accessibility: a tablist of tabs, the current one selected, badge counts in the names, 44 pt targets, and `onReselect` for a tap on the current tab.

- `Chip` with `accessibilityRole="tab"` now reports `selected` instead of `checked`.
- `IconButton` exports `badgeMark` and `withCount`.
- `learn` no longer counts tab bars and docks as host chrome; they map to `TabBar`.
- CRAFT rule 11: tabs are `TabBar` until `flux/navigation` draws them.
