import { useQuery } from '@tanstack/react-query';

import { needGroceries } from '@/api/groceries';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
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

export async function setCook(plan: MealPlan, cookId: string | null) {
  const { error } = await supabase.from('meal_plans').update({ cook_id: cookId }).eq('id', plan.id);
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['meal_plans'] });
}

/**
 * Who cooks a day's lunch or dinner, from the Plan table. Works before a meal is chosen;
 * clearing the cook of a slot without a meal removes its row. Optimistic.
 */
export async function setMealCook(
  householdId: string,
  day: string,
  slot: MealSlot,
  cookId: string | null,
  existing: MealPlan | undefined,
) {
  if (!existing && !cookId) return;
  const key = ['meal_plans', householdId];
  queryClient.setQueriesData<MealPlan[]>({ queryKey: key }, (old) => {
    const rest = (old ?? []).filter((p) => !(p.plan_date === day && p.slot === slot));
    if (!cookId && !existing?.meal_id) return rest;
    return [...rest, { id: existing?.id ?? `optimistic-${day}-${slot}`, household_id: householdId, meal_id: existing?.meal_id ?? null, plan_date: day, slot, cook_id: cookId }];
  });
  const { error } = existing
    ? !cookId && !existing.meal_id
      ? await supabase.from('meal_plans').delete().eq('id', existing.id)
      : await supabase.from('meal_plans').update({ cook_id: cookId }).eq('id', existing.id)
    : await supabase.from('meal_plans').insert({ household_id: householdId, meal_id: null, plan_date: day, slot, cook_id: cookId });
  await queryClient.invalidateQueries({ queryKey: key });
  if (error) throw error;
}

/** Back to the backlog: the meal itself stays for next time. */
export async function unplanMeal(id: string) {
  const { error } = await supabase.from('meal_plans').delete().eq('id', id);
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['meal_plans'] });
}
