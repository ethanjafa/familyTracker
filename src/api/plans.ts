import { useQuery } from '@tanstack/react-query';

import { logsSince } from '@/api/routines';
import { showAlert } from '@/lib/dialogs';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import type { Routine, RoutinePlan } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

/** Plan changes from the same window as logs onwards, including future weeks. */
export function useRoutinePlans() {
  const { household } = useHousehold();
  const since = logsSince();
  return useQuery({
    queryKey: ['routine_plans', household.id, since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routine_plans')
        .select('*')
        .eq('household_id', household.id)
        .gte('plan_date', since);
      if (error) throw error;
      return data as RoutinePlan[];
    },
  });
}

export type PlanChange = { planned: boolean; assignee_id: string | null } | null;

/**
 * Change one day of a routine's plan. `null` goes back to the usual schedule.
 * Updates the cache optimistically so the week grid responds instantly.
 */
export async function setRoutinePlan(routine: Routine, day: string, change: PlanChange) {
  const key = ['routine_plans', routine.household_id];
  await queryClient.cancelQueries({ queryKey: key });
  queryClient.setQueriesData<RoutinePlan[]>({ queryKey: key }, (old) => {
    const rest = (old ?? []).filter((p) => !(p.routine_id === routine.id && p.plan_date === day));
    if (!change) return rest;
    return [
      ...rest,
      { id: `optimistic-${routine.id}-${day}`, routine_id: routine.id, household_id: routine.household_id, plan_date: day, ...change },
    ];
  });

  const { error } = change
    ? await supabase
        .from('routine_plans')
        .upsert(
          { routine_id: routine.id, household_id: routine.household_id, plan_date: day, ...change },
          { onConflict: 'routine_id,plan_date' },
        )
    : await supabase.from('routine_plans').delete().eq('routine_id', routine.id).eq('plan_date', day);
  if (error) showAlert('Could not save the plan', error.message);
  await queryClient.invalidateQueries({ queryKey: key });
}

/** Undo every plan change in a date range (e.g. "reset this week"). */
export async function resetRoutinePlans(householdId: string, from: string, to: string) {
  const { error } = await supabase
    .from('routine_plans')
    .delete()
    .eq('household_id', householdId)
    .gte('plan_date', from)
    .lte('plan_date', to);
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['routine_plans'] });
}
