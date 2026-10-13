// The 0.2 recipes, rendered in node against the kit tokens: what each one
// draws (host views, styles from the token roles), what it tells a screen
// reader, and what a press does. Evidence for each recipe is in
// `registry.meta.json`: the hand-written copies found across the template
// catalog, and the real apps on Mobbin it was shaped after.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FILES_DIR } from './emit.ts';
import { component, dirLayer, el, findAll, loader, render, type HostNode, type Props, type View } from './__tests__/render.ts';

const kit = loader([dirLayer(FILES_DIR)]);
const tokens = kit('theme/tokens.ts') as {
  colors: Record<'light' | 'dark', Record<string, string>>;
  shape: Record<string, number>;
  type: Record<string, Props>;
  chrome: Record<string, number>;
  layout: Record<string, number>;
};
const light = tokens.colors.light;
const noop = () => undefined;
const glyph = el('Glyph', { name: 'bag' });

const allOf = (nodes: Array<View | string>, type: string): View[] =>
  nodes.flatMap((node) => (typeof node === 'string' ? [] : [...(node.type === type ? [node] : []), ...allOf(node.children, type)]));
const firstOf = (nodes: Array<View | string>, type: string): View => {
  const hit = allOf(nodes, type)[0];
  if (hit === undefined) throw new Error(`no ${type}`);
  return hit;
};
const styleOf = (node: View) => node.props.style as Props;
const textOf = (node: View): string => node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
const texts = (nodes: Array<View | string>) => allOf(nodes, 'Text').map(textOf);
const draw = (file: string, props: Props, device = {}) => render(kit, el(component(kit, file), props), device);

test('Divider: a hairline in border-soft (border when strong), inset by px or the gutter, vertical when asked', () => {
  const plain = styleOf(firstOf(draw('components/Divider.tsx', {}).view, 'View'));
  assert.deepEqual([plain.height, plain.backgroundColor, plain.marginLeft], [0.5, light['border-soft'], 0]);
  const inset = styleOf(firstOf(draw('components/Divider.tsx', { inset: true, strong: true, margin: 8 }).view, 'View'));
  assert.deepEqual([inset.marginLeft, inset.backgroundColor, inset.marginVertical], [tokens.layout.gutter, light.border, 8]);
  const column = styleOf(firstOf(draw('components/Divider.tsx', { vertical: true, inset: 12 }).view, 'View'));
  assert.deepEqual([column.width, column.alignSelf, column.marginTop], [0.5, 'stretch', 12]);
  assert.equal(firstOf(draw('components/Divider.tsx', {}).view, 'View').props.accessibilityElementsHidden, true);
});

test('ScreenHeader: a 44 px row, a back IconButton named Back, the title centred over the row or at the start, a large title under it', () => {
  const back: unknown[] = [];
  const centred = draw('components/ScreenHeader.tsx', { title: 'Overview', onBack: () => back.push(1), trailing: glyph });
  assert.equal(styleOf(firstOf(centred.view, 'View').children[0] as View).height, tokens.chrome.appBarHeight);
  const button = firstOf(centred.view, 'Pressable');
  assert.equal(button.props.accessibilityLabel, 'Back');
  assert.equal(findAll(centred.tree, 'Path')[0]?.props.d, (kit('components/Icon.tsx').ICONS as Record<string, { path: string }>)['chevron-left']?.path, 'iOS draws a chevron');
  const title = firstOf(centred.view, 'Text');
  assert.deepEqual([title.props.accessibilityRole, textOf(title), styleOf(title).fontSize], ['header', 'Overview', tokens.type.title?.fontSize]);
  assert.equal(styleOf(title.children.length ? title : title).fontSize, tokens.type.title?.fontSize);
  assert.equal(allOf(centred.view, 'Glyph').length, 1, 'the trailing slot renders');
  centred.presses.forEach(noop);
  assert.equal(back.length, 1);

  const android = draw('components/ScreenHeader.tsx', { title: 'Overview', onBack: noop }, { os: 'android' });
  assert.equal(findAll(android.tree, 'Path')[0]?.props.d, (kit('components/Icon.tsx').ICONS as Record<string, { path: string }>)['arrow-left']?.path, 'Android draws an arrow');

  const start = draw('components/ScreenHeader.tsx', { title: 'Orders' });
  assert.equal(styleOf(firstOf(start.view, 'Text')).flex, 1, 'no leading: the title sits at the start');

  const large = draw('components/ScreenHeader.tsx', { title: 'Discover', eyebrow: 'Today', large: true, onBack: noop });
  assert.deepEqual(texts(large.view), ['TODAY', 'Discover']);
  assert.equal(styleOf(allOf(large.view, 'Text')[1] as View).fontSize, tokens.type.display?.fontSize);
});

