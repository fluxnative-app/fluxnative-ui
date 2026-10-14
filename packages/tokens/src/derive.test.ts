import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brandLayers, validateBrand, type TokenSources } from './brand.ts';
import { contrast, deriveSeedRoles, READABLE, SEED_SURFACES, type Scheme } from './derive.ts';

const tokensDir = join(import.meta.dirname, '..', 'tokens');
const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'));
const kit: TokenSources = {
  base: readJson(join(tokensDir, 'base.tokens.json')),
  schemes: { light: readJson(join(tokensDir, 'color.light.tokens.json')), dark: readJson(join(tokensDir, 'color.dark.tokens.json')) },
};
const kitPalette = (scheme: Scheme): Record<string, string> => {
  const report = validateBrand(brandLayers({ file: 'brand.tokens.json', doc: { $extensions: { 'dev.fluxnative.brand': { schemaVersion: 1 } } } }), kit);
  assert.ok(report.brand, 'the kit itself resolves');
  return { ...report.brand.colors[scheme] };
};

/** Every hue in 15° steps × five saturations × seven lightnesses: 840 seeds, the way a picker or a brand file can set one. */
function seeds(): string[] {
  const out: string[] = [];
  for (let h = 0; h < 360; h += 15) {
    for (const s of [0.15, 0.35, 0.6, 0.85, 1]) {
      for (const l of [0.12, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9]) {
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = l - c / 2;
        const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
        out.push(`#${[r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`);
      }
    }
  }
  return out;
}

/** The kit's surfaces, and grounds brands in the catalog set themselves: cream paper, a sage card, navy and warm-graphite darks. */
const grounds: Array<[string, Scheme, Record<string, string>]> = [
  ['kit light', 'light', {}],
  ['kit dark', 'dark', {}],
  ['cream', 'light', { background: '#f4efe6', card: '#fbf8f2', popover: '#ffffff', muted: '#ebe4d6' }],
  ['sage', 'light', { background: '#eef2ec', card: '#ffffff', popover: '#ffffff', muted: '#dfe7db' }],
  ['navy', 'dark', { background: '#0b1324', card: '#131d33', popover: '#1a2540', muted: '#16213a' }],
  ['graphite', 'dark', { background: '#1a1816', card: '#24211e', popover: '#2e2a26', muted: '#211e1b' }],
];

test('every seed on every ground: accents reach 4.5:1 on each surface, and their inks reach 4.5:1 on them', () => {
  const failures: string[] = [];
  const all = seeds();
  for (const [name, scheme, surfaces] of grounds) {
    const palette = { ...kitPalette(scheme), ...surfaces };
    for (const seed of all) {
      const d = deriveSeedRoles(seed, palette, scheme);
      for (const role of ['primary', 'tertiary'] as const) {
        for (const surface of SEED_SURFACES) {
          const ratio = contrast(d[role]!, palette[surface]!, scheme);
          if (ratio < READABLE) failures.push(`${name} ${seed}: ${role} on ${surface} ${ratio.toFixed(2)}`);
        }
      }
      for (const [fg, bg] of [['primary-foreground', 'primary'], ['tertiary-foreground', 'tertiary'], ['accent-foreground', 'accent']] as const) {
        const ratio = contrast(d[fg]!, d[bg]!, scheme);
        if (ratio < READABLE) failures.push(`${name} ${seed}: ${fg} on ${bg} ${ratio.toFixed(2)}`);
      }
      if (d.ring !== d.primary) failures.push(`${name} ${seed}: ring is not primary`);
    }
  }
  assert.deepEqual(failures.slice(0, 10), [], `${failures.length} of ${all.length * grounds.length} seed × ground pairs fail`);
});

test('a seed that already reads is used as is; one that does not keeps its hue and moves just far enough', () => {
  const light = kitPalette('light');
  assert.equal(deriveSeedRoles('#0b6b55', light, 'light').primary, '#0b6b55', 'deep green reads on white');
  const lime = deriveSeedRoles('#c8f031', light, 'light').primary!;
  assert.notEqual(lime, '#c8f031');
  assert.ok(contrast(lime, '#ffffff') >= READABLE);
  // Darkened toward black, not replaced: still more green than red or blue.
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(lime.slice(i, i + 2), 16)) as [number, number, number];
  assert.ok(g > r && g > b, `${lime} keeps the hue`);
});

test('roles the brand set are kept, and accents follow the surfaces the brand set', () => {
  const cream = { ...kitPalette('light'), background: '#f4efe6', muted: '#e2d9c8' };
  const kept = deriveSeedRoles('#c8f031', { ...cream, primary: '#3b5d12' }, 'light', new Set(['primary']));
  assert.equal(kept.primary, undefined, 'a role the brand set is not returned');
  assert.equal(kept.ring, '#3b5d12', 'ring follows the brand primary');
  const onCream = deriveSeedRoles('#c8f031', cream, 'light');
  assert.ok(contrast(onCream.primary!, '#e2d9c8') >= READABLE, 'readable on the darker muted the brand set');
});

test('a brand file with a seed derives the accents in both schemes and passes every contrast rule', () => {
  const doc = { $extensions: { 'dev.fluxnative.brand': { schemaVersion: 1, scheme: 'system', seed: '#C8F031' } } };
  const report = validateBrand(brandLayers({ file: 'brand.tokens.json', doc }), kit);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.warnings.filter((w) => /no dark colours/.test(w.message)), [], 'the dark scheme derives from the seed');
  assert.ok(report.brand);
  assert.equal(report.brand.meta.seed, '#c8f031');
  for (const scheme of ['light', 'dark'] as const) {
    const palette = report.brand.colors[scheme];
    assert.notEqual(palette.primary, kitPalette(scheme).primary, `${scheme}: the seed replaced the kit's blue`);
    assert.ok(contrast(palette.primary!, palette.card!, scheme) >= READABLE);
  }
});

test('a brand without a seed resolves exactly as before', () => {
  const doc = { $extensions: { 'dev.fluxnative.brand': { schemaVersion: 1 } } };
  const report = validateBrand(brandLayers({ file: 'brand.tokens.json', doc }), kit);
  assert.ok(report.brand);
  assert.equal(report.brand.meta.seed, undefined);
  assert.equal(report.brand.colors.light.primary, '#007aff');
});

test('a seed that is not #rrggbb is an error', () => {
  const doc = { $extensions: { 'dev.fluxnative.brand': { schemaVersion: 1, seed: 'teal' } } };
  const report = validateBrand(brandLayers({ file: 'brand.tokens.json', doc }), kit);
  assert.ok(report.errors.some((e) => e.at.endsWith('.seed') && /#rrggbb/.test(e.message)));
});
