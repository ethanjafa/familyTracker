import { Stack } from 'expo-router';

import { PrivacyPolicy } from '@/components/legal/privacy-policy';

/** The privacy policy inside Settings, for signed-in people. */
export default function SettingsPrivacyScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Privacy policy' }} />
      <PrivacyPolicy />
    </>
  );
}