test('SearchField: a muted pill with the search glyph, a field named by its placeholder, a clear button only with text, Cancel on demand', () => {
  const changes: string[] = [];
  const empty = draw('components/SearchField.tsx', { value: '', onChangeText: (t: string) => changes.push(t), trailing: glyph });
  const box = allOf(empty.view, 'View')[1] as View;
  assert.deepEqual([styleOf(box).height, styleOf(box).borderRadius, styleOf(box).backgroundColor], [40, tokens.shape.chip, light.muted]);
  const input = firstOf(empty.view, 'TextInput');
  assert.deepEqual([input.props.accessibilityLabel, input.props.returnKeyType, input.props.autoCapitalize], ['Search', 'search', 'none']);
  assert.equal(allOf(empty.view, 'Pressable').length, 0, 'no clear button without text');
  assert.equal(allOf(empty.view, 'Glyph').length, 1, 'the trailing slot shows while empty');

  const typed = draw('components/SearchField.tsx', { value: 'cali', onChangeText: (t: string) => changes.push(t), onCancel: noop, variant: 'field', size: 'lg', placeholder: 'Search stocks' });
  const [clear, cancel] = allOf(typed.view, 'Pressable') as [View, View];
  assert.equal(clear.props.accessibilityLabel, 'Clear search');
  assert.equal(cancel.props.accessibilityLabel, 'Cancel');
  assert.equal(allOf(typed.view, 'Glyph').length, 0, 'the trailing slot hides behind the clear button');
  assert.deepEqual([styleOf(allOf(typed.view, 'View')[1] as View).height, styleOf(allOf(typed.view, 'View')[1] as View).borderRadius], [48, tokens.shape.field]);
  assert.equal(firstOf(typed.view, 'TextInput').props.accessibilityLabel, 'Search stocks');
  typed.presses.forEach(noop);
  assert.deepEqual(changes, [''], 'clear sends an empty string');
});

test('TextField: label, muted field with the focus ring colour, helper or error below, kind sets keyboard and capitalisation, password toggles Show/Hide', () => {
  const email = draw('components/TextField.tsx', { value: '', onChangeText: noop, label: 'Email address', placeholder: 'you@example.com', helper: 'We never share it', kind: 'email' });
  assert.deepEqual(texts(email.view), ['Email address', 'We never share it']);
  const input = firstOf(email.view, 'TextInput');
  assert.deepEqual(
    [input.props.keyboardType, input.props.autoCapitalize, input.props.accessibilityLabel, input.props.accessibilityHint, input.props.secureTextEntry],
    ['email-address', 'none', 'Email address', 'We never share it', false],
  );
  const box = allOf(email.view, 'View')[1] as View;
  assert.deepEqual([styleOf(box).height, styleOf(box).borderRadius, styleOf(box).backgroundColor, styleOf(box).borderColor], [48, tokens.shape.field, light.muted, 'transparent']);

  const wrong = draw('components/TextField.tsx', { value: 'x', onChangeText: noop, label: 'Password', kind: 'password', error: 'At least 8 characters', variant: 'outline' });
  assert.equal(styleOf(allOf(wrong.view, 'View')[1] as View).borderColor, light.destructive, 'an error paints the border destructive');
  assert.equal(styleOf(allOf(wrong.view, 'View')[1] as View).backgroundColor, 'transparent');
  const note = allOf(wrong.view, 'Text').at(-1) as View;
  assert.deepEqual([textOf(note), styleOf(note).color, note.props.accessibilityLiveRegion], ['At least 8 characters', light.destructive, 'polite']);
  assert.equal(firstOf(wrong.view, 'TextInput').props.secureTextEntry, true);
  assert.equal(firstOf(wrong.view, 'Pressable').props.accessibilityLabel, 'Show password');

  const notes = draw('components/TextField.tsx', { value: '', onChangeText: noop, multiline: true, placeholder: 'Notes' });
  assert.equal(styleOf(firstOf(notes.view, 'TextInput')).minHeight, (tokens.type.body?.lineHeight as number) * 3);
});

