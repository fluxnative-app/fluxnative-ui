// The bottom padding a scroll view's content needs so nothing rests under a
// floating dock: wrap the screen in `DockInsetProvider`, give the scroll
// content `paddingBottom: useDockInset()`. A dock over the content reports
// its measured height plus its lift from the bottom edge plus a 16 pt gap:
// the kit's overlay `TabBar` and an absolutely placed `BottomBar` do it
// themselves, a template's own dock with `onLayout={useReportDock({ bottom })}`.
// Two docks take the larger; 0 until a dock has reported, and always 0
// outside a provider, where the docks behave as they did before.
//
// The home indicator is counted once, by whoever holds it: the kit's docks
// carry it in `bottom` (the capsule's lift, or the bar's padding inside the
// measured height), so they report no `safeBottom`. A template dock passes
// `safeBottom` only for space under it that neither its height nor its
// `bottom` already includes.

import React from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { space } from '../theme/tokens';

/** The gap between a dock and the last content at rest. */
export const DOCK_GAP = space[4];

export interface DockMetrics {
  /** The dock's measured height (onLayout). */
  height: number;
  /** Its lift from the bottom edge (an overlay's `bottom`). */
  bottomOffset?: number;
  /** Home-indicator space under it that `height` and `bottomOffset` do not already count. */
  safeBottom?: number;
  /** Default `DOCK_GAP` (16). */
  gap?: number;
}

const length = (n: number | undefined): number => (n !== undefined && Number.isFinite(n) && n > 0 ? n : 0);

/** The content inset one dock needs: height + offset + safe area + gap, rounded up; 0 for a dock with no height. */
export function dockInset({ height, bottomOffset, safeBottom, gap = DOCK_GAP }: DockMetrics): number {
  if (length(height) === 0) return 0;
  return Math.ceil(height + length(bottomOffset) + length(safeBottom) + length(gap));
}

/** The docks of one screen: each reports its inset under its own key; the screen's inset is the largest. */
export interface DockStore {
  report: (key: object, inset: number) => void;
  clear: (key: object) => void;
  inset: () => number;
  /** Called with the new inset whenever it changes; returns the unsubscribe. */
  subscribe: (listener: (inset: number) => void) => () => void;
}

export function dockStore(): DockStore {
  const docks = new Map<object, number>();
  const listeners = new Set<(inset: number) => void>();
  let current = 0;
  const publish = () => {
    let next = 0;
    docks.forEach((inset) => {
      if (inset > next) next = inset;
    });
    if (next === current) return;
    current = next;
    listeners.forEach((listener) => listener(next));
  };
  return {
    report: (key, inset) => {
      docks.set(key, length(inset));
      publish();
    },
    clear: (key) => {
      if (docks.delete(key)) publish();
    },
    inset: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The nearest provider's store; null outside one. */
export const DockInsetContext = React.createContext<DockStore | null>(null);

export interface DockInsetProviderProps {
  children?: React.ReactNode;
}

/** Wraps a screen (or the tab shell around its screens) whose docks should report. */
export function DockInsetProvider({ children }: DockInsetProviderProps) {
  const store = React.useRef<DockStore | null>(null);
  if (store.current === null) store.current = dockStore();
  return React.createElement(DockInsetContext.Provider, { value: store.current }, children);
}

export interface DockReport {
  /** The dock's lift from the bottom edge in px. Default 0. */
  bottom?: number;
  /** See `DockMetrics.safeBottom`. Default 0. */
  safeBottom?: number;
  /** false: report nothing (a dock in the screen's column, not over the content). Default true. */
  active?: boolean;
}

/** For a dock: returns the `onLayout` that reports it to the nearest provider, and clears it on unmount. */
export function useReportDock({ bottom = 0, safeBottom = 0, active = true }: DockReport = {}): (event: LayoutChangeEvent) => void {
  const store = React.useContext(DockInsetContext);
  const key = React.useRef<object>({}).current;
  const height = React.useRef(0);
  React.useEffect(() => {
    if (store === null || !active) return undefined;
    if (height.current > 0) store.report(key, dockInset({ height: height.current, bottomOffset: bottom, safeBottom }));
    return () => store.clear(key);
  }, [store, key, bottom, safeBottom, active]);
  return React.useCallback(
    (event: LayoutChangeEvent) => {
      height.current = event.nativeEvent.layout.height;
      if (store !== null && active) store.report(key, dockInset({ height: height.current, bottomOffset: bottom, safeBottom }));
    },
    [store, key, bottom, safeBottom, active],
  );
}

/** The bottom padding for a scroll view's content under the nearest provider's docks; 0 with none. */
export default function useDockInset(): number {
  const store = React.useContext(DockInsetContext);
  const [inset, setInset] = React.useState(() => (store === null ? 0 : store.inset()));
  React.useEffect(() => {
    if (store === null) return undefined;
    setInset(store.inset());
    return store.subscribe(setInset);
  }, [store]);
  return store === null ? 0 : inset;
}
