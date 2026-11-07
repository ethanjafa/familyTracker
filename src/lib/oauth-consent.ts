import { Platform } from 'react-native';

/**
 * Connecting an AI assistant (MCP) sends people to /oauth/consent?authorization_id=… on the web
 * app. If they still have to sign in, the id is remembered here so they come back to the consent
 * screen afterwards (Google sign-in leaves the page and returns to the home page).
 */
const KEY = 'oauth-authorization-id';

export const CONSENT_PATH = '/oauth/consent';

export function rememberConsentRequest() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const id = new URLSearchParams(window.location.search).get('authorization_id');
  if (window.location.pathname !== CONSENT_PATH || !id) return;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Not remembered; after signing in, the person starts the connection again from their assistant.
  }
}

export function pendingConsentRequest() {
  if (Platform.OS !== 'web') return null;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearConsentRequest() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
