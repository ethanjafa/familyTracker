import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { SettingsButton } from '@/components/ui';
import { FontFamilies } from '@/constants/theme';

/** Each tab gets its own stack so detail screens push inside the tab. Settings is one tap away from all of them. */
export function TabStack() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: Platform.OS === 'ios',
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: FontFamilies[700] },
        headerLargeTitleStyle: { fontFamily: FontFamilies[800] },
        headerRight: () => <SettingsButton />,
      }}
    />
  );
}
