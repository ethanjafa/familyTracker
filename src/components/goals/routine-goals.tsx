import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { addRoutines } from '@/api/routines';
import { ThemedText } from '@/components/themed-text';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  IconTile,
  Loading,
  ScorePill,
  SectionTitle,
  styles,
  useElevation,
} from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useRoutineData } from '@/hooks/use-routine-data';
import { useTheme } from '@/hooks/use-theme';
import { weekStart } from '@/lib/dates';
import { showAlert } from '@/lib/dialogs';
import { describeSchedule, hasDayAssignees } from '@/lib/schedule';
import { pct, scoreRoutine, scoreRoutines, streak } from '@/lib/scoring';
import { type RoutineTemplate, suggestedCategories, suggestedRoutines } from '@/lib/suggestions';
import type { Routine, RoutineCategory } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';


/** Routines & To-dos → Routines: categories with their routines, plus suggestions. */
export function RoutineGoals() {
  const data = useRoutineData();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const categories = data.categories;
  const addRoutine = () => router.push('/routine-form');
  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allCollapsed = categories.every((c) => !expanded.has(c.id));

  if (data.isLoading) return <Loading />;

  return (
    <>
      {categories.length === 0 ? (
        <EmptyState
          icon="🏠"
          title="No categories yet"
          body="Start from a suggestion below, or create your own. Tag a routine 🔒 Personal to keep it to yourself."
          action={<Button title="Create my own" variant="secondary" onPress={addRoutine} />}
        />
      ) : (
        <>
          <Pressable
            onPress={() => setExpanded(allCollapsed ? new Set(categories.map((c) => c.id)) : new Set())}
            hitSlop={8}
            style={{ alignSelf: 'flex-end' }}>
            <ThemedText type="small" themeColor="tint" style={{ fontWeight: 700 }}>
              {allCollapsed ? 'Expand all' : 'Collapse all'}
            </ThemedText>
          </Pressable>
          {categories.map((c) => (
            <CategoryCard
              key={c.id}
              category={c}
              routines={data.routines.filter((r) => r.category_id === c.id)}
              logIndex={data.logIndex}
              open={expanded.has(c.id)}
              onToggle={() => toggle(c.id)}
            />
          ))}
        </>
      )}

      <SuggestedCategories categories={categories} />
    </>
  );
}

