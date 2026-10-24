import { useQuery } from '@tanstack/react-query';
import { subWeeks } from 'date-fns';
import { Alert } from 'react-native';

import { toDay, weekStart } from '@/lib/dates';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import type { LogStatus, Routine, RoutineCategory, RoutineLog } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

/** Logs are loaded for this many weeks back; enough for streaks, trends and month views. */
export const LOG_WEEKS = 12;
export const logsSince = () => toDay(subWeeks(weekStart(new Date()), LOG_WEEKS));

export function useCategories() {
  const { household } = useHousehold();
  return useQuery({
    queryKey: ['routine_categories', household.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routine_categories')
        .select('*')
        .eq('household_id', household.id)
        .order('sort_order')
        .order('created_at');
      if (error) throw error;
      return data as RoutineCategory[];
    },
  });
}

export function useRoutines() {
  const { household } = useHousehold();
  return useQuery({
    queryKey: ['routines', household.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routines')
        .select('*')
        .eq('household_id', household.id)
        .is('archived_at', null)
        .order('created_at');
      if (error) throw error;
      return data as Routine[];
    },
  });
}

export function useLogs() {
  const { household } = useHousehold();
  const since = logsSince();
  return useQuery({
    queryKey: ['routine_logs', household.id, since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routine_logs')
        .select('*')
        .eq('household_id', household.id)
        .gte('log_date', since);
      if (error) throw error;
      return data as RoutineLog[];
    },
  });
}

export async function saveCategory(values: Partial<RoutineCategory> & Pick<RoutineCategory, 'household_id' | 'name'>) {
  const { error } = values.id
    ? await supabase.from('routine_categories').update(values).eq('id', values.id)
    : await supabase.from('routine_categories').insert(values);
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['routine_categories'] });
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from('routine_categories').delete().eq('id', id);
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['routine_categories'] });
  await queryClient.invalidateQueries({ queryKey: ['routines'] });
}

export async function saveRoutine(
  values: Partial<Routine> & Pick<Routine, 'household_id' | 'category_id' | 'name'>,
) {
  const { error } = values.id
    ? await supabase.from('routines').update(values).eq('id', values.id)
    : await supabase.from('routines').insert(values);
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['routines'] });
}

type NewRoutine = Pick<Routine, 'name' | 'schedule' | 'time_of_day' | 'weight'>;

/** Add several routines to a category at once (e.g. from suggestions). */
export async function addRoutines(householdId: string, categoryId: string, routines: NewRoutine[]) {
  if (!routines.length) return;
  const { error } = await supabase
    .from('routines')
    .insert(routines.map((r) => ({ ...r, household_id: householdId, category_id: categoryId })));
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['routines'] });
}

/** Create a category together with its first routines. */
export async function addCategoryWithRoutines(
  category: Pick<RoutineCategory, 'household_id' | 'name' | 'icon' | 'visibility'>,
  routines: NewRoutine[],
) {
  const { data, error } = await supabase.from('routine_categories').insert(category).select('id').single();
  if (error) throw error;
  await addRoutines(category.household_id, data.id, routines);
  await queryClient.invalidateQueries({ queryKey: ['routine_categories'] });
}

/** Archiving keeps history in old scorecards; the routine just stops appearing. */
export async function archiveRoutine(id: string) {
  const { error } = await supabase
    .from('routines')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['routines'] });
}

/** Set (or clear, with null) a routine's log for a day. Updates the cache optimistically. */
export async function setLog(routine: Routine, day: string, status: LogStatus | null, userId: string) {
  const key = ['routine_logs', routine.household_id];
  await queryClient.cancelQueries({ queryKey: key });
  queryClient.setQueriesData<RoutineLog[]>({ queryKey: key }, (old) => {
    const rest = (old ?? []).filter((l) => !(l.routine_id === routine.id && l.log_date === day));
    if (!status) return rest;
    return [
      ...rest,
      {
        id: `optimistic-${routine.id}-${day}`,
        routine_id: routine.id,
        household_id: routine.household_id,
        user_id: userId,
        log_date: day,
        status,
        note: null,
      },
    ];
  });

  const { error } = status
    ? await supabase.from('routine_logs').upsert(
        {
          routine_id: routine.id,
          household_id: routine.household_id,
          user_id: userId,
          log_date: day,
          status,
        },
        { onConflict: 'routine_id,log_date' },
      )
    : await supabase.from('routine_logs').delete().eq('routine_id', routine.id).eq('log_date', day);
  if (error) Alert.alert('Could not save', error.message);
  await queryClient.invalidateQueries({ queryKey: key });
}
