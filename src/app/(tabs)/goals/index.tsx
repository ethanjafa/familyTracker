import { router, Stack, useLocalSearchParams } from 'expo-router';

import { useProjectItems, useProjects } from '@/api/projects';
import { RoutineGoals } from '@/components/goals/routine-goals';
import { TodoGoals } from '@/components/goals/todo-goals';
import { HeaderButton, Screen, Segmented } from '@/components/ui';
import { useRoutineData } from '@/hooks/use-routine-data';

type Section = 'routines' | 'todos';

/** Everything the family keeps working on: routines (habits) and to-dos (things to get done). */
export default function GoalsScreen() {
  const params = useLocalSearchParams<{ section?: Section }>();
  const section: Section = params.section === 'todos' ? 'todos' : 'routines';
  const routines = useRoutineData();
  const projects = useProjects();
  const items = useProjectItems();

  const add = () =>
    router.push(section === 'routines' ? '/routine-form' : '/todo-form');
  const refetch = () => Promise.all([routines.refetch(), projects.refetch(), items.refetch()]);

  return (
    <>
      <Stack.Screen options={{ title: 'Routines', headerRight: () => <HeaderButton title="+" onPress={add} /> }} />
      <Screen onRefresh={refetch} refreshing={routines.isRefetching || projects.isRefetching}>
        <Segmented
          options={[
            { value: 'routines', label: '🔁 Routines' },
            { value: 'todos', label: '📝 To do' },
          ]}
          value={section}
          onChange={(v) => router.setParams({ section: v })}
        />
        {section === 'routines' ? <RoutineGoals /> : <TodoGoals />}
      </Screen>
    </>
  );
}
