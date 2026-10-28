import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { useProjectItems, useProjects } from '@/api/projects';
import { ThemedText } from '@/components/themed-text';
import { TodoRow } from '@/components/todo-row';
import { Button, EmptyState, IconTile, Loading, styles, useElevation } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { prettyDay, today as todayKey } from '@/lib/dates';
import { categoryStats, sortTodos } from '@/lib/projects';
import type { Project, ProjectItem } from '@/lib/types';

/** Routines & To-dos → To do: categories of to-dos, each with an owner and a target date. Categories start collapsed. */
export function TodoGoals() {
  const projects = useProjects();
  const items = useProjectItems();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (projects.isPending || items.isPending) return <Loading />;
  const categories = projects.data ?? [];
  const addTodo = () => router.push('/todo-form');

  if (!categories.length) {
    return (
      <EmptyState
        icon="📝"
        title="No to-do lists yet"
        body="Add a to-do and give it a category like Home repairs or Paperwork, an owner and a target date."
        action={<Button title="New to-do" onPress={addTodo} />}
      />
    );
  }

  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      {categories.map((c) => (
        <CategoryCard key={c.id} category={c} items={items.data ?? []} open={expanded.has(c.id)} onToggle={() => toggle(c.id)} />
      ))}
    </>
  );
}

function CategoryCard({
  category,
  items,
  open,
  onToggle,
}: {
  category: Project;
  items: ProjectItem[];
  open: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const elevation = useElevation();
  const [showDone, setShowDone] = useState(false);
  const today = todayKey();
  const s = categoryStats(category, items, today);
  const done = sortTodos(items.filter((i) => i.project_id === category.id && i.status === 'done'));
  const edit = () => router.push({ pathname: '/todo-category-form', params: { id: category.id } });
  const summary = !s.total
    ? 'Nothing yet'
    : !s.open.length
      ? 'All done 🎉'
      : [
          `${s.open.length} to do`,
          s.overdue ? `${s.overdue} from earlier days` : s.next?.due_date ? `next ${prettyDay(s.next.due_date)}` : '',
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <Animated.View layout={LinearTransition.duration(220)} style={[local.card, { backgroundColor: theme.card, borderColor: theme.border }, elevation]}>
      <Pressable onPress={onToggle} onLongPress={edit} style={({ pressed }) => [local.header, { opacity: pressed ? 0.7 : 1 }]}>
        <IconTile icon={category.icon} />
        <View style={{ flex: 1 }}>
          <ThemedText type="heading" style={{ fontSize: 17 }}>
            {category.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {summary}
          </ThemedText>
        </View>
        <ThemedText themeColor="textSecondary" style={[local.chevron, { transform: [{ rotate: open ? '90deg' : '0deg' }] }]}>
          ›
        </ThemedText>
      </Pressable>

      {open && (
        <Animated.View entering={FadeIn.duration(180)}>
          <View style={{ paddingHorizontal: Spacing.three }}>
            {s.open.map((i, idx) => (
              <TodoRow key={i.id} item={i} today={today} first={idx === 0} />
            ))}
            {done.length > 0 && (
              <Pressable onPress={() => setShowDone((v) => !v)} hitSlop={6} style={{ paddingVertical: 10 }}>
                <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: 600 }}>
                  {showDone ? '▾' : '▸'} Done ({done.length})
                </ThemedText>
              </Pressable>
            )}
            {showDone && done.map((i, idx) => <TodoRow key={i.id} item={i} today={today} first={idx === 0} />)}
          </View>
          <View style={[local.footer, { borderTopColor: theme.border }]}>
            <Pressable
              onPress={() => router.push({ pathname: '/todo-form', params: { categoryId: category.id } })}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <ThemedText type="small" themeColor="tint" style={{ fontWeight: 700 }}>
                + Add to-do
              </ThemedText>
            </Pressable>
            <Pressable onPress={edit} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
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

const local = StyleSheet.create({
  card: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  header: { ...styles.row, padding: Spacing.three },
  chevron: { fontSize: 26, lineHeight: 28, width: 16, textAlign: 'center' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
