---
'@fluxnative/catalog': minor
---

Two recipes from the template catalog's top `learn` candidates, grounded on Mobbin:

- `SkeletonRows`: a list while it loads, rows of a circle, square or no leading shape and one to three bars (the second shorter), an optional trailing value pair and hairlines, one busy "Loading" element for screen readers. 17 templates drew it by hand; shaped after Instagram, Quizlet, ChatGPT, talabat and Wise.
- `StatTile`: one number with a label, a unit, a change chip coloured by trend (filled, with its ink, so it passes 4.5:1) and a caption; card or plain, `md` or `lg`, a button with `onPress`. A local `Stat` in 8 templates; shaped after Substack, Fitbit, Tonal and MacroFactor.

The catalog index budget moves from 8 KB to 9 KB: fitting 8 KB had started to cost meaning (a brace group of icon names read as a name `x` in the third real eval round). Rows still leave out the optional labels that only rename English defaults and the props a component's metadata lists in `indexOmit`; `registry.json` keeps every prop. `Icon` now accepts 46 names from other icon sets (`x`, `user`, `map-pin`, `shopping-cart`…), each drawn as the kit glyph it means, and `ProgressBar`'s `progress` is optional (default 0) for the indeterminate case.
