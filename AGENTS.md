# Working in the FluxNative UI repo

This file is for agents changing FluxNative UI itself. The index that ships to *apps using* FluxNative UI is `docs/llm/AGENTS.index.md`, and it must stay under 8 KB.

## Layout

- `packages/tokens/tokens/*.tokens.json` is the only place a design value is defined. After any change, run `pnpm tokens`; it regenerates `src/generated/*` and `apps/expo-example/src/global.css`. Never edit generated files.
- `packages/glass`: the ladder (`tiers.ts`, pure and tested), adapters, `GlassSurface`.
- `packages/ui`: components. `src/expo-router/*` is the only code that imports `expo-router`.
- `packages/tw-runtime`: the runtime class resolver. It must accept exactly what Uniwind accepts under the FluxNative UI theme. Add a test for every class family.
- `packages/catalog/files/components`: the recipes a Flux template gets (template dialect: `import React`, StyleSheet, no `className`). A new recipe needs: an entry in `packages/catalog/registry.meta.json` (use, archetypes, aliases, evidence: the hand-written copies in fluxbuilder-template and the Mobbin screens it follows), a render test next to `recipes-0.2.test.ts`, a row in `docs/topics/catalog.md`, then `pnpm tokens` to regenerate `registry.json`, `docs/llm/CATALOG.index.md` (≤ 9 KB; `pnpm evolve` checks) and the package manifest.
- `packages/mcp`: the MCP server over the catalog; `src/graders` are the deterministic screen checks behind `validate_screen`.

## Rules

- Imports use explicit `.ts`/`.tsx` extensions, which `node --test` needs. The one exception: a file that has `.ios.tsx`/`.android.tsx` siblings is imported **without** an extension, because Metro only resolves platform files for extensionless specifiers.
- Strict TypeScript with `noUncheckedIndexedAccess`.
- Keep the public API closed: string-literal unions, semantic color names only, no style escape hatch without `unsafe` in its name.
- Glass rules: no `opacity` animation on glass or its ancestors, no glass inside glass, no `backgroundColor` on glass.
- Every user-visible API change updates `docs/llm/AGENTS.index.md` in the same change; a catalog change regenerates `docs/llm/CATALOG.index.md` and `registry.json` (`pnpm tokens`).
- Design rules for generated screens live in `docs/llm/CRAFT.index.md` (≤ 4 KB, versioned); change them with the reasoning in `docs/topics/craft.md`.

## Checks

```bash
pnpm test && pnpm typecheck && pnpm tokens:check
cd apps/expo-example && npx expo export --platform web && npx expo export --platform ios
```

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
