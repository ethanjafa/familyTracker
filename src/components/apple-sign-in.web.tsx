import { useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { signInWith } from '@/lib/auth';

/**
 * Sign in with Apple on the web, so people who joined with Apple on iPhone can sign in here too
 * (e.g. to connect an AI assistant). Goes through Supabase with the Apple Services ID.
 */
export function AppleSignInButton({ onError }: { onError: (e: unknown) => void }) {
  const [busy, setBusy] = useState(false);
  const press = async () => {
    setBusy(true);
    try {
      await signInWith('apple');
    } catch (e) {
      onError(e);
      setBusy(false);
    }
  };
  return (
    <Pressable
      onPress={press}
      disabled={busy}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: '#000',
        borderRadius: Radius.md,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.8 : 1,
      })}>
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <ThemedText style={{ color: '#fff', fontWeight: 600, fontSize: 17 }}>Sign in with Apple</ThemedText>
      )}
    </Pressable>
  );
}
