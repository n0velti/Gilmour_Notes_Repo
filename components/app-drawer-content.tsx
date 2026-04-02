import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { DrawerContentScrollView, DrawerItem, useDrawerStatus } from '@react-navigation/drawer';
import { useEffect, useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BW } from '@/constants/monochrome';
import { useAuth } from '@/contexts/auth-context';

export function AppDrawerContent(props: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const drawerStatus = useDrawerStatus();

  useEffect(() => {
    if (drawerStatus === 'open') {
      Keyboard.dismiss();
    }
  }, [drawerStatus]);

  const currentRoute = props.state.routes[props.state.index]?.name;
  const email = session?.user?.email ?? '';

  return (
    <View style={styles.root}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 10 },
        ]}
        style={styles.scroll}>
        <DrawerItem
          label="Notes"
          focused={currentRoute === 'index'}
          onPress={() => props.navigation.navigate('index')}
          activeTintColor={BW.fg}
          inactiveTintColor={BW.muted}
          activeBackgroundColor="rgba(0,0,0,0.04)"
          style={styles.drawerItem}
          labelStyle={styles.drawerLabel}
        />
        <DrawerItem
          label="Chat"
          focused={currentRoute === 'chat'}
          onPress={() => props.navigation.navigate('chat')}
          activeTintColor={BW.fg}
          inactiveTintColor={BW.muted}
          activeBackgroundColor="rgba(0,0,0,0.04)"
          style={styles.drawerItem}
          labelStyle={styles.drawerLabel}
        />
      </DrawerContentScrollView>

      <Pressable
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}
        onPress={() => setSignOutOpen(true)}>
        <Text style={styles.footerEmail} numberOfLines={2}>
          {email || 'Account'}
        </Text>
      </Pressable>

      <Modal
        visible={signOutOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSignOutOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSignOutOpen(false)}>
          <Pressable style={styles.signOutSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Account</Text>
            <Text style={styles.sheetEmail} numberOfLines={2}>
              {email}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.sheetBtn, pressed && { opacity: 0.7 }]}
              onPress={async () => {
                setSignOutOpen(false);
                await signOut();
              }}>
              <Text style={styles.sheetBtnDanger}>Sign out</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.sheetBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setSignOutOpen(false)}>
              <Text style={styles.sheetBtnMuted}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BW.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 4,
  },
  drawerItem: {
    marginHorizontal: 4,
    marginVertical: 2,
    borderRadius: 8,
  },
  drawerLabel: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BW.hairline,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  footerEmail: {
    fontSize: 12,
    color: BW.fg,
    opacity: 0.75,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  signOutSheet: {
    backgroundColor: BW.bg,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BW.borderSoft,
    padding: 20,
    gap: 16,
  },
  sheetTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: BW.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sheetEmail: {
    fontSize: 16,
    color: BW.fg,
  },
  sheetBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetBtnDanger: {
    fontSize: 17,
    fontWeight: '600',
    color: BW.fg,
  },
  sheetBtnMuted: {
    fontSize: 16,
    color: BW.muted,
  },
});
