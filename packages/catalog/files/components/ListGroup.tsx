// Rows grouped on one surface, the way a settings screen groups them: a
// caps title above, the rows separated by inset hairlines, a helper line
// below. 'inset' (default) sets the group on a `card` with `shape.card`
// corners; 'plain' runs the rows edge to edge under full-width rules.
// Each row gets the gutter as horizontal padding.

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { layout, shape, space, type } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import Divider from './Divider';

export type ListGroupVariant = 'inset' | 'plain';

export interface ListGroupProps {
  /** The rows (ListRow, or anything row-shaped). */
  children?: React.ReactNode;
  /** Caps line above the group. */
  title?: string;
  /** Helper text under the group. */
  footer?: string;
  /** Default 'inset'. */
  variant?: ListGroupVariant;
  /** Where the rules between rows start, in px from the group's edge. Default `layout.gutter`; 'plain' rules ignore it. */
  ruleInset?: number;
  style?: StyleProp<ViewStyle>;
}

export default function ListGroup({ children, title, footer, variant = 'inset', ruleInset = layout.gutter, style }: ListGroupProps) {
  const palette = usePalette();
  const rows = React.Children.toArray(children);
  const inset = variant === 'inset';
  return (
    <View style={style}>
      {title !== undefined ? (
        <Text style={[type.caps, styles.title, { color: palette['muted-foreground'] }]}>{title.toUpperCase()}</Text>
      ) : null}
      <View style={inset ? { backgroundColor: palette.card, borderRadius: shape.card, overflow: 'hidden' } : null}>
        {rows.map((row, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <Divider inset={inset ? ruleInset : 0} /> : null}
            <View style={styles.row}>{row}</View>
          </React.Fragment>
        ))}
      </View>
      {footer !== undefined ? (
        <Text style={[type.bodySm, styles.footer, { color: palette['muted-foreground'] }]}>{footer}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: space[2], marginLeft: layout.gutter },
  row: { paddingHorizontal: layout.gutter },
  footer: { marginTop: space[2], marginHorizontal: layout.gutter },
});
