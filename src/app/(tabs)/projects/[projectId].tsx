import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { setItemStatus, useProjectItems, useProjects } from '@/api/projects';
import { ThemedText } from '@/components/themed-text';
import { Avatar, Button, Card, EmptyState, HeaderButton, Loading, ProgressBar, Screen, SectionTitle, styles } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { prettyDay, today } from '@/lib/dates';
import { ITEM_STATUS, money, NEXT_STATUS, projectStats, sortItems } from '@/lib/projects';
import type { ProjectItem } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

export default function ProjectScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const theme = useTheme();
  const { memberById } = useHousehold();
  const projects = useProjects();
  const items = useProjectItems();
  const day = today();

  if (projects.isPending || items.isPending) return <Loading />;
  const project = projects.data?.find((p) => p.id === projectId);
  if (!project) return <EmptyState icon="🤷" title="Project not found" body="It may have been deleted." />;

  const own = sortItems((items.data ?? []).filter((i) => i.project_id === project.id));
  const s = projectStats(project, items.data ?? [], day);
  const addItem = () => router.push({ pathname: '/item-form', params: { projectId: project.id } });

  const cycle = (item: ProjectItem) =>
    setItemStatus(item, NEXT_STATUS[item.status]).catch((e) => Alert.alert('Could not update', e.message));

  return (
    <>
      <Stack.Screen
        options={{
          title: `${project.icon} ${project.name}`,
          headerRight: () => (
            <HeaderButton title="Edit" onPress={() => router.push({ pathname: '/project-form', params: { id: project.id } })} />
          ),
        }}
      />
      <Screen onRefresh={() => items.refetch()} refreshing={items.isRefetching}>
        <Card>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <ThemedText type="smallBold" style={{ fontSize: 18 }}>
              {s.percent}% complete
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {s.done}/{s.total} steps
            </ThemedText>
          </View>
          <ProgressBar value={s.percent} color={theme.tint} />
          {project.description ? <ThemedText type="small">{project.description}</ThemedText> : null}
          <ThemedText type="small" themeColor="textSecondary">
            {[
              project.target_date && `🎯 ${prettyDay(project.target_date)}`,
              project.budget != null && `💰 ${money(s.spent)} of ${money(Number(project.budget))}`,
              project.budget == null && s.spent > 0 && `💰 ${money(s.spent)} spent`,
            ]
              .filter(Boolean)
              .join('   ')}
          </ThemedText>
          {project.budget != null && s.spent > Number(project.budget) && (
            <ThemedText type="small" style={{ color: theme.danger }}>
              Over budget by {money(s.spent - Number(project.budget))}
            </ThemedText>
          )}
        </Card>

        <SectionTitle right={<HeaderButton title="+ Step" onPress={addItem} />}>Steps</SectionTitle>
        {own.length === 0 ? (
          <EmptyState icon="🪜" title="No steps yet" body="Add the sub-projects, e.g. Laminate change, Paint walls." action={<Button title="Add a step" onPress={addItem} />} />
        ) : (
          <Card style={{ gap: 0, paddingVertical: 4 }}>
            {own.map((item) => {
              const overdue = item.status !== 'done' && item.due_date && item.due_date < day;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => router.push({ pathname: '/item-form', params: { id: item.id } })}
                  style={({ pressed }) => [styles.row, { paddingVertical: 10, opacity: pressed ? 0.6 : 1 }]}>
                  <Pressable onPress={() => cycle(item)} hitSlop={10}>
                    <ThemedText style={{ fontSize: 22, lineHeight: 28 }}>{ITEM_STATUS[item.status].icon}</ThemedText>
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={item.status === 'done' ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}>
                      {item.title}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {ITEM_STATUS[item.status].label}
                      {item.due_date ? (
                        <ThemedText type="small" style={{ color: overdue ? theme.danger : theme.textSecondary }}>
                          {` · due ${prettyDay(item.due_date)}`}
                        </ThemedText>
                      ) : null}
                      {item.cost != null ? ` · ${money(Number(item.cost))}` : ''}
                    </ThemedText>
                  </View>
                  {item.assignee_id && <Avatar profile={memberById.get(item.assignee_id)?.profile} size={24} />}
                </Pressable>
              );
            })}
          </Card>
        )}
        {own.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            Tap the status icon to move a step forward
          </ThemedText>
        )}
      </Screen>
    </>
  );
}
