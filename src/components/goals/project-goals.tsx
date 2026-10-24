import { router } from 'expo-router';
import { View } from 'react-native';

import { useProjectItems, useProjects } from '@/api/projects';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, IconTile, Loading, ProgressBar, SectionTitle, styles } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { prettyDay, today } from '@/lib/dates';
import { projectStats } from '@/lib/projects';
import type { Visibility } from '@/lib/types';

/** Goals → Projects: progress cards; tap one for its steps. */
export function ProjectGoals({ visibility }: { visibility: Visibility }) {
  const theme = useTheme();
  const projects = useProjects();
  const items = useProjectItems();
  const day = today();

  const list = (projects.data ?? []).filter((p) => p.visibility === visibility);
  const active = list.filter((p) => p.status !== 'done');
  const finished = list.filter((p) => p.status === 'done');
  const addProject = () => router.push({ pathname: '/project-form', params: { visibility } });

  const renderProject = (p: (typeof list)[number]) => {
    const s = projectStats(p, items.data ?? [], day);
    const warnings = [
      s.overdue && `${s.overdue} overdue`,
      s.blocked && `${s.blocked} blocked`,
      s.stalled && `no progress in ${s.idleDays} days`,
    ].filter(Boolean);
    return (
      <Card key={p.id} onPress={() => router.push(`/goals/${p.id}`)}>
        <View style={styles.row}>
          <IconTile icon={p.icon} />
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
        <ProgressBar value={s.percent} color={theme.tint} />
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

  if (projects.isPending || items.isPending) return <Loading />;
  if (list.length === 0) {
    return (
      <EmptyState
        icon="🛠️"
        title={`No ${visibility} projects yet`}
        body="Break big goals into steps, e.g. Renovation → Laminate change, Paint bedroom."
        action={<Button title="Start a project" onPress={addProject} />}
      />
    );
  }

  return (
    <>
      {active.map(renderProject)}
      {finished.length > 0 && (
        <>
          <SectionTitle>Completed</SectionTitle>
          {finished.map(renderProject)}
        </>
      )}
    </>
  );
}
