// The tabs at the foot of an app: two to five items, each a glyph and a
// label, one of them current. 'floating' (default) is an inset capsule over
// the content, the iOS 26 shape (TIDE, Calm, GitHub, Crouton on Mobbin),
// that hugs its tabs and centres when they have no labels (Shop, IMDb);
// 'bar' is the full-width bar on `card` under a hairline, the Material 3 and classic
// iOS shape (Strava, Burger King, LinkedIn). The current tab is marked by a
// lens behind it (`indicator="lens"`, `accent`), a solid `primary` fill
// ("solid": a disc with no labels, the pill that carries the label with
// `labels="active"`), or by colour alone ("tint"); its kit glyph is filled.
// An `action` is a round button beside the capsule (Craft, Wabi) or a disc
// raised between the tabs (Docusign). Until the host draws tab chrome
// (`flux/navigation` has only a stack), this is the one tab bar a template
// draws (CRAFT rule 11). Screen readers get a tablist of tabs, the current
// one selected, with badge counts in the names. Over the content, it reports
// its height to the nearest `DockInsetProvider` (`useDockInset`).

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { elevation, layout, shape, space, type } from '../theme/tokens';
import { usePalette, type Palette } from '../theme/usePalette';
import Icon, { type IconName } from './Icon';
import { badgeMark, withCount } from './IconButton';
import Press, { type PressHaptic } from './Press';
import { useReportDock } from './useDockInset';

export type TabBarShape = 'floating' | 'bar';
export type TabBarLabels = 'always' | 'active' | 'none';
export type TabBarIndicator = 'lens' | 'solid' | 'tint';
export type TabBarTone = 'default' | 'inverse' | 'glass';

export interface TabBarItem {
  key: string;
  /** Shown as `labels` says, and always the tab's screen-reader name. */
  label: string;
  /** A kit icon name (filled while current), or a function that draws the brand's own glyph. */
  icon?: IconName | ((state: { selected: boolean; color: string; size: number }) => React.ReactNode);
  /** A count or short text in the glyph's corner, or `true` for a dot. A count joins the name. */
  badge?: number | string | boolean;
  accessibilityHint?: string;
}

export interface TabBarAction {
  icon: IconName | React.ReactNode;
  accessibilityLabel: string;
  onPress: () => void;
  /** 'end' (default): a round button beside the capsule, or the bar's last slot. 'center': a disc raised between the tabs. */
  placement?: 'end' | 'center';
}

