// Kit K12: Press reaches the 44 pt touch target by itself. It measures its
// box and grows the hit slop on each axis that is short of `minTarget`,
// never under the brand's `interaction.press.hitSlop`; an explicit
// `hitSlop` wins, `minTarget={false}` keeps the brand's slop only. The
// template factory failed the 44 pt check in nearly every batch because
// reaching it was left to each caller.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FILES_DIR } from './emit.ts';
import { component, dirLayer, el, findAll, loader, render, type Exports, type Layer, type Loader, type Props } from './__tests__/render.ts';

type Insets = { top: number; bottom: number; left: number; right: number };
type Slop = (width: number, height: number, base: number, min?: number | false) => Insets;
type State = (initial: unknown) => [unknown, (next: unknown) => void];

/** A module that hands the test the renderer's React stub, so a test can lay out a Press. */
const probe: Layer = (rel) => (rel === 'probe.ts' ? "import React from 'react';\nexport default React;\n" : undefined);
const kit = loader([probe, dirLayer(FILES_DIR)]);
const tokens = kit('theme/tokens.ts') as Exports & { interaction: { press: Props } };

function branded(hitSlop: number): Loader {
  return loader([probe, dirLayer(FILES_DIR)], {
    'theme/tokens.ts': { ...tokens, interaction: { ...tokens.interaction, press: { ...tokens.interaction.press, hitSlop } } },
  });
}

const insets = (across: number, along: number): Insets => ({ top: along, bottom: along, left: across, right: across });
const pressable = (load: Loader, props: Props) => {
  const node = findAll(render(load, el(component(load, 'components/Press.tsx'), { accessibilityLabel: 'Go', ...props })).tree, 'Pressable')[0];
  assert.ok(node, 'a Pressable');
  return node.props;
};

/** Renders a Press as if its box had been laid out at `width` × `height`: the first layout event, then the render after it. */
function laidOut(load: Loader, props: Props, width: number, height: number): Props {
  const react = load('probe.ts').default as { useState: State };
  const original = react.useState;
  let box: unknown = null;
  // Press's only state starts at null (no layout yet); the reduced-motion hook's does not.
  react.useState = (initial) => (initial === null ? [box, (next) => (box = typeof next === 'function' ? (next as (current: unknown) => unknown)(box) : next)] : original(initial));
  try {
    const first = pressable(load, props);
    const onLayout = first.onLayout as ((event: unknown) => void) | undefined;
    assert.ok(onLayout, 'Press measures its box');
    onLayout({ nativeEvent: { layout: { x: 0, y: 0, width, height } } });
    return pressable(load, props);
  } finally {
    react.useState = original;
  }
}

test('minTargetSlop: grows each short axis to the target, never under the base', () => {
  const slop = kit('components/Press.tsx').minTargetSlop as Slop;
  assert.equal(kit('components/Press.tsx').MIN_TARGET, 44);
  assert.deepEqual(slop(24, 24, 0), insets(10, 10), 'a 24 pt glyph: 10 each side');
  assert.deepEqual(slop(120, 32, 0), insets(0, 6), 'a wide 32 pt chip grows only in height');
  assert.deepEqual(slop(30, 60, 0), insets(7, 0), 'a narrow tall box grows only in width');
  assert.deepEqual(slop(44, 44, 0), insets(0, 0), 'exactly 44: nothing');
  assert.deepEqual(slop(80, 56, 0), insets(0, 0), 'over 44: nothing');
  assert.deepEqual(slop(43, 41, 0), insets(1, 2), 'odd shortfalls round up to reach 44');
  assert.deepEqual(slop(40, 40, 8), insets(8, 8), 'the base wins when it is larger');
  assert.deepEqual(slop(20, 100, 8), insets(12, 8), 'the growth wins when it is larger');
  assert.deepEqual(slop(24, 24, 0, 48), insets(12, 12), 'a custom target');
  assert.deepEqual(slop(24, 24, 0, false), insets(0, 0), 'false: the base only');
  assert.deepEqual(slop(24, 24, 6, false), insets(6, 6));
});

