import { format } from 'date-fns';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useProjectItems, useProjects } from '@/api/projects';
import { RoutineRow } from '@/components/routine-row';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, Loading, ProgressBar, Screen, SectionTitle, Segmented, styles } from '@/components/ui';
import { useRoutineData } from '@/hooks/use-routine-data';
import { useTheme } from '@/hooks/use-theme';
import { prettyDay, toDay, weekStart } from '@/lib/dates';
import { isDueToday } from '@/lib/schedule';
import { pct, routinesFor, scoreRoutines, streak } from '@/lib/scoring';
import type { TimeOfDay } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

const SECTIONS: { key: TimeOfDay; label: string }[] = [
  { key: 'morning', label: '🌅 Morning' },
  { key: 'day', label: '☀️ Day' },
  { key: 'evening', label: '🌙 Evening' },
  { key: 'anytime', label: '🕑 Anytime' },
];

type Filter = 'mine' | 'family' | 'all';

export default function TodayScreen() {
  const theme = useTheme();
  const { userId, memberById } = useHousehold();
  const data = useRoutineData();
  const projects = useProjects();
  const items = useProjectItems();
  const [filter, setFilter] = useState<Filter>('mine');

  const now = new Date();
  const day = toDay(now);

  const due = useMemo(() => {
    const mine = new Set(routinesFor(userId, data.routines, data.categoryById).map((r) => r.id));
    return data.routines.filter((r) => {
      const category = data.categoryById.get(r.category_id);
      if (!category || !isDueToday(r, data.logIndex.get(r.id), now)) return false;
      if (filter === 'mine') return mine.has(r.id) || (category.visibility === 'family' && r.assignee_ids.length === 0);
      if (filter === 'family') return category.visibility === 'family';
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filter, userId, day]);

  const doneCount = due.filter((r) => data.logIndex.get(r.id)?.has(day)).length;
  const weekScore = pct(scoreRoutines(routinesFor(userId, data.routines, data.categoryById), data.logIndex, weekStart(now), now));

  const nextActions = useMemo(() => {
    const activeProjects = new Map((projects.data ?? []).filter((p) => p.status === 'active').map((p) => [p.id, p]));
    return (items.data ?? [])
      .filter((i) => i.status !== 'done' && activeProjects.has(i.project_id) && (!i.assignee_id || i.assignee_id === userId))
      .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
      .slice(0, 3)
      .map((i) => ({ item: i, project: activeProjects.get(i.project_id)! }));
  }, [projects.data, items.data, userId]);

  return (
    <>
      <Stack.Screen options={{ title: format(now, 'EEEE, d MMM') }} />
      <Screen onRefresh={data.refetch} refreshing={data.isRefetching}>
        {data.isLoading ? (
          <Loading />
        ) : (
          <>
            <Card>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <ThemedText type="smallBold" style={{ fontSize: 18 }}>
                  {doneCount} of {due.length} done today
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Week: {weekScore === null ? '—' : `${weekScore}%`}
                </ThemedText>
              </View>
              <ProgressBar value={due.length ? (100 * doneCount) / due.length : 0} color={theme.tint} />
            </Card>

            <Segmented
              options={[
                { value: 'mine', label: 'Mine' },
                { value: 'family', label: 'Family' },
                { value: 'all', label: 'All' },
              ]}
              value={filter}
              onChange={setFilter}
            />

            {due.length === 0 ? (
              <EmptyState
                icon="🌱"
                title={data.routines.length ? 'Nothing due right now' : 'No routines yet'}
                body={
                  data.routines.length
                    ? 'Enjoy the free time, or check the other filters.'
                    : 'Create a category (like House cleanliness) and add routines to it.'
                }
                action={
                  !data.routines.length && (
                    <Button title="Add routines" onPress={() => router.navigate('/routines')} />
                  )
                }
              />
            ) : (
              SECTIONS.map(({ key, label }) => {
                const list = due.filter((r) => r.time_of_day === key);
                if (!list.length) return null;
                return (
                  <View key={key} style={{ gap: 8 }}>
                    <SectionTitle>{label}</SectionTitle>
                    <Card style={{ gap: 0, paddingVertical: 8 }}>
                      {list.map((r) => (
                        <RoutineRow
                          key={r.id}
                          routine={r}
                          category={data.categoryById.get(r.category_id)!}
                          day={day}
                          logs={data.logIndex.get(r.id)}
                          streak={streak(r, data.logIndex, now)}
                          userId={userId}
                          memberById={memberById}
                        />
                      ))}
                    </Card>
                  </View>
                );
              })
            )}

            {nextActions.length > 0 && (
              <View style={{ gap: 8 }}>
                <SectionTitle>🛠️ Next project steps</SectionTitle>
                {nextActions.map(({ item, project }) => (
                  <Card key={item.id} onPress={() => router.navigate(`/projects/${project.id}`)}>
                    <ThemedText>{item.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {project.icon} {project.name}
                      {item.due_date && (
                        <ThemedText type="small" style={{ color: item.due_date < day ? theme.danger : theme.textSecondary }}>
                          {' · due '}
                          {prettyDay(item.due_date)}
                        </ThemedText>
                      )}
                    </ThemedText>
                  </Card>
                ))}
              </View>
            )}

            {due.length > 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                Tap to check off · long-press for partial or skip
              </ThemedText>
            )}
          </>
        )}
      </Screen>
    </>
  );
}
