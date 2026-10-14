// The FluxNative UI MCP server: the catalog layer as tools an agent can call
// while it writes a Flux template screen or an Expo app. Everything it
// answers comes from the layer itself (registry.json, CATALOG.index.md, the
// recipe sources, the eval graders), so it cannot drift from the code.
//
//   search_components  words → the recipes that fit, with props and evidence
//   get_component      one recipe: props, deps, when to use, the source
//   get_index          the ≤ 9 KB CATALOG.index.md
//   get_design_rules   docs/llm/CRAFT.index.md, the design rules models follow
//   list_tokens        palette roles, type / shape / elevation / space keys
//   validate_screen    a screen's source → the deterministic graders' verdict
//
// Runs over stdio (`npx fluxnative-ui-mcp`, or `node packages/mcp/src/bin.js`).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FILES_DIR, PACKAGE_ROOT as CATALOG_ROOT, CATALOG_VERSION, renderCatalogIndex, renderRegistry, type Registry, type RegistryEntry } from '@fluxnative/catalog';
import { loadCatalog } from './graders/catalog.ts';
import { gradeDialect } from './graders/dialect.ts';
import { gradeProps } from './graders/props.ts';
import { gradeShadowPrimitive } from './graders/shadow-primitive.ts';
import { parseScreen } from './graders/source.ts';
import { gradeTokens } from './graders/tokens.ts';

const REPO_ROOT = join(CATALOG_ROOT, '..', '..');

let cached: Registry | null = null;
export function registry(): Registry {
  cached ??= renderRegistry();
  return cached;
}

const text = (value: unknown) => ({ content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] });

