// Photo and Avatar when a remote picture fails (process 4.0: hotlinked photos
// can vanish after a template ships, and the screen must still look designed).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FILES_DIR } from './emit.ts';
import { component, dirLayer, el, findAll, loader, render, type HostNode, type Props, type View } from './__tests__/render.ts';

const kit = loader([dirLayer(FILES_DIR)]);
const tokens = kit('theme/tokens.ts') as { colors: Record<'light' | 'dark', Record<string, string>>; shape: Record<string, number> };
const light = tokens.colors.light;

const allOf = (nodes: Array<View | string>, type: string): View[] =>
  nodes.flatMap((node) => (typeof node === 'string' ? [] : [...(node.type === type ? [node] : []), ...allOf(node.children, type)]));
const firstOf = (nodes: Array<View | string>, type: string) => allOf(nodes, type)[0] as View;
const styleOf = (node: View) => (node.props.style ?? {}) as Props;
const textOf = (node: View | string): string => (typeof node === 'string' ? node : node.children.map(textOf).join(''));
const draw = (file: string, props: Props, device = {}) => render(kit, el(component(kit, file), props), device);
/** Fires the first Image's handler, as the host would. */
const fire = (tree: Array<HostNode | string>, handler: 'onLoad' | 'onError') => (findAll(tree, 'Image')[0]?.props[handler] as () => void)();
const frameSize = (view: Array<View | string>) => {
  const frame = styleOf(firstOf(view, 'View'));
  return [frame.width, frame.aspectRatio, frame.height, frame.borderRadius];
};

test('nextPhotoPhase: loading settles on the first event; a failure is final', () => {
  const next = kit('components/Photo.tsx').nextPhotoPhase as (phase: string, event: string) => string;
  assert.deepEqual([next('loading', 'load'), next('loading', 'error'), next('ready', 'error'), next('failed', 'load'), next('failed', 'error')], ['ready', 'failed', 'failed', 'failed', 'failed']);
});

test('Photo loading → loaded: the skeleton goes, the image stays, onLoad once, the frame keeps its size', () => {
  const calls: string[] = [];
  const photo = draw('components/Photo.tsx', { uri: 'https://images.unsplash.com/p', alt: 'A bowl of ramen', aspectRatio: 4 / 3, onLoad: () => calls.push('load'), onError: () => calls.push('error') });
  assert.equal(allOf(photo.view, 'Animated.View').length, 1, 'a skeleton while loading');
  fire(photo.tree, 'onLoad');
  const loaded = photo.rerender();
  assert.equal(allOf(loaded.view, 'Animated.View').length, 0);
  assert.equal(allOf(loaded.view, 'Image').length, 1);
  assert.deepEqual(calls, ['load']);
  assert.deepEqual(frameSize(loaded.view), frameSize(photo.view));
});

test('Photo loading → error → designed fallback: the muted well, the image glyph in muted-foreground, alt and children kept, no retry', () => {
  const calls: string[] = [];
  const photo = draw('components/Photo.tsx', { uri: 'https://images.unsplash.com/gone', alt: 'Harbour at dusk', aspectRatio: 16 / 9, onError: () => calls.push('error'), children: el('Caption') });
  fire(photo.tree, 'onError');
  const failed = photo.rerender();
  const frame = firstOf(failed.view, 'View');
  assert.deepEqual([frame.props.accessibilityRole, frame.props.accessibilityLabel, styleOf(frame).backgroundColor], ['image', 'Harbour at dusk', light.muted]);
  assert.deepEqual(frameSize(failed.view), frameSize(photo.view), 'no layout shift');
  assert.equal(allOf(failed.view, 'Image').length, 0, 'the dead image is gone: no retry');
  assert.equal(allOf(failed.view, 'Animated.View').length, 0, 'no skeleton over the fallback');
  const glyph = firstOf(failed.view, 'Path');
  assert.equal(glyph.props.stroke, light['muted-foreground']);
  const kids = frame.children as View[];
  assert.equal(kids.at(-1)?.type, 'Caption', 'the overlay draws above the fallback');
  assert.deepEqual(calls, ['error']);
  assert.deepEqual(firstOf(photo.rerender().view, 'View').props.accessibilityLabel, 'Harbour at dusk', 'stable on another render');
});

test('Photo placeholderColor and fallbackIcon: the well in the role, the glyph in its ink, or none', () => {
  const tinted = draw('components/Photo.tsx', { uri: 'x', placeholder: 'muted', placeholderColor: 'secondary', fallbackIcon: 'bag' });
  assert.equal(styleOf(firstOf(tinted.view, 'View')).backgroundColor, light.secondary, 'the loading well');
  fire(tinted.tree, 'onError');
  const failed = tinted.rerender();
  assert.equal(styleOf(firstOf(failed.view, 'View')).backgroundColor, light.secondary);
  assert.equal(firstOf(failed.view, 'Path').props.stroke, light['secondary-foreground']);

  const plain = draw('components/Photo.tsx', { uri: 'x', fallbackIcon: 'none' });
  fire(plain.tree, 'onError');
  assert.equal(allOf(plain.rerender().view, 'Svg').length, 0, 'a plain well');
});

test('Photo: a fallback element wins over the default', () => {
  const photo = draw('components/Photo.tsx', { uri: 'x', alt: 'Cover', fallback: el('BrandMark'), fallbackIcon: 'bag' });
  fire(photo.tree, 'onError');
  const failed = photo.rerender();
  assert.equal(allOf(failed.view, 'BrandMark').length, 1);
  assert.equal(allOf(failed.view, 'Svg').length, 0);
  assert.equal(firstOf(failed.view, 'View').props.accessibilityLabel, 'Cover');
});

test('Photo: a new uri after a failure loads again (a recycled cell)', () => {
  const Photo = component(kit, 'components/Photo.tsx');
  const props: Props = { uri: 'https://example.com/a.jpg' };
  const photo = render(kit, el((p: Props) => Photo({ ...p, ...props }), {}));
  fire(photo.tree, 'onError');
  assert.equal(allOf(photo.rerender().view, 'Image').length, 0);
  props.uri = 'https://example.com/b.jpg';
  const next = photo.rerender();
  assert.deepEqual(firstOf(next.view, 'Image').props.source, { uri: 'https://example.com/b.jpg' });
});

test('Avatar error → initials: the photo goes, the initials disc stays', () => {
  const avatar = draw('components/Avatar.tsx', { name: 'Alex Smith', uri: 'https://example.com/gone.jpg', tone: 'primary' });
  assert.equal(allOf(avatar.view, 'Image').length, 1);
  fire(avatar.tree, 'onError');
  const failed = avatar.rerender();
  assert.equal(allOf(failed.view, 'Image').length, 0);
  const initials = firstOf(failed.view, 'Text');
  assert.deepEqual([textOf(initials), styleOf(initials).color], ['AS', light['primary-foreground']]);
  assert.equal(firstOf(failed.view, 'View').props.accessibilityLabel, 'Alex Smith');
  assert.equal(styleOf(firstOf(failed.view, 'View').children[0] as View).borderRadius, Math.min(tokens.shape.avatar ?? 0, 20));
});
