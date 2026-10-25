import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { signInWith } from '@/lib/auth';
import { showAlert } from '@/lib/dialogs';
import { errorMessage } from '@/lib/errors';

const HIGHLIGHTS = [
  { icon: '🗓️', text: 'Daily routines for everyone at home' },
  { icon: '📝', text: 'Shared to-dos with owners and target dates' },
  { icon: '📈', text: 'Weekly scores to see how the family is doing' },
];

export default function SignInScreen() {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    try {
      await signInWith('google');
    } catch (e) {
      showAlert('Sign-in failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <View style={styles.hero}>
          <View style={[styles.halo, { backgroundColor: theme.tintSoft }]}>
            <Image source={require('@/assets/images/logo-mark.png')} style={styles.logo} contentFit="contain" />
          </View>
          <View style={{ gap: Spacing.two, alignItems: 'center' }}>
            <ThemedText type="title">FamilyWeek</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.tagline}>
              Plan and track your family&apos;s day to day
            </ThemedText>
          </View>
          <View style={styles.highlights}>
            {HIGHLIGHTS.map((h) => (
              <View key={h.text} style={styles.highlight}>
                <View style={[styles.highlightIcon, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <ThemedText style={{ fontSize: 18, lineHeight: 24 }}>{h.icon}</ThemedText>
                </View>
                <ThemedText type="small" style={{ flex: 1 }}>
                  {h.text}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
        <View style={{ gap: Spacing.three }}>
          <Button title="Continue with Google" loading={busy} onPress={signIn} />
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            Everyone in your family signs in with their own account.
          </ThemedText>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four, justifyContent: 'space-between' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.five },
  halo: { width: 168, height: 168, borderRadius: 84, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 150, height: 150 },
  tagline: { textAlign: 'center', fontSize: 17, maxWidth: 330 },
  highlights: { gap: Spacing.three, width: '100%', maxWidth: 360 },
  highlight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  highlightIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
