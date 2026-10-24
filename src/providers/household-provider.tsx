import { createContext, type PropsWithChildren, useContext, useMemo } from 'react';

import { useHouseholdQuery, useMembersQuery } from '@/api/household';
import { colorFor, Palette } from '@/constants/theme';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import type { Household, Member } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

type HouseholdState = {
  userId: string | undefined;
  household: Household | null;
  members: Member[];
  memberById: Map<string, Member>;
  /** Each member's own colour, so nobody in the family shares one. */
  memberColor: (userId: string | undefined) => string;
  loading: boolean;
};

const HouseholdContext = createContext<HouseholdState | null>(null);

export function HouseholdProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const householdQuery = useHouseholdQuery(userId);
  const household = householdQuery.data ?? null;
  const membersQuery = useMembersQuery(household?.id);

  useRealtimeSync(household?.id);

  const value = useMemo<HouseholdState>(() => {
    const members = membersQuery.data ?? [];
    // Members come in the order they joined, so colours stay put as the family grows.
    const colors = new Map(members.map((m, i) => [m.user_id, Palette[i % Palette.length]]));
    return {
      userId,
      household,
      members,
      memberById: new Map(members.map((m) => [m.user_id, m])),
      memberColor: (id) => (id && colors.get(id)) || colorFor(id),
      loading: !!userId && householdQuery.isPending,
    };
  }, [userId, household, membersQuery.data, householdQuery.isPending]);

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHouseholdState() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHouseholdState must be used inside HouseholdProvider');
  return ctx;
}

/** For screens behind the "has a household" guard. */
export function useHousehold() {
  const ctx = useHouseholdState();
  if (!ctx.household || !ctx.userId) throw new Error('No household loaded');
  return { ...ctx, household: ctx.household, userId: ctx.userId };
}
