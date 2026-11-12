import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useProjectItems, useProjects } from '@/api/projects';
import { RoutineGoals } from '@/components/goals/routine-goals';
import { TodoGoals } from '@/components/goals/todo-goals';
import { AddBox } from '@/components/add-box';
import { Screen, Segmented } from '@/components/ui';
import { useRoutineData } from '@/hooks/use-routine-data';

type Section = 'routines' | 'todos';

/** Everything the family keeps working on: routines (habits) and to-dos (things to get done). */
export default function GoalsScreen() {
  const params = useLocalSearchParams<{ section?: Section }>();
  const section: Section = params.section === 'todos' ? 'todos' : 'routines';
  const routines = useRoutineData();
  const projects = useProjects();
  const items = useProjectItems();

  // Type a name and press "+": the form opens with it filled in, to pick the category and schedule (or date).
  const [text, setText] = useState('');
  const add = () => {
    const name = text.trim();
    setText('');
    router.push({ pathname: section === 'routines' ? '/routine-form' : '/todo-form', params: name ? { name } : {} });
  };
  const refetch = () => Promise.all([routines.refetch(), projects.refetch(), items.refetch()]);

  return (
    <>
      <Stack.Screen options={{ title: 'Routines' }} />
      <Screen onRefresh={refetch} refreshing={routines.isRefetching || projects.isRefetching}>
        <Segmented
          options={[
            { value: 'routines', label: '🔁 Routines' },
            { value: 'todos', label: '📝 To do' },
          ]}
          value={section}
          onChange={(v) => router.setParams({ section: v })}
        />
        <AddBox
          value={text}
          onChangeText={setText}
          onAdd={add}
          placeholder={section === 'routines' ? 'Add a routine, e.g. Wash dishes' : 'Add a to-do, e.g. Book the dentist'}
        />
        {section === 'routines' ? <RoutineGoals /> : <TodoGoals />}
      </Screen>
    </>
  );
}
