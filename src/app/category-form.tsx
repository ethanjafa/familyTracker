import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { deleteCategory, saveCategory, useCategories } from '@/api/routines';
import { Button, Field, Loading, Screen } from '@/components/ui';
import type { RoutineCategory } from '@/lib/types';
import { confirmAsync, showAlert } from '@/lib/dialogs';
import { errorMessage } from '@/lib/errors';
import { categoryIcon } from '@/lib/icons';
import { useHousehold } from '@/providers/household-provider';

export default function CategoryForm() {
  const params = useLocalSearchParams<{ id?: string }>();
  const categories = useCategories();
  if (params.id && categories.isPending) return <Loading />;
  const existing = categories.data?.find((c) => c.id === params.id);
  return <CategoryFormBody existing={existing} />;
}

function CategoryFormBody({ existing }: { existing?: RoutineCategory }) {
  const { household } = useHousehold();
  const [name, setName] = useState(existing?.name ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await saveCategory({ id: existing?.id, household_id: household.id, name: name.trim(), icon: categoryIcon(name.trim()), visibility: existing?.visibility ?? 'family' });
      router.back();
    } catch (e) {
      showAlert('Could not save', errorMessage(e));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirmAsync('Delete category?', 'All routines in it and their history will be deleted.'))) return;
    try {
      await deleteCategory(existing!.id);
      router.dismissTo({ pathname: '/goals', params: { section: 'routines' } });
    } catch (e) {
      showAlert('Could not delete', errorMessage(e));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: existing ? 'Edit category' : 'New category' }} />
      <Screen>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. House cleanliness" autoFocus={!existing} />
        <Button title="Save" onPress={save} loading={busy} disabled={!name.trim()} />
        {existing && <Button title="Delete category" variant="danger" onPress={remove} />}
      </Screen>
    </>
  );
}
