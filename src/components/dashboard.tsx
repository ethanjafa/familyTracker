import { type Href, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useElevation } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Tile = {
  icon: string;
  title: string;
  /** One short line of live status, e.g. "5 to buy". */
  detail: string;
  href: Href;
  /** The tile's own colour (background tint, icon circle and title). */
  color: string;
  /** Draw attention (something needs doing). */
  alert?: boolean;
};

/** Shortcut tiles on Today, two to a row. */
export function Dashboard({ tiles }: { tiles: Tile[] }) {
  return (
    <View style={local.grid}>
      {tiles.map((t) => (
        <DashboardTile key={t.title} tile={t} />
      ))}
    </View>
  );
}

function DashboardTile({ tile }: { tile: Tile }) {
  const theme = useTheme();
  const elevation = useElevation();
  return (
    <Pressable
      onPress={() => router.navigate(tile.href)}
      style={({ pressed }) => [
        local.tile,
        { backgroundColor: `${tile.color}1F`, borderColor: tile.alert ? theme.warning : `${tile.color}40` },
        elevation,
        { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}>
      <View style={[local.icon, { backgroundColor: tile.color }]}>
        <ThemedText style={{ fontSize: 20, lineHeight: 26 }}>{tile.icon}</ThemedText>
      </View>
      <ThemedText type="smallBold" numberOfLines={1} style={{ color: tile.color, fontSize: 15 }}>
        {tile.title}
      </ThemedText>
      <ThemedText
        type="small"
        numberOfLines={2}
        style={{ fontSize: 12, lineHeight: 16, color: tile.alert ? theme.warning : theme.textSecondary }}>
        {tile.detail}
      </ThemedText>
    </Pressable>
  );
}

const local = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tile: {
    // Two per row, with the grid's gap between them.
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 92,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 4,
  },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
});
