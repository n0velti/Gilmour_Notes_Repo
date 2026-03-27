import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
  throw new Error(
    'Missing Supabase client env. Copy .env.example to .env and set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (Dashboard → Settings → API → anon public key).'
  );
}

/** AsyncStorage reads `window` on web; Expo Router’s Node SSR pass has no `window`. */
function getAuthStorage() {
  if (Platform.OS !== 'web') {
    return AsyncStorage;
  }
  if (typeof window === 'undefined') {
    const memory = new Map<string, string>();
    return {
      getItem: async (key: string) => memory.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: async (key: string) => {
        memory.delete(key);
      },
      isServer: true,
    };
  }
  return {
    getItem: (key: string) => Promise.resolve(window.localStorage.getItem(key)),
    setItem: (key: string, value: string) => Promise.resolve(window.localStorage.setItem(key, value)),
    removeItem: (key: string) => Promise.resolve(window.localStorage.removeItem(key)),
  };
}

export const supabase = createClient(supabaseUrl.trim(), supabaseAnonKey.trim(), {
  auth: {
    storage: getAuthStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