test('Press: the brand slop before layout, then a 44 pt target; an explicit hitSlop and minTarget={false} keep today', () => {
  assert.equal(pressable(kit, {}).hitSlop, 0, 'before the first layout event: the kit slop, as before');
  assert.deepEqual(laidOut(kit, {}, 24, 24).hitSlop, insets(10, 10));
  assert.deepEqual(laidOut(kit, {}, 160, 36).hitSlop, insets(0, 4), 'a 36 pt button grows 4 above and below');
  assert.deepEqual(laidOut(kit, {}, 160, 56).hitSlop, insets(0, 0), 'a big box keeps its own size');
  assert.deepEqual(laidOut(kit, { minTarget: 48 }, 24, 24).hitSlop, insets(12, 12));

  const own = pressable(kit, { hitSlop: 3 });
  assert.equal(own.hitSlop, 3, 'an explicit hitSlop wins');
  assert.equal('onLayout' in own, false, 'and nothing is measured');
  const dense = pressable(kit, { minTarget: false });
  assert.equal(dense.hitSlop, 0, 'minTarget false: the brand slop');
  assert.equal('onLayout' in dense, false);

  const brand = branded(6);
  assert.equal(pressable(brand, {}).hitSlop, 6, "the brand's slop before layout");
  assert.deepEqual(laidOut(brand, {}, 200, 40).hitSlop, insets(6, 6), "never under the brand's slop");
  assert.deepEqual(laidOut(brand, {}, 20, 40).hitSlop, insets(12, 6));
  assert.equal(pressable(brand, { minTarget: false }).hitSlop, 6);
});

test('textActionSlop still gives a text action its 44 pt line', () => {
  const textActionSlop = kit('components/Press.tsx').textActionSlop as (height: number) => number;
  assert.equal(textActionSlop(20), 12);
  assert.equal(textActionSlop(50), 0);
  assert.equal((branded(14)('components/Press.tsx').textActionSlop as (height: number) => number)(20), 14);
});

test('the recipes that compute their own slop keep it (no double slop): it wins over the measured one', () => {
  const draw = (file: string, props: Props) => findAll(render(kit, el(component(kit, file), props)).tree, 'Pressable');
  const glyph = el('Glyph', { name: 'bag' });
  const cases: Array<[string, Props]> = [
    ['components/IconButton.tsx', { children: glyph, accessibilityLabel: 'Bag', size: 'sm' }],
    ['components/Toggle.tsx', { value: false, onValueChange: () => undefined, accessibilityLabel: 'Wi-Fi' }],
    ['components/Stepper.tsx', { value: 1, onChange: () => undefined, accessibilityLabel: 'Quantity' }],
    ['components/Rating.tsx', { value: 3, onChange: () => undefined, accessibilityLabel: 'Rating' }],
    ['components/SegmentedControl.tsx', { segments: ['Day', 'Week'], selectedIndex: 0, onChange: () => undefined }],
  ];
  for (const [file, props] of cases) {
    const nodes = draw(file, props);
    assert.ok(nodes.length > 0, `${file}: a Pressable`);
    for (const node of nodes) {
      assert.equal(typeof node.props.hitSlop, 'number', `${file}: its own slop`);
      assert.equal('onLayout' in node.props, false, `${file}: not measured on top`);
    }
  }
  // The recipes without their own slop reach 44 pt through Press.
  for (const [file, props] of [
    ['components/Button.tsx', { label: 'Pay', size: 'sm' }],
    ['components/Chip.tsx', { label: 'M', round: true, onPress: () => undefined }],
    ['components/ListRow.tsx', { title: 'Account', onPress: () => undefined }],
  ] as Array<[string, Props]>) {
    assert.equal(typeof draw(file, props)[0]?.props.onLayout, 'function', `${file}: measured by Press`);
  }
});
