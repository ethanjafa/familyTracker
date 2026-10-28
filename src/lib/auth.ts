import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export type Provider = 'google' | 'apple';

/**
 * Expo Go on Android can report a "bare" environment, so createURL returns the app's own
 * scheme (whoseturn://), which Expo Go can't receive. Link back through the dev server instead.
 */
function getRedirectUrl() {
  const hostUri = Constants.expoConfig?.hostUri;
  if (Platform.OS !== 'web' && isRunningInExpoGo() && hostUri) {
    return `exp://${hostUri}/--/auth-callback`;
  }
  return Linking.createURL('auth-callback');
}

/**
 * Browser-based OAuth via Supabase (PKCE). Works in Expo Go; native sign-in buttons
 * can replace this once the app ships as a development/store build.
 */
export async function signInWith(provider: Provider) {
  if (Platform.OS === 'web') {
    // A full-page redirect instead of a popup: popups are unreliable in iPhone home-screen web apps.
    // Supabase returns to this site with ?code=…, which the client exchanges on load (detectSessionInUrl).
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
    if (error) throw error;
    return;
  }

  const redirectTo = getRedirectUrl();
  // Must be allow-listed in Supabase → Authentication → URL Configuration → Redirect URLs.
  if (__DEV__) console.log('[auth] redirectTo:', redirectTo);
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

/**
 * Email sign-in without a password: Supabase emails a 6-digit code (new emails get an account).
 * The email template must include {{ .Token }} (Supabase → Authentication → Email Templates).
 */
export async function sendEmailCode(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
  if (error) throw error;
}

/** Finish email sign-in with the code from the email. The session is picked up by AuthProvider. */
export async function verifyEmailCode(email: string, code: string) {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
  if (error) throw error;
}

/**
 * Permanently delete the signed-in account (App Store / Google Play requirement). Shared family
 * things you created stay with the family; everything that's only yours is removed.
 */
export async function deleteAccount() {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  await unregisterAndClear();
}

/** The account no longer exists on the server, so only the local session needs clearing. */
async function unregisterAndClear() {
  await supabase.auth.signOut({ scope: 'local' });
  queryClient.clear();
}

export async function signOut() {
  await supabase.auth.signOut();
  queryClient.clear();
}
