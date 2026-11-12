import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { LoadError } from '@/components/ui';
import { Colors, FontFamilies } from '@/constants/theme';
import { CONSENT_PATH, pendingConsentRequest, rememberConsentRequest } from '@/lib/oauth-consent';
import { queryClient } from '@/lib/query-client';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { HouseholdProvider, useHouseholdState } from '@/providers/household-provider';

SplashScreen.preventAutoHideAsync();

const PUBLIC_WEB_PAGES = ['/support', '/privacy', '/delete-account', '/ai'];
/** The address a web visitor opened, before the navigator falls back to another screen. */
const OPENED_PATH = typeof window !== 'undefined' ? window.location?.pathname : undefined;
rememberConsentRequest();

const fonts = {
  regular: { fontFamily: FontFamilies[400], fontWeight: '400' },
  medium: { fontFamily: FontFamilies[500], fontWeight: '500' },
  bold: { fontFamily: FontFamilies[700], fontWeight: '700' },
  heavy: { fontFamily: FontFamilies[800], fontWeight: '800' },
} as const;

/** Navigation chrome (headers, modals) in the app's palette and typeface. */
const navTheme = (dark: boolean) => {
  const base = dark ? DarkTheme : DefaultTheme;
  const c = Colors[dark ? 'dark' : 'light'];
  return {
    ...base,
    fonts,
    colors: { ...base.colors, primary: c.tint, background: c.background, card: c.background, text: c.text, border: c.border },
  };
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <HouseholdProvider>
            <RootNavigator />
          </HouseholdProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { session, loading: authLoading } = useAuth();
  const { household, loading: householdLoading, problem: householdProblem } = useHouseholdState();
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const ready = !authLoading && !householdLoading && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Signed-out people always start on sign-in, whatever screen the navigator falls back to.
  // On the web, the public support, privacy and delete-account pages the store listings link to stay reachable.
  const pathname = usePathname();
  useEffect(() => {
    if (!ready || session || pathname === '/sign-in') return;
    const isPublic = (path?: string) => !!path && PUBLIC_WEB_PAGES.includes(path);
    if (Platform.OS === 'web' && isPublic(pathname) && isPublic(OPENED_PATH)) return;
    router.replace('/sign-in');
  }, [ready, session, pathname]);

  // Signed in partway through connecting an AI assistant: back to its consent screen.
  useEffect(() => {
    const pending = pendingConsentRequest();
    if (!ready || !session || householdProblem || !pending || pathname === CONSENT_PATH) return;
    router.replace({ pathname: CONSENT_PATH, params: { authorization_id: pending } });
  }, [ready, session, pathname, householdProblem]);

  if (!ready) return null;

  // Signed in, but the family couldn't be loaded (offline, server trouble). Say so and offer a retry,
  // instead of treating it as "no family yet" and sending the person to onboarding.
  if (session && householdProblem) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: Colors[colorScheme === 'dark' ? 'dark' : 'light'].background }}>
        <LoadError problem={householdProblem} />
      </View>
    );
  }

  const modal = { presentation: 'modal', headerShown: true } as const;
  // Where a locked screen sends you. Without this, expo-router falls back to the first open route
  // in filesystem order, which is the public /ai page, not onboarding.
  const home = !session ? '/sign-in' : !household ? '/onboarding' : '/';

  return (
    <ThemeProvider value={navTheme(colorScheme === 'dark')}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Signed out: sign-in comes first, so it's where the app opens. The public pages the app
            store listings link to are here too, after it; signed-in people read them in Settings. */}
        <Stack.Protected guard={!session} redirectTo={home}>
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="support" options={{ headerShown: true }} />
          <Stack.Screen name="privacy" options={{ headerShown: true }} />
          <Stack.Screen name="delete-account" options={{ headerShown: true }} />
        </Stack.Protected>
        <Stack.Protected guard={!!session && !household} redirectTo={home}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={!!session && !!household} redirectTo={home}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="category-form" options={modal} />
          <Stack.Screen name="create" options={modal} />
          <Stack.Screen name="join-family" options={modal} />
          <Stack.Screen name="routine-form" options={modal} />
          <Stack.Screen name="todo-category-form" options={modal} />
          <Stack.Screen name="todo-form" options={modal} />
          <Stack.Screen name="suggestion" options={modal} />
          <Stack.Screen name="meal-form" options={modal} />
          <Stack.Screen name="settings/index" options={{ headerShown: true, title: 'Settings' }} />
          <Stack.Screen name="settings/ai" options={{ headerShown: true }} />
          <Stack.Screen name="settings/privacy" options={{ headerShown: true }} />
          <Stack.Screen name="store-mode" options={modal} />
        </Stack.Protected>
        <Stack.Screen name="auth-callback" />
        {/* The shareable "connect Claude" page: open signed in or out. */}
        <Stack.Screen name="ai" options={{ headerShown: true }} />
        <Stack.Screen name="oauth/consent" options={{ headerShown: true, title: 'Connect an assistant' }} />
      </Stack>
    </ThemeProvider>
  );
}
