import { useQuery } from '@tanstack/react-query';

import { showAlert } from '@/lib/dialogs';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import type { GroceryItem, GroceryStatus } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

export function useGroceries() {
  const { household } = useHousehold();
  return useQuery({
    queryKey: ['grocery_items', household.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grocery_items')
        .select('*')
        .eq('household_id', household.id)
        .order('name');
      if (error) throw error;
      return data as GroceryItem[];
    },
  });
}

const normalize = (name: string) => name.trim().toLowerCase();

/**
 * Mark items as needed, adding any that aren't on the list yet. Items you already need
 * are left alone. Returns how many items newly went on the shopping list.
 */
export async function needGroceries(householdId: string, names: string[], forLabel: string | null = null) {
  const wanted = [...new Map(names.filter((n) => n.trim()).map((n) => [normalize(n), n.trim()])).entries()];
  if (!wanted.length) return 0;

  const { data: existing, error } = await supabase
    .from('grocery_items')
    .select('id, name, status')
    .eq('household_id', householdId);
  if (error) throw error;
  const byName = new Map((existing ?? []).map((i) => [normalize(i.name), i]));

  const toInsert = wanted.filter(([key]) => !byName.has(key)).map(([, name]) => name);
  const toNeed = wanted.map(([key]) => byName.get(key)).filter((i) => i && i.status === 'have').map((i) => i!.id);

  if (toInsert.length) {
    const { error: e } = await supabase
      .from('grocery_items')
      .insert(toInsert.map((name) => ({ household_id: householdId, name, status: 'need', for_label: forLabel })));
    if (e) throw e;
  }
  if (toNeed.length) {
    const { error: e } = await supabase.from('grocery_items').update({ status: 'need', for_label: forLabel }).in('id', toNeed);
    if (e) throw e;
  }
  await queryClient.invalidateQueries({ queryKey: ['grocery_items'] });
  return toInsert.length + toNeed.length;
}

/** Have it / need it. Optimistic, so ticking things off in the store feels instant. */
export async function setGroceryStatus(item: GroceryItem, status: GroceryStatus) {
  const key = ['grocery_items', item.household_id];
  const changes = { status, for_label: status === 'have' ? null : item.for_label };
  queryClient.setQueriesData<GroceryItem[]>({ queryKey: key }, (old) =>
    old?.map((i) => (i.id === item.id ? { ...i, ...changes } : i)),
  );
  const { error } = await supabase.from('grocery_items').update(changes).eq('id', item.id);
  if (error) showAlert('Could not update', error.message);
  await queryClient.invalidateQueries({ queryKey: key });
}

export async function deleteGrocery(id: string) {
  const { error } = await supabase.from('grocery_items').delete().eq('id', id);
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['grocery_items'] });
}
