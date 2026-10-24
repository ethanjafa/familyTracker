import { useEffect } from 'react';

import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';

/** Table -> query keys to refresh when another family member changes it. */
const TABLES: Record<string, string[]> = {
  routine_categories: ['routine_categories'],
  routines: ['routines'],
  routine_logs: ['routine_logs'],
  projects: ['projects'],
  project_items: ['project_items'],
  routine_plans: ['routine_plans'],
  meals: ['meals'],
  meal_plans: ['meal_plans'],
  grocery_items: ['grocery_items'],
  household_members: ['household_members', 'households'],
  households: ['households'],
  profiles: ['household_members'],
};

/**
 * Subscribes to database changes and refetches affected queries. Row Level Security
 * still applies, so each person only receives rows they are allowed to see.
 */
export function useRealtimeSync(householdId: string | undefined) {
  useEffect(() => {
    if (!householdId) return;
    const channel = supabase.channel(`household:${householdId}`);
    for (const [table, keys] of Object.entries(TABLES)) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        for (const key of keys) queryClient.invalidateQueries({ queryKey: [key] });
      });
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId]);
}
