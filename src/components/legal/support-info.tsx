import { Link } from 'expo-router';
import { Linking, Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Screen } from '@/components/ui';
import { SUPPORT_EMAIL } from '@/lib/legal';

const FAQ: [string, string][] = [
  [
    'How do I add my family?',
    'Go to Settings → Family → “Invite a family member” and send them the code. They sign in to WhoseTurn and choose “Join with code”. Codes last 7 days.',
  ],
  [
    'I already started my own family. How do I join someone else’s?',
    'Ask them for an invite code, then go to Settings → “Join another family with a code”. You can bring your routines and to-dos along or start fresh.',
  ],
  [
    'How do I plan the week?',
    'Open the Assign tab and tap a box to choose who does it; tap again to switch person. Your family’s planning day (Settings → Planning day) adds a “Plan the week together” task to Today.',
  ],
  [
    'Why can’t my family see something I added?',
    'Items marked 🔒 personal are only visible to you. Edit the item and switch personal off to share it with your family.',
  ],
  [
    'Reminders don’t arrive',
    'Turn them on in Settings → Reminders, and allow notifications for WhoseTurn in your phone’s settings. Reminders work in the iPhone and Android apps.',
  ],
];

/** Help and contact details, shown on the public /support page (the App Store's Support URL). */
export function SupportInfo() {
  return (
    <Screen>
      <ThemedText type="subtitle">WhoseTurn support</ThemedText>
      <Card>
        <ThemedText type="smallBold" style={{ fontSize: 16 }}>
          Contact us
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Questions, problems or ideas? Email us and we’ll get back to you, usually within two days.
        </ThemedText>
        <Pressable onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} hitSlop={8}>
          <ThemedText type="small" themeColor="tint" style={{ fontWeight: 700 }}>
            {SUPPORT_EMAIL}
          </ThemedText>
        </Pressable>
      </Card>
      {FAQ.map(([q, a]) => (
        <Card key={q}>
          <ThemedText type="smallBold" style={{ fontSize: 16 }}>
            {q}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {a}
          </ThemedText>
        </Card>
      ))}
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        <Link href="/privacy" style={{ textDecorationLine: 'underline' }}>
          Privacy policy
        </Link>
        {'   ·   '}
        <Link href="/delete-account" style={{ textDecorationLine: 'underline' }}>
          Delete your account
        </Link>
      </ThemedText>
    </Screen>
  );
}
