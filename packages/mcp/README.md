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
| `get_archetype` `{ archetype }` | the recipes for one screen archetype (`cart-checkout`, `settings`, `ai-chat`…, OpenDesign's 30 plus the five AI ones): those made for it, most evidence first, then the general ones that fit any screen, each with its import path, one-line summary and when to use it; an unknown archetype returns an error with the valid list |
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
`get_index`, then `get_archetype` for the screen's archetype and
`search_components` for each part it still needs, then
`validate_screen` on the result and fix what `next` says."

## Develop

```bash
pnpm --filter @fluxnative/ui-mcp test        # node:test, in-memory transport
pnpm --filter @fluxnative/ui-mcp typecheck
```

`src/server.ts` holds the tools (pure functions `searchComponents`,
`getComponent`, `getArchetype`, `validateScreen` plus `createServer`); `src/stdio.ts` serves
them; `src/bin.js` is the launcher that strips TypeScript types the way
`fluxnative-catalog` does.
