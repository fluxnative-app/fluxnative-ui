// Kit 0.4: what the learn report over the merged template catalog found it
// forking or wrapping (fluxbuilder-template, 13 October 2026). Each test
// names the template whose fork or composition the recipe now covers.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FILES_DIR } from './emit.ts';
import { component, dirLayer, el, findAll, loader, render, type Props, type View } from './__tests__/render.ts';

const kit = loader([dirLayer(FILES_DIR)]);
const tokens = kit('theme/tokens.ts') as { type: Record<string, Props>; shape: Record<string, number> };
const LINE = tokens.type.body?.lineHeight as number;
const LABEL_LINE = tokens.type.label?.lineHeight as number;

const allOf = (nodes: Array<View | string>, type: string): View[] =>
  nodes.flatMap((node) => (typeof node === 'string' ? [] : [...(node.type === type ? [node] : []), ...allOf(node.children, type)]));
const firstOf = (nodes: Array<View | string>, type: string): View => {
  const hit = allOf(nodes, type)[0];
  if (hit === undefined) throw new Error(`no ${type}`);
  return hit;
};
const styleOf = (node: View) => node.props.style as Props;
const draw = (file: string, props: Props, device = {}) => render(kit, el(component(kit, file), props), device);
const noop = () => undefined;
const outputOf = (value: unknown) => ((value as Props).interpolate as { outputRange: unknown[] }).outputRange;

test('Composer (sinew-ai-coach): a 52 pt field with the 44 pt send 4 pt in, a blank-field tap focuses the field, disabled keeps the placeholder legible', () => {
  const sent: string[] = [];
  const blank = draw('components/Composer.tsx', { value: '', onChangeText: noop, onSend: (t: string) => sent.push(t), onStop: noop, streaming: false });
  const input = firstOf(blank.view, 'TextInput');
  assert.deepEqual([styleOf(input).minHeight, styleOf(input).paddingTop], [52, (52 - LINE) / 2], 'one line is 52 pt');
  const send = allOf(blank.view, 'Pressable').find((node) => node.props.accessibilityLabel === 'Send');
  assert.ok(send);
  assert.equal(styleOf(send).marginBottom, 4, '4 pt under the 44 pt send: centred on one line');

  // The renderer pressed every Pressable once with no field mounted; mount one and tap again.
  const focused: number[] = [];
  const ref = findAll(blank.tree, 'TextInput')[0]?.props.ref as { current: unknown };
  ref.current = { focus: () => focused.push(1) };
  const tap = findAll(blank.tree, 'Pressable').find((node) => node.props.accessibilityLabel === 'Send')?.props.onPress as (event: unknown) => void;
  tap({});
  assert.deepEqual([focused.length, sent.length], [1, 0], 'a blank tap focuses the field and sends nothing');

  const typed = draw('components/Composer.tsx', { value: ' 3 sets? ', onChangeText: noop, onSend: (t: string) => sent.push(t), onStop: noop, streaming: false });
  assert.ok(typed.presses.length > 0);
  assert.deepEqual(sent, ['3 sets?'], 'text is sent trimmed');

  const off = draw('components/Composer.tsx', { value: '', onChangeText: noop, onSend: noop, onStop: noop, streaming: false, disabled: true, placeholder: 'Plans refill at 06:00' });
  const field = firstOf(off.view, 'TextInput');
  assert.deepEqual([field.props.editable, field.props.accessibilityState], [false, { disabled: true }]);
  assert.ok(allOf(off.view, 'View').every((node) => styleOf(node)?.opacity === undefined), 'no faded field: the placeholder says why');
  assert.equal(allOf(off.view, 'Pressable').find((node) => node.props.accessibilityLabel === 'Send')?.props.disabled, true, 'the send dims');
});

test('SearchField readOnly (orvia-health): not editable, full strength, the clear button off; disabled still fades', () => {
  const read = draw('components/SearchField.tsx', { value: '', onChangeText: noop, placeholder: 'Three questions left tomorrow', readOnly: true });
  const input = firstOf(read.view, 'TextInput');
  assert.deepEqual([input.props.editable, input.props.accessibilityState], [false, { disabled: true }]);
  assert.ok(allOf(read.view, 'View').every((node) => styleOf(node)?.opacity === undefined), 'full strength');
  const typed = draw('components/SearchField.tsx', { value: 'sleep', onChangeText: noop, readOnly: true });
  assert.equal(firstOf(typed.view, 'Pressable').props.disabled, true, 'no clearing a read-only field');

  const off = draw('components/SearchField.tsx', { value: '', onChangeText: noop, disabled: true });
  assert.ok(allOf(off.view, 'View').some((node) => styleOf(node)?.opacity === 0.45), 'disabled fades');
});

test('ProgressBar square (gridfront-weather): radius 0 on the track and the run; the pill by default', () => {
  const square = draw('components/ProgressBar.tsx', { progress: 0.4, height: 12, square: true });
  const track = allOf(square.view, 'View').at(-1) as View;
  assert.deepEqual([styleOf(track).borderRadius, styleOf(firstOf(square.view, 'Animated.View')).borderRadius], [0, 0]);
  const pill = draw('components/ProgressBar.tsx', { progress: 0.4, height: 12 });
  assert.equal(styleOf(allOf(pill.view, 'View').at(-1) as View).borderRadius, Math.min(tokens.shape.control as number, 6));
});

test('PageDots dots (laudine-designer-boutique): equal round dots, the others at 55% so both the dot and the page read at 3:1', () => {
  const dots = draw('components/PageDots.tsx', { count: 3, index: 1, variant: 'dots' });
  const current = styleOf(allOf(dots.view, 'Animated.View')[1] as View);
  assert.deepEqual([outputOf(current.width), outputOf(current.opacity), current.borderRadius], [[8, 8], [0.55, 1], 4]);
  const pill = styleOf(allOf(draw('components/PageDots.tsx', { count: 3, index: 1 }).view, 'Animated.View')[1] as View);
  assert.deepEqual([outputOf(pill.width), outputOf(pill.opacity)], [[8, 24], [0.55, 1]], 'the pill by default; its faded dots at 55% since 0.6 (3:1 on every catalog palette)');
});

test('text actions reach 44 pt (dimity-assistant measured 34): Notice, SectionHeader, Snackbar, SearchField Cancel, TextField Show', () => {
  const slop = (44 - LABEL_LINE) / 2;
  assert.equal((kit('components/Press.tsx').textActionSlop as (h: number) => number)(LABEL_LINE), slop);
  const actions: Array<[string, Props, string]> = [
    ['components/Notice.tsx', { message: 'Card declined', actionLabel: 'Try again', onAction: noop }, 'Try again'],
    ['components/SectionHeader.tsx', { title: 'Saved', action: 'See all', onAction: noop }, 'See all'],
    ['components/Snackbar.tsx', { visible: true, message: 'Removed', actionLabel: 'Undo', onAction: noop, onDismiss: noop }, 'Undo'],
    ['components/SearchField.tsx', { value: '', onChangeText: noop, onCancel: noop }, 'Cancel'],
    ['components/TextField.tsx', { label: 'Password', value: '', onChangeText: noop, kind: 'password' }, 'Show password'],
  ];
  for (const [file, props, label] of actions) {
    const action = allOf(draw(file, props).view, 'Pressable').find((node) => node.props.accessibilityLabel === label);
    assert.ok(action, `${file}: ${label}`);
    assert.equal(action.props.hitSlop, slop, `${file}: a ${LABEL_LINE} pt line plus ${slop} each side is 44`);
  }
});
