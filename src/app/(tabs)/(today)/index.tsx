import { format, getDay } from 'date-fns';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useGroceries } from '@/api/groceries';
import { useMealPlans, useMeals } from '@/api/meals';
import { useProjectItems, useProjects } from '@/api/projects';
import { Dashboard, type Tile } from '@/components/dashboard';
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
  styles,
  useElevation,
} from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useRoutineData } from '@/hooks/use-routine-data';
import { useTheme } from '@/hooks/use-theme';
import { toDay, weekStart } from '@/lib/dates';
import { assigneesOn, isDueToday } from '@/lib/schedule';
import { isWeekPlanned, planningDayOf } from '@/lib/planning';
import { sortTodos } from '@/lib/projects';
import { pct, routinesFor, scoreRoutines, streak } from '@/lib/scoring';
import type { MealSlot } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

type Filter = 'mine' | 'family' | 'all';

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
  const [filter, setFilter] = useState<Filter>('family');

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
      if (filter === 'family') return category.visibility === 'family';
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filter, userId, day]);

  const doneCount = due.filter((r) => data.logIndex.get(r.id)?.has(day)).length;
  const weekScore = pct(scoreRoutines(routinesFor(userId, data.routines, data.categoryById), data.logIndex, weekStart(now), now));

  // To-dos for this day: planned for it or at/past their target date; otherwise the next few.
  const categoryById = new Map((projects.data ?? []).map((p) => [p.id, p]));
  const openTodos = sortTodos(
    (items.data ?? []).filter(
      (i) => i.status !== 'done' && categoryById.has(i.project_id) && (!i.assignee_id || i.assignee_id === userId),
    ),
  );
  const todosToday = openTodos.filter((i) => i.planned_date === day || (!!i.due_date && i.due_date <= day));
  const todos = todosToday.length ? todosToday : openTodos.slice(0, 3);

  const mealOn = (slot: MealSlot) => {
    const plan = mealPlans.data?.find((p) => p.plan_date === day && p.slot === slot);
    return plan?.meal_id ? meals.data?.find((m) => m.id === plan.meal_id) : undefined;
  };
  const lunch = mealOn('lunch');
  const dinner = mealOn('dinner');
  const toBuy = (groceries.data ?? []).filter((i) => i.status === 'need').length;
  const planned = isWeekPlanned(household, data.logIndex, now);
  const planningToday = getDay(now) === planningDayOf(household);
  const openCount = (items.data ?? []).filter((i) => i.status !== 'done').length;

  const tiles: Tile[] = [
    {
      icon: '⛵',
      title: 'Plan',
      detail: planned ? 'Week planned ✓' : planningToday ? 'Plan the week today' : 'Plan next week',
      href: '/plan',
      alert: planningToday && !planned,
    },
    {
      icon: dinner?.icon ?? lunch?.icon ?? '🍽️',
      title: 'Meals',
      detail: dinner || lunch ? [lunch && `🥪 ${lunch.name}`, dinner && `🍽️ ${dinner.name}`].filter(Boolean).join(' · ') : 'Nothing planned',
      href: { pathname: '/meals', params: { week: toDay(weekStart(now)) } },
    },
    { icon: '🛒', title: 'Groceries', detail: toBuy ? `${toBuy} to buy` : 'All stocked', href: '/groceries' },
    { icon: '📝', title: 'To do', detail: `${openCount} open`, href: { pathname: '/goals', params: { section: 'todos' } } },
    { icon: '📊', title: 'Scorecard', detail: `This week ${weekScore === null ? '—' : `${weekScore}%`}`, href: '/scorecard' },
    { icon: '👨‍👩‍👧', title: 'Family', detail: `${members.length} member${members.length === 1 ? '' : 's'}`, href: '/settings' },
  ];

  return (
    <>
      <Stack.Screen options={{ title: format(now, 'EEEE, d MMM') }} />
      <Screen onRefresh={data.refetch} refreshing={data.isRefetching}>
        {data.isLoading ? (
          <Loading />
        ) : (
          <>
            <View style={[hero.card, { backgroundColor: theme.tint }, glow]}>
              <ThemedText type="small" style={hero.muted}>
                {greeting(now)}
                {firstName ? `, ${firstName}` : ''}
              </ThemedText>
              <View style={[styles.row, { justifyContent: 'space-between', alignItems: 'flex-end' }]}>
                <View>
                  <ThemedText type="title" style={hero.text}>
                    {doneCount}
                    <ThemedText type="heading" style={hero.muted}>
                      {' '}
                      / {due.length}
                    </ThemedText>
                  </ThemedText>
                  <ThemedText type="small" style={hero.muted}>
                    {due.length && doneCount === due.length ? 'All done today 🎉' : 'done today'}
                  </ThemedText>
                </View>
                <View style={hero.badge}>
                  <ThemedText type="smallBold" style={hero.text}>
                    Week {weekScore === null ? '—' : `${weekScore}%`}
                  </ThemedText>
                </View>
              </View>
              <ProgressBar
                value={due.length ? (100 * doneCount) / due.length : 0}
                color="#FFFFFF"
                track="rgba(255,255,255,0.28)"
              />
            </View>

            <Dashboard tiles={tiles} />

            <Segmented
              options={[
                { value: 'family', label: 'Family' },
                { value: 'mine', label: 'Mine' },
                { value: 'all', label: 'All' },
              ]}
              value={filter}
              onChange={setFilter}
            />

            {due.length === 0 ? (
              <EmptyState
                icon="🌱"
                title={!data.routines.length ? 'No routines yet' : 'Nothing due right now'}
                body={
                  data.routines.length
                    ? 'Enjoy the free time, or check the other filters.'
                    : 'Create a category (like House cleanliness) and add routines to it.'
                }
                action={
                  !data.routines.length && (
                    <Button title="Add routines" onPress={() => router.navigate('/goals')} />
                  )
                }
              />
            ) : (
              <Card style={{ gap: 0, paddingVertical: 4 }}>
                {due.map((r) => (
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
            )}

            {todos.length > 0 && (
              <View style={{ gap: 8 }}>
                <SectionTitle>{todosToday.length ? '📝 To do today' : '📝 Next to-dos'}</SectionTitle>
                <Card style={{ gap: 0, paddingVertical: 4 }}>
                  {todos.map((item, i) => {
                    const category = categoryById.get(item.project_id)!;
                    return <TodoRow key={item.id} item={item} today={day} caption={`${category.icon} ${category.name}`} first={i === 0} />;
                  })}
                </Card>
              </View>
            )}

            {due.length > 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                Tap a routine to check it off
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
  badge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
