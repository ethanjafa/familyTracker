import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { FontFamilies } from '@/constants/theme';

/** Each tab gets its own stack so detail screens push inside the tab. */
export function TabStack() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: Platform.OS === 'ios',
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: FontFamilies[700] },
        headerLargeTitleStyle: { fontFamily: FontFamilies[800] },
      }}
    />
  );
}