test('ListRow: a plain View without onPress (a Toggle can live in trailing), a Press with a chevron and "title, value" name with one', () => {
  const still = draw('components/ListRow.tsx', { title: 'Usage analytics', subtitle: 'Share anonymous usage data', leading: glyph, leadingTile: true, trailing: el('Toggle') });
  assert.equal(allOf(still.view, 'Pressable').length, 0);
  assert.equal(allOf(still.view, 'Toggle').length, 1);
  const tile = allOf(still.view, 'View')[2] as View;
  assert.deepEqual([styleOf(tile).width, styleOf(tile).borderRadius, styleOf(tile).backgroundColor], [32, tokens.shape.well, light.muted]);
  assert.deepEqual(texts(still.view), ['Usage analytics', 'Share anonymous usage data']);

  const opened: number[] = [];
  const row = draw('components/ListRow.tsx', { title: 'Dark mode', value: 'Automatic', onPress: () => opened.push(1) });
  const press = firstOf(row.view, 'Pressable');
  assert.deepEqual([press.props.accessibilityLabel, press.props.accessibilityRole], ['Dark mode, Automatic', 'button']);
  assert.equal(findAll(row.tree, 'Path').length, 1, 'a chevron');
  row.presses.forEach(noop);
  assert.equal(opened.length, 1);

  const danger = draw('components/ListRow.tsx', { title: 'Delete account', onPress: noop, destructive: true, trailing: 'none', accessibilityRole: 'menuitem' });
  assert.equal(styleOf(firstOf(danger.view, 'Text')).color, light.destructive);
  assert.equal(findAll(danger.tree, 'Path').length, 0, 'trailing none: no chevron');
  assert.equal(firstOf(danger.view, 'Pressable').props.accessibilityRole, 'menuitem');
});

test('ListGroup: a caps title, rows on a card with inset rules between them (full-width when plain), a footer', () => {
  const rows = [el('Row', { key: 'a' }), null, el('Row', { key: 'b' }), el('Row', { key: 'c' })];
  const inset = draw('components/ListGroup.tsx', { title: 'Appearance', footer: 'Follows the system by default.', children: rows });
  assert.deepEqual(texts(inset.view), ['APPEARANCE', 'Follows the system by default.']);
  const card = allOf(inset.view, 'View')[1] as View;
  assert.deepEqual([styleOf(card).backgroundColor, styleOf(card).borderRadius, styleOf(card).overflow], [light.card, tokens.shape.card, 'hidden']);
  assert.equal(allOf(inset.view, 'Row').length, 3);
  const rules = card.children.filter((child) => typeof child !== 'string' && styleOf(child).height === 0.5) as View[];
  assert.equal(rules.length, 2, 'a rule between each pair of rows, none around them');
  assert.ok(rules.every((rule) => styleOf(rule).marginLeft === tokens.layout.gutter));

  const plain = draw('components/ListGroup.tsx', { variant: 'plain', children: rows });
  const wrap = allOf(plain.view, 'View')[1] as View;
  assert.equal(styleOf(wrap).backgroundColor, undefined);
  const plainRules = wrap.children.filter((child) => typeof child !== 'string' && styleOf(child).height === 0.5) as View[];
  assert.ok(plainRules.every((rule) => styleOf(rule).marginLeft === 0), 'plain rules run edge to edge');
});

