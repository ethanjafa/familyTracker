import { addWeeks } from 'date-fns';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { GroceryList } from '@/components/plan/grocery-list';
import { MealPlanner } from '@/components/plan/meal-planner';
import { Screen, Segmented } from '@/components/ui';
import { weekDays, weekStart } from '@/lib/dates';

type View = 'groceries' | 'meals';
type Week = 'this' | 'next';

/**
 * Food: the grocery list and the meal plan side by side, since planning a meal puts its missing
 * ingredients on the list. Opens on Groceries; Today's "Plan meals" tile opens it on Meals.
 */
export default function FoodScreen() {
  const params = useLocalSearchParams<{ view?: string }>();
  const view: View = params.view === 'meals' ? 'meals' : 'groceries';
  const [week, setWeek] = useState<Week>('this');
  const start = addWeeks(weekStart(new Date()), week === 'next' ? 1 : 0);

  return (
    <>
      <Stack.Screen options={{ title: view === 'meals' ? 'Meal plan' : 'Groceries' }} />
      <Screen>
        <Segmented
          options={[
            { value: 'groceries', label: '🛒 Groceries' },
            { value: 'meals', label: '🍽️ Meal plan' },
          ]}
          value={view}
          onChange={(v) => router.setParams({ view: v })}
        />
        {view === 'groceries' ? (
          <GroceryList />
        ) : (
          <>
            <Segmented
              options={[
                { value: 'this', label: 'This week' },
                { value: 'next', label: 'Next week' },
              ]}
              value={week}
              onChange={setWeek}
            />
            <MealPlanner days={weekDays(start)} />
          </>
        )}
      </Screen>
    </>
  );
}
