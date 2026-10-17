// Orb (K8): the assistant's mark for voice and AI moments, ported from
// voiceorbs (MIT). The template factory found glossy orbs flattened in about
// 8 of 10 voice/AI templates, each builder drawing its own.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { FILES_DIR, render as emit } from './emit.ts';
import { component, dirLayer, el, loader, render, type Props, type View } from './__tests__/render.ts';

const kit = loader([dirLayer(FILES_DIR)]);
const tokens = kit('theme/tokens.ts') as { colors: Record<'light' | 'dark', Record<string, string>> };
const orb = kit('components/Orb.tsx') as {
  clampOrbLevel: (level: number) => number;
  track: (cycles: number, shape: (u: number) => number, phase?: number, samples?: number) => { inputRange: number[]; outputRange: number[] };
};

const STATES = ['idle', 'connecting', 'listening', 'thinking', 'speaking', 'error', 'disabled'] as const;
const VARIANTS = ['glass', 'pulse'] as const;

const allOf = (nodes: Array<View | string>, type: string): View[] =>
  nodes.flatMap((node) => (typeof node === 'string' ? [] : [...(node.type === type ? [node] : []), ...allOf(node.children, type)]));
const draw = (props: Props, device = {}) => render(kit, el(component(kit, 'components/Orb.tsx'), props), device);
const starts = (mount: unknown[][]) => mount.filter((entry) => entry[0] === 'start');
const root = (view: Array<View | string>) => view[0] as View;
const stopColors = (view: Array<View | string>) => allOf(view, 'Stop').map((stop) => stop.props.stopColor);

test('Orb: both variants draw every state, light and dark, as one labelled image', () => {
  for (const variant of VARIANTS) {
    for (const state of STATES) {
      for (const scheme of ['light', 'dark'] as const) {
        const { view } = draw({ variant, state }, { scheme });
        const box = root(view);
        assert.equal(box.props.accessibilityRole, 'image', `${variant} ${state}`);
        assert.equal(box.props.accessible, true);
        assert.match(String(box.props.accessibilityLabel), /^Assistant /);
        assert.deepEqual([(box.props.style as Props).width, (box.props.style as Props).height], [160, 160]);
        assert.ok(allOf(view, 'Svg').length >= 2, `${variant} ${state} draws its layers`);
        assert.ok(allOf(view, 'Stop').length > 4, 'soft edges are gradient stops');
      }
    }
  }
});

test('Orb: the label follows the state; an explicit one wins', () => {
  assert.equal(root(draw({ state: 'listening' }).view).props.accessibilityLabel, 'Assistant listening');
  assert.equal(root(draw({ state: 'disabled' }).view).props.accessibilityLabel, 'Assistant unavailable');
  assert.equal(root(draw({ state: 'thinking', accessibilityLabel: 'Mira is thinking' }).view).props.accessibilityLabel, 'Mira is thinking');
});

test('Orb: one native-driver loop while live; paused and Reduce Motion start nothing', () => {
  for (const variant of VARIANTS) {
    for (const state of STATES) {
      const live = draw({ variant, state });
      const loops = starts(live.mount).filter((entry) => JSON.stringify(entry[1]).includes('"loop"'));
      assert.equal(loops.length, 1, `${variant} ${state}: one clock`);
      assert.match(JSON.stringify(loops[0]), /"useNativeDriver":true/);
      assert.deepEqual(starts(draw({ variant, state, paused: true, level: 0.6 }).mount), [], `${variant} ${state} paused`);
      assert.deepEqual(starts(draw({ variant, state, level: 0.6 }, { reduced: true }).mount), [], `${variant} ${state} reduced`);
    }
  }
});

test('Orb: a still frame is deterministic (two identical frames for the capture harness)', () => {
  for (const variant of VARIANTS) {
    for (const state of STATES) {
      const a = draw({ variant, state }, { reduced: true }).view;
      const b = draw({ variant, state }, { reduced: true }).view;
      assert.deepEqual(a, b);
      assert.doesNotMatch(JSON.stringify(a), /"interpolate"/, `${variant} ${state}: no animated value in a still frame`);
    }
  }
});

test('Orb: level is clamped to 0–1; negative means procedural', () => {
  assert.deepEqual([orb.clampOrbLevel(2), orb.clampOrbLevel(0.4), orb.clampOrbLevel(-1), orb.clampOrbLevel(Number.NaN)], [1, 0.4, 0, 0]);
  // The glass halo's opacity is 0.72 + 0.28 × level: level 7 reads as 1.
  const haloOpacity = (props: Props) => (allOf(draw({ ...props, paused: true }).view, 'Animated.View')[1]?.props.style as Props).opacity;
  assert.equal(haloOpacity({ level: 7 }), 1);
  assert.equal(haloOpacity({ level: 1 }), 1);
  assert.equal(haloOpacity({ level: 0 }), 0.72);
  assert.equal(haloOpacity({ level: -3 }), 0.72, 'idle rests at 0');
  // Live, the given level is sprung to, clamped.
  const springs = starts(draw({ level: 3, state: 'speaking' }).mount).filter((entry) => JSON.stringify(entry[1]).includes('"spring"'));
  assert.equal(springs.length, 1);
  assert.match(JSON.stringify(springs[0]), /"toValue":1[,}]/);
  assert.equal(starts(draw({ state: 'speaking' }).mount).filter((entry) => JSON.stringify(entry[1]).includes('"spring"')).length, 0, 'procedural: no spring');
});

