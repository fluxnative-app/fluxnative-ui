// Kit 0.5: TabBar, from the 53 tab bars the template catalog drew by hand
// (fluxbuilder-template, 13 October 2026) and the iOS 26 / Material 3
// shapes on Mobbin (registry.meta.json).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FILES_DIR } from './emit.ts';
import { component, dirLayer, el, findAll, loader, render, type Props, type View } from './__tests__/render.ts';

const kit = loader([dirLayer(FILES_DIR)]);
const tokens = kit('theme/tokens.ts') as {
  colors: Record<'light' | 'dark', Record<string, string>>;
  layout: Record<string, number>;
  elevation: Record<string, Props>;
};
const light = tokens.colors.light;
const ROW = tokens.layout.tabBarHeight as number;
const GUTTER = tokens.layout.gutter as number;

const allOf = (nodes: Array<View | string>, type: string): View[] =>
  nodes.flatMap((node) => (typeof node === 'string' ? [] : [...(node.type === type ? [node] : []), ...allOf(node.children, type)]));
const firstOf = (nodes: Array<View | string>, type: string): View => {
  const hit = allOf(nodes, type)[0];
  if (hit === undefined) throw new Error(`no ${type}`);
  return hit;
};
const styleOf = (node: View) => (node.props.style ?? {}) as Props;
const textOf = (node: View | string): string => (typeof node === 'string' ? node : node.children.map(textOf).join(''));
const draw = (props: Props, device = {}) => render(kit, el(component(kit, 'components/TabBar.tsx'), props), device);
const tablist = (view: Array<View | string>) => allOf(view, 'View').find((node) => node.props.accessibilityRole === 'tablist') as View;
const tabsOf = (view: Array<View | string>) => allOf(view, 'Pressable').filter((node) => node.props.accessibilityRole === 'tab');

const ITEMS = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'search', label: 'Search', icon: 'search' },
  { key: 'bag', label: 'Bag', icon: 'bag', badge: 3 },
  { key: 'me', label: 'Profile', icon: 'person', badge: true },
];

test('TabBar: a tablist of tabs, the current one selected, labels shown, a count in the name, select and reselect', () => {
  const selected: string[] = [];
  const reselected: string[] = [];
  const bar = draw({ items: ITEMS, activeKey: 'home', onSelect: (k: string) => selected.push(k), onReselect: (k: string) => reselected.push(k), accessibilityLabel: 'Sections' });
  assert.equal(tablist(bar.view).props.accessibilityLabel, 'Sections');
  const tabs = tabsOf(bar.view);
  assert.deepEqual(
    tabs.map((t) => [t.props.accessibilityLabel, (t.props.accessibilityState as Props).selected]),
    [['Home', true], ['Search', false], ['Bag, 3', false], ['Profile', false]],
    'the count joins the name; a dot does not',
  );
  assert.deepEqual(allOf(bar.view, 'Text').map(textOf), ['Home', 'Search', '3', 'Bag', 'Profile'], 'labels always, the badge count drawn on the glyph');
  assert.deepEqual([selected, reselected], [['search', 'bag', 'me'], ['home']], 'a tap on the current tab reselects it');
  assert.ok(tabs.every((t) => (styleOf(t).minWidth as number) >= 44));

  const outside = draw({ items: ITEMS, activeKey: null, onSelect: () => undefined });
  assert.ok(tabsOf(outside.view).every((t) => (t.props.accessibilityState as Props).selected === false), 'null: no tab is current');
});