export interface TabBarProps {
  items: readonly TabBarItem[];
  /** The current tab; null on a screen outside the tabs. */
  activeKey: string | null;
  onSelect: (key: string) => void;
  /** A tap on the current tab (scroll to the top, clear a search). */
  onReselect?: (key: string) => void;
  /** Default 'floating'. */
  shape?: TabBarShape;
  /** Default 'always'. 'active': only the current tab's label, beside its glyph. */
  labels?: TabBarLabels;
  /** Default 'lens'. */
  indicator?: TabBarIndicator;
  /** The surface. 'default': `card` under a hairline. 'inverse': a dark dock. 'glass': the translucent tier's fill and rim. */
  tone?: TabBarTone;
  action?: TabBarAction;
  /** Over the content at the foot of the screen (default for 'floating'), or in the screen's column after the scroll view (default for 'bar'). */
  overlay?: boolean;
  /** Space under it in px, for the home indicator: the capsule's lift, or the bar's bottom padding. Default `layout.gutter`. */
  bottom?: number;
  /** Default 'selection'. */
  haptic?: PressHaptic;
  /** The tablist's screen-reader name. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Comp tokens: glyph size; the lens inset, and the wider one around an icon-only disc; M3's well; the raised disc and how far it rises. */
const GLYPH = 24;
const INSET = 4;
const ROUND_INSET = space[2];
const WELL = { width: 56, height: 32 };
const DISC = 56;
const RISE = 16;
const RING = 4;
const BADGE = 16;
const DOT = 8;

/** The row's height, without the space under it: the brand's `layout.tabBarHeight`, the whole capsule. */
export const tabBarRowHeight = (): number => layout.tabBarHeight;

/** How much an overlay tab bar covers from the foot of the screen: pad scroll content by this. */
export function tabBarClearance(shape: TabBarShape = 'floating', bottom: number = layout.gutter, raised = false): number {
  return tabBarRowHeight() + bottom + (shape === 'floating' ? space[2] : 0) + (raised ? RISE : 0);
}

interface Inks {
  surface: ViewStyle;
  idle: string;
  /** The current tab's glyph on the bare surface ('tint'), and its label there: text needs 4.5:1, a glyph 3:1. */
  tint: string;
  tintLabel: string;
  lens: string;
  onLens: string;
  /** The lens is the ink at low strength on an inverse dock. */
  lensOpacity: number;
}

/** `fg` laid over `bg` at `amount`, for two #rrggbb colours; anything else gets `fg`. */
function blend(fg: string, bg: string, amount: number): string {
  const hex = /^#[0-9a-f]{6}$/i;
  if (!hex.test(fg) || !hex.test(bg)) return fg;
  const channel = (c: string, at: number) => parseInt(c.slice(at, at + 2), 16);
  const mixed = [1, 3, 5].map((at) => Math.round(channel(fg, at) * amount + channel(bg, at) * (1 - amount)));
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function inksOf(tone: TabBarTone, bar: boolean, palette: Palette): Inks {
  if (tone === 'inverse') {
    return {
      surface: { backgroundColor: palette.inverse },
      // 64% of the ink: 8.2:1 (light) and 6.5:1 (dark) on the kit's inverse, still a step below the current tab.
      idle: blend(palette['inverse-foreground'], palette.inverse, 0.64),
      tint: palette['inverse-foreground'],
      tintLabel: palette['inverse-foreground'],
      lens: palette['inverse-foreground'],
      onLens: palette['inverse-foreground'],
      lensOpacity: 0.16,
    };
  }
  const glass = tone === 'glass';
  return {
    surface: glass
      ? { backgroundColor: palette['glass-fill'], borderColor: palette['glass-border'], borderWidth: StyleSheet.hairlineWidth }
      : bar
        ? { backgroundColor: palette.card, borderTopColor: palette['border-soft'], borderTopWidth: StyleSheet.hairlineWidth }
        : { backgroundColor: palette.card, borderColor: palette['border-soft'], borderWidth: StyleSheet.hairlineWidth },
    idle: glass ? palette['foreground-soft'] : palette['muted-foreground'],
    // `primary` on `card` is 4.0:1 on the kit palette: enough for the glyph, not for an 11 px label.
    tint: palette.primary,
    tintLabel: palette.foreground,
    lens: palette.accent,
    onLens: palette['accent-foreground'],
    lensOpacity: 1,
  };
}

function Glyph({ icon, selected, color }: { icon: TabBarItem['icon'] | React.ReactNode; selected: boolean; color: string }) {
  if (typeof icon === 'function') return <>{icon({ selected, color, size: GLYPH })}</>;
  if (typeof icon === 'string') return <Icon name={icon as IconName} size={GLYPH} color={color} filled={selected} />;
  return <>{icon ?? null}</>;
}

export default function TabBar({
  items,
  activeKey,
  onSelect,
  onReselect,
  shape: form = 'floating',
  labels = 'always',
  indicator = 'lens',
  tone = 'default',
  action,
  overlay,
  bottom = layout.gutter,
  haptic = 'selection',
  accessibilityLabel,
  style,
}: TabBarProps) {
  const palette = usePalette();
  const bar = form === 'bar';
  const floats = overlay ?? !bar;
  const row = tabBarRowHeight();
  const inks = inksOf(tone, bar, palette);
  const center = action !== undefined && action.placement === 'center';
  const half = Math.ceil(items.length / 2);
  // An icon-only capsule hugs its tabs, one row-wide slot each, and centres (Shop, IMDb).
  const hug = !bar && labels === 'none';
  // Over the content, it tells the nearest DockInsetProvider how much it covers: its box, its lift (the
  // capsule's `bottom`; the bar holds it as padding), and the raised disc standing RISE + RING above the box.
  const placed = StyleSheet.flatten(style) ?? {};
  const lift = typeof placed.bottom === 'number' ? placed.bottom : floats && !bar ? bottom : 0;
  const onLayout = useReportDock({ bottom: lift + (center ? RISE + RING : 0), active: floats || placed.position === 'absolute' });

  const tab = (item: TabBarItem) => {
    const selected = item.key === activeKey;
    const solid = indicator === 'solid' && selected;
    const lens = indicator === 'lens' && selected;
    const showLabel = labels === 'always' || (labels === 'active' && selected);
    const beside = labels === 'active' && selected;
    const ink = solid ? palette['primary-foreground'] : lens ? inks.onLens : selected ? inks.tint : inks.idle;
    const labelInk = selected && !solid && !lens ? inks.tintLabel : ink;
    const mark = badgeMark(item.badge);
    // M3 bar with labels: the well sits behind the glyph only; everywhere else the lens or fill holds the whole item.
    const well = bar && labels === 'always' && (lens || solid);
    const fill = solid ? palette.primary : inks.lens;
    const fillOpacity = solid ? 1 : inks.lensOpacity;
    const round = !showLabel && !well;
    return (
      <Press
        key={item.key}
        onPress={() => (selected ? onReselect?.(item.key) : onSelect(item.key))}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={mark !== null && mark !== 'dot' ? withCount(item.label, mark.text) : item.label}
        accessibilityHint={item.accessibilityHint}
        haptic={haptic}
        style={[styles.item, hug ? { height: row, width: row - ROUND_INSET } : { height: row, flex: beside ? 1.7 : 1 }]}
      >
        {(lens || solid) && !well ? (
          <View
            pointerEvents="none"
            style={[
              // Placed by offsets, not alignSelf: on the web, align-self on an absolute box sizes it to its content (0 tall).
              round ? { top: ROUND_INSET, width: row - ROUND_INSET * 2, height: row - ROUND_INSET * 2, left: '50%', marginLeft: -(row / 2 - ROUND_INSET) } : styles.lensWide,
              { position: 'absolute', borderRadius: shape.control, backgroundColor: fill, opacity: fillOpacity },
            ]}
          />
        ) : null}
        <View style={[styles.face, beside ? styles.faceRow : null]}>
          <View>
            {well ? <View pointerEvents="none" style={[styles.well, { borderRadius: shape.control, backgroundColor: fill, opacity: fillOpacity }]} /> : null}
            <Glyph icon={item.icon} selected={selected} color={ink} />
            {mark === 'dot' ? (
              <View style={[styles.dot, { backgroundColor: palette.destructive }]} />
            ) : mark !== null ? (
              <View style={[styles.badge, { backgroundColor: palette.destructive }]}>
                <Text style={[type.caps, styles.badgeText, { color: palette['destructive-foreground'] }]}>{mark.text}</Text>
              </View>
            ) : null}
          </View>
          {showLabel ? (
            <Text numberOfLines={1} style={[type.caps, { color: labelInk }, beside ? styles.labelBeside : styles.label]}>
              {item.label}
            </Text>
          ) : null}
        </View>
      </Press>
    );
  };

  const disc = (raised: boolean) =>
    action === undefined ? null : (
      <Press
        key="action"
        onPress={action.onPress}
        accessibilityRole="button"
        accessibilityLabel={action.accessibilityLabel}
        haptic="medium"
        style={[
          styles.disc,
          raised
            ? { position: 'absolute', top: -RISE - RING, left: '50%', marginLeft: -(DISC / 2 + RING), width: DISC + RING * 2, height: DISC + RING * 2, borderWidth: RING, borderColor: (inks.surface.backgroundColor as string | undefined) ?? palette.background }
            : { width: row, height: row },
          { backgroundColor: palette.primary },
        ]}
      >
        <Glyph icon={action.icon} selected={false} color={palette['primary-foreground']} />
      </Press>
    );

  const tabs = center
    ? [...items.slice(0, half).map(tab), <View key="slot" style={[styles.slot, { height: row }]}>{disc(true)}</View>, ...items.slice(half).map(tab)]
    : items.map(tab);
  const endInBar = bar && action !== undefined && !center;

  const body = (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.row,
        inks.surface,
        bar
          ? { paddingBottom: bottom, paddingHorizontal: space[2] }
          : [{ height: row, borderRadius: shape.control, paddingHorizontal: INSET }, elevation[3], styles.capsule, hug ? styles.hug : null],
      ]}
    >
      {tabs}
      {endInBar ? <View style={[styles.slot, { height: row }]}>{disc(false)}</View> : null}
    </View>
  );

