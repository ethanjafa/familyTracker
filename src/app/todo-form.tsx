import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { createTodoCategory, deleteItem, saveItem, useProjectItems, useProjects } from '@/api/projects';
import { CategoryPicker, NEW_CATEGORY } from '@/components/category-picker';
import { PersonChips } from '@/components/plan/pickers';
import { ThemedText } from '@/components/themed-text';
import { Button, DateField, Field, isValidDay, Label, Loading, Screen, Segmented } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { confirmAsync, showAlert } from '@/lib/dialogs';
import { errorMessage } from '@/lib/errors';
import type { Project, ProjectItem } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

/** Create or edit a to-do in one page: its category is a field (pick one, or type a new one). */
export default function TodoForm() {
  const params = useLocalSearchParams<{ id?: string; categoryId?: string }>();
  const items = useProjectItems();
  const projects = useProjects();
  if (items.isPending || projects.isPending) return <Loading />;
  const existing = items.data?.find((i) => i.id === params.id);
  if (params.id && !existing) return <Loading />;
  const categories = projects.data ?? [];
  const initial = existing?.project_id ?? params.categoryId ?? (categories.length ? '' : NEW_CATEGORY);
  return <TodoFormBody key={existing?.id ?? 'new'} existing={existing} categories={categories} initialCategoryId={initial} />;
}

function TodoFormBody({
  existing,
  categories,
  initialCategoryId,
}: {
  existing?: ProjectItem;
  categories: Project[];
  initialCategoryId: string;
}) {
  const theme = useTheme();
  const { household, userId } = useHousehold();
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [newCategory, setNewCategory] = useState('');
  const category = categories.find((c) => c.id === categoryId);
  // To-dos in the old personal categories are always personal.
  const lockedPersonal = category?.visibility === 'personal';
  const [personalTag, setPersonal] = useState(!!existing?.private_to);
  const personal = lockedPersonal || personalTag;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [targetDate, setTargetDate] = useState(existing?.due_date ?? '');
  // Backlog = no target date yet. Existing to-dos without a date are in the backlog.
  const [backlog, setBacklog] = useState(!!existing && !existing.due_date);
  const [owner, setOwner] = useState<string | null>(existing ? existing.assignee_id : null);
  const [busy, setBusy] = useState(false);

  const hasCategory = categoryId === NEW_CATEGORY ? !!newCategory.trim() : !!category;
  const hasDate = backlog || (!!targetDate && isValidDay(targetDate));
  const valid = !!title.trim() && hasCategory && hasDate;

  const save = async () => {
    setBusy(true);
    try {
      const project_id = categoryId === NEW_CATEGORY ? await createTodoCategory(household.id, newCategory.trim()) : categoryId;
      await saveItem({
        id: existing?.id,
        household_id: household.id,
        project_id,
        title: title.trim(),
        due_date: backlog ? null : targetDate,
        // Personal to-dos are hidden from everyone else and always yours.
        assignee_id: personal ? userId : owner,
        ...(personal || existing?.private_to !== undefined ? { private_to: personal ? userId : null } : {}),
      });
      router.back();
    } catch (e) {
      showAlert('Could not save', errorMessage(e));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirmAsync('Delete to-do?', `"${existing!.title}" will be removed.`))) return;
    try {
      await deleteItem(existing!.id);
      router.back();
    } catch (e) {
      showAlert('Could not delete', errorMessage(e));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: existing ? 'Edit to-do' : 'New to-do' }} />
      <Screen>
        <Field label="To-do" value={title} onChangeText={setTitle} placeholder="e.g. Fix the tap" autoFocus={!existing} />
        <CategoryPicker
          categories={categories}
          value={categoryId}
          onChange={setCategoryId}
          newName={newCategory}
          onNewName={setNewCategory}
          placeholder="e.g. Home repairs"
        />

        <Label>Who can see it</Label>
        {lockedPersonal ? (
          <ThemedText type="small" themeColor="textSecondary">
            🔒 Personal. This category is only yours.
          </ThemedText>
        ) : (
          <>
            <Segmented
              options={[
                { value: 'family', label: '👨‍👩‍👧 Family' },
                { value: 'personal', label: '🔒 Personal' },
              ]}
              value={personal ? 'personal' : 'family'}
              onChange={(v) => setPersonal(v === 'personal')}
            />
            <ThemedText type="small" themeColor="textSecondary">
              {personal ? 'Only you can see it, and you are its owner.' : 'Everyone in your household can see it.'}
            </ThemedText>
          </>
        )}
        {!personal && (
          <>
            <Label>Owner</Label>
            <PersonChips value={owner} onChange={setOwner} noneLabel="Anyone" />
          </>
        )}

        <View style={{ opacity: backlog ? 0.4 : 1 }} pointerEvents={backlog ? 'none' : 'auto'}>
          <DateField label="Date" value={backlog ? '' : targetDate} onChange={setTargetDate} />
          <ThemedText type="small" themeColor="textSecondary">
            It shows up on Today on this day.
          </ThemedText>
        </View>
        <Pressable onPress={() => setBacklog((b) => !b)} hitSlop={6} style={local.check}>
          <View style={[local.box, { borderColor: backlog ? theme.tint : theme.backgroundSelected, backgroundColor: backlog ? theme.tint : 'transparent' }]}>
            {backlog && <ThemedText style={local.tick}>✓</ThemedText>}
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={{ fontWeight: 600 }}>Backlog</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              No date yet. Pick one later.
            </ThemedText>
          </View>
        </Pressable>

        <Button title="Save" onPress={save} loading={busy} disabled={!valid} />
        {existing && <Button title="Delete to-do" variant="danger" onPress={remove} />}
      </Screen>
    </>
  );
}

const local = StyleSheet.create({
  check: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#fff', fontWeight: 800, fontSize: 13, lineHeight: 17 },
});
