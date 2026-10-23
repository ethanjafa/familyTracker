import { createContext, type PropsWithChildren, useContext, useMemo } from 'react';

import { useHouseholdQuery, useMembersQuery } from '@/api/household';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import type { Household, Member } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

type HouseholdState = {
  userId: string | undefined;
  household: Household | null;
  members: Member[];
  memberById: Map<string, Member>;
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
    return {
      userId,
      household,
      members,
      memberById: new Map(members.map((m) => [m.user_id, m])),
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
