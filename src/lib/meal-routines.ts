import type { Household, MealPlan, MealSlot, Routine, RoutinePlan, Schedule } from '@/lib/types';

/**
 * "Make lunch" and "Cook dinner" are real routines every family has, so cooking can be ticked off
 * on Today and counts towards scores. They have no days of their own: who cooks is chosen on the
 * Assign page (stored with the meal plan), and the routine is on exactly the days that have a cook.
 */
const NO_DAYS: Schedule = { type: 'weekdays', days: [] };

/** Which meal a routine stands for, or null for an ordinary routine. */
export function mealSlotOf(household: Household, routineId: string): MealSlot | null {
  if (routineId === household.lunch_routine_id) return 'lunch';
  if (routineId === household.dinner_routine_id) return 'dinner';
  return null;
}

/** Meal routines get their days and owners from the meal plan's cooks; other routines pass through. */
export function withMealCooks(routines: Routine[], mealPlans: MealPlan[], household: Household): Routine[] {
  return routines.map((r) => {
    const slot = mealSlotOf(household, r.id);
    if (!slot) return r;
    const plans = new Map<string, RoutinePlan>();
    for (const p of mealPlans) {
      if (p.slot !== slot || !p.cook_id) continue;
      plans.set(p.plan_date, {
        id: p.id,
        routine_id: r.id,
        household_id: r.household_id,
        plan_date: p.plan_date,
        planned: true,
        assignee_id: p.cook_id,
      });
    }
    return { ...r, schedule: NO_DAYS, assignee_ids: [], day_assignees: {}, plans };
  });
}
