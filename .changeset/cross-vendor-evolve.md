---
'@fluxnative/catalog': patch
'@fluxnative/icons': minor
---

What an OpenAI model (gpt-6.1-sol, through Codex CLI) misread in the catalog index, its first cross-vendor run:

- `arrow-down-right` icon (SF `arrow.down.right`, Material `south_east`): the falling trend beside `arrow-up-right`. The model reached for it and the table had no such glyph.
- `Photo` `height` takes a `DimensionValue` like `width`, so `height="100%"` fills the parent. The model wrote it in two runs.
- Index rule 7: a recipe before a hand-drawn view (`MessageList` for a chat, `ListRow` for a row, `TabBar` for tabs, `StateView` for empty and error). The model's coverage was the lowest of every model run.
