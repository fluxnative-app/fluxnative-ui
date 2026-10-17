import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Chip from './Chip';
import type { Shelf } from '../data/shelf';
import { shelfGap } from '../theme/brand';
import { space, text } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';

export default function ShelfCard({ shelf, onOpen }: { shelf: Shelf; onOpen: (id: string) => void }) {
  const palette = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: palette.card }]}>
      <Text style={[text.base, { color: palette['card-foreground'] }]}>{shelf.title}</Text>
      <Chip label={`${shelf.count} books`} onPress={() => onOpen(shelf.id)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space[4], gap: shelfGap },
});
