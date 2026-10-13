// The 0.3 recipes, from the template catalog's top learn candidates and
// grounded on Mobbin (registry.meta.json): SkeletonRows and StatTile.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FILES_DIR } from './emit.ts';
import { component, dirLayer, el, findAll, loader, render, type HostNode, type Props, type View } from './__tests__/render.ts';

const kit = loader([dirLayer(FILES_DIR)]);
const tokens = kit('theme/tokens.ts') as { colors: Record<'light' | 'dark', Record<string, string>>; shape: Record<string, number>; type: Record<string, Props>; layout: Record<string, number> };
const light = tokens.colors.light;
const dark = tokens.colors.dark;

const allOf = (nodes: Array<View | string>, type: string): View[] =>
  nodes.flatMap((node) => (typeof node === 'string' ? [] : [...(node.type === type ? [node] : []), ...allOf(node.children, type)]));
const firstOf = (nodes: Array<View | string>, type: string): View => {
  const hit = allOf(nodes, type)[0];
  if (hit === undefined) throw new Error(`no ${type}`);
  return hit;
};
const styleOf = (node: View) => node.props.style as Props;
const textOf = (node: View): string => node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
const draw = (file: string, props: Props, device = {}) => render(kit, el(component(kit, file), props), device);
const findPath = (tree: Array<HostNode | string>) => findAll(tree, 'Path')[0]?.props.d;

test('SkeletonRows: rows of a leading shape and bars, one busy "Loading" element, dividers and a trailing pair on request', () => {
  const list = draw('components/SkeletonRows.tsx', {});
  const root = firstOf(list.view, 'View');
  assert.deepEqual([root.props.accessible, root.props.accessibilityRole, root.props.accessibilityLabel, root.props.accessibilityState], [true, 'progressbar', 'Loading', { busy: true }]);
  const rows = root.children.filter((child): child is View => typeof child !== 'string');
  assert.equal(rows.length, 4, 'four rows by default');
  const blocks = allOf([rows[0] as View], 'Animated.View');
  assert.equal(blocks.length, 3, 'a circle and two bars');
  assert.deepEqual([styleOf(blocks[0] as View).width, styleOf(blocks[0] as View).borderRadius], [44, 22], 'a 44 px circle');
  assert.deepEqual([styleOf(blocks[1] as View).width, styleOf(blocks[2] as View).width], ['72%', '46%'], 'the second bar is shorter');
  assert.equal(styleOf(rows[0] as View).paddingHorizontal, tokens.layout.gutter);

  const dense = draw('components/SkeletonRows.tsx', { count: 3, leading: 'square', lines: 3, trailing: true, dividers: true, size: 56, accessibilityLabel: 'Loading orders' });
  const denseRoot = firstOf(dense.view, 'View');
  const denseRows = denseRoot.children.filter((child): child is View => typeof child !== 'string');
  assert.equal(denseRoot.props.accessibilityLabel, 'Loading orders');
  assert.equal(allOf([denseRows[0] as View], 'Animated.View').length, 1 + 3 + 2, 'a square, three bars, a trailing pair');
  assert.equal(styleOf(allOf([denseRows[0] as View], 'Animated.View')[0] as View).borderRadius, tokens.shape.well, 'square corners follow shape.well');
  assert.equal(styleOf(denseRows[0] as View).borderBottomColor, light['border-soft']);
  assert.equal(styleOf(denseRows[2] as View).borderBottomWidth, undefined, 'no rule after the last row');
  assert.equal(allOf([firstOf(draw('components/SkeletonRows.tsx', { leading: 'none', lines: 9 }).view, 'View')], 'Animated.View').length, 4 * 3, 'no leading shape; lines clamp to 3');
});