/** Words → recipes, scored on name, aliases, use line, summary, archetypes and prop names. */
export function searchComponents(query: string, limit = 8, archetype?: string): Array<RegistryEntry & { score: number }> {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  const scored = registry().components.map((c) => {
    let score = 0;
    const name = c.name.toLowerCase();
    const aliases = c.aliases.map((a) => a.toLowerCase());
    const haystack = `${c.use} ${c.summary}`.toLowerCase();
    for (const w of words) {
      if (name === w) score += 10;
      else if (name.includes(w)) score += 5;
      if (aliases.some((a) => a === w)) score += 8;
      else if (aliases.some((a) => a.includes(w))) score += 3;
      if (haystack.includes(w)) score += 2;
      if (c.archetypes.some((a) => a.includes(w))) score += 2;
      if (c.props.some((p) => p.name.toLowerCase() === w)) score += 1;
    }
    if (archetype && (c.archetypes.includes(archetype) || c.archetypes.includes('*'))) score += 3;
    return { ...c, score };
  });
  return scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function getComponent(name: string, withSource: boolean): (RegistryEntry & { source?: string }) | null {
  const entry = registry().components.find((c) => c.name.toLowerCase() === name.toLowerCase() || c.aliases.some((a) => a.toLowerCase() === name.toLowerCase()));
  if (entry === undefined) return null;
  if (!withSource) return entry;
  const file = join(FILES_DIR, entry.path);
  return { ...entry, source: existsSync(file) ? readFileSync(file, 'utf8') : undefined };
}

export interface Validation {
  pass: boolean;
  dialect: ReturnType<typeof gradeDialect>['details'];
  props: ReturnType<typeof gradeProps>['details'];
  tokens: ReturnType<typeof gradeTokens>['details'];
  shadowPrimitive: ReturnType<typeof gradeShadowPrimitive>['details'];
  next: string[];
}

/** The deterministic graders over one screen: dialect, hallucinated props, token literals, re-implemented primitives. Typecheck is left to the template's own `tsc` run. */
export function validateScreen(source: string, screenName = 'Screen'): Validation {
  const screenFile = `screens/${screenName}.tsx`;
  const catalog = loadCatalog();
  const screen = parseScreen(source);
  const dialect = gradeDialect(screen, catalog, screenFile);
  const props = gradeProps(screen, catalog);
  const tokens = gradeTokens(screen);
  const shadow = gradeShadowPrimitive(screen);
  const next: string[] = [];
  for (const v of dialect.details.violations.slice(0, 5)) next.push(`dialect: ${v.message} (line ${v.line})`);
  for (const h of props.details.hallucinated.slice(0, 5)) next.push(`props: <${h.component}> has no prop \`${h.prop}\` (line ${h.line}); see get_component`);
  for (const v of tokens.details.violations.slice(0, 5)) next.push(`tokens: ${v.rule} \`${v.text}\` (line ${v.line}); use a palette role or a token`);
  for (const f of shadow.details.findings.slice(0, 5)) next.push(`shadow: ${f.message} (line ${f.line}); use ${f.primitive}`);
  return { pass: dialect.pass && props.pass && tokens.pass && shadow.pass, dialect: dialect.details, props: props.details, tokens: tokens.details, shadowPrimitive: shadow.details, next };
}

export function createServer(): McpServer {
  const server = new McpServer({ name: 'fluxnative-ui', version: CATALOG_VERSION });

  server.registerTool(
    'search_components',
    {
      title: 'Search FluxNative UI recipes',
      description:
        'Find the catalog components (recipes) that fit a need, in plain words: "settings row with a toggle", "quantity stepper", "search bar". Returns each match with its import path, props (closed values inline), when to use it, screen archetypes and the evidence it was shaped from. Use before writing a local component: the catalog may already carry it.',
      inputSchema: { query: z.string().min(1).describe('What the screen needs, in plain words'), limit: z.number().int().min(1).max(20).optional(), archetype: z.string().optional().describe('An OpenDesign or AI archetype to prefer (settings, cart-checkout, ai-chat…)') },
    },
    async ({ query, limit, archetype }) => text(searchComponents(query, limit ?? 8, archetype).map(({ score, deps, exports, ...rest }) => ({ ...rest, deps, exports, score }))),
  );

  server.registerTool(
    'get_component',
    {
      title: 'Read one recipe',
      description: 'One catalog component by name (or by an alias such as CtaButton): its props with types and closed values, named exports, dependencies, when to use it, the apps it follows, and optionally its source in the template dialect.',
      inputSchema: { name: z.string().min(1), source: z.boolean().optional().describe('Include the TSX source (default false)') },
    },
    async ({ name, source }) => {
      const entry = getComponent(name, source ?? false);
      return text(entry ?? { error: `no catalog component or alias named ${name}`, known: registry().components.map((c) => c.name) });
    },
  );

  server.registerTool(
    'get_index',
    {
      title: 'The catalog index',
      description: 'docs/llm/CATALOG.index.md: the ≤ 9 KB index of the whole layer (rules, tokens, every component with its props, one example). Read it once before writing a Flux template screen.',
      inputSchema: {},
    },
    async () => text(renderCatalogIndex()),
  );

  server.registerTool(
    'get_design_rules',
    {
      title: 'The design rules',
      description: 'docs/llm/CRAFT.index.md: the rules that keep a generated screen from looking generated and keep a template distinct enough for App Store and Google Play review (identity, copy, imagery, layout, motion, states).',
      inputSchema: {},
    },
    async () => {
      const file = join(REPO_ROOT, 'docs', 'llm', 'CRAFT.index.md');
      return text(existsSync(file) ? readFileSync(file, 'utf8') : 'CRAFT.index.md is not in this checkout.');
    },
  );

  server.registerTool(
    'list_tokens',
    {
      title: 'Token roles',
      description: 'The palette roles (usePalette()), and the keys of type, shape, elevation, space, layout and interaction in theme/tokens.ts. Screens use these names, never literals.',
      inputSchema: {},
    },
    async () => text({ catalog: registry().catalog, dialect: registry().dialect, tokens: registry().tokens }),
  );

  server.registerTool(
    'validate_screen',
    {
      title: 'Validate a screen',
      description:
        'Run the deterministic graders of the kit over a screen source (template dialect): forbidden imports and web constructs, props a catalog component does not declare, hex / rgb / size literals, local components that re-implement a recipe. Returns pass and a short "next" list. Typecheck is not included; run `pnpm eval` or tsc for that.',
      inputSchema: { source: z.string().min(1).describe('The full TSX source of one screen'), screenName: z.string().optional().describe('The default export name (default Screen)') },
    },
    async ({ source, screenName }) => text(validateScreen(source, screenName ?? 'Screen')),
  );

  return server;
}
