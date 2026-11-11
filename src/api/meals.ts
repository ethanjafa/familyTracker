import { useQuery } from '@tanstack/react-query';

import { needGroceries } from '@/api/groceries';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import { hasPending, inOrder } from '@/lib/write-queue';
import type { Meal, MealPlan, MealSlot } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

export function useMeals() {
  const { household } = useHousehold();
  return useQuery({
    queryKey: ['meals', household.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('meals').select('*').eq('household_id', household.id).order('name');
      if (error) throw error;
      return data as Meal[];
    },
  });
}

/** Every planned dinner (past ones tell us when a meal was last had). */
export function useMealPlans() {
  const { household } = useHousehold();
  return useQuery({
    queryKey: ['meal_plans', household.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('meal_plans').select('*').eq('household_id', household.id);
      if (error) throw error;
      return data as MealPlan[];
    },
  });
}

export async function saveMeal(values: Partial<Meal> & Pick<Meal, 'household_id' | 'name'>) {
  const { error } = values.id
    ? await supabase.from('meals').update(values).eq('id', values.id)
    : await supabase.from('meals').insert(values);
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['meals'] });
}

export async function deleteMeal(id: string) {
  const { error } = await supabase.from('meals').delete().eq('id', id);
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['meals'] });
  await queryClient.invalidateQueries({ queryKey: ['meal_plans'] });
}

/**
 * Put a meal on a day's lunch or dinner (replacing whatever was planned) and add its missing
 * ingredients to the shopping list. Returns how many groceries went on the list.
 */
export async function planMeal(meal: Meal, day: string, slot: MealSlot, cookId: string | null) {
  const { error } = await supabase
    .from('meal_plans')
    .upsert(
      { household_id: meal.household_id, meal_id: meal.id, plan_date: day, slot, cook_id: cookId },
      { onConflict: 'household_id,plan_date,slot' },
    );
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['meal_plans'] });
  return needGroceries(meal.household_id, meal.ingredients, meal.name);
}

/** Who cooks a planned meal (from the meal planner). */
export const setCook = (plan: MealPlan, cookId: string | null) =>
  setMealCook(plan.household_id, plan.plan_date, plan.slot, cookId);

/**
 * Who cooks a day's lunch or dinner. Works before a meal is chosen; clearing the cook of a slot
 * without a meal removes its row. Optimistic, and safe to tap quickly: the row is addressed by its
 * day and slot (never by an id that may not exist yet), and saves for one slot go out in order.
 */
export async function setMealCook(householdId: string, day: string, slot: MealSlot, cookId: string | null) {
  const key = ['meal_plans', householdId];
  const here = (p: MealPlan) => p.plan_date === day && p.slot === slot;
  const current = queryClient
    .getQueriesData<MealPlan[]>({ queryKey: key })
    .flatMap(([, plans]) => plans ?? [])
    .find(here);
  if (!current && !cookId) return;
  const removes = !cookId && !current?.meal_id;

  // The box changes at once (before anything is awaited), so a second quick tap sees the first.
  const cancelled = queryClient.cancelQueries({ queryKey: key });
  queryClient.setQueriesData<MealPlan[]>({ queryKey: key }, (old) => {
    const rest = (old ?? []).filter((p) => !here(p));
    if (removes) return rest;
    return [...rest, { id: current?.id ?? `optimistic-${day}-${slot}`, household_id: householdId, meal_id: current?.meal_id ?? null, plan_date: day, slot, cook_id: cookId }];
  });

  await cancelled;

  const queue = `meal_plans|${householdId}|`;
  try {
    await inOrder(`${queue}${day}|${slot}`, async () => {
      const where = { household_id: householdId, plan_date: day, slot };
      const { error } = removes
        ? await supabase.from('meal_plans').delete().match(where).is('meal_id', null)
        : await supabase.from('meal_plans').upsert({ ...where, cook_id: cookId }, { onConflict: 'household_id,plan_date,slot' });
      if (error) throw error;
    });
  } finally {
    // Reload once the last tap has been saved, so an earlier answer can't undo a later tap.
    if (!hasPending(queue)) await queryClient.invalidateQueries({ queryKey: key });
  }
}

/** Back to the backlog: the meal itself stays for next time. */
export async function unplanMeal(id: string) {
  const { error } = await supabase.from('meal_plans').delete().eq('id', id);
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['meal_plans'] });
}
