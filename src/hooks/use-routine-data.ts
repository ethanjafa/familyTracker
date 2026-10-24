import { useMemo } from 'react';

import { useRoutinePlans } from '@/api/plans';
import { useCategories, useLogs, useRoutines } from '@/api/routines';
import { indexLogs } from '@/lib/scoring';
import type { Routine, RoutinePlan } from '@/lib/types';

/** Routines with their plan changes attached, so schedule helpers see the planned week. */
function withPlans(routines: Routine[], plans: RoutinePlan[]): Routine[] {
  const byRoutine = new Map<string, Map<string, RoutinePlan>>();
  for (const p of plans) {
    let byDay = byRoutine.get(p.routine_id);
    if (!byDay) byRoutine.set(p.routine_id, (byDay = new Map()));
    byDay.set(p.plan_date, p);
  }
  return routines.map((r) => (byRoutine.has(r.id) ? { ...r, plans: byRoutine.get(r.id) } : r));
}

/** Categories, routines (with plans) and recent logs, plus lookup maps used by most screens. */
export function useRoutineData() {
  const categories = useCategories();
  const routines = useRoutines();
  const logs = useLogs();
  // Plans are optional: until the planning migration runs, routines just follow their schedules.
  const plans = useRoutinePlans();

  return useMemo(
    () => ({
      categories: categories.data ?? [],
      routines: withPlans(routines.data ?? [], plans.data ?? []),
      logs: logs.data ?? [],
      logIndex: indexLogs(logs.data ?? []),
      categoryById: new Map((categories.data ?? []).map((c) => [c.id, c])),
      isLoading: categories.isPending || routines.isPending || logs.isPending,
      isRefetching: categories.isRefetching || routines.isRefetching || logs.isRefetching,
      refetch: () => Promise.all([categories.refetch(), routines.refetch(), logs.refetch(), plans.refetch()]),
    }),
    [categories, routines, logs, plans],
  );
}
