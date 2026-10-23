import { useMemo } from 'react';

import { useCategories, useLogs, useRoutines } from '@/api/routines';
import { indexLogs } from '@/lib/scoring';

/** Categories, routines and recent logs, plus lookup maps used by most screens. */
export function useRoutineData() {
  const categories = useCategories();
  const routines = useRoutines();
  const logs = useLogs();

  return useMemo(
    () => ({
      categories: categories.data ?? [],
      routines: routines.data ?? [],
      logs: logs.data ?? [],
      logIndex: indexLogs(logs.data ?? []),
      categoryById: new Map((categories.data ?? []).map((c) => [c.id, c])),
      isLoading: categories.isPending || routines.isPending || logs.isPending,
      isRefetching: categories.isRefetching || routines.isRefetching || logs.isRefetching,
      refetch: () => Promise.all([categories.refetch(), routines.refetch(), logs.refetch()]),
    }),
    [categories, routines, logs],
  );
}