test('SegmentedControl: a tablist of tabs with the selected state, selection haptic, a muted track or an underline row', () => {
  const picked: number[] = [];
  const track = draw('components/SegmentedControl.tsx', { segments: ['Upcoming', 'Past'], selectedIndex: 1, onChange: (i: number) => picked.push(i), accessibilityLabel: 'Events' });
  const list = firstOf(track.view, 'View');
  assert.deepEqual([list.props.accessibilityRole, list.props.accessibilityLabel], ['tablist', 'Events']);
  assert.deepEqual([styleOf(list).height, styleOf(list).backgroundColor, styleOf(list).borderRadius], [44, light.muted, tokens.shape.control]);
  const tabs = allOf(track.view, 'Pressable');
  assert.deepEqual(tabs.map((tab) => [tab.props.accessibilityRole, tab.props.accessibilityLabel, (tab.props.accessibilityState as Props).selected]), [
    ['tab', 'Upcoming', false],
    ['tab', 'Past', true],
  ]);
  assert.deepEqual(texts(track.view).map((t, i) => [t, styleOf(allOf(track.view, 'Text')[i] as View).color]), [
    ['Upcoming', light['muted-foreground']],
    ['Past', light.foreground],
  ]);
  track.presses.forEach(noop);
  assert.deepEqual(picked, [0, 1]);
  assert.ok(track.presses.every((press) => press.some((entry) => entry[0] === 'haptic' && entry[1] === 'selection')), 'every tab gives a selection haptic');

  const line = draw('components/SegmentedControl.tsx', { segments: ['All', 'Selected'], selectedIndex: 0, onChange: noop, variant: 'line', size: 'sm' });
  const row = firstOf(line.view, 'View');
  assert.deepEqual([styleOf(row).height, styleOf(row).borderBottomWidth, styleOf(row).backgroundColor], [38, 0.5, undefined]);
  assert.equal(styleOf(firstOf(line.view, 'Text')).color, light.primary, 'the selected line tab reads primary');
});

test('Notice: an alert with the tone colour as tint and rule, the tone icon, title and message, an action and a dismiss', () => {
  const acted: number[] = [];
  const dismissed: number[] = [];
  const notice = draw('components/Notice.tsx', {
    tone: 'success',
    title: 'Order placed',
    message: 'We will text you when it ships.',
    actionLabel: 'Track order',
    onAction: () => acted.push(1),
    onDismiss: () => dismissed.push(1),
  });
  const root = firstOf(notice.view, 'View');
  assert.deepEqual([root.props.accessibilityRole, styleOf(root).borderRadius, styleOf(root).backgroundColor, styleOf(root).overflow], ['alert', tokens.shape.cardInner, light.card, 'hidden']);
  const [tint, rule] = root.children.slice(0, 2) as [View, View];
  assert.deepEqual([styleOf(tint).backgroundColor, styleOf(tint).opacity], [light.success, 0.12]);
  assert.deepEqual([styleOf(rule).backgroundColor, styleOf(rule).width], [light.success, 3]);
  assert.equal(findAll(notice.tree, 'Path')[0]?.props.d, (kit('components/Icon.tsx').ICONS as Record<string, { path: string }>)['check-circle']?.path);
  assert.deepEqual(texts(notice.view), ['Order placed', 'We will text you when it ships.', 'Track order']);
  const [action, close] = allOf(notice.view, 'Pressable') as [View, View];
  assert.deepEqual([action.props.accessibilityLabel, close.props.accessibilityLabel], ['Track order', 'Dismiss']);
  notice.presses.forEach(noop);
  assert.deepEqual([acted.length, dismissed.length], [1, 1]);

  const quiet = draw('components/Notice.tsx', { message: 'Prices include tax.' });
  assert.equal(allOf(quiet.view, 'Pressable').length, 0);
  assert.equal(styleOf(firstOf(quiet.view, 'View').children[0] as View).backgroundColor, light.primary, 'info tints with primary');
  const error = draw('components/Notice.tsx', { message: 'Card declined', tone: 'error' });
  assert.equal(styleOf(firstOf(error.view, 'View').children[1] as View).backgroundColor, light.destructive);
});

