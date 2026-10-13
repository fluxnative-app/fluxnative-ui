---
'@fluxnative/catalog': minor
---

`CATALOG.index.md` lists the 90 `Icon` names (closed; any other name fails tsc). The first real eval run showed every model guessing Lucide names (`alert-triangle`, `map-pin`, `user`); with the list, Opus 5.5 went from 38% to 100% first-try, Sonnet 5.5 from 62% to 100%, Haiku 5.5 from 23% to 85%. To stay under 8 KB, closed string values are written `a/b` (`variant?(primary/secondary)`), and the `interaction` row and a tagline that repeated rule 1 are gone.
