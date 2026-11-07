import type { OAuthAuthorizationDetails } from '@supabase/supabase-js';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Loading, Screen } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { clearConsentRequest } from '@/lib/oauth-consent';
import { supabase } from '@/lib/supabase';

const CAN = [
  'See your family’s members, routines, week plan, to-dos and grocery list',
  'Add routines and to-dos, and tick them off',
  'Change who does what on the week plan',
  'Add items to the grocery list',
];

/**
 * "Allow Claude to use WhoseTurn?" — shown when someone connects an AI assistant (MCP) to their
 * account. The root layout makes sure they're signed in first.
 */
export default function OAuthConsentScreen() {
  const { authorization_id: id } = useLocalSearchParams<{ authorization_id?: string }>();
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(id ? null : 'This link is missing its authorization request.');
  const [busy, setBusy] = useState<'allow' | 'deny' | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase.auth.oauth.getAuthorizationDetails(id).then(({ data, error: e }) => {
      if (e) return setError(e.message);
      if (data && 'authorization_id' in data) return setDetails(data);
      // Already allowed before: straight back to the assistant.
      clearConsentRequest();
      if (data?.redirect_url) window.location.href = data.redirect_url;
    });
  }, [id]);

  const decide = async (allow: boolean) => {
    setBusy(allow ? 'allow' : 'deny');
    clearConsentRequest();
    try {
      // Supabase sends the browser back to the assistant once this is done.
      const { error: e } = allow
        ? await supabase.auth.oauth.approveAuthorization(id!)
        : await supabase.auth.oauth.denyAuthorization(id!);
      if (e) throw e;
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  };

  if (error)
    return (
      <Screen>
        <ThemedText type="subtitle">Couldn’t connect</ThemedText>
        <ThemedText themeColor="textSecondary">{error} Start again from your AI assistant.</ThemedText>
      </Screen>
    );
  if (!details) return <Loading />;

  const app = details.client.name || 'An app';
  return (
    <Screen>
      <ThemedText type="subtitle">Allow {app} to use WhoseTurn?</ThemedText>
      <Card style={{ gap: 10 }}>
        <ThemedText type="smallBold" style={{ fontSize: 16 }}>
          {app} will be able to:
        </ThemedText>
        {CAN.map((c) => (
          <ThemedText key={c} type="small" themeColor="textSecondary">
            • {c}
          </ThemedText>
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          It acts as you: it only sees your family, and your 🔒 personal items stay yours. You can disconnect it at any time in
          the assistant’s settings.
        </ThemedText>
      </Card>
      <View style={{ gap: 12 }}>
        <Button title="Allow" onPress={() => decide(true)} loading={busy === 'allow'} disabled={busy !== null} />
        <Button title="Deny" variant="secondary" onPress={() => decide(false)} loading={busy === 'deny'} disabled={busy !== null} />
      </View>
    </Screen>
  );
}
