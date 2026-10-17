---
"@fluxnative/catalog": minor
"@fluxnative/ui-mcp": minor
---

The catalog now carries one canonical list of screen archetypes (`ARCHETYPES`: OpenDesign's 30 plus `ai-chat`, `ai-generate`, `ai-scan`, `ai-voice`, `ai-insight`) and a generated `registry.archetypes.json` that maps each archetype to the recipes made for it (most evidence first) and the general ones that fit any screen. `pnpm tokens` writes it with `registry.json`, `pnpm tokens:check` keeps it fresh, and an archetype in `registry.meta.json` that is not on the list fails the build. The MCP server adds `get_archetype { archetype }`, which answers that entry with each recipe's import path, summary and use line, so an agent that has assigned a screen its archetype can pick its recipes in one call instead of searching for every part.