test('Orb: thinking spins an arc; error is the destructive tone and shakes once; disabled is muted', () => {
  const light = tokens.colors.light;
  const paths = (props: Props) => allOf(draw({ ...props, paused: true }).view, 'Path').length;
  assert.ok(paths({ variant: 'pulse', state: 'thinking' }) > 0);
  assert.equal(paths({ variant: 'pulse', state: 'idle' }), 0, 'no arc unless thinking or connecting');
  assert.ok(paths({ variant: 'glass', state: 'thinking' }) > paths({ variant: 'glass', state: 'idle' }), 'the counter arc');

  const error = draw({ variant: 'pulse', state: 'error' });
  assert.ok(stopColors(error.view).includes(light.destructive));
  assert.ok(!stopColors(draw({ variant: 'pulse' }).view).includes(light.destructive));
  assert.ok(starts(error.mount).some((entry) => JSON.stringify(entry[1]).includes('"sequence"')), 'the shake');
  assert.ok(!starts(draw({ variant: 'pulse', state: 'error' }, { reduced: true }).mount).length);

  const disabled = allOf(draw({ state: 'disabled', paused: true }).view, 'Animated.View')[0];
  assert.equal((disabled?.props.style as Props).opacity, 0.5);
});

test('Orb: colours are theme roles (default primary → tertiary), never a hex prop', () => {
  const light = tokens.colors.light;
  const colors = stopColors(draw({ variant: 'pulse', paused: true }).view);
  assert.ok(colors.includes(light.primary) && colors.includes(light.tertiary));
  const swapped = stopColors(draw({ variant: 'pulse', paused: true, from: 'success', to: 'warning' }).view);
  assert.ok(swapped.includes(light.success) && swapped.includes(light.warning));
});

test('Orb: every loop is a whole number of cycles in the clock turn (seamless), its input strictly rising', () => {
  for (const [cycles, phase] of [
    [7, 0],
    [13, 1.1 / 3.1],
    [15, 2.3 / 3.6],
  ] as const) {
    const { inputRange, outputRange } = orb.track(cycles, (u) => Math.sin(Math.PI * u), phase, 6);
    assert.equal(inputRange[0], 0);
    assert.ok(Math.abs((inputRange.at(-1) ?? 0) - 1) < 1e-4);
    assert.ok(inputRange.every((x, i) => i === 0 || x > (inputRange[i - 1] ?? 0)));
    assert.ok(Math.abs((outputRange[0] ?? 0) - (outputRange.at(-1) ?? 1)) < 1e-9, 'ends where it starts');
  }
});

test('Orb: the MIT notice of the ported work travels in the source and in every emitted copy', () => {
  const source = readFileSync(join(FILES_DIR, 'components', 'Orb.tsx'), 'utf8');
  const emitted = emit({ only: ['Orb'] }).files;
  for (const text of [source, emitted['components/Orb.tsx'] ?? '']) {
    assert.match(text, /Adapted from voiceorbs glass-orb and pulse-orb, https:\/\/github\.com\/amunozdev\/voiceorbs/);
    assert.match(text, /Copyright \(c\) 2026 Alexis Munoz/);
    assert.match(text, /The above copyright notice and this permission notice shall be included in all\n\/\/ copies or substantial portions of the Software\./);
    assert.match(text, /THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND/);
  }
  assert.deepEqual(
    Object.keys(emitted).filter((rel) => rel.startsWith('components/')).sort(),
    ['components/Orb.tsx', 'components/bridge.ts', 'components/useReducedMotion.ts'],
    'Orb brings only Reduce Motion',
  );
  const notices = readFileSync(join(import.meta.dirname, '..', '..', '..', 'THIRD_PARTY_NOTICES.md'), 'utf8');
  assert.match(notices, /voiceorbs[\s\S]*Copyright \(c\) 2026 Alexis Munoz/);
});

test('Orb: the registry entry is a visual recipe for the AI moments, since 0.2.0, with the closed props', async () => {
  const { renderRegistry, readRegistryMeta } = await import('./registry.ts');
  const archetypes = (JSON.parse(readFileSync(join(import.meta.dirname, '..', 'registry.archetypes.json'), 'utf8')) as { archetypes: Record<string, unknown> }).archetypes;
  const meta = readRegistryMeta().Orb;
  assert.ok(meta);
  assert.equal(meta.recipeKind, 'visual');
  assert.equal(meta.since, '0.2.0');
  assert.deepEqual(meta.archetypes, ['ai-voice', 'ai-chat', 'ai-insight', 'ai-generate', 'onboarding']);
  assert.deepEqual(meta.archetypes.filter((id: string) => !(id in archetypes)), []);
  const entry = renderRegistry().components.find((c) => c.name === 'Orb');
  assert.ok(entry);
  assert.deepEqual(
    entry.props.map((p) => p.name),
    ['variant', 'size', 'from', 'to', 'state', 'level', 'speed', 'paused', 'accessibilityLabel', 'style'],
  );
  assert.equal(entry.props.find((p) => p.name === 'variant')?.type, "'glass'|'pulse'");
});
