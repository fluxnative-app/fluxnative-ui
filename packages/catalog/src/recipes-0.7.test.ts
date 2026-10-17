// Kit 0.7 in the factory's numbering, shipped in @fluxnative/catalog 0.1.0: the dock inset. "Content under a floating dock at rest" (p0.overlap)
// was the most frequent blocking failure of the template factory's batches 23,
// 25 and 26: no dock told the screen how tall it was, so every builder padded
// its scroll content by hand, and many forgot.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FILES_DIR } from './emit.ts';
import { component, dirLayer, el, loader, react, render, type Props, type View } from './__tests__/render.ts';

const kit = loader([dirLayer(FILES_DIR)]);
const tokens = kit('theme/tokens.ts') as { layout: Record<string, number>; space: Record<number, number> };
const dock = kit('components/useDockInset.ts') as {
  DOCK_GAP: number;
  dockInset: (metrics: { height: number; bottomOffset?: number; safeBottom?: number; gap?: number }) => number;
  dockStore: () => Store;
  DockInsetContext: { Provider: unknown };
  DockInsetProvider: (props: Props) => unknown;
  useReportDock: (options?: Props) => (event: unknown) => void;
  default: () => number;
};
interface Store {
  report: (key: object, inset: number) => void;
  clear: (key: object) => void;
  inset: () => number;
  subscribe: (listener: (inset: number) => void) => () => void;
}

const noop = () => undefined;
const layout = (height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height } } });
const items = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'me', label: 'Me', icon: 'user' },
];
const gutter = tokens.layout.gutter ?? 16;

/** Every host view that measures itself, except a `Press`'s Pressable (it measures its own box to reach `minTarget`). */
const measured = (nodes: Array<View | string>): View[] =>
  nodes.flatMap((node) =>
    typeof node === 'string' ? [] : [...(node.props.onLayout !== undefined && node.type !== 'Pressable' ? [node] : []), ...measured(node.children)],
  );
/** The raw `onLayout` of the first host view that has one. */
function onLayoutOf(tree: unknown[]): (event: unknown) => void {
  const walk = (nodes: unknown[]): unknown => {
    for (const node of nodes) {
      if (typeof node === 'string') continue;
      const host = node as { props: Props; children: unknown[] };
      if (typeof host.props.onLayout === 'function') return host.props.onLayout;
      const inner = walk(host.children);
      if (inner) return inner;
    }
    return undefined;
  };
  const found = walk(tree);
  assert.equal(typeof found, 'function', 'a view with onLayout');
  return found as (event: unknown) => void;
}
const under = (store: Store, ...children: unknown[]) => el(dock.DockInsetContext.Provider, { value: store }, ...children);

test('dockInset: height + lift + safe area + the 16 pt gap, rounded up; 0 for no height', () => {
  assert.equal(dock.DOCK_GAP, 16);
  assert.equal(dock.DOCK_GAP, tokens.space[4]);
  assert.equal(dock.dockInset({ height: 56, bottomOffset: 16 }), 88);
  assert.equal(dock.dockInset({ height: 64, bottomOffset: 0, safeBottom: 34 }), 114);
  assert.equal(dock.dockInset({ height: 56.5, gap: 8 }), 65, 'rounded up');
  assert.equal(dock.dockInset({ height: 0, bottomOffset: 16 }), 0);
  assert.equal(dock.dockInset({ height: Number.NaN }), 0);
  assert.equal(dock.dockInset({ height: 56, bottomOffset: -8, safeBottom: Number.POSITIVE_INFINITY }), 72, 'a negative or non-finite part counts as 0');
});

test('dockStore: a report, an update on a new height, a clear back to 0, two docks take the larger', () => {
  const store = dock.dockStore();
  const heard: number[] = [];
  const stop = store.subscribe((inset) => heard.push(inset));
  const tabs = {};
  const bar = {};
  assert.equal(store.inset(), 0, '0 before any dock reports');
  store.report(tabs, 88);
  store.report(tabs, 96);
  assert.equal(store.inset(), 96);
  store.report(bar, 120);
  assert.equal(store.inset(), 120, 'the larger of two docks');
  store.clear(bar);
  assert.equal(store.inset(), 96);
  store.clear(tabs);
  assert.equal(store.inset(), 0, 'unmounted: back to 0');
  store.clear(tabs);
  assert.deepEqual(heard, [88, 96, 120, 96, 0], 'one call per change');
  stop();
  store.report(tabs, 50);
  assert.deepEqual(heard, [88, 96, 120, 96, 0], 'unsubscribed');
});

