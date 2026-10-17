import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import flux from 'flux';
import { GlassSurface } from 'flux/glass';
import { useNavigation } from 'flux/navigation';
import Chip from '../components/Chip';
import ShelfCard from '../components/ShelfCard';
import { SHELVES } from '../data/shelf';
import { space, text } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';

type PreviewState = 'live' | 'empty';

export default function ShelfScreen({ previewState = 'live' }: { previewState?: PreviewState }) {
  const palette = usePalette();
  const navigation = useNavigation();
  const shelves = previewState === 'empty' ? [] : SHELVES;
  const first = shelves[0];
  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={styles.content}>
      <GlassSurface role="bar">
        <Text style={[text.base, { color: palette.foreground }]}>{first ? first.title : 'No shelves yet'}</Text>
      </GlassSurface>
      <Chip label="All shelves" selected onPress={() => flux.ui.toast('All shelves')} />
      {shelves.map((shelf) => (
        <ShelfCard key={shelf.id} shelf={shelf} onOpen={(id) => navigation.push('Shelf', { id })} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space[4], gap: space[3] },
});
