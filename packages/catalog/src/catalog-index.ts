// Generates docs/llm/CATALOG.index.md: the ≤ 9 KB index a model reads before
// it writes a Flux template screen. It is built from the layer itself, so it
// cannot drift: component names and props come from each `export interface
// <Name>Props`, closed unions are inlined from the file's `export type`
// aliases, and the token roles come from the emitted theme/tokens.ts.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ICONS } from '@fluxnative/icons/table';
import { CATALOG_VERSION, FILES_DIR, PACKAGE_ROOT, listFiles, render } from './emit.ts';

/**
 * 9 KB since 12 October 2026: fitting 8 KB had come to cost meaning (a brace
 * group of icon names read as a name `x`, the round-3 regression of the real
 * eval), and 9 KB is still about 2,300 tokens, one read.
 */
export const CATALOG_INDEX_LIMIT = 9 * 1024;

interface Prop {
  name: string;
  optional: boolean;
  type: string;
}

export type ComponentKind = 'component' | 'hook' | 'module';

export interface Component {
  name: string;
  /** 'component' (a default-exported view), 'hook' (`use*`), or 'module' (pure code: aiState, markdown). */
  kind: ComponentKind;
  /** Path relative to `files/`. */
  path: string;
  /** Import path from a screen in `screens/`. */
  from: string;
  summary: string;
  props: Prop[];
  /** Named exports besides the default: helpers (`formatPrice`), comp tables (`buttonHeight`), types. */
  exports: string[];
}