test('StatTile: label, tabular value and unit, a trend chip that passes contrast, one spoken element, a button with onPress', () => {
  const tile = draw('components/StatTile.tsx', { label: 'Resting heart rate', value: 51, unit: 'bpm', delta: '−3', caption: 'Today' });
  const root = firstOf(tile.view, 'View');
  assert.deepEqual([root.props.accessible, root.props.accessibilityLabel], [true, 'Resting heart rate, 51 bpm, −3, Today']);
  assert.deepEqual([styleOf(root).backgroundColor, styleOf(root).borderRadius], [light.card, tokens.shape.card]);
  const texts = allOf(tile.view, 'Text');
  assert.deepEqual(texts.map(textOf), ['Resting heart rate', '−3', '51', 'bpm', 'Today']);
  const value = styleOf(texts[2] as View);
  assert.deepEqual([value.fontSize, value.fontVariant, value.color], [tokens.type.headline?.fontSize, ['tabular-nums'], light['card-foreground']]);
  const chip = allOf(tile.view, 'View').find((node) => styleOf(node)?.borderRadius === tokens.shape.control);
  assert.ok(chip, 'a pill chip');
  assert.deepEqual([styleOf(chip).backgroundColor, styleOf(texts[1] as View).color], [light.destructive, light['destructive-foreground']], '− reads as down');

  const up = draw('components/StatTile.tsx', { label: 'Total volume', value: '6.6K', delta: '+6,613', size: 'lg', variant: 'plain' });
  const upTexts = allOf(up.view, 'Text');
  assert.equal(styleOf(upTexts[1] as View).color, light['success-foreground'], '+ reads as up');
  assert.equal(styleOf(upTexts[2] as View).fontSize, tokens.type.display?.fontSize, 'lg sets the value in the display role');
  assert.equal(styleOf(firstOf(up.view, 'View')).backgroundColor, undefined, 'plain has no surface');
  assert.equal(styleOf(upTexts[2] as View).color, light.foreground);

  const pressed: unknown[] = [];
  const button = draw('components/StatTile.tsx', { label: 'Workouts', value: 6, onPress: () => pressed.push(1), trend: 'neutral', delta: '0' }, { scheme: 'dark' });
  const press = firstOf(button.view, 'Pressable');
  assert.deepEqual([press.props.accessibilityRole, press.props.accessibilityLabel], ['button', 'Workouts, 6, 0']);
  assert.equal(styleOf(allOf(button.view, 'Text')[1] as View).color, dark['muted-foreground'], 'neutral uses the muted ink');
  button.presses.forEach(() => undefined);
  assert.equal(pressed.length, 1);
  assert.equal((kit('components/StatTile.tsx').trendOf as (d?: string) => string)('12%'), 'neutral');
});

test('batch-01 fixes: a 44 pt send at full colour, 44 pt segments, StatTile value role and colour, a fixed back glyph, AiBadge mark', () => {
  // Composer: the send button is md (44) and not disabled while empty; an empty send does nothing.
  const sent: string[] = [];
  const composer = draw('components/Composer.tsx', { value: '', onChangeText: () => undefined, onSend: (t: string) => sent.push(t), onStop: () => undefined, streaming: false });
  const send = allOf(composer.view, 'Pressable').find((node) => node.props.accessibilityLabel === 'Send');
  assert.ok(send, 'a Send button');
  assert.notEqual(send.props.disabled, true, 'full colour at rest');
  // Press puts the width on the Pressable and the height on its face.
  assert.deepEqual([styleOf(send).width, styleOf(allOf([send], 'Animated.View')[0] as View).height], [44, 44], 'a 44 x 44 button');
  composer.presses.forEach(() => undefined);
  assert.deepEqual(sent, [], 'an empty send does nothing');

  // SegmentedControl: a 44 px track and each segment padded to a 44 px target.
  const segmented = draw('components/SegmentedControl.tsx', { segments: ['Day', 'Week'], selectedIndex: 0, onChange: () => undefined });
  const tab = allOf(segmented.view, 'Pressable')[0];
  assert.ok(tab);
  assert.equal(tab.props.hitSlop, (44 - (44 - 6)) / 2);

  // StatTile: a value role carries a brand's number face; a value colour role.
  const tile = draw('components/StatTile.tsx', { label: 'Streak', value: 14, valueRole: 'numeric', valueColor: 'primary' });
  const value = allOf(tile.view, 'Text')[1] as View;
  assert.deepEqual([styleOf(value).fontSize, styleOf(value).color, styleOf(value).fontVariant], [tokens.type.numeric?.fontSize, light.primary, ['tabular-nums']]);

  // ScreenHeader: one glyph on every platform when the design asks for it.
  const icons = kit('components/Icon.tsx').ICONS as Record<string, { path: string }>;
  const chevronOnAndroid = draw('components/ScreenHeader.tsx', { title: 'Back', onBack: () => undefined, backIcon: 'chevron' }, { os: 'android' });
  assert.equal(findPath(chevronOnAndroid.tree), icons['chevron-left']?.path);
  const arrowOnIos = draw('components/ScreenHeader.tsx', { title: 'Back', onBack: () => undefined, backIcon: 'arrow' });
  assert.equal(findPath(arrowOnIos.tree), icons['arrow-left']?.path);

  // AiBadge: the brand's mark instead of the sparkle, or none.
  const marked = draw('components/AiBadge.tsx', { mark: { type: 'BrandMark', props: {}, key: null } });
  assert.equal(allOf(marked.view, 'BrandMark').length, 1);
  assert.equal(allOf(draw('components/AiBadge.tsx', { mark: null }).view, 'Svg').length, 0, 'no sparkle');
  assert.equal(allOf(draw('components/AiBadge.tsx', {}).view, 'Svg').length, 1, 'the sparkle by default');
});