test('TabBar floating (default): an inset capsule over the content, the row from layout.tabBarHeight, elevation 3; a lens behind the current tab', () => {
  const capsule = draw({ items: ITEMS, activeKey: 'search', onSelect: () => undefined });
  const outer = firstOf(capsule.view, 'View');
  assert.deepEqual([styleOf(outer).position, styleOf(outer).left, styleOf(outer).right, styleOf(outer).bottom], ['absolute', GUTTER, GUTTER, GUTTER]);
  const list = tablist(capsule.view);
  assert.deepEqual([styleOf(list).height, styleOf(list).backgroundColor, styleOf(list).shadowRadius], [ROW, light.card, tokens.elevation['3']?.shadowRadius]);
  const current = tabsOf(capsule.view)[1] as View;
  const lens = allOf([current], 'View').find((node) => styleOf(node).position === 'absolute' && styleOf(node).backgroundColor === light.accent);
  assert.ok(lens, 'an accent lens behind the current tab');
  assert.equal(allOf([current], 'Text').map((t) => styleOf(t).color)[0], light['accent-foreground']);
  assert.equal(allOf([tabsOf(capsule.view)[0] as View], 'Text').map((t) => styleOf(t).color)[0], light['muted-foreground'], 'idle ink');

  const inFlow = draw({ items: ITEMS, activeKey: 'home', onSelect: () => undefined, overlay: false, bottom: 8 });
  assert.deepEqual([styleOf(firstOf(inFlow.view, 'View')).position, styleOf(firstOf(inFlow.view, 'View')).marginBottom], [undefined, 8]);
});

test('TabBar bar: full width under a hairline, the bottom as padding; with labels the lens is an M3 well behind the glyph', () => {
  const bar = draw({ items: ITEMS, activeKey: 'home', onSelect: () => undefined, shape: 'bar', bottom: 20 });
  assert.equal(styleOf(firstOf(bar.view, 'View')).position, undefined, 'a bar sits in the column by default');
  const list = tablist(bar.view);
  assert.deepEqual([styleOf(list).paddingBottom, styleOf(list).backgroundColor, styleOf(list).borderTopColor], [20, light.card, light['border-soft']]);
  const well = allOf([tabsOf(bar.view)[0] as View], 'View').find((node) => styleOf(node).width === 56 && styleOf(node).height === 32);
  assert.ok(well, 'a 56 x 32 well');
});

test('TabBar indicators: solid fills the current tab in primary (a disc with no labels), tint colours the glyph and keeps the label at text contrast', () => {
  const solid = draw({ items: ITEMS, activeKey: 'bag', onSelect: () => undefined, indicator: 'solid', labels: 'none' });
  assert.equal(allOf(solid.view, 'Text').filter((t) => textOf(t) === 'Bag').length, 0, 'no labels');
  const disc = allOf([tabsOf(solid.view)[2] as View], 'View').find((node) => styleOf(node).backgroundColor === light.primary);
  assert.ok(disc);
  assert.equal(styleOf(disc).width, ROW - 16, 'a disc 8 inside the row');
  assert.equal(styleOf(tablist(solid.view)).alignSelf, 'center', 'an icon-only capsule hugs its tabs and centres');
  assert.ok(tabsOf(solid.view).every((t) => styleOf(t).width === ROW - 8 && styleOf(t).flex === undefined), 'a slot 8 wider than its disc: the discs sit 8 apart');
  assert.equal(styleOf(tablist(draw({ items: ITEMS, activeKey: 'home', onSelect: () => undefined }).view)).alignSelf, undefined, 'with labels it spans the gutter');
  const glyph = findAll(solid.tree, 'Path').map((p) => p.props).find((p) => p.fill === light['primary-foreground']);
  assert.ok(glyph, 'the current kit glyph is filled in the fill ink');

  const active = draw({ items: ITEMS, activeKey: 'search', onSelect: () => undefined, indicator: 'solid', labels: 'active' });
  assert.deepEqual(allOf(active.view, 'Text').map(textOf), ['Search', '3'], 'only the current label (and the count)');
  assert.equal(styleOf(tabsOf(active.view)[1] as View).flex, 1.7, 'the current tab widens to carry its label');

  const tint = draw({ items: ITEMS, activeKey: 'home', onSelect: () => undefined, indicator: 'tint' });
  assert.equal(allOf([tabsOf(tint.view)[0] as View], 'Text').map((t) => styleOf(t).color)[0], light.foreground, 'label in foreground');
  assert.ok(findAll(tint.tree, 'Path').some((p) => p.props.fill === light.primary), 'glyph in primary, filled');
});

