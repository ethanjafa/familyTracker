import { Link } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Share, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Screen } from '@/components/ui';
import { MCP_URL } from '@/lib/legal';

const STEPS = [
  'Open Claude on the web (claude.ai) and go to Connectors.',
  'Choose “Add custom connector”. Name it WhoseTurn and paste the link above.',
  'Click Connect, sign in with the account you use in WhoseTurn, and tap Allow.',
  'Done. It also works in the Claude phone app, signed in to the same Claude account.',
];

const EXAMPLES = [
  'Who’s doing what in our family this week?',
  'Give Tuesday’s dishes to Sara and Thursday’s to me.',
  'Add a routine: water the plants every Monday and Thursday.',
  'Add milk, eggs and bread to the grocery list.',
  'What’s left on my to-do list?',
];

/** How to connect Claude to WhoseTurn: on the public /ai page and in Settings. */
export function AiConnectGuide({ privacyHref }: { privacyHref: '/privacy' | '/settings/privacy' }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(MCP_URL);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard blocked: the link is selectable, so it can still be copied by hand.
      }
      return;
    }
    // The share sheet has "Copy" on iPhone and Android, and can send the link to a computer.
    await Share.share({ message: MCP_URL });
  };

  return (
    <Screen>
      <ThemedText type="subtitle">Plan your family’s week with Claude</ThemedText>
      <ThemedText themeColor="textSecondary">
        Connect Claude, the AI assistant, to WhoseTurn and just ask: who’s on dishes, what’s for this week, what to buy.
        Changes show up in everyone’s WhoseTurn app straight away.
      </ThemedText>

      <Card>
        <ThemedText type="smallBold" style={{ fontSize: 16 }}>
          Your connector link
        </ThemedText>
        <ThemedText type="small" selectable style={{ fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) }}>
          {MCP_URL}
        </ThemedText>
        <Button title={copied ? 'Copied ✓' : Platform.OS === 'web' ? 'Copy link' : 'Copy or share link'} onPress={copy} />
        <Button
          title="Open Claude"
          variant="secondary"
          onPress={() => Linking.openURL('https://claude.ai')}
        />
      </Card>

      <Card>
        <ThemedText type="smallBold" style={{ fontSize: 16 }}>
          How to connect
        </ThemedText>
        <View style={{ gap: 8 }}>
          {STEPS.map((s, i) => (
            <ThemedText key={s} type="small" themeColor="textSecondary">
              {i + 1}. {s}
            </ThemedText>
          ))}
        </View>
      </Card>

      <Card>
        <ThemedText type="smallBold" style={{ fontSize: 16 }}>
          Things to ask
        </ThemedText>
        <View style={{ gap: 6 }}>
          {EXAMPLES.map((e) => (
            <ThemedText key={e} type="small" themeColor="textSecondary">
              “{e}”
            </ThemedText>
          ))}
        </View>
      </Card>

      <Card>
        <ThemedText type="smallBold" style={{ fontSize: 16 }}>
          Your privacy
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Claude acts as you: it sees and changes only what you can in WhoseTurn, and only when you ask. Your 🔒 personal
          items stay yours. Each family member connects their own Claude, and anyone can disconnect at any time in
          Claude’s Connectors.
        </ThemedText>
        <Link href={privacyHref} style={{ textDecorationLine: 'underline' }}>
          <ThemedText type="small" themeColor="tint" style={{ fontWeight: 700 }}>
            Read the privacy policy
          </ThemedText>
        </Link>
      </Card>
    </Screen>
  );
}
