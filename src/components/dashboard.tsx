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
  /** Draw attention (something needs doing). */
  alert?: boolean;
};

/** Shortcut tiles on Today, three to a row. */
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
        { backgroundColor: theme.card, borderColor: tile.alert ? theme.warning : theme.border },
        elevation,
        { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}>
      <ThemedText style={{ fontSize: 24, lineHeight: 30 }}>{tile.icon}</ThemedText>
      <ThemedText type="smallBold" numberOfLines={1}>
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
    // Three per row, with the grid's two gaps shared between them.
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 104,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 2,
  },
});
