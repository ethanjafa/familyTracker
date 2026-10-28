import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * Apple's own "Continue with Apple" button and sign-in sheet (iPhone only). Apple requires it
 * whenever an iPhone app also offers Google sign-in. The Apple token is exchanged for a Supabase session.
 */
export function AppleSignInButton({ onError }: { onError: (e: unknown) => void }) {
  const dark = useColorScheme() === 'dark';
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAvailable, () => setAvailable(false));
  }, []);

  if (!available) return null;

  const signIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!credential.identityToken) throw new Error('Apple did not return a sign-in token. Please try again.');
      const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
      if (error) throw error;
      // Apple shares the person's name only on their very first sign-in, so keep it.
      const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
      if (name && data.user) {
        await supabase.auth.updateUser({ data: { full_name: name } });
        await supabase.from('profiles').update({ display_name: name }).eq('id', data.user.id);
      }
    } catch (e) {
      // Closing Apple's sheet isn't an error.
      if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return;
      onError(e);
    }
  };

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={dark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={14}
      style={{ width: '100%', height: 52 }}
      onPress={signIn}
    />
  );
}
