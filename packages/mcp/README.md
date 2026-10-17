# @fluxnative/ui-mcp

An [MCP](https://modelcontextprotocol.io) server over the FluxNative UI
catalog layer, so an agent writing a Flux template screen (or an Expo app
on the kit) can look up the recipes it needs, read one in full, and check a
screen before it lands, instead of guessing from training data.

Everything it answers comes from the layer itself: `registry.json`,
`docs/llm/CATALOG.index.md`, `docs/llm/CRAFT.index.md`, the recipe sources
and the eval graders. It cannot drift from the code.

| tool | what it returns |
|---|---|
| `search_components` `{ query, limit?, archetype? }` | the recipes that fit a plain-words need ("settings row with a chevron", "quantity stepper"), each with its import path, props with closed values, when to use it, screen archetypes and evidence (hand-written copies in the template catalog, real apps on Mobbin) |
| `get_component` `{ name, source? }` | one recipe by name or alias (`CtaButton` → `Button`): props, named exports, dependencies, metadata, and the TSX source on request |
| `get_index` | `CATALOG.index.md`, the ≤ 9 KB index to read once before writing a screen |
| `get_design_rules` | `CRAFT.index.md`: the rules that keep a screen from reading as generated and a template distinct enough for store review |
| `list_tokens` | the palette roles and the keys of `type`, `shape`, `elevation`, `space`, `layout`, `interaction`, plus the dialect's allowed imports |
| `validate_screen` `{ source, screenName? }` | the deterministic graders over a screen: forbidden imports and web constructs, hallucinated props, colour and size literals, local components that re-implement a recipe; `pass` and a short `next` list |

## Run it

From a checkout of this repository (the graders read the catalog layer in
`packages/catalog`, so it runs from the monorepo for now):

```bash
pnpm install
node packages/mcp/src/bin.js      # stdio
```

Claude Code:

```bash
claude mcp add fluxnative-ui -- node /path/to/fluxnative-ui/packages/mcp/src/bin.js
```

Cursor, Codex and other clients take the same command in their MCP
configuration (`"command": "node", "args": ["/path/to/fluxnative-ui/packages/mcp/src/bin.js"]`).

The prompt that gets the most out of it: "Before writing a screen, call
`get_index`, then `search_components` for each part of the screen, then
`validate_screen` on the result and fix what `next` says."

## Grade screens without MCP

`fluxnative-ui-grade` runs every deterministic grader over `.tsx` screens,
including the two `validate_screen` leaves out: the typecheck (strict,
`noUncheckedIndexedAccess`, against the emitted catalog layer) and recipe
coverage. A CI step or a template gate can call it directly:

```bash
node packages/mcp/src/grade.js [--root <files/>] [--expect <file.json>] [--json] <screen.tsx | dir>...
```

- A directory means every `*.tsx` directly in it; a screen's name is its
  file name without `.tsx`.
- `--root <files/>` grades the screens of a Flux template (its `files/`
  folder; `screens/` when no screen is given) in place of a bare catalog
  layer. A relative import must land on a file inside the root (never
  outside it), and the bare allowlist is the template contract (`flux`,
  `flux/navigation`, `flux/glass`, Skia, reanimated besides React Native).
  The typecheck compiles the screen inside a copy of the template, against
  the kit's React Native types and the host modules' declarations
  (`src/graders/host.ts`), and charges the screen only for errors in its own
  file: errors in shared files go to `typecheck.details.elsewhere`. Props
  and coverage know the recipes `.fluxnative-ui.json` lists, read from the
  template's own copies, so a template component that shares a recipe's name
  is not judged as that recipe.
- `--expect` gives the recipes and `previewState` values a screen should
  cover: `{ "recipes": [...], "states": [...] }` for every screen, or
  `{ "screens": { "<Name>": { ... } }, "default": { ... } }`. A screen with
  no expectation gets coverage `{ "pass": null, "details": "na: ..." }`,
  which does not gate.
- `--json` prints `{ "version": 1, "kit": { "version", "commit" }, "pass", "screens":
  { "<Name>": { "pass", "dialect", "typecheck", "props", "tokens",
  "shadowPrimitive", "coverage", "metrics" } } }` on stdout, each grader as
  `{ pass, score, details }`. Without it: one line per failing grader, then a
  verdict.
- Exit 0 when every screen passes every grader, 2 when one fails, 1 for a
  usage or runtime error. A typecheck that cannot run (no `node_modules`) is
  reported as `{ "pass": false, "details": "unavailable: ..." }` and exits 1,
  never as a pass.

## Run it in an agent lane

A builder lane (a Claude Code agent in its own git worktree) and the gate
that checks its work run the kit from a checkout pinned to one commit, the
one the template repository's `tool/fluxnative.lock.json` names. One
checkout per commit, shared by every lane on the machine:

```bash
sha=<commit from fluxnative.lock.json>
kit=<kits>/${sha:0:7}
git -C <fluxnative-ui clone> worktree add --detach "$kit" "$sha"
pnpm --dir "$kit" install --frozen-lockfile --offline   # drop --offline when the store is cold
node "$kit/packages/mcp/src/grade.js" --doctor           # exit 0 ready, 1 with each failing item named
```

`--doctor [--json]` (on both bins) checks Node 22.15 or newer, the installed
dependencies (the MCP server's, and `react`, `react-native` and
`@types/react` under `packages/catalog/node_modules`, which the typecheck
links), and that the MCP server starts and answers `initialize` over stdio.
Run it when the lane starts: a missing install then fails the lane with a
reason instead of a grader reading `unavailable` in the middle of a gate.

`--version [--json]` (on both bins) prints `{"version": "<package version>",
"commit": "<HEAD of the kit checkout>"}`; `commit` is null outside a git
checkout of this repository (installed from npm, or exported without
`.git`). The grader's JSON report carries the same pair as `kit`, so a gate
proves the kit it ran is the pinned one by comparing `kit.commit` with the
lock.

The lane's `.mcp.json`, for Claude Code:

```json
{ "mcpServers": { "fluxnative-ui": { "command": "node", "args": ["<kit>/packages/mcp/src/bin.js"] } } }
```

The gate's call, from the template repository:

```bash
node <kit>/packages/mcp/src/grade.js --root templates/<id>/files --expect <expect.json> --json
```

Exit 0 when every screen passes, 2 when a grader failed (the report says
which), 1 for a usage or runtime error, including a typecheck that could
not run. The root scripts do the same from anywhere, with relative paths
resolved against the caller's folder: `pnpm -s --dir <kit> grade …` and
`pnpm --dir <kit> mcp` (`-s` keeps pnpm's banner out of the output; the exit
code passes through).

## Develop

```bash
pnpm --filter @fluxnative/ui-mcp test        # node:test, in-memory transport
pnpm --filter @fluxnative/ui-mcp typecheck
```

`src/server.ts` holds the tools (pure functions `searchComponents`,
`getComponent`, `validateScreen` plus `createServer`); `src/stdio.ts` serves
them; `src/graders/cli.ts` is `fluxnative-ui-grade`; `src/bin.js` and
`src/grade.js` are the launchers, which strip TypeScript types the way
`fluxnative-catalog` does (`src/launch.js`).
