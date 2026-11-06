import { Stack } from 'expo-router';

import { SupportInfo } from '@/components/legal/support-info';

/** Public help page for the App Store's Support URL, reachable while signed out. */
export default function SupportScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Support', headerShown: true }} />
      <SupportInfo />
    </>
  );
}