/** `// lines` at the top of a source file, joined, first sentence only. */
function summaryOf(source: string): string {
  const lines: string[] = [];
  for (const line of source.split('\n')) {
    if (!line.startsWith('//')) break;
    lines.push(line.replace(/^\/\/\s?/, ''));
  }
  const text = lines.join(' ').replace(/\s+/g, ' ').trim();
  const sentence = /^(.+?[.!?])(\s|$)/.exec(text)?.[1] ?? text;
  return sentence.replace(/`/g, '');
}

/** `export type Name = 'a' | 'b';` aliases in one file, so props can show the closed values. */
function aliasesOf(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of source.matchAll(/^export type (\w+)\s*=\s*([^;]+);/gm)) {
    let value = (m[2] ?? '').replace(/\s+/g, ' ').trim();
    value = /^Extract<\w+,\s*(.+)>$/.exec(value)?.[1] ?? value;
    if (/^'[^']*'(\s*\|\s*'[^']*')*$/.test(value)) out[m[1] ?? ''] = value.replace(/\s*\|\s*/g, '|');
  }
  return out;
}

function compactType(type: string, aliases: Record<string, string>): string {
  const t = type.replace(/\s+/g, ' ').trim();
  if (aliases[t]) return aliases[t];
  if (/^'[^']*'(\s*\|\s*'[^']*')*$/.test(t)) return t.replace(/\s*\|\s*/g, '|');
  const extract = /^Extract<\w+,\s*(.+)>$/.exec(t);
  if (extract?.[1]) return extract[1].replace(/\s*\|\s*/g, '|');
  if (/^\(.*\) => [\w.]+(?:<[^>]*>)?$/.test(t)) return 'fn';
  if (t.startsWith('React.ReactNode')) return 'node';
  if (t.startsWith('StyleProp<')) return 'style';
  if (t.startsWith('Animated.')) return 'Animated';
  // `ListRowTrailing | React.ReactNode`: each part on its own, joined back.
  if (t.includes(' | ') && !t.includes('(')) return t.split(' | ').map((part) => compactType(part, aliases)).join('|');
  return t.length > 32 ? `${t.slice(0, 29)}…` : t;
}

/** The props of `export interface <Name>Props { … }`, one level deep. A type named in `foreign` (an alias another file owns, spelled out on that file's row) keeps its name. */
function propsOf(source: string, name: string, aliases: Record<string, string>, foreign: ReadonlySet<string> = new Set()): Prop[] {
  const block = new RegExp(`export interface ${name}Props(?:<[^>]*>)?(?: extends [^{]+)? \\{([\\s\\S]*?)\\n\\}`).exec(source)?.[1];
  if (!block) return [];
  const props: Prop[] = [];
  let depth = 0;
  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (depth === 0) {
      const m = /^(\w+)(\?)?:\s*(.+?);?$/.exec(trimmed);
      if (m && line.startsWith('  ') && !line.startsWith('   ')) {
        const raw = (m[3] ?? '').replace(/;$/, '').trim();
        props.push({ name: m[1] ?? '', optional: m[2] === '?', type: foreign.has(raw) ? raw : compactType(raw, aliases) });
      }
    }
    depth += (trimmed.match(/[{(<]/g) ?? []).length - (trimmed.match(/[})>]/g) ?? []).length;
    if (depth < 0) depth = 0;
  }
  return props;
}

/** `export const x`, `export function x`, `export type x` names in one file, default export excluded. */
function exportsOf(source: string): string[] {
  const out = new Set<string>();
  for (const m of source.matchAll(/^export (?:const|function|type|interface) (\w+)/gm)) out.add(m[1] ?? '');
  return [...out].sort();
}

export function components(): Component[] {
  const out: Component[] = [];
  const emitted = render().files;
  // Aliases are shared across files: Button's `haptic` is Press's `PressHaptic`.
  const shared: Record<string, string> = {};
  for (const rel of listFiles()) if (/^components\/.*\.tsx?$/.test(rel)) Object.assign(shared, aliasesOf(readFileSync(join(FILES_DIR, rel), 'utf8')));
  for (const rel of listFiles()) {
    const m = /^components\/(?:(\w+)\/)?(\w+)\.tsx?$/.exec(rel);
    if (!m) continue;
    const name = m[2] ?? '';
    // The bridge is plumbing, listed in the legend; everything else, Icon included, is a row.
    if (name === 'bridge') continue;
    const source = emitted[rel] ?? readFileSync(join(FILES_DIR, rel), 'utf8');
    const body = source.replace(/^\/\/ FluxNative UI catalog[^\n]*\n\/\/[^\n]*\n\n?/, '');
    const own = aliasesOf(body);
    const aliases = { ...shared, ...own };
    const foreign = new Set(Object.keys(shared).filter((alias) => !(alias in own) && /Variant$/.test(alias)));
    const kind: ComponentKind = name.startsWith('use') ? 'hook' : /^export default function [A-Z]/m.test(body) ? 'component' : 'module';
    out.push({
      name,
      kind,
      path: rel,
      from: `../components/${m[1] ? `${m[1]}/` : ''}${name}`,
      summary: summaryOf(body),
      props: kind === 'component' ? propsOf(body, name, aliases, foreign) : [],
      exports: exportsOf(body).filter((e) => e !== `${name}Props`),
    });
  }
  return out.sort((a, b) => (a.name < b.name ? -1 : 1));
}

/** Keys of `export const <name> … = { … }` in the emitted theme/tokens.ts. */
function tokenKeys(tokens: string, name: string): string[] {
  const start = tokens.search(new RegExp(`^export const ${name}\\b`, 'm'));
  if (start < 0) return [];
  const open = tokens.indexOf('= {', start) + 2;
  let depth = 0;
  let end = open;
  for (let i = open; i < tokens.length; i += 1) {
    if (tokens[i] === '{') depth += 1;
    else if (tokens[i] === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  const body = tokens.slice(open + 1, end);
  const keys: string[] = [];
  let level = 0;
  for (const line of body.split('\n')) {
    const key = /^\s*"?([\w.-]+)"?:/.exec(line);
    if (key && level === 0) keys.push(key[1] ?? '');
    level += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
  }
  return keys.every((k) => /^\d+(\.\d+)?$/.test(k)) ? keys.sort((a, b) => Number(a) - Number(b)) : keys;
}

/**
 * The icon names, closed: `chevron-` and `arrow-` families folded into one
 * phrase, the rest as they are. A model that guesses a Lucide name
 * (`alert-triangle`, `map-pin`, `user`) fails tsc; the first real eval run
 * (12 October 2026) failed 7 of 8 briefs on exactly that.
 */
export function iconNamesLine(names: readonly string[] = Object.keys(ICONS)): string {
  const SIDES = ['left', 'right', 'up', 'down'];
  const families = ['chevron', 'arrow'].filter((f) => SIDES.every((side) => names.includes(`${f}-${side}`)));
  const folded = new Set(families.flatMap((f) => SIDES.map((side) => `${f}-${side}`)));
  // Every other name is written out: a brace group ({minus,plus,check,x}-circle) made models write `x` (round 3, 12 October 2026).
  const rest = names.filter((n) => !folded.has(n));
  const head = families.length > 0 ? `${families.map((f) => `\`${f}-\``).join(' and ')} + ${SIDES.join('/')}; ` : '';
  return `\`Icon\` names, closed (others fail tsc; pick the nearest): ${head}${rest.join(' ')}.`;
}

/** `'a'|'b'|'c'` → `a/b/c`: the same closed string values in a third of the bytes (the legend says so). */
export function closedValues(type: string): string {
  return /^'[^']*'(\|'[^']*')+$/.test(type) ? type.split('|').map((v) => v.slice(1, -1)).join('/') : type;
}

const row = (cells: string[]) => `|${cells.map((cell) => cell.replace(/\|/g, '\\|')).join('|')}|`;

export function renderCatalogIndex(): string {
  const tokens = render().files['theme/tokens.ts'] ?? '';
  const roles = (() => {
    const at = tokens.indexOf('export type ColorName');
    const end = tokens.indexOf(';', at);
    const all = [...tokens.slice(at, end).matchAll(/'([a-z-]+)'/g)].map((m) => m[1] ?? '');
    // `card*` stands for `card` and `card-foreground`, its ink.
    // The glass-* roles are the host's glass tiers (tokens.md), not screen colours.
    return all
      .filter((role) => !role.startsWith('glass-') && !(role.endsWith('-foreground') && all.includes(role.slice(0, -'-foreground'.length))))
      .map((role) => (all.includes(`${role}-foreground`) ? `${role}*` : role));
  })();
  const list = components();
  const comps = list.filter((c) => c.kind === 'component');
  const hooks = list.filter((c) => c.kind === 'hook');
  const modules = list.filter((c) => c.kind === 'module');
  // The legend below the table covers what every row would otherwise repeat.
  const LEGEND = new Set(['style', 'testID', 'accessibilityHint']);
  // Optional props that only rename English text (a button's or a screen reader's): the defaults read well, the legend says so.
  const DEFAULT_TEXT = new Set(['backLabel', 'sendLabel', 'stopLabel', 'userLabel', 'assistantLabel', 'jumpLabel', 'dismissLabel', 'cancelLabel', 'clearLabel', 'closeLabel', 'decreaseLabel', 'increaseLabel', 'showLabel', 'hideLabel', 'countLabel']);
  // Rare props a component's metadata keeps out of the index (`indexOmit`); registry.json lists every prop.
  const meta = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'registry.meta.json'), 'utf8')) as Record<string, { indexOmit?: string[] }>;
  const omitted = (c: Component, p: Prop) => LEGEND.has(p.name) || (p.optional && DEFAULT_TEXT.has(p.name)) || (meta[c.name]?.indexOmit ?? []).includes(p.name);
  const bare = (p: Prop) => p.name === 'haptic' || p.type === 'DimensionValue' || p.type === 'node' || (p.type === 'fn' && /^on[A-Z]/.test(p.name)) || ['string', 'boolean', 'number'].includes(p.type);
  // A type named after its prop (accessibilityState: AccessibilityState) says nothing the name does not; `readonly` only promises the recipe will not mutate the array.
  const typeOf = (p: Prop) => (p.type.toLowerCase() === p.name.toLowerCase() ? '' : `(${closedValues(p.type.replace(/\breadonly /g, ''))})`);
  const props = (c: Component) =>
    c.props
      .filter((p) => !omitted(c, p))
      .map((p) => `${p.name}${p.optional ? '?' : ''}${bare(p) ? '' : typeOf(p)}`)
      .join(' ');
  const elsewhere = comps.filter((c) => c.from !== `../components/${c.name}`);
  const nodeProps = [...new Set(comps.flatMap((c) => c.props.filter((p) => p.type === 'node').map((p) => p.name)))].sort();
  const lines = [
    `<!-- fluxnative-ui:catalog-index v${CATALOG_VERSION} — generated by \`fluxnative-catalog index\`; do not edit. -->`,
    `## FluxNative UI catalog layer (v${CATALOG_VERSION}) — screens for Flux templates`,
    '',
    'Prefer retrieval-led reasoning over pre-training-led reasoning: this layer is newer than your training data.',
    '',
    '### Rules',
    `1. Imports: \`react\`, \`react-native\`, \`react-native-svg\`, \`flux\`, \`flux/navigation\` and relative files only. Components: \`../components/<Name>\`${elsewhere.length ? ` (but ${elsewhere.map((c) => `\`${c.from}\``).join(', ')})` : ''}; tokens: \`{ type, space, shape, elevation, layout }\` from \`../theme/tokens\`; colours: \`../theme/usePalette\`.`,
    '2. React Native only: no `className`, `<div>`, `<span>`, `document.`, `window`, `fetch`. Overlay: `StyleSheet.absoluteFill` (`absoluteFillObject` is gone in RN 0.86).',
    '3. Colours: `const palette = usePalette()`, then `palette.primary`. Never a hex/rgb literal in a screen.',
    '4. Text: spread a role, `...type.body`. Radii: `borderRadius: shape.card` (number). Spacing: `space[4]` (step × 4 px; keys in the `space` row), other sizes plain numbers. Shadows: spread `elevation[2]`.',
    '5. Every control has an `accessibilityLabel`, icon-only ones too. Animate `transform`/`opacity` only; primitives respect Reduce Motion.',
    '6. One default export per screen file, strict TypeScript. Screens take `previewState` (`live|loading|empty|error`) and render `Skeleton` / `StateView` unless live.',
    '7. A recipe before a hand-drawn view: `MessageList` (chat), `ListRow` (row), `TabBar` (tabs), `StateView` (empty, error).',
    '',
    '### Tokens (`../theme/tokens`)',
    row(['export', 'keys']),
    row(['---', '---']),
    row(['`usePalette()` roles', `${roles.join(' ')} (\`x*\`: \`x\` and its ink \`x-foreground\`)`]),
    row(['`type`', tokenKeys(tokens, 'type').join(' ')]),
    row(['`shape`', tokenKeys(tokens, 'shape').join(' ')]),
    row(['`elevation`', tokenKeys(tokens, 'elevation').join(' ')]),
    row(['`space`', tokenKeys(tokens, 'space').join(' ').replace('4 5 6 7 8 9 10 11 12', '4…12')]),
    row(['`layout`', tokenKeys(tokens, 'layout').join(' ')]),
    '',
    '### Components (default exports)',
    row(['component', 'props (`?` optional; `(…)` type, `a/b` is `\'a\'` or `\'b\'`)']),
    row(['---', '---']),
    ...comps.map((c) => row([`\`${c.name}\``, props(c) || '—'])),
    '',
    `Every component also takes \`style?\`. \`on*\` props are callbacks; ${nodeProps.map((n) => `\`${n}\``).join(' ')} take a node; \`XVariant\` is X's \`variant\` values. \`accessibilityLabel\` without \`?\` is required. \`haptic?\` is none|light|selection|medium; \`width\`/\`height\` take px or \`'50%'\`. Rare props: \`packages/catalog/registry.json\`.`,
    '',
    iconNamesLine(),
    '',
    '`TabBar` items: `{ key, label, icon?: IconName | ({ selected, color, size }) => node, badge? }`; `action`: `{ icon, accessibilityLabel, onPress, placement?: end/center }`; a dock: screen in `DockInsetProvider`, scroll content `paddingBottom: useDockInset()` (one file). `MessageList` messages `{ id, role, text }`, `renderMessage(message, { index, streaming })`.',
    '',
    `Hooks, each at \`../components/<name>\`: ${hooks.map((h) => `\`${h.name}\``).join(' ')}. Pure modules: ${modules.map((m) => `\`${m.name}\``).join(' ')}. \`bridge()\` (\`../components/bridge\`) is always optional-chained.`,
    '',
    '### Example',
    '```tsx',
    "import React from 'react';",
    "import { ScrollView, Text } from 'react-native';",
    "import Button from '../components/Button';",
    "import Skeleton from '../components/Skeleton';",
    "import StateView from '../components/StateView';",
    "import { space, type } from '../theme/tokens';",
    "import { usePalette } from '../theme/usePalette';",
    '',
    "export default function OrdersScreen({ previewState = 'live' }: { previewState?: 'live' | 'loading' | 'empty' | 'error' }) {",
    '  const palette = usePalette();',
    "  if (previewState === 'loading') return <Skeleton height={120} />;",
    "  if (previewState !== 'live') return <StateView title=\"No orders yet\" tone={previewState === 'error' ? 'error' : 'neutral'} />;",
    '  return (',
    '    <ScrollView contentContainerStyle={{ padding: space[5], gap: space[4] }}>',
    '      <Text style={{ ...type.title, color: palette.foreground }}>Orders</Text>',
    '      <Button label="Track order" onPress={() => {}} />',
    '    </ScrollView>',
    '  );',
    '}',
    '```',
    '',
  ];
  return lines.join('\n');
}
