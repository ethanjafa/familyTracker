import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { switchHousehold } from '@/api/household';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Field, Label, Screen, Segmented } from '@/components/ui';
import { confirmAsync, showAlert } from '@/lib/dialogs';
import { errorMessage } from '@/lib/errors';
import { useHousehold } from '@/providers/household-provider';

type Choice = 'bring' | 'fresh';

/** Settings → Join another family: switch to the family behind an invite code. */
export default function JoinFamilyScreen() {
  const { household, members } = useHousehold();
  const alone = members.length <= 1;
  const [code, setCode] = useState('');
  const [choice, setChoice] = useState<Choice>('bring');
  const [busy, setBusy] = useState(false);

  const join = async () => {
    const what = !alone
      ? `You'll leave "${household.name}". The family keeps everything shared; your 🔒 personal items come with you.`
      : choice === 'bring'
        ? 'Your routines, to-dos, meals and grocery list move into the new family.'
        : `"${household.name}" and its data are deleted. Only your 🔒 personal items come with you.`;
    if (!(await confirmAsync('Join another family?', what, 'Join'))) return;
    setBusy(true);
    try {
      await switchHousehold(code, alone && choice === 'bring');
      router.dismissTo('/');
    } catch (e) {
      showAlert('Could not join', errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Join another family' }} />
      <Screen>
        <ThemedText themeColor="textSecondary">
          Ask someone in the other family for an invite code (Settings → Invite a family member) and enter it here.
        </ThemedText>
        <Field label="Invite code" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="e.g. 4F9A2C" />

        {alone ? (
          <>
            <Label>What about your routines and to-dos?</Label>
            <Segmented
              options={[
                { value: 'bring', label: 'Bring them' },
                { value: 'fresh', label: 'Start fresh' },
              ]}
              value={choice}
              onChange={setChoice}
            />
            <Card>
              <ThemedText type="small" themeColor="textSecondary">
                {choice === 'bring'
                  ? 'Recommended. Your routines, to-dos, meals and grocery list move into the new family, so nothing you set up is lost.'
                  : `"${household.name}" and everything in it are deleted. Only your 🔒 personal items come with you.`}
              </ThemedText>
            </Card>
          </>
        ) : (
          <Card>
            <ThemedText type="small" themeColor="textSecondary">
              You&apos;ll leave &quot;{household.name}&quot;. The others there keep everything shared. Your 🔒 personal routines
              and to-dos come with you.
            </ThemedText>
          </Card>
        )}

        <Button title="Join family" onPress={join} loading={busy} disabled={code.trim().length < 6} />
      </Screen>
    </>
  );
}
