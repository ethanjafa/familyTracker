import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useProjectItems, useProjects } from '@/api/projects';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, HeaderButton, IconTile, Loading, ProgressBar, Screen, SectionTitle, Segmented, styles } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { prettyDay, today } from '@/lib/dates';
import { projectStats } from '@/lib/projects';
import type { Visibility } from '@/lib/types';

export default function ProjectsScreen() {
  const theme = useTheme();
  const projects = useProjects();
  const items = useProjectItems();
  const [visibility, setVisibility] = useState<Visibility>('family');
  const day = today();

  const list = (projects.data ?? []).filter((p) => p.visibility === visibility);
  const active = list.filter((p) => p.status !== 'done');
  const finished = list.filter((p) => p.status === 'done');
  const addProject = () => router.push({ pathname: '/project-form', params: { visibility } });
  const refetch = () => Promise.all([projects.refetch(), items.refetch()]);

  const renderProject = (p: (typeof list)[number]) => {
    const s = projectStats(p, items.data ?? [], day);
    const warnings = [
      s.overdue && `${s.overdue} overdue`,
      s.blocked && `${s.blocked} blocked`,
      s.stalled && `no progress in ${s.idleDays} days`,
    ].filter(Boolean);
    return (
      <Card key={p.id} onPress={() => router.push(`/projects/${p.id}`)}>
        <View style={styles.row}>
          <IconTile icon={p.icon} color={p.color} />
          <View style={{ flex: 1 }}>
            <ThemedText type="smallBold" style={{ fontSize: 17 }}>
              {p.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {s.done}/{s.total} steps
              {p.target_date ? ` · target ${prettyDay(p.target_date)}` : ''}
              {p.status === 'on_hold' ? ' · on hold' : ''}
            </ThemedText>
          </View>
          <ThemedText type="smallBold">{s.percent}%</ThemedText>
        </View>
        <ProgressBar value={s.percent} color={p.color} />
        {s.next && p.status === 'active' && (
          <ThemedText type="small">
            <ThemedText type="smallBold">Next: </ThemedText>
            {s.next.title}
          </ThemedText>
        )}
        {warnings.length > 0 && (
          <ThemedText type="small" style={{ color: theme.danger }}>
            ⚠️ {warnings.join(' · ')}
          </ThemedText>
        )}
      </Card>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Projects', headerRight: () => <HeaderButton title="+" onPress={addProject} /> }} />
      <Screen onRefresh={refetch} refreshing={projects.isRefetching}>
        <Segmented
          options={[
            { value: 'personal', label: '🙋 Personal' },
            { value: 'family', label: '👨‍👩‍👧 Family' },
          ]}
          value={visibility}
          onChange={setVisibility}
        />
        {projects.isPending || items.isPending ? (
          <Loading />
        ) : list.length === 0 ? (
          <EmptyState
            icon="🛠️"
            title={`No ${visibility} projects yet`}
            body="Break big goals into steps, e.g. Renovation → Laminate change, Paint bedroom."
            action={<Button title="Start a project" onPress={addProject} />}
          />
        ) : (
          <>
            {active.map(renderProject)}
            {finished.length > 0 && (
              <>
                <SectionTitle>Completed</SectionTitle>
                {finished.map(renderProject)}
              </>
            )}
          </>
        )}
      </Screen>
    </>
  );
}
