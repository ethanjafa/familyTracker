import { Stack } from 'expo-router';

import { AiConnectGuide } from '@/components/ai-connect-guide';
import { useAuth } from '@/providers/auth-provider';

/** Public page explaining how to connect Claude (share this link). Open whether signed in or not. */
export default function AiScreen() {
  const { session } = useAuth();
  return (
    <>
      <Stack.Screen options={{ title: 'WhoseTurn + Claude', headerShown: true }} />
      <AiConnectGuide privacyHref={session ? '/settings/privacy' : '/privacy'} />
    </>
  );
}
