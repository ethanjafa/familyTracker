import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors, FontFamilies } from '@/constants/theme';
import { queryClient } from '@/lib/query-client';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { HouseholdProvider, useHouseholdState } from '@/providers/household-provider';

SplashScreen.preventAutoHideAsync();

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
  const { household, loading: householdLoading } = useHouseholdState();
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

  if (!ready) return null;

  const modal = { presentation: 'modal', headerShown: true } as const;

  return (
    <ThemeProvider value={navTheme(colorScheme === 'dark')}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={!!session && !household}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={!!session && !!household}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="category-form" options={modal} />
          <Stack.Screen name="routine-form" options={modal} />
          <Stack.Screen name="todo-category-form" options={modal} />
          <Stack.Screen name="todo-form" options={modal} />
          <Stack.Screen name="suggestion" options={modal} />
          <Stack.Screen name="meal-form" options={modal} />
          <Stack.Screen name="meals" options={modal} />
          <Stack.Screen name="groceries" options={modal} />
          <Stack.Screen name="store-mode" options={modal} />
        </Stack.Protected>
        <Stack.Screen name="auth-callback" />
        {/* Public pages the app store listings link to; readable without signing in. */}
        <Stack.Screen name="privacy" options={{ headerShown: true }} />
        <Stack.Screen name="delete-account" options={{ headerShown: true }} />
      </Stack>
    </ThemeProvider>
  );
}
