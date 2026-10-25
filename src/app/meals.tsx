import { addWeeks } from 'date-fns';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { MealPlanner } from '@/components/plan/meal-planner';
import { Screen, Segmented } from '@/components/ui';
import { fromDay, toDay, weekDays, weekStart } from '@/lib/dates';

/** Lunch and dinner for each day, from one shared meal backlog. Opened from Plan. */
export default function MealsScreen() {
  const params = useLocalSearchParams<{ week?: string }>();
  const thisWeek = weekStart(new Date());
  const [start, setStart] = useState(() => (params.week ? fromDay(params.week) : thisWeek));
  const isNext = toDay(start) !== toDay(thisWeek);

  return (
    <>
      <Stack.Screen options={{ title: 'Meals' }} />
      <Screen>
        <Segmented
          options={[
            { value: 'this', label: 'This week' },
            { value: 'next', label: 'Next week' },
          ]}
          value={isNext ? 'next' : 'this'}
          onChange={(v) => setStart(v === 'next' ? addWeeks(thisWeek, 1) : thisWeek)}
        />
        <MealPlanner days={weekDays(start)} />
      </Screen>
    </>
  );
}
