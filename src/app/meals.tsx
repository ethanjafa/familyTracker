import { addWeeks } from 'date-fns';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { MealPlanner } from '@/components/plan/meal-planner';
import { Screen, Segmented } from '@/components/ui';
import { fromDay, toDay, weekDays, weekStart } from '@/lib/dates';
import type { MealSlot } from '@/lib/types';

/** Pick each day's lunch and dinner from the meal backlog. Opened from Plan. */
export default function MealsScreen() {
  const params = useLocalSearchParams<{ week?: string }>();
  const thisWeek = weekStart(new Date());
  const [slot, setSlot] = useState<MealSlot>('dinner');
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
        <Segmented
          options={[
            { value: 'lunch', label: '🥪 Lunch' },
            { value: 'dinner', label: '🍽️ Dinner' },
          ]}
          value={slot}
          onChange={setSlot}
        />
        <MealPlanner days={weekDays(start)} slot={slot} />
      </Screen>
    </>
  );
}