function CategoryCard({
  category,
  routines,
  logIndex,
  open,
  onToggle,
}: {
  category: RoutineCategory;
  routines: Routine[];
  logIndex: ReturnType<typeof useRoutineData>['logIndex'];
  open: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const elevation = useElevation();
  const now = new Date();
  const score = pct(scoreRoutines(routines, logIndex, weekStart(now), now));
  const addRoutine = () => router.push({ pathname: '/routine-form', params: { categoryId: category.id } });
  const editCategory = () => router.push({ pathname: '/category-form', params: { id: category.id } });
  const ideas = suggestedRoutines(category, routines);
  const addIdea = (t: RoutineTemplate) =>
    addRoutines(category.household_id, category.id, [t]).catch((e) => showAlert('Could not add', e.message));

  return (
    <Animated.View
      layout={LinearTransition.duration(220)}
      style={[local.card, { backgroundColor: theme.card, borderColor: theme.border }, elevation]}>
      <Pressable onPress={onToggle} onLongPress={editCategory} style={({ pressed }) => [local.header, { opacity: pressed ? 0.7 : 1 }]}>
        <IconTile icon={category.icon} />
        <View style={{ flex: 1 }}>
          <ThemedText type="heading" style={{ fontSize: 17 }}>
            {category.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {routines.length} routine{routines.length === 1 ? '' : 's'}
          </ThemedText>
        </View>
        <ScorePill value={score} />
        <ThemedText themeColor="textSecondary" style={[local.chevron, { transform: [{ rotate: open ? '90deg' : '0deg' }] }]}>
          ›
        </ThemedText>
      </Pressable>

      {open && (
        <Animated.View entering={FadeIn.duration(180)}>
          {routines.map((r) => (
            <RoutineLine key={r.id} routine={r} logIndex={logIndex} />
          ))}
          {ideas.length > 0 && (
            <View style={[local.ideas, { borderTopColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: 600 }}>
                💡 Ideas for {category.name}
              </ThemedText>
              <View style={styles.wrap}>
                {ideas.slice(0, 4).map((t) => (
                  <Pressable
                    key={t.name}
                    onPress={() => addIdea(t)}
                    style={({ pressed }) => [local.idea, { backgroundColor: theme.tintSoft, opacity: pressed ? 0.6 : 1 }]}>
                    <ThemedText type="small" themeColor="tint" style={{ fontWeight: 700 }}>
                      + {t.name}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          <View style={[local.footer, { borderTopColor: theme.border }]}>
            <Pressable onPress={addRoutine} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <ThemedText type="small" themeColor="tint" style={{ fontWeight: 700 }}>
                + Add routine
              </ThemedText>
            </Pressable>
            <Pressable onPress={editCategory} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: 600 }}>
                Edit category
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

function SuggestedCategories({ categories }: { categories: RoutineCategory[] }) {
  const theme = useTheme();
  const suggestions = suggestedCategories(categories);
  if (!suggestions.length) return null;
  return (
    <View style={{ gap: Spacing.two }}>
      <SectionTitle>Suggestions</SectionTitle>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {suggestions.map((t, i) => (
          <Pressable
            key={t.key}
            onPress={() => router.push({ pathname: '/suggestion', params: { key: t.key } })}
            style={({ pressed }) => [
              styles.row,
              {
                paddingVertical: 10,
                opacity: pressed ? 0.6 : 1,
                borderTopColor: theme.border,
                borderTopWidth: i ? StyleSheet.hairlineWidth : 0,
              },
            ]}>
            <IconTile icon={t.icon} size={40} />
            <View style={{ flex: 1 }}>
              <ThemedText style={{ fontWeight: 600 }}>{t.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {t.routines
                  .slice(0, 3)
                  .map((r) => r.name)
                  .join(', ')}
                …
              </ThemedText>
            </View>
            <View style={[local.idea, { backgroundColor: theme.tintSoft }]}>
              <ThemedText type="small" themeColor="tint" style={{ fontWeight: 700 }}>
                Add
              </ThemedText>
            </View>
          </Pressable>
        ))}
      </Card>
    </View>
  );
}

function RoutineLine({ routine, logIndex }: { routine: Routine; logIndex: ReturnType<typeof useRoutineData>['logIndex'] }) {
  const theme = useTheme();
  const { memberById } = useHousehold();
  const now = new Date();
  const week = pct(scoreRoutine(routine, logIndex, weekStart(now), now));
  const s = streak(routine, logIndex, now);
  const turns = hasDayAssignees(routine);
  const people = turns ? [...new Set(Object.values(routine.day_assignees ?? {}))] : routine.assignee_ids;
  const details = [
    describeSchedule(routine.schedule),
    turns ? 'Takes turns' : '',
    s >= 2 ? `🔥 ${s}` : '',
  ].filter(Boolean);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/routine-form', params: { id: routine.id } })}
      style={({ pressed }) => [local.line, { borderTopColor: theme.border, opacity: pressed ? 0.6 : 1 }]}>
      <View style={[local.dot, { backgroundColor: theme.tint }]} />
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText style={{ fontWeight: 600 }}>
          {routine.private_to ? '🔒 ' : ''}
          {routine.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {details.join(' · ')}
        </ThemedText>
      </View>
      {people.length > 0 && (
        <View style={{ flexDirection: 'row' }}>
          {people.slice(0, 3).map((id) => (
            <View key={id} style={{ marginLeft: -6 }}>
              <Avatar profile={id ? memberById.get(id)?.profile : undefined} size={24} />
            </View>
          ))}
        </View>
      )}
      <ScorePill value={week} />
    </Pressable>
  );
}

const local = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    ...styles.row,
    padding: Spacing.three,
  },
  chevron: {
    fontSize: 26,
    lineHeight: 28,
    width: 16,
    textAlign: 'center',
  },
  line: {
    ...styles.row,
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 19,
    marginRight: 6,
  },
  ideas: {
    gap: Spacing.two,
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  idea: {
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
