import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { setItemStatus } from '@/api/projects';
import { ThemedText } from '@/components/themed-text';
import { Avatar, styles } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { prettyDay } from '@/lib/dates';
import { movedFrom } from '@/lib/projects';
import { showAlert } from '@/lib/dialogs';
import { errorMessage } from '@/lib/errors';
import type { ProjectItem } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

/** A to-do: tick the box to finish it, tap the row to edit it. */
export function TodoRow({ item, today, caption, first = false }: { item: ProjectItem; today: string; caption?: string; first?: boolean }) {
  const theme = useTheme();
  const { memberById } = useHousehold();
  const done = item.status === 'done';
  const toggle = () =>
    setItemStatus(item, done ? 'todo' : 'done').catch((e) => showAlert('Could not update', errorMessage(e)));
  // Unfinished to-dos move on to the next day by themselves; say where they came from.
  const from = movedFrom(item, today);
  const on = item.planned_date ?? item.due_date;
  const when = from ? `Moved from ${prettyDay(from)}` : !on || on === today ? '' : prettyDay(on);
  const details = [caption, when].filter(Boolean);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/todo-form', params: { id: item.id } })}
      style={({ pressed }) => [
        styles.row,
        local.row,
        !first && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
        { opacity: pressed ? 0.6 : 1 },
      ]}>
      <Pressable
        onPress={toggle}
        hitSlop={10}
        style={[local.box, { borderColor: done ? theme.success : theme.backgroundSelected, backgroundColor: done ? theme.success : 'transparent' }]}>
        {done && <ThemedText style={local.tick}>✓</ThemedText>}
      </Pressable>
      <View style={{ flex: 1 }}>
        <ThemedText style={done ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}>
          {item.private_to ? '🔒 ' : ''}
          {item.title}
        </ThemedText>
        {details.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            {details.join(' · ')}
          </ThemedText>
        )}
      </View>
      {item.assignee_id && <Avatar profile={memberById.get(item.assignee_id)?.profile} size={24} />}
    </Pressable>
  );
}

const local = StyleSheet.create({
  row: { paddingVertical: 10, gap: 12 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#fff', fontWeight: 800, fontSize: 14, lineHeight: 18 },
});
