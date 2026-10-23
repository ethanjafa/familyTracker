import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export type Provider = 'google' | 'apple';

/**
 * Browser-based OAuth via Supabase (PKCE). Works in Expo Go; native sign-in buttons
 * can replace this once the app ships as a development/store build.
 */
export async function signInWith(provider: Provider) {
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return;

  const { queryParams } = Linking.parse(result.url);
  const errorDescription = queryParams?.error_description;
  if (errorDescription) throw new Error(String(errorDescription));
  const code = queryParams?.code;
  if (typeof code !== 'string') throw new Error('Sign-in did not return a code.');
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}

export async function signOut() {
  await supabase.auth.signOut();
  queryClient.clear();
}
