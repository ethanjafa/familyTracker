import { Link } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Linking, Platform, Share, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Screen } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { MCP_URL } from '@/lib/legal';

const EXAMPLES = [
  'Who’s doing what this week?',
  'Give Tuesday’s dishes to me.',
  'Add milk and eggs to the grocery list.',
];

/** How to connect Claude to WhoseTurn: on the public /ai page and in Settings. */
export function AiConnectGuide({ privacyHref }: { privacyHref: '/privacy' | '/settings/privacy' }) {
  const theme = useTheme();
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
      <ThemedText type="subtitle">Connect to Claude</ThemedText>

      <Card>
        <Step n={1} title="Copy the WhoseTurn link">
          <Button title={copied ? 'Copied ✓' : 'Copy link'} onPress={copy} />
        </Step>

        <Step n={2} title="Add it in Claude">
          <ThemedText type="small" themeColor="textSecondary">
            Open Claude, go to Connectors and tap “Add custom connector”. Name it WhoseTurn and paste the link.
          </ThemedText>
          <Button title="Open Claude" variant="secondary" onPress={() => Linking.openURL('https://claude.ai')} />
        </Step>

        <Step n={3} title="Tap Connect, sign in to WhoseTurn and tap Allow" />
      </Card>

      <ThemedText type="heading" style={{ fontSize: 17 }}>
        Then ask Claude
      </ThemedText>
      <View style={{ gap: 8 }}>
        {EXAMPLES.map((e) => (
          <View
            key={e}
            style={{
              alignSelf: 'flex-end',
              maxWidth: '85%',
              backgroundColor: theme.tintSoft,
              borderRadius: 18,
              borderBottomRightRadius: 4,
              paddingHorizontal: 14,
              paddingVertical: 10,
            }}>
            <ThemedText style={{ color: theme.tint, fontWeight: 600 }}>{e}</ThemedText>
          </View>
        ))}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        Use ChatGPT? You can add the same link there as a custom connector. This may need a paid ChatGPT plan.
      </ThemedText>

      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        The assistant sees and changes only what you can in WhoseTurn.{' '}
        <Link href={privacyHref} style={{ textDecorationLine: 'underline' }}>
          Privacy
        </Link>
      </ThemedText>
    </Screen>
  );
}

function Step({ n, title, children }: { n: number; title: string; children?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 6 }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: theme.tint,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <ThemedText style={{ color: theme.onTint, fontWeight: 800 }}>{n}</ThemedText>
      </View>
      <View style={{ flex: 1, gap: 8, paddingTop: 3 }}>
        <ThemedText type="smallBold" style={{ fontSize: 16 }}>
          {title}
        </ThemedText>
        {children}
      </View>
    </View>
  );
}