test('a floating TabBar reports its capsule plus its lift; a new height updates it; unmount resets to 0', () => {
  const store = dock.dockStore();
  const drawn = render(kit, under(store, el(component(kit, 'components/TabBar.tsx'), { items, activeKey: 'home', onSelect: noop })));
  const onLayout = onLayoutOf(drawn.tree);
  onLayout(layout(56));
  assert.equal(store.inset(), 56 + gutter + 16);
  onLayout(layout(64));
  assert.equal(store.inset(), 64 + gutter + 16);
  drawn.unmount();
  assert.equal(store.inset(), 0);
});

test('TabBar: a raised centre disc counts above the box; a bar in the column reports nothing; an overlay bar holds its lift as padding', () => {
  const store = dock.dockStore();
  const action = { icon: 'plus', accessibilityLabel: 'New', onPress: noop, placement: 'center' };
  onLayoutOf(render(kit, under(store, el(component(kit, 'components/TabBar.tsx'), { items, activeKey: 'home', onSelect: noop, action, bottom: 24 }))).tree)(layout(56));
  assert.equal(store.inset(), 56 + 24 + 16 + 4 + 16, 'RISE + RING over the capsule');

  const column = dock.dockStore();
  onLayoutOf(render(kit, under(column, el(component(kit, 'components/TabBar.tsx'), { items, activeKey: 'home', onSelect: noop, shape: 'bar' }))).tree)(layout(72));
  assert.equal(column.inset(), 0, 'the bar sits after the scroll view: it takes its own space');

  const overlay = dock.dockStore();
  onLayoutOf(render(kit, under(overlay, el(component(kit, 'components/TabBar.tsx'), { items, activeKey: 'home', onSelect: noop, shape: 'bar', overlay: true }))).tree)(layout(72));
  assert.equal(overlay.inset(), 72 + 16, 'its bottom padding is inside the measured height: counted once');
});

test('BottomBar reports only over the content: style bottom plus a floating card margin; a TabBar and a BottomBar take the larger', () => {
  const store = dock.dockStore();
  const draw = (props: Props) => el(component(kit, 'components/BottomBar.tsx'), { primaryLabel: 'Book', onPrimary: noop, ...props });
  onLayoutOf(render(kit, under(store, draw({}))).tree)(layout(80));
  assert.equal(store.inset(), 0, 'in the column: nothing');

  const drawn = render(kit, under(store, draw({ floating: true, style: { position: 'absolute', left: 0, right: 0, bottom: 8 } })));
  onLayoutOf(drawn.tree)(layout(96));
  assert.equal(store.inset(), 96 + 8 + gutter + 16);
  const tabs = render(kit, under(store, el(component(kit, 'components/TabBar.tsx'), { items, activeKey: 'home', onSelect: noop })));
  onLayoutOf(tabs.tree)(layout(56));
  assert.equal(store.inset(), 96 + 8 + gutter + 16, 'the larger dock wins');
  drawn.unmount();
  assert.equal(store.inset(), 56 + gutter + 16, 'the other dock remains');
});

test("a template's own dock reports through useReportDock; useDockInset reads the provider; no provider: no-op and 0", () => {
  const store = dock.dockStore();
  let seen = -1;
  const TabDock = (props: Props) => el('View', { onLayout: dock.useReportDock({ bottom: props.bottom as number }) });
  const Probe = () => {
    seen = dock.default();
    return null;
  };
  const drawn = render(kit, under(store, el(TabDock, { bottom: 20 })));
  onLayoutOf(drawn.tree)(layout(60));
  assert.equal(store.inset(), 96);
  render(kit, under(store, el(Probe)));
  assert.equal(seen, 96, 'the inset a scroll view pads by');

  const alone = render(kit, el(TabDock, { bottom: 20 }));
  onLayoutOf(alone.tree)(layout(60));
  alone.unmount();
  render(kit, el(Probe));
  assert.equal(seen, 0, 'no provider: 0');
});

test('DockInsetProvider gives its subtree a store of its own', () => {
  let store: Store | null = null;
  const Grab = () => {
    store = react.useContext(dock.DockInsetContext as never) as Store | null;
    return el('View');
  };
  render(kit, el(dock.DockInsetProvider, {}, el(Grab)));
  assert.ok(store !== null);
  assert.equal((store as Store).inset(), 0);
  let outside: unknown = 'unset';
  const GrabOutside = () => {
    outside = react.useContext(dock.DockInsetContext as never);
    return null;
  };
  render(kit, el(GrabOutside));
  assert.equal(outside, null, 'restored outside the provider');
});

test('without a provider TabBar and BottomBar still render, each measuring one view (the onLayout is a no-op there)', () => {
  const tabs = render(kit, el(component(kit, 'components/TabBar.tsx'), { items, activeKey: 'home', onSelect: noop })).view;
  assert.equal(measured(tabs).length, 1);
  const bar = render(kit, el(component(kit, 'components/BottomBar.tsx'), { primaryLabel: 'Book', onPrimary: noop })).view;
  assert.equal(measured(bar).length, 1);
});
