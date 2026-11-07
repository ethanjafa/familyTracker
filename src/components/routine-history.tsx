import { addDays, format, isAfter, subWeeks } from 'date-fns';
import { Pressable, View } from 'react-native';

import { setLog } from '@/api/routines';
import { ThemedText } from '@/components/themed-text';
import { Card, Label } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { toDay, weekStart } from '@/lib/dates';
import { wasPlannedOn } from '@/lib/schedule';
import type { Routine, RoutineLog } from '@/lib/types';

const WEEKS = 4;
const HEADINGS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * The last few weeks of a routine's check-ins, to fix days that were missed or ticked by mistake.
 * Tap a day to tick it; tap again to clear it. Saves straight away.
 */
export function RoutineHistory({ routine, logs, userId }: { routine: Routine; logs: Map<string, RoutineLog> | undefined; userId: string }) {
  const theme = useTheme();
  const now = new Date();
  const first = subWeeks(weekStart(now), WEEKS - 1);

  return (
    <Card>
      <Label>Check-ins · last {WEEKS} weeks</Label>
      <ThemedText type="small" themeColor="textSecondary">
        Tap a day to tick it or clear it. This saves straight away. Outlined days were on the plan.
      </ThemedText>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {HEADINGS.map((h, i) => (
            <ThemedText key={i} type="small" themeColor="textSecondary" style={{ flex: 1, textAlign: 'center' }}>
              {h}
            </ThemedText>
          ))}
        </View>
        {Array.from({ length: WEEKS }, (_, w) => (
          <View key={w} style={{ flexDirection: 'row', gap: 6 }}>
            {Array.from({ length: 7 }, (_, i) => {
              const d = addDays(first, w * 7 + i);
              const key = toDay(d);
              const future = isAfter(d, now);
              const status = logs?.get(key)?.status;
              const planned = !future && wasPlannedOn(routine, d);
              const fill = status === 'done' ? theme.success : status === 'partial' ? theme.warning : 'transparent';
              return (
                <Pressable
                  key={key}
                  disabled={future}
                  onPress={() => setLog(routine, key, status ? null : 'done', userId)}
                  accessibilityRole="button"
                  accessibilityLabel={`${format(d, 'EEEE d MMMM')}: ${status ?? (planned ? 'missed' : 'not ticked')}`}
                  style={({ pressed }) => ({
                    flex: 1,
                    aspectRatio: 1,
                    maxHeight: 44,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: fill,
                    borderWidth: 2,
                    borderColor: status ? fill : planned ? theme.textSecondary : theme.backgroundSelected,
                    opacity: future ? 0.25 : pressed ? 0.6 : 1,
                  })}>
                  <ThemedText
                    type="small"
                    style={{ fontWeight: 700, color: status === 'done' || status === 'partial' ? '#fff' : undefined }}>
                    {status === 'done' ? '✓' : status === 'partial' ? '½' : status === 'skipped' ? '–' : format(d, 'd')}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </Card>
  );
}
