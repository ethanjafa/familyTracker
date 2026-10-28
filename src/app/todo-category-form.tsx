import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { deleteProject, saveProject, useProjects } from '@/api/projects';
import { Button, Field, Loading, Screen } from '@/components/ui';
import { confirmAsync, showAlert } from '@/lib/dialogs';
import { errorMessage } from '@/lib/errors';
import { categoryIcon } from '@/lib/icons';
import type { Project } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

/** A to-do category: just a name and an icon. */
export default function TodoCategoryForm() {
  const params = useLocalSearchParams<{ id?: string }>();
  const projects = useProjects();
  if (params.id && projects.isPending) return <Loading />;
  const existing = projects.data?.find((p) => p.id === params.id);
  return <TodoCategoryFormBody existing={existing} />;
}

function TodoCategoryFormBody({ existing }: { existing?: Project }) {
  const { household } = useHousehold();
  const [name, setName] = useState(existing?.name ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await saveProject({ id: existing?.id, household_id: household.id, name: name.trim(), icon: categoryIcon(name.trim()), visibility: existing?.visibility ?? 'family' });
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
        <Button title="Save" onPress={save} loading={busy} disabled={!name.trim()} />
        {existing && <Button title="Delete category" variant="danger" onPress={remove} />}
      </Screen>
    </>
  );
}
