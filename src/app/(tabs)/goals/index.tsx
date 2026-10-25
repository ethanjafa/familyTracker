import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useProjectItems, useProjects } from '@/api/projects';
import { RoutineGoals } from '@/components/goals/routine-goals';
import { TodoGoals } from '@/components/goals/todo-goals';
import { HeaderButton, Screen, Segmented } from '@/components/ui';
import { useRoutineData } from '@/hooks/use-routine-data';
import type { Visibility } from '@/lib/types';

type Section = 'routines' | 'todos';

/** Everything the family keeps working on: routines (habits) and to-dos (things to get done). */
export default function GoalsScreen() {
  const params = useLocalSearchParams<{ section?: Section }>();
  const section: Section = params.section === 'todos' ? 'todos' : 'routines';
  const [visibility, setVisibility] = useState<Visibility>('family');
  const routines = useRoutineData();
  const projects = useProjects();
  const items = useProjectItems();

  const add = () =>
    router.push({ pathname: section === 'routines' ? '/category-form' : '/todo-category-form', params: { visibility } });
  const refetch = () => Promise.all([routines.refetch(), projects.refetch(), items.refetch()]);

  return (
    <>
      <Stack.Screen options={{ title: 'Goals', headerRight: () => <HeaderButton title="+" onPress={add} /> }} />
      <Screen onRefresh={refetch} refreshing={routines.isRefetching || projects.isRefetching}>
        <Segmented
          options={[
            { value: 'routines', label: '🔁 Routines' },
            { value: 'todos', label: '📝 To do' },
          ]}
          value={section}
          onChange={(v) => router.setParams({ section: v })}
        />
        <Segmented
          options={[
            { value: 'family', label: '👨‍👩‍👧 Family' },
            { value: 'personal', label: '🙋 Personal' },
          ]}
          value={visibility}
          onChange={setVisibility}
        />
        {section === 'routines' ? <RoutineGoals visibility={visibility} /> : <TodoGoals visibility={visibility} />}
      </Screen>
    </>
  );
}
