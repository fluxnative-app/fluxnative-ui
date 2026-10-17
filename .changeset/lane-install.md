---
"@fluxnative/ui-mcp": minor
---

Both bins, `fluxnative-ui-grade` and `fluxnative-ui-mcp`, take `--version [--json]`, which prints `{"version", "commit"}` (the kit checkout's git `HEAD`, null when installed from npm), and `--doctor [--json]`, which checks Node 22.15 or newer, the installed dependencies the MCP server and the typecheck need, and that the MCP server answers `initialize` over stdio, exiting 1 with each failing item named. The grader's JSON report now carries the same `kit.commit`, so a template gate can prove it ran the kit its lock pins, and an agent lane fails at its start with a clear reason instead of a grader reading `unavailable` mid-gate. The repository root gains `pnpm mcp` and `pnpm grade` scripts (`pnpm --dir <kit> grade …` resolves paths against the caller), and the MCP README a "Run it in an agent lane" section: pinning a worktree by commit, the install command, the `.mcp.json` entry and the gate's grader call.
