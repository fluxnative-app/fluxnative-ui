# @fluxnative/mcp

## 0.0.1

### Minor Changes

- 1a908b7: The screen graders (dialect, props, tokens, shadow-primitive, coverage, typecheck, extract) move into `@fluxnative/mcp` (`src/graders`), next to the `validate_screen` tool that uses them, and their tests now run in CI.

  The eval runner, the judges, the AI-look panels, `evolve` and the template-catalog `learn` command are now FluxBuilder's private tooling and leave this repository:

  - `fluxnative-catalog learn` is removed.
  - The `eval`, `evolve` and `judge` scripts are removed.
  - `docs/topics/evolution.md` is removed.

  The index gates every release must pass (no phantom name, every component documented, every recipe with evidence) are now a catalog test.

- 1a908b7: `@fluxnative/mcp`, an MCP server over the catalog layer: `search_components`, `get_component`, `get_index`, `get_design_rules`, `list_tokens` and `validate_screen`, all answered from `registry.json`, the two indexes and the eval graders, so an agent can look recipes up and check a screen instead of guessing. Runs from a checkout over stdio (`node packages/mcp/src/bin.js`).

### Patch Changes

- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [1a908b7]
- Updated dependencies [e6edb0f]
- Updated dependencies [1a908b7]
- Updated dependencies [61c3566]
- Updated dependencies [1a908b7]
  - @fluxnative/catalog@0.0.1