  const floatingEnd = !bar && action !== undefined && !center;
  return (
    <View
      pointerEvents="box-none"
      onLayout={onLayout}
      style={[
        floats ? styles.overlay : null,
        floats && !bar ? { left: layout.gutter, right: layout.gutter, bottom } : null,
        !floats && !bar ? { marginHorizontal: layout.gutter, marginBottom: bottom } : null,
        floatingEnd ? styles.withEnd : null,
        style,
      ]}
    >
      {floatingEnd ? <View style={styles.fill}>{body}</View> : body}
      {floatingEnd ? <View style={[elevation[3], { borderRadius: row / 2 }]}>{disc(false)}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  withEnd: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  fill: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  capsule: { alignItems: 'center' },
  hug: { alignSelf: 'center' },
  item: { minWidth: 44, alignItems: 'stretch', justifyContent: 'center' },
  lensWide: { top: INSET, bottom: INSET, left: 2, right: 2 },
  face: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  faceRow: { flexDirection: 'row', gap: space[1.5] },
  well: { position: 'absolute', top: (GLYPH - WELL.height) / 2, left: (GLYPH - WELL.width) / 2, width: WELL.width, height: WELL.height },
  label: { textAlign: 'center', letterSpacing: 0 },
  labelBeside: { letterSpacing: 0 },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  disc: { borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -5, left: GLYPH - 8, minWidth: BADGE, height: BADGE, paddingHorizontal: 4, borderRadius: BADGE / 2, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, lineHeight: 12, letterSpacing: 0 },
  dot: { position: 'absolute', top: -1, left: GLYPH - 4, width: DOT, height: DOT, borderRadius: DOT / 2 },
});
