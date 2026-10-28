import { Stack } from 'expo-router';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Screen } from '@/components/ui';
import { SUPPORT_EMAIL } from '@/lib/legal';

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'What we collect',
    body: [
      'Your name and email address, from Google or Apple when you sign in with them, or the email you sign in with.',
      'What you and your family put into WhoseTurn: your household, routines, to-dos, meals, grocery lists, plans and check-ins.',
    ],
  },
  {
    title: 'How it is used',
    body: [
      'Only to run the app: to show your family the routines, to-dos and meals you share, and to work out scores and plans.',
      'We do not sell your data, show ads, or use it for advertising or tracking.',
    ],
  },
  {
    title: 'Who can see it',
    body: [
      'People in your household see what is shared with the household.',
      'Anything you tag 🔒 Personal is visible only to you.',
      'Your data is stored with our database provider, Supabase, which processes it only on our behalf.',
    ],
  },
  {
    title: 'Deleting your data',
    body: [
      'You can delete your account at any time in Settings → Delete my account.',
      'This removes your account and everything that is only yours. Shared family items stay with your family; if you are the last member, the whole household is deleted.',
    ],
  },
  {
    title: 'Children',
    body: ['WhoseTurn accounts are for adults. Children can be part of the family plan through a parent’s account.'],
  },
  {
    title: 'Contact',
    body: [`Questions or requests: ${SUPPORT_EMAIL}`],
  },
];

/** Public privacy policy (linked from the app stores and Settings). Readable without signing in. */
export default function PrivacyScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Privacy policy', headerShown: true }} />
      <Screen>
        <ThemedText type="subtitle">WhoseTurn privacy policy</ThemedText>
        {SECTIONS.map((s) => (
          <Card key={s.title}>
            <ThemedText type="smallBold" style={{ fontSize: 16 }}>
              {s.title}
            </ThemedText>
            <View style={{ gap: 6 }}>
              {s.body.map((line) => (
                <ThemedText key={line} type="small" themeColor="textSecondary">
                  {line}
                </ThemedText>
              ))}
            </View>
          </Card>
        ))}
      </Screen>
    </>
  );
}
