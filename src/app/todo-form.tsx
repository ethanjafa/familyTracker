import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { deleteItem, saveItem, useProjectItems, useProjects } from '@/api/projects';
import { PersonChips } from '@/components/plan/pickers';
import { Button, DateField, Field, isValidDay, Label, Loading, Screen } from '@/components/ui';
import { confirmAsync, showAlert } from '@/lib/dialogs';
import { errorMessage } from '@/lib/errors';
import type { Project, ProjectItem } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

/** A to-do: what needs doing, who owns it, and the target date. */
export default function TodoForm() {
  const params = useLocalSearchParams<{ id?: string; categoryId?: string }>();
  const items = useProjectItems();
  const projects = useProjects();
  if (items.isPending || projects.isPending) return <Loading />;
  const existing = items.data?.find((i) => i.id === params.id);
  const category = projects.data?.find((p) => p.id === (existing?.project_id ?? params.categoryId));
  if (!category) return <Loading />;
  return <TodoFormBody existing={existing} category={category} />;
}

function TodoFormBody({ existing, category }: { existing?: ProjectItem; category: Project }) {
  const { household, userId } = useHousehold();
  const personal = category.visibility === 'personal';
  const [title, setTitle] = useState(existing?.title ?? '');
  const [targetDate, setTargetDate] = useState(existing?.due_date ?? '');
  // Personal to-dos are always yours.
  const [owner, setOwner] = useState<string | null>(existing ? existing.assignee_id : personal ? userId : null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await saveItem({
        id: existing?.id,
        household_id: household.id,
        project_id: category.id,
        title: title.trim(),
        due_date: targetDate || null,
        assignee_id: owner,
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
      <Stack.Screen options={{ title: existing ? 'Edit to-do' : `New to-do · ${category.icon} ${category.name}` }} />
      <Screen>
        <Field label="To-do" value={title} onChangeText={setTitle} placeholder="e.g. Fix the tap" autoFocus={!existing} />
        <Label>Owner</Label>
        <PersonChips value={owner} onChange={setOwner} noneLabel="Anyone" onlyMe={personal} />
        <DateField label="Target date" value={targetDate} onChange={setTargetDate} />
        <Button title="Save" onPress={save} loading={busy} disabled={!title.trim() || !isValidDay(targetDate)} />
        {existing && <Button title="Delete to-do" variant="danger" onPress={remove} />}
      </Screen>
    </>
  );
}