test('Stepper: one adjustable element with increment and decrement actions, two round buttons that stop at min and max, the value in the numeric role', () => {
  const changes: number[] = [];
  const stepper = draw('components/Stepper.tsx', { value: 1, onChange: (n: number) => changes.push(n), accessibilityLabel: 'Quantity', min: 1, max: 2 });
  const root = firstOf(stepper.view, 'View');
  assert.deepEqual(
    [root.props.accessible, root.props.accessibilityRole, root.props.accessibilityLabel, root.props.accessibilityValue, root.props.accessibilityActions],
    [true, 'adjustable', 'Quantity', { min: 1, max: 2, now: 1, text: '1' }, [{ name: 'increment' }, { name: 'decrement' }]],
  );
  const [minus, plus] = allOf(stepper.view, 'Pressable') as [View, View];
  assert.deepEqual([minus.props.accessibilityLabel, (minus.props.accessibilityState as Props).disabled], ['Decrease', true]);
  assert.deepEqual([plus.props.accessibilityLabel, (plus.props.accessibilityState as Props).disabled], ['Increase', false]);
  assert.equal(plus.props.hitSlop, 2, 'a 40 px button grows its hit area to 44');
  const face = styleOf(plus.children[0] as View);
  assert.deepEqual([styleOf(plus).width, face.height, face.borderRadius, face.borderColor], [40, 40, 20, light.border]);
  const value = firstOf(stepper.view, 'Text');
  assert.deepEqual([textOf(value), styleOf(value).fontVariant, styleOf(value).minWidth], ['1', ['tabular-nums'], 28]);
  stepper.presses.forEach(noop);
  assert.deepEqual(changes, [2], 'minus is at min and does nothing; plus steps up');
  const live = findAll(stepper.tree, 'View')[0] as HostNode;
  (live.props.onAccessibilityAction as (event: unknown) => void)({ nativeEvent: { actionName: 'increment' } });
  (live.props.onAccessibilityAction as (event: unknown) => void)({ nativeEvent: { actionName: 'decrement' } });
  assert.deepEqual(changes, [2, 2]);

  const tonal = draw('components/Stepper.tsx', { value: 2, onChange: noop, accessibilityLabel: 'Guests', size: 'sm', variant: 'tonal', format: (n: number) => `${n} kg` });
  const button = styleOf((allOf(tonal.view, 'Pressable')[0] as View).children[0] as View);
  assert.deepEqual([styleOf(allOf(tonal.view, 'Pressable')[0] as View).width, button.backgroundColor, button.borderWidth], [32, light.muted, undefined]);
  assert.equal(textOf(firstOf(tonal.view, 'Text')), '2 kg');
});

