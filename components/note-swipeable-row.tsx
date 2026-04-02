import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { memo, useCallback, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';

import { BW } from '@/constants/monochrome';

const DELETE_WIDTH = 72;
/** Match `noteRowWrap` min height (40px field + 5px vertical padding × 2). */
const ROW_CONTENT_MIN_HEIGHT = 50;

type Props = {
  children: React.ReactNode;
  onDelete: () => void;
};

function NoteSwipeableRowInner({ children, onDelete }: Props) {
  const swipeRef = useRef<Swipeable | null>(null);

  const handleDelete = useCallback(() => {
    swipeRef.current?.close();
    onDelete();
  }, [onDelete]);

  if (Platform.OS === 'web') {
    return <View style={styles.fallback}>{children}</View>;
  }

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      overshootRight={false}
      rightThreshold={32}
      renderRightActions={() => (
        <View style={styles.actions}>
          <RectButton
            style={styles.deleteBtn}
            onPress={handleDelete}
            accessibilityLabel="Delete note"
            accessibilityRole="button">
            <MaterialIcons name="delete-outline" size={24} color="#ffffff" />
          </RectButton>
        </View>
      )}
      containerStyle={styles.container}>
      <View style={styles.inner}>{children}</View>
    </Swipeable>
  );
}

export const NoteSwipeableRow = memo(NoteSwipeableRowInner);

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  inner: {
    width: '100%',
    backgroundColor: BW.bg,
  },
  fallback: {
    backgroundColor: BW.bg,
  },
  actions: {
    flexDirection: 'row',
    width: DELETE_WIDTH,
    minHeight: ROW_CONTENT_MIN_HEIGHT,
    backgroundColor: '#c41e1e',
  },
  deleteBtn: {
    flex: 1,
    minHeight: ROW_CONTENT_MIN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#c41e1e',
  },
});
