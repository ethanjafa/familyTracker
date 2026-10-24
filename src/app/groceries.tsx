import { Stack } from 'expo-router';

import { GroceryList } from '@/components/plan/grocery-list';
import { Screen } from '@/components/ui';

/** The household grocery list: everything is either Have or Need. Opened from Plan. */
export default function GroceriesScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Groceries' }} />
      <Screen>
        <GroceryList />
      </Screen>
    </>
  );
}
