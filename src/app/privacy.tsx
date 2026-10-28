import { Stack } from 'expo-router';

import { PrivacyPolicy } from '@/components/legal/privacy-policy';

/** Public privacy policy for the app store listings, reachable while signed out. */
export default function PrivacyScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Privacy policy', headerShown: true }} />
      <PrivacyPolicy />
    </>
  );
}
