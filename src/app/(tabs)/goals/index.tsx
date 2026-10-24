import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useProjectItems, useProjects } from '@/api/projects';
import { ProjectGoals } from '@/components/goals/project-goals';
import { RoutineGoals } from '@/components/goals/routine-goals';
import { HeaderButton, Screen, Segmented } from '@/components/ui';
import { useRoutineData } from '@/hooks/use-routine-data';
import type { Visibility } from '@/lib/types';

type Section = 'routines' | 'projects';

/** Everything the family keeps working on: routines (habits) and projects (things to finish). */
export default function GoalsScreen() {
  const params = useLocalSearchParams<{ section?: Section }>();
  const section: Section = params.section === 'projects' ? 'projects' : 'routines';
  const [visibility, setVisibility] = useState<Visibility>('family');
  const routines = useRoutineData();
  const projects = useProjects();
  const items = useProjectItems();

  const add = () =>
    router.push({ pathname: section === 'routines' ? '/category-form' : '/project-form', params: { visibility } });
  const refetch = () => Promise.all([routines.refetch(), projects.refetch(), items.refetch()]);

  return (
    <>
      <Stack.Screen options={{ title: 'Goals', headerRight: () => <HeaderButton title="+" onPress={add} /> }} />
      <Screen onRefresh={refetch} refreshing={routines.isRefetching || projects.isRefetching}>
        <Segmented
          options={[
            { value: 'routines', label: '🔁 Routines' },
            { value: 'projects', label: '🛠️ Projects' },
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
        {section === 'routines' ? <RoutineGoals visibility={visibility} /> : <ProjectGoals visibility={visibility} />}
      </Screen>
    </>
  );
}