test('BottomBar: buttons in a row or stacked, a leading slot, a summary line, a hairline bar or a floating card that clears the home indicator', () => {
  const pressed: string[] = [];
  const bar = draw('components/BottomBar.tsx', {
    primaryLabel: 'Add — $45.96',
    onPrimary: () => pressed.push('primary'),
    secondaryLabel: 'Save for later',
    onSecondary: () => pressed.push('secondary'),
    leading: glyph,
    summaryLabel: 'Total',
    summaryValue: '$45.96',
    children: el('Promo'),
  });
  const root = firstOf(bar.view, 'View');
  assert.deepEqual([styleOf(root).paddingBottom, styleOf(root).borderTopWidth, styleOf(root).backgroundColor], [tokens.layout.gutter, 0.5, light.background]);
  assert.deepEqual(texts(bar.view), ['Total', '$45.96', 'Save for later', 'Add — $45.96']);
  assert.equal(allOf(bar.view, 'Promo').length, 1);
  assert.equal(allOf(bar.view, 'Glyph').length, 1);
  const buttons = allOf(bar.view, 'Pressable');
  assert.deepEqual(buttons.map((button) => styleOf(button).flex), [1, 1], 'side by side, both grow');
  bar.presses.forEach(noop);
  assert.deepEqual(pressed, ['secondary', 'primary']);

  const stacked = draw('components/BottomBar.tsx', { primaryLabel: 'Buy now', onPrimary: noop, secondaryLabel: 'Add to cart', onSecondary: noop, arrange: 'stacked', floating: true, bottom: 24 });
  assert.deepEqual(texts(stacked.view), ['Buy now', 'Add to cart']);
  const card = firstOf(stacked.view, 'View');
  assert.deepEqual([styleOf(card).backgroundColor, styleOf(card).borderRadius, styleOf(card).marginBottom, styleOf(card).marginHorizontal, styleOf(card).elevation], [light.card, tokens.shape.card, 24, tokens.layout.gutter, 6]);
  assert.ok(allOf(stacked.view, 'Pressable').every((button) => styleOf(button).flex === undefined), 'stacked buttons keep their block width');
});

test('Avatar: initials on a disc chosen by name, the photo over them, a status dot in a background ring, and one name for the reader', () => {
  const initialsOf = kit('components/Avatar.tsx').initialsOf as (name: string) => string;
  const toneOf = kit('components/Avatar.tsx').toneOf as (name: string) => string;
  assert.deepEqual([initialsOf('Alex Smith'), initialsOf('  sam '), initialsOf('Ana María de la Cruz'), initialsOf('')], ['AS', 'S', 'AC', '']);
  assert.equal(toneOf('Alex Smith'), toneOf('Alex Smith'));
  assert.ok(new Set(['Alex', 'Sam', 'Lee', 'Ana', 'Kim', 'Omar', 'Yuki'].map(toneOf)).size > 1, 'names spread over the roles');

  const avatar = draw('components/Avatar.tsx', { name: 'Alex Smith', uri: 'https://example.com/a.jpg', status: 'online', size: 'lg', tone: 'primary' });
  const root = firstOf(avatar.view, 'View');
  assert.deepEqual([root.props.accessibilityRole, root.props.accessibilityLabel, styleOf(root).width], ['image', 'Alex Smith, online', 56]);
  const disc = root.children[0] as View;
  assert.deepEqual([styleOf(disc).borderRadius, styleOf(disc).backgroundColor], [28, light.primary]);
  const initials = firstOf(avatar.view, 'Text');
  assert.deepEqual([textOf(initials), styleOf(initials).color, styleOf(initials).fontSize], ['AS', light['primary-foreground'], 22]);
  assert.deepEqual(firstOf(avatar.view, 'Image').props.source, { uri: 'https://example.com/a.jpg' });
  const dot = root.children[1] as View;
  assert.deepEqual([styleOf(dot).backgroundColor, styleOf(dot).borderColor, styleOf(dot).width], [light.success, light.background, 16]);

  const rounded = draw('components/Avatar.tsx', { name: 'Kova', rounded: true, size: 'xs', badge: glyph });
  assert.equal(styleOf((firstOf(rounded.view, 'View').children[0]) as View).borderRadius, tokens.shape.cardInner);
  assert.equal(allOf(rounded.view, 'Image').length, 0);
  assert.equal(allOf(rounded.view, 'Glyph').length, 1);
});

