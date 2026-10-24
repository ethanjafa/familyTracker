import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { deleteItem, saveItem, useProjectItems, useProjects } from '@/api/projects';
import { Button, Chip, ChipGroup, DateField, Field, isValidDay, Label, Loading, Screen, styles } from '@/components/ui';
import { ITEM_STATUS } from '@/lib/projects';
import type { ItemStatus, Project, ProjectItem } from '@/lib/types';
import { errorMessage } from '@/lib/errors';
import { useHousehold } from '@/providers/household-provider';

export default function ItemForm() {
  const params = useLocalSearchParams<{ id?: string; projectId?: string }>();
  const items = useProjectItems();
  const projects = useProjects();
  if (items.isPending || projects.isPending) return <Loading />;
  const existing = items.data?.find((i) => i.id === params.id);
  const project = projects.data?.find((p) => p.id === (existing?.project_id ?? params.projectId));
  if (!project) return <Loading />;
  return <ItemFormBody existing={existing} project={project} />;
}

function ItemFormBody({ existing, project }: { existing?: ProjectItem; project: Project }) {
  const { household, members, userId } = useHousehold();
  const [title, setTitle] = useState(existing?.title ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [status, setStatus] = useState<ItemStatus>(existing?.status ?? 'todo');
  const [assignee, setAssignee] = useState<string | null>(existing?.assignee_id ?? null);
  const [dueDate, setDueDate] = useState(existing?.due_date ?? '');
  const [cost, setCost] = useState(existing?.cost != null ? String(existing.cost) : '');
  const [busy, setBusy] = useState(false);

  const costValue = cost.trim() === '' ? null : Number(cost.replace(',', '.'));
  const valid = title.trim() && isValidDay(dueDate) && (costValue === null || !isNaN(costValue));
  // Personal projects only involve their owner.
  const people = project.visibility === 'family' ? members : members.filter((m) => m.user_id === userId);

  const save = async () => {
    setBusy(true);
    try {
      await saveItem({
        id: existing?.id,
        household_id: household.id,
        project_id: project.id,
        title: title.trim(),
        notes: notes.trim() || null,
        status,
        assignee_id: assignee,
        due_date: dueDate || null,
        cost: costValue,
      });
      router.back();
    } catch (e) {
      Alert.alert('Could not save', errorMessage(e));
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert('Delete step?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteItem(existing!.id);
          router.back();
        },
      },
    ]);

  return (
    <>
      <Stack.Screen options={{ title: existing ? 'Edit step' : `New step · ${project.name}` }} />
      <Screen>
        <Field label="Step" value={title} onChangeText={setTitle} placeholder="e.g. Laminate change" autoFocus={!existing} />
        <Label>Status</Label>
        <ChipGroup
          options={(Object.keys(ITEM_STATUS) as ItemStatus[]).map((s) => ({
            value: s,
            label: `${ITEM_STATUS[s].icon} ${ITEM_STATUS[s].label}`,
          }))}
          value={status}
          onChange={setStatus}
        />
        <Label>Owner</Label>
        <View style={styles.wrap}>
          <Chip label="Anyone" selected={assignee === null} onPress={() => setAssignee(null)} />
          {people.map((m) => (
            <Chip
              key={m.user_id}
              label={m.profile.display_name}
              selected={assignee === m.user_id}
              onPress={() => setAssignee(m.user_id)}
            />
          ))}
        </View>
        <DateField label="Due date" value={dueDate} onChange={setDueDate} />
        <Field label="Cost" value={cost} onChangeText={setCost} keyboardType="decimal-pad" placeholder="optional" />
        <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Materials, contacts, measurements…" />
        <Button title="Save" onPress={save} loading={busy} disabled={!valid} />
        {existing && <Button title="Delete step" variant="danger" onPress={remove} />}
      </Screen>
    </>
  );
}
