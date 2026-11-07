import { Stack } from 'expo-router';

import { AiConnectGuide } from '@/components/ai-connect-guide';

/** "Connect Claude" inside Settings, for signed-in people. */
export default function SettingsAiScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Connect Claude' }} />
      <AiConnectGuide privacyHref="/settings/privacy" />
    </>
  );
}
