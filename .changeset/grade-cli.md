---
"@fluxnative/ui-mcp": minor
---

A new bin, `fluxnative-ui-grade [--expect <file.json>] [--json] <screen.tsx | dir>...`, runs every deterministic screen grader without MCP: dialect, typecheck, props, tokens, shadow-primitive and recipe coverage (`validate_screen` keeps its four). `--expect` sets the recipes and states each screen should cover, globally or per screen name; without one, coverage reports `na` instead of a pass. `--json` prints a versioned report (`{ version: 1, kit, pass, screens }`, each grader as `{ pass, score, details }`). It exits 0 when every screen passes, 2 when a grader fails and 1 on a usage or runtime error, including a typecheck that cannot run, which is reported as `unavailable` and never as a pass.
