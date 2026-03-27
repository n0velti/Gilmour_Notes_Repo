import { DrawerToggleButton } from '@react-navigation/drawer';
import { Drawer } from 'expo-router/drawer';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Dimensions, StyleSheet } from 'react-native';

import { AppDrawerContent } from '@/components/app-drawer-content';
import { BW } from '@/constants/monochrome';
import { useAuth } from '@/contexts/auth-context';

const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.78, 276);

export default function DrawerLayout() {
  const { session, initialized } = useAuth();

  useEffect(() => {
    if (!initialized) return;
    if (!session) {
      router.replace('/(auth)/login');
    }
  }, [initialized, session]);

  return (
    <Drawer
      drawerContent={(props) => <AppDrawerContent {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: BW.bg },
        headerTintColor: BW.fg,
        headerTitleStyle: { fontWeight: '500', color: BW.fg, fontSize: 17 },
        headerShadowVisible: false,
        headerLeft: (props) => <DrawerToggleButton {...props} tintColor={BW.fg} />,
        drawerPosition: 'left',
        drawerType: 'slide',
        swipeEnabled: true,
        swipeEdgeWidth: 72,
        drawerStyle: {
          width: DRAWER_WIDTH,
          backgroundColor: BW.bg,
          borderRightWidth: StyleSheet.hairlineWidth,
          borderRightColor: BW.hairline,
        },
        sceneStyle: { backgroundColor: BW.bg },
      }}>
      <Drawer.Screen
        name="index"
        options={{
          title: '',
          headerTitle: '',
        }}
      />
      <Drawer.Screen
        name="calendar"
        options={{
          title: 'Calendar',
        }}
      />
      <Drawer.Screen
        name="chat"
        options={{
          title: 'Chat',
        }}
      />
    </Drawer>
  );
}
