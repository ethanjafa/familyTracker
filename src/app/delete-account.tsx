import { Stack } from 'expo-router';

import { DeleteAccountInfo } from '@/components/legal/delete-account-info';

/** Public "how to delete your account" page for Google Play, reachable while signed out. */
export default function DeleteAccountScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Delete your account', headerShown: true }} />
      <DeleteAccountInfo />
    </>
  );
}