test('ProgressBar: a progressbar with the percentage, a muted pill track, a run in the tone colour that eases to the value; indeterminate sweeps', () => {
  const bar = draw('components/ProgressBar.tsx', { progress: 0.6, label: 'Daily goal', valueLabel: '3 of 5', tone: 'success' });
  const root = firstOf(bar.view, 'View');
  assert.deepEqual([root.props.accessibilityRole, root.props.accessibilityLabel, root.props.accessibilityValue], ['progressbar', 'Daily goal', { min: 0, max: 100, now: 60, text: '3 of 5' }]);
  assert.deepEqual(texts(bar.view), ['Daily goal', '3 of 5']);
  const track = allOf(bar.view, 'View').at(-1) as View;
  assert.deepEqual([styleOf(track).height, styleOf(track).borderRadius, styleOf(track).backgroundColor, styleOf(track).overflow], [6, 3, light.muted, 'hidden']);
  assert.equal(styleOf(firstOf(bar.view, 'Animated.View')).backgroundColor, light.success);
  assert.ok(bar.mount.some((entry) => entry[0] === 'start'), 'the run animates on mount');

  const still = draw('components/ProgressBar.tsx', { progress: 2, height: 10 }, { reduced: true });
  assert.deepEqual(firstOf(still.view, 'View').props.accessibilityValue, { min: 0, max: 100, now: 100, text: '100%' }, 'clamped to 1');
  assert.ok(!still.mount.some((entry) => entry[0] === 'start'), 'Reduce Motion jumps');
  assert.equal(styleOf(allOf(still.view, 'View').at(-1) as View).borderRadius, 5);

  const unknown = draw('components/ProgressBar.tsx', { progress: 0, indeterminate: true });
  assert.equal(firstOf(unknown.view, 'View').props.accessibilityValue, undefined);
  assert.ok(unknown.mount.some((entry) => entry[0] === 'start' && JSON.stringify(entry[1]).includes('loop')), 'a sweeping loop');
});

test('PageDots: one dot per page, the current one a pill at full opacity, light dots over a photo, "Page n of m" for the reader', () => {
  const dots = draw('components/PageDots.tsx', { count: 4, index: 1 });
  const root = firstOf(dots.view, 'View');
  assert.deepEqual([root.props.accessibilityLabel, root.props.accessibilityValue], ['Page 2 of 4', { min: 1, max: 4, now: 2 }]);
  const drawn = allOf(dots.view, 'Animated.View');
  assert.equal(drawn.length, 4);
  assert.ok(drawn.every((dot) => styleOf(dot).height === 8 && styleOf(dot).backgroundColor === light.foreground));
  const current = styleOf(drawn[1] as View);
  assert.deepEqual([(current.width as Props).of, (current.opacity as Props).of], [{ animated: 1 }, { animated: 1 }]);
  assert.deepEqual((styleOf(drawn[0] as View).width as Props).of, { animated: 0 });

  const photo = draw('components/PageDots.tsx', { count: 3, index: 0, onPhoto: true, size: 'sm' });
  assert.equal(styleOf(firstOf(photo.view, 'Animated.View')).backgroundColor, light.background, 'light scheme: the lightest neutral is background');
  const dark = draw('components/PageDots.tsx', { count: 3, index: 0, onPhoto: true }, { scheme: 'dark' });
  assert.equal(styleOf(firstOf(dark.view, 'Animated.View')).backgroundColor, tokens.colors.dark.foreground, 'dark scheme: foreground');
});

