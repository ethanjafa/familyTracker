import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { deleteCategory, saveCategory, useCategories } from '@/api/routines';
import { ThemedText } from '@/components/themed-text';
import { Button, ColorPicker, Field, IconPicker, Label, Loading, Screen, Segmented } from '@/components/ui';
import type { RoutineCategory, Visibility } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

export default function CategoryForm() {
  const params = useLocalSearchParams<{ id?: string; visibility?: Visibility }>();
  const categories = useCategories();
  if (params.id && categories.isPending) return <Loading />;
  const existing = categories.data?.find((c) => c.id === params.id);
  return <CategoryFormBody existing={existing} defaultVisibility={params.visibility ?? 'personal'} />;
}

function CategoryFormBody({ existing, defaultVisibility }: { existing?: RoutineCategory; defaultVisibility: Visibility }) {
  const { household } = useHousehold();
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? '🏠');
  const [color, setColor] = useState(existing?.color ?? '#208AEF');
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? defaultVisibility);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await saveCategory({ id: existing?.id, household_id: household.id, name: name.trim(), icon, color, visibility });
      router.back();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert('Delete category?', 'All routines in it and their history will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteCategory(existing!.id);
          router.dismissTo('/routines');
        },
      },
    ]);

  return (
    <>
      <Stack.Screen options={{ title: existing ? 'Edit category' : 'New category' }} />
      <Screen>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. House cleanliness" autoFocus={!existing} />
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
              {visibility === 'personal'
                ? 'Only you can see personal categories.'
                : 'Everyone in your household can see and log family routines.'}
            </ThemedText>
          </>
        )}
        <Label>Icon</Label>
        <IconPicker value={icon} onChange={setIcon} />
        <Label>Color</Label>
        <ColorPicker value={color} onChange={setColor} />
        <Button title="Save" onPress={save} loading={busy} disabled={!name.trim()} />
        {existing && <Button title="Delete category" variant="danger" onPress={remove} />}
      </Screen>
    </>
  );
}
