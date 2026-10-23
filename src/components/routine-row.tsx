import { Alert, Pressable, View } from 'react-native';

import { setLog } from '@/api/routines';
import { ThemedText } from '@/components/themed-text';
import { Avatar, styles } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fromDay } from '@/lib/dates';
import { completedBetween, flexibleTarget, isFlexible, periodStart } from '@/lib/schedule';
import type { LogStatus, Member, Routine, RoutineCategory, RoutineLog } from '@/lib/types';

const MARK: Record<LogStatus, string> = { done: '✓', partial: '½', skipped: '–' };

type Props = {
  routine: Routine;
  category: RoutineCategory;
  day: string;
  logs: Map<string, RoutineLog> | undefined;
  streak: number;
  userId: string;
  memberById: Map<string, Member>;
};

/** A checkable routine. Tap toggles done; long-press offers partial / skip. */
export function RoutineRow({ routine, category, day, logs, streak, userId, memberById }: Props) {
  const theme = useTheme();
  const log = logs?.get(day);
  const status = log?.status;

  const toggle = () => setLog(routine, day, status ? null : 'done', userId);
  const more = () =>
    Alert.alert(routine.name, undefined, [
      { text: 'Done', onPress: () => setLog(routine, day, 'done', userId) },
      { text: 'Partly done', onPress: () => setLog(routine, day, 'partial', userId) },
      { text: "Skip (doesn't count)", onPress: () => setLog(routine, day, 'skipped', userId) },
      ...(status ? [{ text: 'Clear', style: 'destructive' as const, onPress: () => setLog(routine, day, null, userId) }] : []),
      { text: 'Cancel', style: 'cancel' },
    ]);

  const details: string[] = [`${category.icon} ${category.name}`];
  if (isFlexible(routine.schedule)) {
    const done = completedBetween(logs, periodStart(routine.schedule, fromDay(day)), fromDay(day));
    details.push(`${done}/${flexibleTarget(routine.schedule)} this ${routine.schedule.type === 'monthly' ? 'month' : 'week'}`);
  }
  const loggedBy = log && log.user_id !== userId ? memberById.get(log.user_id) : undefined;
  if (loggedBy) details.push(`by ${loggedBy.profile.display_name}`);

  const checkColor = status === 'done' ? theme.success : status === 'partial' ? theme.warning : theme.textSecondary;

  return (
    <Pressable onPress={toggle} onLongPress={more} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1, paddingVertical: 6 }]}>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          borderWidth: 2,
          borderColor: status ? checkColor : theme.backgroundSelected,
          backgroundColor: status && status !== 'skipped' ? checkColor : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {status && (
          <ThemedText style={{ color: status === 'skipped' ? checkColor : '#fff', fontWeight: 800 }}>{MARK[status]}</ThemedText>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText
          style={status === 'done' || status === 'skipped' ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}>
          {routine.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {details.join(' · ')}
        </ThemedText>
      </View>
      {routine.assignee_ids.length > 0 && (
        <View style={{ flexDirection: 'row' }}>
          {routine.assignee_ids.slice(0, 3).map((id) => (
            <View key={id} style={{ marginLeft: -6 }}>
              <Avatar profile={memberById.get(id)?.profile} size={22} />
            </View>
          ))}
        </View>
      )}
      {streak >= 2 && <ThemedText type="smallBold">🔥{streak}</ThemedText>}
    </Pressable>
  );
}
