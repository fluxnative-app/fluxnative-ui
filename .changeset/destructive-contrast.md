---
'@fluxnative/tokens': patch
'@fluxnative/catalog': patch
---

The default light `destructive` is `#d70015` instead of `#ff3b30`: 5.4:1 on white and white on it, so error titles, error helpers and danger fills pass 4.5:1 (the old red was 3.55:1). Visual change: error states are a deeper red. Templates that set their own `destructive` are unchanged. Found by the pairwise judge on the first real eval run.