test('TabBar tones and actions: inverse and glass surfaces; an end disc beside the capsule, a centre disc raised between the tabs; tabBarClearance', () => {
  const inverse = draw({ items: ITEMS, activeKey: 'home', onSelect: () => undefined, tone: 'inverse', indicator: 'tint' });
  assert.equal(styleOf(tablist(inverse.view)).backgroundColor, light.inverse);
  const idle = allOf([tabsOf(inverse.view)[1] as View], 'Text').map((t) => styleOf(t).color)[0] as string;
  assert.match(idle, /^#[0-9a-f]{6}$/, 'a blended idle ink, not an opacity');
  assert.notEqual(idle, light['inverse-foreground']);
  const glass = draw({ items: ITEMS, activeKey: 'home', onSelect: () => undefined, tone: 'glass' });
  assert.deepEqual([styleOf(tablist(glass.view)).backgroundColor, styleOf(tablist(glass.view)).borderColor], [light['glass-fill'], light['glass-border']]);

  const pressed: string[] = [];
  const end = draw({ items: ITEMS.slice(0, 3), activeKey: 'home', onSelect: () => undefined, action: { icon: 'plus', accessibilityLabel: 'New note', onPress: () => pressed.push('end') } });
  const add = allOf(end.view, 'Pressable').find((node) => node.props.accessibilityLabel === 'New note');
  assert.ok(add);
  assert.deepEqual([add.props.accessibilityRole, styleOf(add).width], ['button', ROW], 'a round button the row tall');
  assert.equal(tablist(end.view).children.filter((c) => typeof c !== 'string' && c.props.accessibilityLabel === 'New note').length, 0, 'outside the tablist');

  const center = draw({ items: ITEMS, activeKey: 'home', onSelect: () => undefined, shape: 'bar', action: { icon: 'scan', accessibilityLabel: 'Scan', onPress: () => pressed.push('center'), placement: 'center' } });
  const scan = allOf(center.view, 'Pressable').find((node) => node.props.accessibilityLabel === 'Scan') as View;
  assert.deepEqual([styleOf(scan).position, styleOf(scan).top], ['absolute', -20], 'raised 16 above the bar, plus its 4 px ring');
  const order = tablist(center.view).children.filter((c): c is View => typeof c !== 'string').map((c) => c.props.accessibilityLabel ?? 'slot');
  assert.deepEqual(order, ['Home', 'Search', 'slot', 'Bag, 3', 'Profile'], 'two tabs either side');
  assert.deepEqual(pressed, ['end', 'center']);

  const clearance = kit('components/TabBar.tsx').tabBarClearance as (shape?: string, bottom?: number, raised?: boolean) => number;
  assert.deepEqual([clearance(), clearance('bar', 0), clearance('bar', 16, true)], [ROW + GUTTER + 8, ROW, ROW + 16 + 16]);
});

test('Chip with the tab role reports selected, not checked (a tab bar built from chips was never announced as current)', () => {
  const chip = draw0('components/Chip.tsx', { label: 'Radar', selected: true, accessibilityRole: 'tab', onPress: () => undefined });
  assert.deepEqual(firstOf(chip.view, 'Pressable').props.accessibilityState, { selected: true, disabled: false });
  const radio = draw0('components/Chip.tsx', { label: 'M', selected: true, accessibilityRole: 'radio', onPress: () => undefined });
  assert.deepEqual(firstOf(radio.view, 'Pressable').props.accessibilityState, { checked: true, disabled: false });
});

function draw0(file: string, props: Props) {
  return render(kit, el(component(kit, file), props));
}

test('no recipe places an absolute view with alignSelf: Yoga centres it, but the web sizes it to its content (the TabBar disc drew 0 tall)', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const dirs = [join(FILES_DIR, 'components'), join(FILES_DIR, 'components', 'commerce')];
  const hits = dirs.flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => f.endsWith('.tsx'))
      .flatMap((f) => readFileSync(join(dir, f), 'utf8').split('\n').map((line, i) => [f, i + 1, line] as const))
      .filter(([, , line]) => /position: 'absolute'/.test(line) && /alignSelf/.test(line) && !line.trim().startsWith('//')),
  );
  assert.deepEqual(hits, []);
});
