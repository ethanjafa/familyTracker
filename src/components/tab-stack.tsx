import { Stack } from 'expo-router';
import { Platform } from 'react-native';

/** Each tab gets its own stack so detail screens push inside the tab. */
export function TabStack() {
  return <Stack screenOptions={{ headerLargeTitle: Platform.OS === 'ios', headerShadowVisible: false }} />;
}
