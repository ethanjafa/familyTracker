import { addWeeks } from 'date-fns';
import { Stack } from 'expo-router';
import { useState } from 'react';

import { PlanTable } from '@/components/plan/plan-table';
import { Screen, Segmented } from '@/components/ui';
import { useRoutineData } from '@/hooks/use-routine-data';
import { weekDays, weekStart } from '@/lib/dates';

type Week = 'this' | 'next';

/**
 * Plan: who does what this week or next. Planning itself is the "Plan the week together" task
 * on Today; meals and groceries are on Today's dashboard.
 */
export default function PlanScreen() {
  const data = useRoutineData();
  const [week, setWeek] = useState<Week>('this');

  const start = addWeeks(weekStart(new Date()), week === 'next' ? 1 : 0);

  return (
    <>
      <Stack.Screen options={{ title: 'Plan' }} />
      <Screen onRefresh={data.refetch} refreshing={data.isRefetching}>
        <Segmented
          options={[
            { value: 'this', label: 'This week' },
            { value: 'next', label: 'Next week' },
          ]}
          value={week}
          onChange={setWeek}
        />
        <PlanTable days={weekDays(start)} />
      </Screen>
    </>
  );
}
