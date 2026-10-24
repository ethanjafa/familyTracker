import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { deleteProject, saveProject, useProjects } from '@/api/projects';
import { ThemedText } from '@/components/themed-text';
import { Button, ChipGroup, DateField, Field, IconPicker, isValidDay, Label, Loading, Screen, Segmented } from '@/components/ui';
import type { Project, ProjectStatus, Visibility } from '@/lib/types';
import { errorMessage } from '@/lib/errors';
import { useHousehold } from '@/providers/household-provider';

export default function ProjectForm() {
  const params = useLocalSearchParams<{ id?: string; visibility?: Visibility }>();
  const projects = useProjects();
  if (params.id && projects.isPending) return <Loading />;
  const existing = projects.data?.find((p) => p.id === params.id);
  return <ProjectFormBody existing={existing} defaultVisibility={params.visibility ?? 'family'} />;
}

function ProjectFormBody({ existing, defaultVisibility }: { existing?: Project; defaultVisibility: Visibility }) {
  const { household } = useHousehold();
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? '🛠️');
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? defaultVisibility);
  const [status, setStatus] = useState<ProjectStatus>(existing?.status ?? 'active');
  const [targetDate, setTargetDate] = useState(existing?.target_date ?? '');
  const [budget, setBudget] = useState(existing?.budget != null ? String(existing.budget) : '');
  const [busy, setBusy] = useState(false);

  const budgetValue = budget.trim() === '' ? null : Number(budget.replace(',', '.'));
  const valid = name.trim() && isValidDay(targetDate) && (budgetValue === null || !isNaN(budgetValue));

  const save = async () => {
    setBusy(true);
    try {
      await saveProject({
        id: existing?.id,
        household_id: household.id,
        name: name.trim(),
        description: description.trim() || null,
        icon,
        visibility,
        status,
        target_date: targetDate || null,
        budget: budgetValue,
      });
      router.back();
    } catch (e) {
      Alert.alert('Could not save', errorMessage(e));
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert('Delete project?', 'All of its steps will be deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteProject(existing!.id);
          router.dismissTo('/projects');
        },
      },
    ]);

  return (
    <>
      <Stack.Screen options={{ title: existing ? 'Edit project' : 'New project' }} />
      <Screen>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Renovation" autoFocus={!existing} />
        <Field label="Goal / notes" value={description} onChangeText={setDescription} multiline placeholder="What does done look like?" />
        {!existing && (
          <>
            <Label>Who is it for</Label>
            <Segmented
              options={[
                { value: 'personal', label: '🙋 Just me' },
                { value: 'family', label: '👨‍👩‍👧 Family' },
              ]}
              value={visibility}
              onChange={setVisibility}
            />
            <ThemedText type="small" themeColor="textSecondary">
              {visibility === 'personal' ? 'Only you can see this project.' : 'Everyone in your household can see and update it.'}
            </ThemedText>
          </>
        )}
        {existing && (
          <>
            <Label>Status</Label>
            <ChipGroup
              options={[
                { value: 'active', label: 'Active' },
                { value: 'on_hold', label: 'On hold' },
                { value: 'done', label: 'Completed' },
              ]}
              value={status}
              onChange={setStatus}
            />
          </>
        )}
        <DateField label="Target date" value={targetDate} onChange={setTargetDate} />
        <Field label="Budget" value={budget} onChangeText={setBudget} keyboardType="decimal-pad" placeholder="optional" />
        <Label>Icon</Label>
        <IconPicker value={icon} onChange={setIcon} />
        <Button title="Save" onPress={save} loading={busy} disabled={!valid} />
        {existing && <Button title="Delete project" variant="danger" onPress={remove} />}
      </Screen>
    </>
  );
}
