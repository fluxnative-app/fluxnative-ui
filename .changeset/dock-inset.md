---
"@fluxnative/catalog": minor
---

Add `useDockInset`, the bottom padding a scroll view's content needs so nothing rests under a floating dock. Wrap a screen in `DockInsetProvider` and give its scroll content `paddingBottom: useDockInset()`: the overlay `TabBar` and an absolutely placed `BottomBar` now measure themselves and report their height plus their lift from the bottom edge plus a 16 pt gap (the larger of two docks wins, 0 with none), and a template's own dock reports the same way through `onLayout={useReportDock({ bottom })}`. `dockInset()` is the pure sum. Content left under a dock at rest was the most frequent blocking failure in the template factory's recent batches; without a provider every dock draws and behaves exactly as before.
