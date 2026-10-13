// Generates registry.json: the machine-readable catalogue of the layer, for
// tools rather than for a model's context. CATALOG.index.md is the ≤ 9 KB
// summary a model reads; the registry holds the whole truth behind it: every
// component with its props read from the sources (name, optional, type), its
// relative imports, and the hand-maintained metadata of registry.meta.json
// (when to use it, screen archetypes, the hand-written names it replaces in
// templates, and the evidence it was shaped from). The MCP server, the
// template-catalog tooling and the screen graders read it; CI keeps it current.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { components, type Component } from './catalog-index.ts';
import { CATALOG_VERSION, PACKAGE_ROOT, componentDeps, render } from './emit.ts';

export const REGISTRY_VERSION = 1;
export const REGISTRY_FILE = join(PACKAGE_ROOT, 'registry.json');
export const REGISTRY_META_FILE = join(PACKAGE_ROOT, 'registry.meta.json');

export interface MobbinRef {
  app: string;
  screen: string;
}

export interface Evidence {
  /** Templates in the catalog that wrote this by hand before the recipe existed. */
  templates?: number;
  categories?: number;
  note?: string;
}

/** One entry of registry.meta.json. */
export interface ComponentMeta {
  since: string;
  use: string;
  /** OpenDesign archetypes (plus the five AI ones); `*` means any screen. */
  archetypes: string[];
  /** Hand-written component names this recipe replaces; the template-catalog tooling and the shadow-primitive grader read them. */
  aliases: string[];
  evidence: Evidence;
  mobbin?: MobbinRef[];
}

export interface RegistryEntry extends Component, ComponentMeta {
  /** Other catalog components this one imports, transitively (`--only` brings them along). */
  deps: string[];
}

export interface Registry {
  $schema: string;
  registryVersion: number;
  catalog: { version: string };
  /** The template dialect a screen must keep to. */
  dialect: { imports: string[]; forbidden: string[] };
  tokens: Record<string, string[]>;
  components: RegistryEntry[];
}

export function readRegistryMeta(file: string = REGISTRY_META_FILE): Record<string, ComponentMeta> {
  const doc = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  const out: Record<string, ComponentMeta> = {};
  for (const [name, value] of Object.entries(doc)) {
    if (name.startsWith('$')) continue;
    out[name] = value as ComponentMeta;
  }
  return out;
}

/** Keys of `export const <name> … = { … }` in the emitted theme/tokens.ts, one level deep. */
function keysOf(tokens: string, name: string): string[] {
  const start = tokens.search(new RegExp(`^export const ${name}\\b`, 'm'));
  if (start < 0) return [];
  const open = tokens.indexOf('{', start);
  let depth = 0;
  const keys: string[] = [];
  let line = '';
  for (let i = open; i < tokens.length; i += 1) {
    const ch = tokens[i] ?? '';
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
    if (ch === '\n') {
      const key = depth === 1 ? /^\s*"?([\w.-]+)"?:/.exec(line) : null;
      if (key) keys.push(key[1] ?? '');
      line = '';
    } else line += ch;
  }
  return keys;
}

export function renderRegistry(): Registry {
  const tokens = render().files['theme/tokens.ts'] ?? '';
  const at = tokens.indexOf('export type ColorName');
  const roles = [...tokens.slice(at, tokens.indexOf(';', at)).matchAll(/'([a-z-]+)'/g)].map((m) => m[1] ?? '');
  const meta = readRegistryMeta();
  const deps = componentDeps();
  const list = components().map((c): RegistryEntry => {
    const own = meta[c.name];
    if (own === undefined) throw new Error(`registry.meta.json has no entry for ${c.name} (${c.path}): add its use, archetypes, aliases and evidence`);
    return { ...c, ...own, deps: deps[c.name] ?? [] };
  });
  for (const name of Object.keys(meta)) {
    if (!list.some((c) => c.name === name)) throw new Error(`registry.meta.json names ${name}, which is not a catalog component`);
  }
  return {
    $schema: 'https://github.com/fluxnative-app/fluxnative-ui/blob/main/docs/topics/registry.md',
    registryVersion: REGISTRY_VERSION,
    catalog: { version: CATALOG_VERSION },
    dialect: {
      imports: ['react', 'react-native', 'react-native-svg', 'flux', 'flux/navigation', './relative'],
      forbidden: ['className', '<div>', '<span>', 'document.', 'window.location', 'fetch', 'hex or rgb literals in screens', 'Modal'],
    },
    tokens: {
      roles,
      type: keysOf(tokens, 'type'),
      shape: keysOf(tokens, 'shape'),
      elevation: keysOf(tokens, 'elevation'),
      space: keysOf(tokens, 'space'),
      layout: keysOf(tokens, 'layout'),
      interaction: keysOf(tokens, 'interaction'),
    },
    components: list,
  };
}

export function renderRegistryJson(): string {
  return `${JSON.stringify(renderRegistry(), null, 2)}\n`;
}
