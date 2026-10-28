import { format, getDay } from 'date-fns';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useGroceries } from '@/api/groceries';
import { useMealPlans, useMeals } from '@/api/meals';
import { useProjectItems, useProjects } from '@/api/projects';
import { Dashboard, type Tile } from '@/components/dashboard';
import { GetStarted, type Step } from '@/components/get-started';
import { DraggableList } from '@/components/draggable-list';
import { RoutineRow } from '@/components/routine-row';
import { TodoRow } from '@/components/todo-row';
import { ThemedText } from '@/components/themed-text';
import {
  Button,
  Card,
  EmptyState,
  Loading,
  ProgressBar,
  Screen,
  SectionTitle,
  Segmented,
  useElevation,
} from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useRoutineData } from '@/hooks/use-routine-data';
import { useTheme } from '@/hooks/use-theme';
import { toDay, weekStart } from '@/lib/dates';
import { assigneesOn, isDueToday } from '@/lib/schedule';
import { isWeekPlanned, planningDayOf } from '@/lib/planning';
import { sortTodos, todoDay } from '@/lib/projects';
import { routinesFor, streak } from '@/lib/scoring';
import { applyOrder, loadOrder, mergeOrder, saveOrder } from '@/lib/today-order';
import type { MealSlot, ProjectItem, Routine } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

/** Mine = my routines and to-dos (plus unassigned family ones); Family (all) = everyone's. */
type Filter = 'mine' | 'all';

const greeting = (d: Date) => (d.getHours() < 12 ? 'Good morning' : d.getHours() < 18 ? 'Good afternoon' : 'Good evening');

