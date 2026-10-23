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
        .select('household:households(id, name)')
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

export async function createHousehold(name: string) {
  const { error } = await supabase.rpc('create_household', { household_name: name });
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['households'] });
}

export async function joinHousehold(code: string) {
  const { error } = await supabase.rpc('join_household', { invite_code: code });
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['households'] });
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

export async function renameHousehold(id: string, name: string) {
  const { error } = await supabase.from('households').update({ name }).eq('id', id);
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: ['households'] });
}
