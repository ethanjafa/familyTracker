import { useQuery } from '@tanstack/react-query';

import { categoryIcon } from '@/lib/icons';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import type { ItemStatus, Project, ProjectItem } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

export function useProjects() {
  const { household } = useHousehold();
  return useQuery({
    queryKey: ['projects', household.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('household_id', household.id)
        .order('created_at');
      if (error) throw error;
      return data as Project[];
    },
  });
}

export function useProjectItems() {
  const { household } = useHousehold();
  return useQuery({
    queryKey: ['project_items', household.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_items')
        .select('*')
        .eq('household_id', household.id)
        .order('sort_order')
        .order('created_at');
      if (error) throw error;
      return data as ProjectItem[];
    },
  });
}

export async function saveProject(values: Partial<Project> & Pick<Project, 'household_id' | 'name'>) {
  const { error } = values.id
    ? await supabase.from('projects').update(values).eq('id', values.id)
    : await supabase.from('projects').insert(values);
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['projects'] });
}

/** Create a to-do category from the to-do form; its icon comes from the name. Returns its id. */
export async function createTodoCategory(householdId: string, name: string) {
  const { data, error } = await supabase
    .from('projects')
    .insert({ household_id: householdId, name, icon: categoryIcon(name), visibility: 'family' })
    .select('id')
    .single();
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['projects'] });
  return data.id as string;
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['projects'] });
  await queryClient.invalidateQueries({ queryKey: ['project_items'] });
}

export async function saveItem(
  values: Partial<ProjectItem> & Pick<ProjectItem, 'household_id' | 'project_id' | 'title'>,
) {
  const { error } = values.id
    ? await supabase.from('project_items').update(values).eq('id', values.id)
    : await supabase.from('project_items').insert(values);
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['project_items'] });
}

export async function setItemStatus(item: ProjectItem, status: ItemStatus) {
  queryClient.setQueriesData<ProjectItem[]>({ queryKey: ['project_items', item.household_id] }, (old) =>
    old?.map((i) => (i.id === item.id ? { ...i, status } : i)),
  );
  const { error } = await supabase.from('project_items').update({ status }).eq('id', item.id);
  await queryClient.invalidateQueries({ queryKey: ['project_items'] });
  if (error) throw error;
}

/** Put a step on a day of the week (or take it off with null) and pick who does it. */
export async function planItem(item: ProjectItem, changes: Partial<Pick<ProjectItem, 'planned_date' | 'assignee_id'>>) {
  queryClient.setQueriesData<ProjectItem[]>({ queryKey: ['project_items', item.household_id] }, (old) =>
    old?.map((i) => (i.id === item.id ? { ...i, ...changes } : i)),
  );
  const { error } = await supabase.from('project_items').update(changes).eq('id', item.id);
  await queryClient.invalidateQueries({ queryKey: ['project_items'] });
  if (error) throw error;
}

export async function deleteItem(id: string) {
  const { error } = await supabase.from('project_items').delete().eq('id', id);
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['project_items'] });
}
