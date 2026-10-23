import { Redirect } from 'expo-router';

/** OAuth redirects land here on some devices; the auth guards take it from there. */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
