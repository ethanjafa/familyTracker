import { useQuery } from '@tanstack/react-query';

import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import type { Household, Member, Profile } from '@/lib/types';

/** The first household the user belongs to (the app supports one at a time). */
export function useHouseholdQuery(userId: string | undefined) {
  return useQuery({
    queryKey: ['households', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('household_members')
        // `*` so the app keeps working whether or not newer columns (planning_day) exist yet.
        .select('household:households(*)')
        .eq('user_id', userId!)
        .order('joined_at')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.household as unknown as Household | undefined) ?? null;
    },
  });
}

export function useMembersQuery(householdId: string | undefined) {
  return useQuery({
    queryKey: ['household_members', householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('household_members')
        .select('user_id, role, profile:profiles(id, display_name, avatar_url, color)')
        .eq('household_id', householdId!)
        .order('joined_at');
      if (error) throw error;
      return data as unknown as Member[];
    },
  });
}

export async function createHousehold(name: string, planningDay: number) {
  const { data: id, error } = await supabase.rpc('create_household', { household_name: name });
  if (error) throw error;
  // Best effort, so sign-up still works before the planning-day migration has run.
  await supabase.rpc('set_planning_day', { hid: id, day: planningDay });
  await queryClient.invalidateQueries({ queryKey: ['households'] });
}

/** Sets the planning day and puts the "Plan the week together" task on that weekday. */
export async function setPlanningDay(householdId: string, day: number) {
  const { error } = await supabase.rpc('set_planning_day', { hid: householdId, day });
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['households'] });
  await queryClient.invalidateQueries({ queryKey: ['routine_categories'] });
  await queryClient.invalidateQueries({ queryKey: ['routines'] });
}

export async function joinHousehold(code: string) {
  const { error } = await supabase.rpc('join_household', { invite_code: code });
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['households'] });
}

/**
 * Move into the family behind an invite code. `bringItems` (only when you're alone in your
 * current family) brings your routines, to-dos, meals and groceries along; otherwise you leave
 * and only your 🔒 personal items come with you. Everything is reloaded for the new family.
 */
export async function switchHousehold(code: string, bringItems: boolean) {
  const { error } = await supabase.rpc('switch_household', { invite_code: code, bring_items: bringItems });
  if (error) throw error;
  await queryClient.invalidateQueries();
}

export async function createInvite(householdId: string) {
  const { data, error } = await supabase.rpc('create_invite', { hid: householdId });
  if (error) throw error;
  return data as string;
}

export async function updateProfile(id: string, values: Partial<Pick<Profile, 'display_name' | 'color'>>) {
  const { error } = await supabase.from('profiles').update(values).eq('id', id);
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['household_members'] });
}

export async function updateHousehold(id: string, values: Partial<Pick<Household, 'name'>>) {
  const { error } = await supabase.from('households').update(values).eq('id', id);
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['households'] });
}

/** Owner only: takes someone out of the household and off all their assignments. */
export async function removeMember(householdId: string, userId: string) {
  const { error } = await supabase.rpc('remove_member', { hid: householdId, member: userId });
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['household_members'] });
  await queryClient.invalidateQueries({ queryKey: ['routines'] });
  await queryClient.invalidateQueries({ queryKey: ['project_items'] });
}
