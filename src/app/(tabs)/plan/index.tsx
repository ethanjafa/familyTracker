import { addWeeks } from 'date-fns';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useGroceries } from '@/api/groceries';
import { setLog } from '@/api/routines';
import { PlanTable } from '@/components/plan/plan-table';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Screen, Segmented, styles } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useRoutineData } from '@/hooks/use-routine-data';
import { toDay, weekDays, weekRange, weekStart } from '@/lib/dates';
import { isWeekPlanned, lastPlanningDay } from '@/lib/planning';
import { useHousehold } from '@/providers/household-provider';

type Week = 'this' | 'next';

export default function PlanScreen() {
  const { household, userId } = useHousehold();
  const data = useRoutineData();
  const groceries = useGroceries();
  const [week, setWeek] = useState<Week>('this');
  const [planning, setPlanning] = useState(false);

  const now = new Date();
  const start = addWeeks(weekStart(now), week === 'next' ? 1 : 0);
  const days = weekDays(start);
  const toBuy = (groceries.data ?? []).filter((i) => i.status === 'need').length;

  // The planning task for this cycle: the most recent planning day, today included.
  const planningRoutine = data.routines.find((r) => r.id === household.planning_routine_id);
  const planned = isWeekPlanned(household, data.logIndex, now);

  const startPlanning = () => {
    setWeek('next');
    setPlanning(true);
  };
  const finish = async () => {
    setPlanning(false);
    if (planningRoutine && !planned) await setLog(planningRoutine, lastPlanningDay(household, now), 'done', userId);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Plan' }} />
      <Screen onRefresh={data.refetch} refreshing={data.isRefetching}>
        {planning ? (
          <Card>
            <ThemedText type="heading">⛵ Planning {weekRange(start)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Give every ⚠️ row someone for each day. When it looks right, tap Done.
            </ThemedText>
          </Card>
        ) : (
          <Button title={planned ? '✏️ Edit plan' : '⛵ Plan next week'} onPress={startPlanning} />
        )}

        <View style={[styles.row, { gap: Spacing.two }]}>
          <View style={{ flex: 1 }}>
            <Button
              title="🍽️ Meals"
              variant="secondary"
              onPress={() => router.push({ pathname: '/meals', params: { week: toDay(start) } })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={toBuy ? `🛒 Groceries · ${toBuy}` : '🛒 Groceries'} variant="secondary" onPress={() => router.push('/groceries')} />
          </View>
        </View>

        <Segmented
          options={[
            { value: 'this', label: 'This week' },
            { value: 'next', label: 'Next week' },
          ]}
          value={week}
          onChange={setWeek}
        />

        <PlanTable days={days} />

        {planning && <Button title="✓ Done planning" onPress={finish} />}
      </Screen>
    </>
  );
}
