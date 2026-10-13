// Kit 0.6: the defaults the template factory's batch-02 had to fork or wrap
// (fluxbuilder-template, 13 October 2026).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FILES_DIR } from './emit.ts';
import { component, dirLayer, el, loader, render, type Props, type View } from './__tests__/render.ts';

const kit = loader([dirLayer(FILES_DIR)]);
const tokens = kit('theme/tokens.ts') as { colors: Record<'light' | 'dark', Record<string, string>>; type: Record<string, Props> };
const light = tokens.colors.light;

const allOf = (nodes: Array<View | string>, type: string): View[] =>
  nodes.flatMap((node) => (typeof node === 'string' ? [] : [...(node.type === type ? [node] : []), ...allOf(node.children, type)]));
const styleOf = (node: View) => (node.props.style ?? {}) as Props;
const textOf = (node: View | string): string => (typeof node === 'string' ? node : node.children.map(textOf).join(''));
const draw = (file: string, props: Props, device = {}) => render(kit, el(component(kit, file), props), device);
const noop = () => undefined;
const outputOf = (value: unknown) => ((value as Props).interpolate as { outputRange: unknown[] }).outputRange;

test('Rating countFormat full: every digit, grouped, in the text and the spoken name (r006 wrote its own "1,186 reviews")', () => {
  const full = draw('components/Rating.tsx', { value: 4.6, count: 1186, countLabel: 'reviews', countFormat: 'full' });
  assert.ok(allOf(full.view, 'Text').some((t) => textOf(t) === '1,186 reviews'));
  assert.match(String(allOf(full.view, 'View')[0]?.props.accessibilityLabel), /1,186 reviews/);
  const short = draw('components/Rating.tsx', { value: 4.6, count: 1186, countLabel: 'reviews' });
  assert.ok(allOf(short.view, 'Text').some((t) => textOf(t) === '1.2K reviews'), 'short by default');
});

test("Press keeps the caller's transform and adds its scale (r001's tilted card lost its rotate)", () => {
  const tilted = draw('components/Press.tsx', { onPress: noop, accessibilityLabel: 'Card', style: { transform: [{ rotate: '-4deg' }] }, children: el('Glyph') });
  const face = allOf(tilted.view, 'Animated.View')[0] as View;
  const transform = styleOf(face).transform as Props[];
  assert.deepEqual(transform[0], { rotate: '-4deg' });
  assert.ok('scale' in (transform[1] ?? {}), 'the press scale after it');
});

test('StatTile labelRole sets the label in a role (r001 wrapped it to get caps)', () => {
  const caps = draw('components/StatTile.tsx', { label: 'Streak', value: 12, labelRole: 'caps' });
  const label = allOf(caps.view, 'Text')[0] as View;
  assert.equal(styleOf(label).fontSize, tokens.type.caps?.fontSize);
  const plain = draw('components/StatTile.tsx', { label: 'Streak', value: 12 });
  assert.equal(styleOf(allOf(plain.view, 'Text')[0] as View).fontSize, tokens.type.bodySm?.fontSize, 'bodySm by default');
});

test('PageDots pill: faded dots at 55%, 3:1 on the ground (30% was 2.4:1, r001)', () => {
  const dots = draw('components/PageDots.tsx', { count: 3, index: 0 });
  assert.deepEqual(outputOf(styleOf(allOf(dots.view, 'Animated.View')[1] as View).opacity), [0.55, 1]);
});

test("StateView's action is primary in every tone (a secondary fill rested near 1.2:1 on a card, r023)", () => {
  const empty = draw('components/StateView.tsx', { title: 'No habits yet', actionLabel: 'Add a habit', onAction: noop, variant: 'card' });
  const fills = allOf(empty.view, 'Animated.View').map((v) => styleOf(v).backgroundColor);
  assert.ok(fills.includes(light.primary), 'a primary-filled button');
});

test('ProgressBar indeterminate under Reduce Motion: a still run in the middle, not an empty track (r099)', () => {
  const still = draw('components/ProgressBar.tsx', { indeterminate: true }, { reduced: true });
  const run = styleOf(allOf(still.view, 'Animated.View')[0] as View);
  assert.deepEqual([run.left, run.width], ['35%', '30%']);
});
