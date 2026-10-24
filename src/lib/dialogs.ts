import { Alert, Platform } from 'react-native';

/**
 * react-native-web's Alert.alert does nothing, so on web (including the home-screen app)
 * these fall back to the browser's own dialogs.
 */
export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

/** Ask before doing something destructive. Resolves true when the person confirms. */
export function confirmAsync(title: string, message: string | undefined, confirmText = 'Delete'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}
