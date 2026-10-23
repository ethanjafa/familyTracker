import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { queryClient } from '@/lib/query-client';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { HouseholdProvider, useHouseholdState } from '@/providers/household-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <HouseholdProvider>
          <RootNavigator />
        </HouseholdProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { session, loading: authLoading } = useAuth();
  const { household, loading: householdLoading } = useHouseholdState();
  const ready = !authLoading && !householdLoading;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const modal = { presentation: 'modal', headerShown: true } as const;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
          <Stack.Screen name="project-form" options={modal} />
          <Stack.Screen name="item-form" options={modal} />
        </Stack.Protected>
        <Stack.Screen name="auth-callback" />
      </Stack>
    </ThemeProvider>
  );
}
