import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { type Provider, signInWith } from '@/lib/auth';

export default function SignInScreen() {
  const [busy, setBusy] = useState<Provider | null>(null);

  const signIn = async (provider: Provider) => {
    setBusy(provider);
    try {
      await signInWith(provider);
    } catch (e) {
      Alert.alert('Sign-in failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <View style={styles.hero}>
          <ThemedText style={{ fontSize: 64, lineHeight: 80 }}>🏡</ThemedText>
          <ThemedText type="subtitle">Family Tracker</ThemedText>
          <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
            Routines, projects and scorecards for you and your family, in sync.
          </ThemedText>
        </View>
        <View style={{ gap: Spacing.two }}>
          <Button title="Continue with Apple" variant="secondary" loading={busy === 'apple'} onPress={() => signIn('apple')} />
          <Button title="Continue with Google" variant="secondary" loading={busy === 'google'} onPress={() => signIn('google')} />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four, justifyContent: 'space-between' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
});
