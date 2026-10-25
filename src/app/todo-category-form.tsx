import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { deleteProject, saveProject, useProjects } from '@/api/projects';
import { ThemedText } from '@/components/themed-text';
import { Button, Field, IconPicker, Label, Loading, Screen, Segmented } from '@/components/ui';
import { confirmAsync, showAlert } from '@/lib/dialogs';
import { errorMessage } from '@/lib/errors';
import type { Project, Visibility } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

/** A to-do category: just a name, an icon, and who it's for. */
export default function TodoCategoryForm() {
  const params = useLocalSearchParams<{ id?: string; visibility?: Visibility }>();
  const projects = useProjects();
  if (params.id && projects.isPending) return <Loading />;
  const existing = projects.data?.find((p) => p.id === params.id);
  return <TodoCategoryFormBody existing={existing} defaultVisibility={params.visibility ?? 'family'} />;
}

function TodoCategoryFormBody({ existing, defaultVisibility }: { existing?: Project; defaultVisibility: Visibility }) {
  const { household } = useHousehold();
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? '📝');
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? defaultVisibility);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await saveProject({ id: existing?.id, household_id: household.id, name: name.trim(), icon, visibility });
      router.back();
    } catch (e) {
      showAlert('Could not save', errorMessage(e));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirmAsync('Delete category?', 'All of its to-dos will be deleted too.'))) return;
    try {
      await deleteProject(existing!.id);
      router.back();
    } catch (e) {
      showAlert('Could not delete', errorMessage(e));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: existing ? 'Edit category' : 'New to-do category' }} />
      <Screen>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Home repairs" autoFocus={!existing} />
        {!existing && (
          <>
            <Label>Who is it for</Label>
            <Segmented
              options={[
                { value: 'family', label: '👨‍👩‍👧 Family' },
                { value: 'personal', label: '🙋 Just me' },
              ]}
              value={visibility}
              onChange={setVisibility}
            />
            <ThemedText type="small" themeColor="textSecondary">
              {visibility === 'personal' ? 'Only you can see these to-dos.' : 'Everyone in your household can see and tick them off.'}
            </ThemedText>
          </>
        )}
        <Label>Icon</Label>
        <IconPicker value={icon} onChange={setIcon} />
        <Button title="Save" onPress={save} loading={busy} disabled={!name.trim()} />
        {existing && <Button title="Delete category" variant="danger" onPress={remove} />}
      </Screen>
    </>
  );
}
