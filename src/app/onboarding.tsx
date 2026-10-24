import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createHousehold, joinHousehold } from '@/api/household';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Field, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { signOut } from '@/lib/auth';

import { errorMessage } from '@/lib/errors';

export default function OnboardingScreen() {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('Our family');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === 'create') await createHousehold(name.trim() || 'Our family');
      else await joinHousehold(code);
    } catch (e) {
      Alert.alert('Something went wrong', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, padding: Spacing.four, gap: Spacing.four, justifyContent: 'center' }}>
          <View style={{ gap: Spacing.two }}>
            <Image source={require('@/assets/images/logo-mark.png')} style={{ width: 72, height: 72, marginBottom: Spacing.two }} />
            <ThemedText type="title">Set up your family</ThemedText>
            <ThemedText themeColor="textSecondary">
              Create a household and invite your partner, or join one with an invite code.
            </ThemedText>
          </View>

          <Segmented
            options={[
              { value: 'create', label: 'Create' },
              { value: 'join', label: 'Join with code' },
            ]}
            value={mode}
            onChange={setMode}
          />

          <Card>
            {mode === 'create' ? (
              <Field label="Household name" value={name} onChangeText={setName} />
            ) : (
              <Field
                label="Invite code"
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
                placeholder="e.g. 4F9A2C"
              />
            )}
          </Card>

          <Button
            title={mode === 'create' ? 'Create household' : 'Join household'}
            onPress={submit}
            loading={busy}
            disabled={mode === 'join' && code.trim().length < 6}
          />
          <Button title="Sign out" variant="danger" onPress={signOut} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}
