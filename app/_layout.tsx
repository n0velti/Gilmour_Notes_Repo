import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { monoNavigationTheme } from '@/lib/navigation-theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootStack() {
  const { initialized } = useAuth();

  useEffect(() => {
    if (initialized) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [initialized]);

  return (
    <ThemeProvider value={monoNavigationTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(drawer)" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootStack />
    </AuthProvider>
  );
}
