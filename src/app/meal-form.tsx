import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { deleteMeal, saveMeal, useMeals } from '@/api/meals';
import { ThemedText } from '@/components/themed-text';
import { Button, Field, Loading, Screen } from '@/components/ui';
import { confirmAsync, showAlert } from '@/lib/dialogs';
import { errorMessage } from '@/lib/errors';
import { mealIcon } from '@/lib/icons';
import type { Meal } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

export default function MealForm() {
  const params = useLocalSearchParams<{ id?: string }>();
  const meals = useMeals();
  if (params.id && meals.isPending) return <Loading />;
  const existing = meals.data?.find((m) => m.id === params.id);
  return <MealFormBody existing={existing} />;
}

/** Ingredients are typed one per line (or separated by commas). */
const parseIngredients = (text: string) =>
  text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

function MealFormBody({ existing }: { existing?: Meal }) {
  const { household } = useHousehold();
  const [name, setName] = useState(existing?.name ?? '');
  const [ingredients, setIngredients] = useState(existing?.ingredients.join('\n') ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await saveMeal({ id: existing?.id, household_id: household.id, name: name.trim(), icon: mealIcon(name.trim()), ingredients: parseIngredients(ingredients) });
      router.back();
    } catch (e) {
      showAlert('Could not save', errorMessage(e));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirmAsync('Delete meal?', `"${existing!.name}" is removed from the backlog and from any planned days.`))) return;
    try {
      await deleteMeal(existing!.id);
      router.back();
    } catch (e) {
      showAlert('Could not delete', errorMessage(e));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: existing ? 'Edit meal' : 'New meal' }} />
      <Screen>
        <Field label="Meal" value={name} onChangeText={setName} placeholder="e.g. Tacos" autoFocus={!existing} />
        <Field
          label="Ingredients (optional)"
          value={ingredients}
          onChangeText={setIngredients}
          multiline
          placeholder={'One per line, e.g.\nTortillas\nAvocados\nSalsa'}
        />
        <ThemedText type="small" themeColor="textSecondary">
          When you plan this meal, any ingredient you don&apos;t have goes on the grocery list.
        </ThemedText>
        <Button title="Save" onPress={save} loading={busy} disabled={!name.trim()} />
        {existing && <Button title="Delete meal" variant="danger" onPress={remove} />}
      </Screen>
    </>
  );
}