test('Rating: filled stars in warning, halves clipped, value and count text, formatCount; interactive stars are radios in an adjustable group', () => {
  const formatCount = kit('components/Rating.tsx').formatCount as (n: number) => string;
  assert.deepEqual([formatCount(950), formatCount(3800), formatCount(12_400), formatCount(1_250_000)], ['950', '3.8K', '12K', '1.3M']);

  const shown = draw('components/Rating.tsx', { value: 3.5, count: 3800, showValue: true });
  const root = firstOf(shown.view, 'View');
  assert.deepEqual([root.props.accessible, root.props.accessibilityRole, root.props.accessibilityLabel], [true, 'text', 'Rated 3.5 out of 5, 3.8K ratings']);
  const paths = findAll(shown.tree, 'Path');
  assert.equal(paths.filter((path) => path.props.fill === light.warning).length, 4, 'three full stars and a half');
  const half = allOf(shown.view, 'View').find((view) => styleOf(view).overflow === 'hidden' && styleOf(view).width === 8);
  assert.ok(half, 'the half star is clipped to half a star');
  assert.deepEqual(texts(shown.view), ['3.5', '3800 ratings'.replace('3800', '3.8K')]);

  const picked: number[] = [];
  const input = draw('components/Rating.tsx', { value: 2, onChange: (n: number) => picked.push(n), size: 'lg' });
  const group = firstOf(input.view, 'View');
  assert.deepEqual([group.props.accessibilityRole, group.props.accessibilityValue], ['adjustable', { min: 0, max: 5, now: 2, text: '2 out of 5' }]);
  const stars = allOf(input.view, 'Pressable');
  assert.deepEqual(stars.map((star) => [star.props.accessibilityLabel, (star.props.accessibilityState as Props).checked]), [
    ['1 star', true],
    ['2 stars', true],
    ['3 stars', false],
    ['4 stars', false],
    ['5 stars', false],
  ]);
  assert.equal(stars[0]?.props.hitSlop, 10, '24 px stars grow their hit area to 44');
  input.presses.forEach(noop);
  assert.deepEqual(picked, [1, 2, 3, 4, 5]);
  ((findAll(input.tree, 'View')[0] as HostNode).props.onAccessibilityAction as (event: unknown) => void)({ nativeEvent: { actionName: 'increment' } });
  assert.equal(picked.at(-1), 3);
});

test('Photo: a muted frame sized by aspect ratio or height, the image, a skeleton until it loads, alt as the image name or decorative', () => {
  const photo = draw('components/Photo.tsx', { uri: 'https://example.com/p.jpg', alt: 'A linen shirt on a chair', aspectRatio: 4 / 5, children: el('Badge') });
  const frame = firstOf(photo.view, 'View');
  assert.deepEqual([frame.props.accessible, frame.props.accessibilityRole, frame.props.accessibilityLabel], [true, 'image', 'A linen shirt on a chair']);
  assert.deepEqual([styleOf(frame).aspectRatio, styleOf(frame).borderRadius, styleOf(frame).backgroundColor, styleOf(frame).overflow, styleOf(frame).width], [0.8, tokens.shape.card, light.muted, 'hidden', '100%']);
  const image = firstOf(photo.view, 'Image');
  assert.deepEqual([image.props.source, image.props.resizeMode], [{ uri: 'https://example.com/p.jpg' }, 'cover']);
  assert.equal(allOf(photo.view, 'Animated.View').length, 1, 'a skeleton while loading');
  assert.equal(allOf(photo.view, 'Badge').length, 1);

  const plain = draw('components/Photo.tsx', { uri: 'x', height: 120, width: 200, placeholder: 'none', fit: 'contain', radius: 0 });
  const box = firstOf(plain.view, 'View');
  assert.deepEqual([box.props.accessible, box.props.accessibilityElementsHidden, box.props.importantForAccessibility, styleOf(box).height, styleOf(box).width, styleOf(box).aspectRatio], [false, true, 'no-hide-descendants', 120, 200, undefined]);
  assert.equal(allOf(plain.view, 'Animated.View').length, 0);
  assert.equal(firstOf(plain.view, 'Image').props.resizeMode, 'contain');
});

test('useCountdown: countdownParts splits ms into padded parts and never goes below zero', () => {
  const parts = kit('components/useCountdown.ts').countdownParts as (ms: number) => Record<string, unknown>;
  assert.deepEqual(parts(2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5_000 + 999), {
    total: 2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5_999,
    days: 2,
    hours: 3,
    minutes: 4,
    seconds: 5,
    dd: '02',
    hh: '03',
    mm: '04',
    ss: '05',
    done: false,
  });
  assert.deepEqual(parts(-5), { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, dd: '00', hh: '00', mm: '00', ss: '00', done: true });
  assert.equal(parts(100 * 86_400_000).dd, '100');
});
