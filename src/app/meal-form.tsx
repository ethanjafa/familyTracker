import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { deleteMeal, saveMeal, useMeals } from '@/api/meals';
import { ThemedText } from '@/components/themed-text';
import { Button, Field, Label, Loading, Screen, styles } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { confirmAsync, showAlert } from '@/lib/dialogs';
import { errorMessage } from '@/lib/errors';
import { MEAL_ICONS } from '@/lib/meal-ideas';
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
  const theme = useTheme();
  const { household } = useHousehold();
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? '🍽️');
  const [ingredients, setIngredients] = useState(existing?.ingredients.join('\n') ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await saveMeal({ id: existing?.id, household_id: household.id, name: name.trim(), icon, ingredients: parseIngredients(ingredients) });
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
        <Label>Icon</Label>
        <View style={styles.wrap}>
          {MEAL_ICONS.map((i) => (
            <Pressable
              key={i}
              onPress={() => setIcon(i)}
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                borderWidth: 1.5,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: i === icon ? theme.tintSoft : 'transparent',
                borderColor: i === icon ? theme.tint : 'transparent',
              }}>
              <ThemedText style={{ fontSize: 24, lineHeight: 32 }}>{i}</ThemedText>
            </Pressable>
          ))}
        </View>
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
