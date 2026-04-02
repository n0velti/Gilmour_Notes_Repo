import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { BW } from '@/constants/monochrome';
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
        <Stack.Screen
          name="note-details"
          options={{
            presentation: 'modal',
            title: 'Details',
            headerShown: true,
            headerStyle: { backgroundColor: BW.bg },
            headerTintColor: BW.fg,
            headerTitleStyle: { fontWeight: '600', color: BW.fg, fontSize: 17 },
            headerShadowVisible: false,
            ...(Platform.OS === 'android' ? { animation: 'slide_from_bottom' as const } : {}),
          }}
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <AuthProvider>
        <RootStack />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
