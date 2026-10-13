---
'@fluxnative/mcp': minor
'@fluxnative/catalog': minor
---

The screen graders (dialect, props, tokens, shadow-primitive, coverage, typecheck, extract) move into `@fluxnative/mcp` (`src/graders`), next to the `validate_screen` tool that uses them, and their tests now run in CI.

The eval runner, the judges, the AI-look panels, `evolve` and the template-catalog `learn` command are now FluxBuilder's private tooling and leave this repository:
- `fluxnative-catalog learn` is removed.
- The `eval`, `evolve` and `judge` scripts are removed.
- `docs/topics/evolution.md` is removed.

The index gates every release must pass (no phantom name, every component documented, every recipe with evidence) are now a catalog test.
