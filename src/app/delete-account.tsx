import { Stack } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Card, Screen } from '@/components/ui';
import { SUPPORT_EMAIL } from '@/lib/legal';

/** Public "how to delete your account" page (Google Play requires one). Readable without signing in. */
export default function DeleteAccountScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Delete your account', headerShown: true }} />
      <Screen>
        <ThemedText type="subtitle">Delete your WhoseTurn account</ThemedText>
        <Card>
          <ThemedText type="smallBold" style={{ fontSize: 16 }}>
            In the app
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            1. Open WhoseTurn and sign in.{'\n'}2. Go to Settings.{'\n'}3. Tap “Delete my account” and confirm.
          </ThemedText>
        </Card>
        <Card>
          <ThemedText type="smallBold" style={{ fontSize: 16 }}>
            What is deleted
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Your account, your profile, and everything that is only yours (personal routines and to-dos) are deleted
            straight away. Routines, to-dos and meals you shared with your family stay with them. If you are the last
            member of your household, the whole household and its data are deleted.
          </ThemedText>
        </Card>
        <Card>
          <ThemedText type="smallBold" style={{ fontSize: 16 }}>
            Can’t sign in?
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Email {SUPPORT_EMAIL} from the address you signed up with and we’ll delete your account for you.
          </ThemedText>
        </Card>
      </Screen>
    </>
  );
}