export default function TodayScreen() {
  const theme = useTheme();
  const glow = useElevation('brand');
  const { household, members, userId, memberById } = useHousehold();
  const firstName = memberById.get(userId)?.profile.display_name.trim().split(/\s+/)[0];
  const data = useRoutineData();
  const projects = useProjects();
  const items = useProjectItems();
  const meals = useMeals();
  const mealPlans = useMealPlans();
  const groceries = useGroceries();
  const [filter, setFilter] = useState<Filter>('mine');
  // Your own order of routines and to-dos, set by holding and dragging.
  const [order, setOrder] = useState(() => loadOrder(userId));
  const reorder = (keys: string[]) => {
    const next = mergeOrder(keys, order);
    setOrder(next);
    saveOrder(userId, next);
  };

  const now = new Date();
  const day = toDay(now);

  const due = useMemo(() => {
    // A person's view of a routine is narrowed to their own days when the family takes turns.
    const mine = new Map(routinesFor(userId, data.routines, data.categoryById).map((r) => [r.id, r]));
    return data.routines.filter((r) => {
      const category = data.categoryById.get(r.category_id);
      if (!category || !isDueToday(r, data.logIndex.get(r.id), now)) return false;
      if (filter === 'mine') {
        const own = mine.get(r.id);
        if (own) return isDueToday(own, data.logIndex.get(r.id), now);
        return category.visibility === 'family' && assigneesOn(r, now).length === 0;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filter, userId, day]);

  // To-dos for today: today is their day (unfinished ones move on from earlier days). Ones finished today stay, ticked.
  const categoryById = new Map((projects.data ?? []).map((p) => [p.id, p]));
  const todosToday = sortTodos(
    (items.data ?? []).filter(
      (i) =>
        categoryById.has(i.project_id) &&
        (filter === 'all' || !i.assignee_id || i.assignee_id === userId) &&
        (i.status !== 'done' ? todoDay(i, day) === day : !!i.completed_at && toDay(new Date(i.completed_at)) === day),
    ),
  );

  // One list for the day: routines and to-dos together, in your own order.
  type Task = { key: string; routine: Routine } | { key: string; todo: ProjectItem };
  const tasks = applyOrder<Task>(
    [...due.map((r) => ({ key: r.id, routine: r })), ...todosToday.map((i) => ({ key: i.id, todo: i }))],
    (t) => t.key,
    order,
  );
  const doneCount =
    due.filter((r) => data.logIndex.get(r.id)?.has(day)).length + todosToday.filter((i) => i.status === 'done').length;

  const mealOn = (slot: MealSlot) => {
    const plan = mealPlans.data?.find((p) => p.plan_date === day && p.slot === slot);
    return plan?.meal_id ? meals.data?.find((m) => m.id === plan.meal_id) : undefined;
  };
  const lunch = mealOn('lunch');
  const dinner = mealOn('dinner');
  const toBuy = (groceries.data ?? []).filter((i) => i.status === 'need').length;
  const planned = isWeekPlanned(household, data.logIndex, now);
  const planningToday = getDay(now) === planningDayOf(household);

  // First-run checklist: each step is done once the real thing exists.
  const ownRoutines = data.routines.filter((r) => r.id !== household.planning_routine_id);
  const steps: Step[] = [
    {
      title: 'Add a routine or to-do',
      detail: 'Start with something that repeats, like dishes or school pick-up.',
      done: ownRoutines.length > 0 || (items.data ?? []).length > 0,
      href: '/create',
    },
    {
      title: 'Invite your family',
      detail: 'Send an invite code from Settings so everyone is in.',
      done: members.length > 1,
      href: '/settings',
    },
    {
      title: 'Plan who does what',
      detail: 'Open Plan and tap the boxes to give each task an owner.',
      done:
        ownRoutines.some((r) => r.assignee_ids.length > 0 || (r.plans?.size ?? 0) > 0) ||
        (items.data ?? []).some((i) => i.assignee_id),
      href: '/plan',
    },
  ];

  const tiles: Tile[] = [
    { icon: '➕', title: 'Create', detail: 'New routine or to-do', href: '/create' },
    {
      icon: '⛵',
      title: 'Plan the week',
      detail: planned ? 'Week planned ✓' : planningToday ? 'Plan the week today' : 'Plan next week',
      href: '/plan',
      alert: planningToday && !planned,
    },
    {
      icon: dinner?.icon ?? lunch?.icon ?? '🍽️',
      title: 'Plan meals',
      detail: dinner || lunch ? [lunch && `🥪 ${lunch.name}`, dinner && `🍽️ ${dinner.name}`].filter(Boolean).join(' · ') : 'Nothing planned',
      href: { pathname: '/meals', params: { week: toDay(weekStart(now)) } },
    },
    { icon: '🛒', title: 'Grocery list', detail: toBuy ? `${toBuy} to buy` : 'All stocked', href: '/groceries' },
  ];

  return (
    <>
      <Stack.Screen options={{ title: format(now, 'EEEE, d MMM') }} />
      <Screen onRefresh={data.refetch} refreshing={data.isRefetching}>
        {data.isLoading ? (
          <Loading />
        ) : (
          <>
            <GetStarted steps={steps} />

            <SectionTitle>Dashboard</SectionTitle>
            <Dashboard tiles={tiles} />

            <SectionTitle>Today</SectionTitle>
            <View style={[hero.card, { backgroundColor: theme.tint }, glow]}>
              <ThemedText type="small" style={hero.muted}>
                {greeting(now)}
                {firstName ? `, ${firstName}` : ''}
              </ThemedText>
              <View>
                <ThemedText type="title" style={hero.text}>
                  {doneCount}
                  <ThemedText type="heading" style={hero.muted}>
                    {' '}
                    / {tasks.length}
                  </ThemedText>
                </ThemedText>
                <ThemedText type="small" style={hero.muted}>
                  {tasks.length && doneCount === tasks.length ? 'All done today 🎉' : 'done today'}
                </ThemedText>
              </View>
              <ProgressBar
                value={tasks.length ? (100 * doneCount) / tasks.length : 0}
                color="#FFFFFF"
                track="rgba(255,255,255,0.28)"
              />
            </View>

            <Segmented
              options={[
                { value: 'mine', label: 'Mine' },
                { value: 'all', label: 'Family' },
              ]}
              value={filter}
              onChange={setFilter}
            />

            {tasks.length === 0 ? (
              <EmptyState
                icon="🌱"
                title={!data.routines.length && !(items.data ?? []).length ? 'Nothing here yet' : 'Nothing due right now'}
                body={
                  data.routines.length || (items.data ?? []).length
                    ? filter === 'mine' ? 'Enjoy the free time, or switch to Family to see everyone.' : 'Enjoy the free time.'
                    : 'Add routines and to-dos to get started.'
                }
                action={
                  !data.routines.length &&
                  !(items.data ?? []).length && <Button title="Add a routine or to-do" onPress={() => router.push('/create')} />
                }
              />
            ) : (
              <Card style={{ gap: 0, paddingVertical: 4 }}>
                <DraggableList
                  items={tasks}
                  keyOf={(t) => t.key}
                  onReorder={reorder}
                  renderItem={(t) => {
                    if ('routine' in t) {
                      return (
                        <RoutineRow
                          routine={t.routine}
                          category={data.categoryById.get(t.routine.category_id)!}
                          day={day}
                          logs={data.logIndex.get(t.routine.id)}
                          streak={streak(t.routine, data.logIndex, now)}
                          userId={userId}
                          memberById={memberById}
                        />
                      );
                    }
                    const category = categoryById.get(t.todo.project_id)!;
                    return <TodoRow item={t.todo} today={day} caption={`${category.icon} ${category.name}`} first />;
                  }}
                />
              </Card>
            )}

            {tasks.length > 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                Tap to check off · hold and drag to reorder
              </ThemedText>
            )}
          </>
        )}
      </Screen>
    </>
  );
}

const hero = StyleSheet.create({
  card: { borderRadius: Radius.xl, padding: 20, gap: Spacing.three },
  text: { color: '#FFFFFF' },
  muted: { color: 'rgba(255,255,255,0.85)' },
});
