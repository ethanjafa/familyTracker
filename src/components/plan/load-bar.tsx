import { StyleSheet, View } from 'react-native';

import { firstName } from '@/components/plan/pickers';
import { ThemedText } from '@/components/themed-text';
import { Card, styles } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useHousehold } from '@/providers/household-provider';

/** How far above an even split someone can be before we suggest rebalancing. */
const UNEVEN_BY = 0.15;

/**
 * Who carries the week: each person's share of the planned tasks, in their colour.
 * `counts` is tasks per person; `open` is tasks nobody has yet.
 */
export function LoadBar({ counts, open }: { counts: Map<string, number>; open: number }) {
  const theme = useTheme();
  const { members, memberColor } = useHousehold();
  const assigned = [...counts.values()].reduce((a, b) => a + b, 0);
  if (assigned + open === 0) return null;

  const people = members.map((m) => ({ member: m, count: counts.get(m.user_id) ?? 0 }));
  const share = (n: number) => (assigned ? n / assigned : 0);
  const busiest = [...people].sort((a, b) => b.count - a.count)[0];
  const uneven = members.length > 1 && assigned > 0 && share(busiest.count) - 1 / members.length > UNEVEN_BY;

  return (
    <Card style={{ gap: 10 }}>
      <ThemedText type="smallBold">⚖️ Who&apos;s carrying the week</ThemedText>
      <View style={[local.bar, { backgroundColor: theme.backgroundElement }]}>
        {people.map(({ member, count }) =>
          count ? <View key={member.user_id} style={{ flex: count, backgroundColor: memberColor(member.user_id) }} /> : null,
        )}
        {open > 0 && <View style={{ flex: open, backgroundColor: theme.backgroundSelected }} />}
      </View>
      <View style={[styles.wrap, { columnGap: 14, rowGap: 4 }]}>
        {people.map(({ member, count }) => (
          <View key={member.user_id} style={local.legend}>
            <View style={[local.dot, { backgroundColor: memberColor(member.user_id) }]} />
            <ThemedText type="small">
              <ThemedText type="smallBold">{firstName(member.profile.display_name)}</ThemedText> {count} ·{' '}
              {Math.round(100 * share(count))}%
            </ThemedText>
          </View>
        ))}
        {open > 0 && (
          <View style={local.legend}>
            <View style={[local.dot, { backgroundColor: theme.backgroundSelected }]} />
            <ThemedText type="small" themeColor="textSecondary">
              Nobody yet {open}
            </ThemedText>
          </View>
        )}
      </View>
      {assigned > 0 && members.length > 1 && (
        <ThemedText type="small" style={{ color: uneven ? theme.warning : theme.success }}>
          {uneven
            ? `${firstName(busiest.member.profile.display_name)} has ${Math.round(100 * share(busiest.count))}% of this week. Swap a few boxes to even it out.`
            : 'Nicely balanced 👍'}
        </ThemedText>
      )}
    </Card>
  );
}

const local = StyleSheet.create({
  bar: { flexDirection: 'row', height: 12, borderRadius: Radius.pill, overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
