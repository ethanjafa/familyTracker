import '@/lib/local-storage';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Web pages are pre-rendered in Node, where there is no localStorage and no session to keep.
const hasStorage = typeof localStorage !== 'undefined';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: hasStorage ? localStorage : undefined,
    autoRefreshToken: hasStorage,
    persistSession: hasStorage,
    // Web sign-in redirects back with ?code=…; native exchanges the code itself in auth.ts.
    detectSessionInUrl: Platform.OS === 'web' && hasStorage,
    flowType: 'pkce',
  },
});

// Only refresh the session while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
