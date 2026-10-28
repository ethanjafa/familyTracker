import { Image } from 'expo-image';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppleSignInButton } from '@/components/apple-sign-in';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui';
import { FontFamilies, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sendEmailCode, signInWith, verifyEmailCode } from '@/lib/auth';
import { showAlert } from '@/lib/dialogs';
import { errorMessage } from '@/lib/errors';

const HIGHLIGHTS = [
  { icon: '🗓️', text: 'Daily routines for everyone at home' },
  { icon: '📝', text: 'Shared to-dos with owners and target dates' },
  { icon: '📈', text: 'Weekly scores to see how the family is doing' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email sign-in (6-digit code) is built but switched off: it needs a custom email sender (SMTP) in
 * Supabase so the code reaches people. Turn it on once that's set up.
 */
const EMAIL_SIGN_IN = false;

export default function SignInScreen() {
  const theme = useTheme();
  const [busy, setBusy] = useState<'google' | 'send' | 'verify' | null>(null);
  const [email, setEmail] = useState('');
  // Set once the code has been emailed; the screen then asks for it.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<void>, failTitle: string) => {
    setBusy(kind);
    try {
      await action();
    } catch (e) {
      showAlert(failTitle, errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const google = () => run('google', () => signInWith('google'), 'Sign-in failed');
  const send = () =>
    run(
      'send',
      async () => {
        await sendEmailCode(email);
        setSentTo(email.trim());
        setCode('');
      },
      'Could not send the code',
    );
  const verify = () => run('verify', () => verifyEmailCode(sentTo!, code), 'That code didn’t work');

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.backgroundElement,
      color: theme.text,
      fontFamily: FontFamilies[500],
    },
  ];

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <View style={styles.hero}>
              <View style={[styles.halo, { backgroundColor: theme.tintSoft }]}>
                <Image source={require('@/assets/images/logo-mark.png')} style={styles.logo} contentFit="contain" />
              </View>
              <View style={{ gap: Spacing.two, alignItems: 'center' }}>
                <ThemedText type="title">WhoseTurn</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.tagline}>
                  Plan and track your family&apos;s day to day
                </ThemedText>
              </View>
              <View style={styles.highlights}>
                {HIGHLIGHTS.map((h) => (
                  <View key={h.text} style={styles.highlight}>
                    <View
                      style={[
                        styles.highlightIcon,
                        {
                          backgroundColor: theme.card,
                          borderColor: theme.border,
                        },
                      ]}>
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
              {sentTo ? (
                <>
                  <ThemedText style={{ textAlign: 'center' }}>
                    We emailed a 6-digit code to{'\n'}
                    <ThemedText style={{ fontWeight: 700 }}>{sentTo}</ThemedText>
                  </ThemedText>
                  <TextInput
                    value={code}
                    onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                    onSubmitEditing={() => code.length === 6 && verify()}
                    placeholder="123456"
                    placeholderTextColor={theme.textSecondary}
                    selectionColor={theme.tint}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                    autoFocus
                    style={[inputStyle, styles.code]}
                  />
                  <Button title="Sign in" loading={busy === 'verify'} disabled={code.length !== 6} onPress={verify} />
                  <View style={styles.links}>
                    <Pressable onPress={() => setSentTo(null)} hitSlop={8}>
                      <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: 600 }}>
                        Use a different email
                      </ThemedText>
                    </Pressable>
                    <Pressable onPress={send} hitSlop={8} disabled={busy !== null}>
                      <ThemedText type="small" themeColor="tint" style={{ fontWeight: 700 }}>
                        Send a new code
                      </ThemedText>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  {/* Apple asks for its button to be at least as prominent as other sign-in options. */}
                  <AppleSignInButton onError={(e) => showAlert('Sign-in failed', errorMessage(e))} />
                  <Button title="Continue with Google" loading={busy === 'google'} disabled={busy !== null} onPress={google} />
                  {EMAIL_SIGN_IN && (
                    <>
                      <View style={styles.divider}>
                        <View style={[styles.rule, { backgroundColor: theme.border }]} />
                        <ThemedText type="small" themeColor="textSecondary">
                          or
                        </ThemedText>
                        <View style={[styles.rule, { backgroundColor: theme.border }]} />
                      </View>
                      <TextInput
                        value={email}
                        onChangeText={setEmail}
                        onSubmitEditing={() => EMAIL_RE.test(email.trim()) && send()}
                        placeholder="you@example.com"
                        placeholderTextColor={theme.textSecondary}
                        selectionColor={theme.tint}
                        keyboardType="email-address"
                        textContentType="emailAddress"
                        autoComplete="email"
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={inputStyle}
                      />
                      <Button
                        title="Continue with email"
                        variant="secondary"
                        loading={busy === 'send'}
                        disabled={busy !== null || !EMAIL_RE.test(email.trim())}
                        onPress={send}
                      />
                    </>
                  )}
                </>
              )}
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                Everyone in your family signs in with their own account.
              </ThemedText>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: Spacing.four,
    justifyContent: 'space-between',
    gap: Spacing.four,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
  },
  halo: {
    width: 168,
    height: 168,
    borderRadius: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  input: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    fontSize: 16,
  },
  code: { textAlign: 'center', fontSize: 26, letterSpacing: 8 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
});
