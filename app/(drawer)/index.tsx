import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { DrawerToggleButton, useDrawerStatus } from '@react-navigation/drawer';
import { router, useNavigation } from 'expo-router';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NoteDueIndicator } from '@/components/note-due-indicator';
import { BW } from '@/constants/monochrome';

const IS_NATIVE = Platform.OS === 'ios' || Platform.OS === 'android';
/** Tight strip — visually “on” the keyboard */
const ACCESSORY_HEIGHT = 38;
const MENU_GAP = 0;
/** Pulls the keybar down over the keyboard top */
const ACCESSORY_BOTTOM_INSET = 18;

type Block = {
  id: string;
  text: string;
  /** When the note row was created — “time” sort */
  createdAt?: number;
  /** End of due calendar day (local), ms */
  dueAt?: number;
  /** When the due date was set — ring “battery” window start */
  dueAnchorAt?: number;
};

type SortMode = 'time' | 'dueAsc' | 'dueDesc';

function createdSortKey(b: Block): number {
  if (b.createdAt != null) return b.createdAt;
  const m = /^note-(\d+)$/.exec(b.id);
  return m ? parseInt(m[1], 10) : 0;
}

function compareDue(a: Block, b: Block, dir: 'asc' | 'desc'): number {
  const aHas = a.dueAt != null;
  const bHas = b.dueAt != null;
  if (aHas && !bHas) return -1;
  if (!aHas && bHas) return 1;
  if (!aHas && !bHas) {
    return createdSortKey(a) - createdSortKey(b);
  }
  const c = a.dueAt! - b.dueAt!;
  return dir === 'asc' ? c : -c;
}

function sortBlocks(list: Block[], mode: SortMode): Block[] {
  const copy = [...list];
  if (mode === 'time') {
    return copy.sort((a, b) => createdSortKey(a) - createdSortKey(b));
  }
  if (mode === 'dueAsc') {
    return copy.sort((a, b) => compareDue(a, b, 'asc'));
  }
  return copy.sort((a, b) => compareDue(a, b, 'desc'));
}

function startOfDayMs(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function calendarDaysLeft(dueAt: number): number {
  const t = startOfDayMs(new Date());
  const d = startOfDayMs(new Date(dueAt));
  return Math.max(0, Math.round((d - t) / 86400000));
}

function ringProgress(dueAt: number, anchorAt: number): number {
  const total = Math.max(dueAt - anchorAt, 60_000);
  const left = dueAt - Date.now();
  return Math.max(0, Math.min(1, left / total));
}

function endOfDueDayMs(d: Date): number {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
}

function formatTodayShort(): string {
  const d = new Date();
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `note-${idCounter}`;
}

export default function NotesScreen() {
  const navigation = useNavigation();
  const drawerStatus = useDrawerStatus();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [dateLabel, setDateLabel] = useState(formatTodayShort);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [duePickerBlockId, setDuePickerBlockId] = useState<string | null>(null);
  const [duePickerTemp, setDuePickerTemp] = useState(() => new Date());
  const [sortMode, setSortMode] = useState<SortMode>('time');
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const duePickerBlockRef = useRef<string | null>(null);

  const displayedBlocks = useMemo(
    () => sortBlocks(blocks, sortMode),
    [blocks, sortMode]
  );

  const cycleSortMode = useCallback(() => {
    setSortMode((m) =>
      m === 'time' ? 'dueAsc' : m === 'dueAsc' ? 'dueDesc' : 'time'
    );
  }, []);

  useEffect(() => {
    duePickerBlockRef.current = duePickerBlockId;
  }, [duePickerBlockId]);

  const hasAnyContent = blocks.some((b) => b.text.trim().length > 0);
  /** Cannot add another row while an empty note row exists */
  const canAddNote = !blocks.some((b) => b.text.trim() === '');

  useFocusEffect(
    useCallback(() => {
      setDateLabel(formatTodayShort());
    }, [])
  );

  useEffect(() => {
    if (drawerStatus === 'open') {
      Keyboard.dismiss();
    }
  }, [drawerStatus]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeftContainerStyle: styles.headerLeftContainer,
      headerLeft: (props: ComponentProps<typeof DrawerToggleButton>) => (
        <View style={styles.headerLeftRow}>
          <DrawerToggleButton {...props} tintColor={BW.fg} />
          <Pressable
            onPress={() => router.push('/(drawer)/calendar')}
            style={styles.headerDateBesideMenu}
            hitSlop={8}>
            <Text
              style={styles.headerDateTextLeft}
              numberOfLines={2}
              {...(Platform.OS === 'ios'
                ? { adjustsFontSizeToFit: true, minimumFontScale: 0.75 }
                : {})}>
              {dateLabel}
            </Text>
          </Pressable>
        </View>
      ),
      headerRightContainerStyle: styles.headerRightContainer,
      headerRight: () => (
        <View style={styles.headerRight}>
          {Platform.OS === 'web' ? (
            <Pressable
              onPress={() => setPlusMenuOpen(true)}
              style={styles.headerIconBtn}
              hitSlop={8}>
              <MaterialIcons name="add" size={22} color={BW.fg} />
            </Pressable>
          ) : null}
          <Pressable
            style={({ pressed }) => [
              styles.sortCircle,
              pressed && { opacity: 0.65 },
            ]}
            onPress={cycleSortMode}
            accessibilityRole="button"
            accessibilityLabel={
              sortMode === 'time'
                ? 'Sort by time added. Switch to due date ascending.'
                : sortMode === 'dueAsc'
                  ? 'Due date ascending. Switch to descending.'
                  : 'Due date descending. Switch to time added.'
            }
            hitSlop={8}>
            {sortMode === 'time' ? (
              <View style={styles.sortDot} />
            ) : sortMode === 'dueAsc' ? (
              <MaterialIcons name="arrow-downward" size={15} color={BW.fg} />
            ) : (
              <MaterialIcons name="arrow-upward" size={15} color={BW.fg} />
            )}
          </Pressable>
        </View>
      ),
    });
  }, [navigation, dateLabel, cycleSortMode, sortMode]);

  useEffect(() => {
    if (!IS_NATIVE) return;

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const subShow = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const subHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const focusBlockById = (id: string) => {
    requestAnimationFrame(() => {
      inputRefs.current[id]?.focus();
    });
  };

  const onChangeBlockById = (id: string, text: string) => {
    if (text === '') {
      setBlocks((prev) => {
        const idx = prev.findIndex((b) => b.id === id);
        if (idx < 0) return prev;
        const next = prev.filter((b) => b.id !== id);
        if (next.length === 0) {
          queueMicrotask(() => Keyboard.dismiss());
        } else {
          const focusIdx = Math.min(idx, Math.max(0, next.length - 1));
          const fid = next[focusIdx]?.id;
          if (fid) {
            queueMicrotask(() => focusBlockById(fid));
          }
        }
        return next;
      });
      return;
    }

    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, text } : b))
    );
  };

  const appendBlock = () => {
    if (!canAddNote) return;
    const id = nextId();
    const createdAt = Date.now();
    setBlocks((prev) => {
      const next = [...prev, { id, text: '', createdAt }];
      return next;
    });
    focusBlockById(id);
  };

  const applyDueDate = (blockId: string, picked: Date) => {
    const dueAt = endOfDueDayMs(picked);
    const dueAnchorAt = Date.now();
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId ? { ...b, dueAt, dueAnchorAt } : b
      )
    );
  };

  const openDuePickerFor = (blockId: string, block: Block) => {
    if (Platform.OS === 'web') {
      Alert.alert('Due date', 'Set due dates in the iOS or Android app.');
      return;
    }
    const base =
      block.dueAt != null ? new Date(block.dueAt) : new Date(Date.now() + 86400000);
    setDuePickerTemp(base);
    setDuePickerBlockId(blockId);
  };

  const closeDuePicker = (refocusId: string | null) => {
    setDuePickerBlockId(null);
    if (refocusId) {
      queueMicrotask(() => focusBlockById(refocusId));
    }
  };

  const confirmDuePicker = () => {
    const id = duePickerBlockId;
    if (!id) return;
    applyDueDate(id, duePickerTemp);
    closeDuePicker(id);
  };

  const iosInputProps =
    Platform.OS === 'ios'
      ? ({
          autoCorrect: false,
          spellCheck: false,
          textContentType: 'none' as const,
          autoComplete: 'off' as const,
          smartInsertDelete: false,
        } as const)
      : {};

  const onPlusMenuAi = () => {
    setPlusMenuOpen(false);
    Alert.alert('AI', 'AI tools will be available here.');
  };

  const onPlusMenuDate = () => {
    setPlusMenuOpen(false);
    router.push('/(drawer)/calendar');
  };

  const onPlusMenuUrgent = () => {
    setPlusMenuOpen(false);
    setBlocks((prev) => {
      if (prev.length === 0) {
        const id = nextId();
        const createdAt = Date.now();
        queueMicrotask(() => focusBlockById(id));
        return [{ id, text: '[URGENT] ', createdAt }];
      }
      const next = [...prev];
      const last = next.length - 1;
      next[last] = {
        ...next[last],
        text: next[last].text.trim() ? `${next[last].text}\n[URGENT] ` : '[URGENT] ',
      };
      const lid = next[last].id;
      queueMicrotask(() => focusBlockById(lid));
      return next;
    });
  };

  const showAccessory = IS_NATIVE && keyboardHeight > 0;
  const keyboardClosed = !showAccessory;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <View style={styles.root}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContentGrow}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag">
            {blocks.length === 0 ? (
              <Pressable
                style={({ pressed }) => [
                  styles.addRowFullWidth,
                  !canAddNote && styles.addRowDisabled,
                  pressed && canAddNote && { opacity: 0.6 },
                ]}
                onPress={appendBlock}
                disabled={!canAddNote}
                hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}>
                <View style={styles.addRowInner}>
                  <MaterialIcons name="add" size={20} color={BW.muted} />
                  <Text style={styles.addRowText}>add new note</Text>
                </View>
              </Pressable>
            ) : (
              <>
                {displayedBlocks.map((block, index) => {
                  const hasDue =
                    block.dueAt != null && block.dueAnchorAt != null;
                  const anchorAt =
                    block.dueAnchorAt ??
                    (block.dueAt != null ? block.dueAt - 7 * 86400000 : Date.now());
                  const progress =
                    hasDue && block.dueAt != null
                      ? ringProgress(block.dueAt, anchorAt)
                      : 0;
                  const daysLeftNum =
                    block.dueAt != null ? calendarDaysLeft(block.dueAt) : 0;
                  const showRowTools =
                    focusedBlockId === block.id || duePickerBlockId === block.id;
                  const isFirstInList = displayedBlocks[0]?.id === block.id;

                  return (
                    <View key={block.id} style={styles.noteBlock}>
                      <View style={styles.noteRow}>
                        <TextInput
                          ref={(r) => {
                            inputRefs.current[block.id] = r;
                          }}
                          style={styles.blockInput}
                          multiline
                          placeholder={isFirstInList ? 'Tap to type…' : ''}
                          placeholderTextColor={BW.muted}
                          value={block.text}
                          onChangeText={(t) => onChangeBlockById(block.id, t)}
                          onFocus={() => setFocusedBlockId(block.id)}
                          onBlur={() =>
                            setFocusedBlockId((cur) =>
                              cur === block.id ? null : cur
                            )
                          }
                          textAlignVertical="top"
                          scrollEnabled={false}
                          {...iosInputProps}
                        />
                        <NoteDueIndicator
                          hasDue={hasDue}
                          daysLeft={daysLeftNum}
                          progress={progress}
                          onPress={() => openDuePickerFor(block.id, block)}
                        />
                      </View>
                      {showRowTools ? (
                        <View style={styles.noteRowToolbar}>
                          <Pressable
                            style={({ pressed }) => [
                              styles.toolBtn,
                              pressed && { opacity: 0.65 },
                            ]}
                            onPress={() =>
                              Alert.alert('AI', 'AI tools for this note will go here.')
                            }
                            hitSlop={6}>
                            <Text style={styles.toolBtnText}>AI</Text>
                          </Pressable>
                        </View>
                      ) : null}
                      {index < displayedBlocks.length - 1 ? (
                        <View style={styles.blockDivider} />
                      ) : null}
                    </View>
                  );
                })}

                {hasAnyContent ? (
                  <View style={styles.addSection}>
                    <View style={styles.faintLine} />
                    <Pressable
                      style={({ pressed }) => [
                        styles.addRowFullWidth,
                        !canAddNote && styles.addRowDisabled,
                        pressed && canAddNote && { opacity: 0.55 },
                      ]}
                      onPress={appendBlock}
                      disabled={!canAddNote}
                      hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}>
                      <View style={styles.addRowInner}>
                        <MaterialIcons name="add" size={18} color={BW.muted} />
                        <Text style={styles.addRowText}>add new note</Text>
                      </View>
                    </Pressable>
                  </View>
                ) : null}

                {keyboardClosed ? (
                  <Pressable
                    style={styles.belowNotesTap}
                    disabled={!canAddNote}
                    pointerEvents={canAddNote ? 'auto' : 'none'}
                    onPress={appendBlock}
                    accessibilityLabel="Add new note"
                  />
                ) : null}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {showAccessory ? (
          <View
            style={[
              styles.accessory,
              {
                bottom: Math.max(0, keyboardHeight - ACCESSORY_BOTTOM_INSET),
                minHeight: ACCESSORY_HEIGHT,
              },
            ]}
            pointerEvents="box-none">
            <Pressable
              style={({ pressed }) => [styles.accBtn, pressed && styles.sqBtnPressed]}
              onPress={() => setPlusMenuOpen(true)}
              accessibilityLabel="More options"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="add" size={22} color={BW.muted} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.accBtn, pressed && styles.sqBtnPressed]}
              onPress={() => Keyboard.dismiss()}
              accessibilityLabel="Hide keyboard"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="keyboard-arrow-down" size={22} color={BW.muted} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.accBtn, pressed && styles.sqBtnPressed]}
              onPress={() => {}}
              accessibilityLabel="Microphone"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="mic" size={20} color={BW.muted} />
            </Pressable>
          </View>
        ) : null}

        {plusMenuOpen ? (
          <View style={styles.menuOverlay}>
            <Pressable style={styles.menuBackdropFill} onPress={() => setPlusMenuOpen(false)} />
            <View
              style={[
                styles.menuSheet,
                IS_NATIVE
                  ? {
                      bottom:
                        Math.max(0, keyboardHeight - ACCESSORY_BOTTOM_INSET) +
                        ACCESSORY_HEIGHT +
                        MENU_GAP,
                    }
                  : { top: 56, bottom: undefined },
              ]}>
              <View style={styles.menuCard}>
                <Pressable
                  style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.6 }]}
                  onPress={onPlusMenuAi}>
                  <Text style={styles.menuRowText}>AI</Text>
                </Pressable>
                <View style={styles.menuDivider} />
                <Pressable
                  style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.6 }]}
                  onPress={onPlusMenuDate}>
                  <Text style={styles.menuRowText}>Date</Text>
                </Pressable>
                <View style={styles.menuDivider} />
                <Pressable
                  style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.6 }]}
                  onPress={onPlusMenuUrgent}>
                  <Text style={styles.menuRowText}>Urgent</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {duePickerBlockId && Platform.OS === 'android' ? (
          <DateTimePicker
            value={duePickerTemp}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={(ev, date) => {
              const id = duePickerBlockRef.current;
              if (ev.type === 'dismissed' || !id) {
                closeDuePicker(id);
                return;
              }
              if (ev.type === 'set' && date) {
                applyDueDate(id, date);
                closeDuePicker(id);
              }
            }}
          />
        ) : null}

        {duePickerBlockId && Platform.OS === 'ios' ? (
          <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={() => closeDuePicker(duePickerBlockId)}>
            <View style={styles.dateModalRoot}>
              <Pressable
                style={styles.dateModalBackdrop}
                onPress={() => closeDuePicker(duePickerBlockId)}
              />
              <View style={styles.dateModalCard}>
                <DateTimePicker
                  value={duePickerTemp}
                  mode="date"
                  display="spinner"
                  themeVariant="light"
                  minimumDate={new Date()}
                  onChange={(_, d) => {
                    if (d) setDuePickerTemp(d);
                  }}
                />
                <View style={styles.dateModalActions}>
                  <Pressable
                    style={styles.dateModalBtn}
                    onPress={() => closeDuePicker(duePickerBlockId)}>
                    <Text style={styles.dateModalBtnMuted}>Cancel</Text>
                  </Pressable>
                  <Pressable style={styles.dateModalBtn} onPress={confirmDuePicker}>
                    <Text style={styles.dateModalBtnStrong}>Done</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BW.bg,
  },
  root: {
    flex: 1,
    backgroundColor: BW.bg,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContentGrow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    flexGrow: 1,
  },
  addRowFullWidth: {
    width: '100%',
    minHeight: 52,
    paddingVertical: 18,
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  addRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
    width: '100%',
    paddingHorizontal: 0,
  },
  addRowDisabled: {
    opacity: 0.42,
  },
  belowNotesTap: {
    flexGrow: 1,
    minHeight: 160,
  },
  noteBlock: {
    width: '100%',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    minHeight: 48,
  },
  noteRowToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    marginBottom: 4,
    paddingLeft: 2,
  },
  toolBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BW.borderSoft,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  toolBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: BW.muted,
    letterSpacing: 0.3,
  },
  blockInput: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 4,
    fontSize: 17,
    lineHeight: 24,
    color: BW.fg,
    backgroundColor: BW.bg,
  },
  blockDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BW.hairline,
    marginVertical: 6,
    marginLeft: 0,
  },
  addSection: {
    marginTop: 4,
  },
  faintLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BW.hairline,
    marginBottom: 10,
    marginLeft: 0,
  },
  addRowText: {
    fontSize: 14,
    color: BW.muted,
    letterSpacing: 0.2,
  },
  headerLeftContainer: {
    paddingLeft: 4,
    maxWidth: '62%',
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 1,
    paddingRight: 4,
  },
  headerDateBesideMenu: {
    paddingVertical: 4,
    paddingLeft: 4,
    minWidth: 0,
    flexShrink: 1,
  },
  headerDateTextLeft: {
    color: BW.fg,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'left',
    flexShrink: 1,
    maxWidth: '100%',
  },
  headerRightContainer: {
    flexGrow: 0,
    flexShrink: 0,
    paddingRight: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingRight: 10,
  },
  headerIconBtn: {
    padding: 6,
  },
  sortCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BW.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BW.bg,
  },
  sortDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: BW.fg,
  },
  accessory: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: BW.bg,
    zIndex: 100,
    elevation: 100,
  },
  accBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  sqBtnPressed: {
    opacity: 0.88,
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 250,
    elevation: 250,
  },
  menuBackdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  menuSheet: {
    position: 'absolute',
    right: 12,
    width: 200,
    zIndex: 2,
  },
  menuCard: {
    backgroundColor: BW.bg,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BW.borderSoft,
    overflow: 'hidden',
  },
  menuRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuRowText: {
    fontSize: 16,
    color: BW.fg,
    fontWeight: '500',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BW.hairline,
  },
  dateModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  dateModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  dateModalCard: {
    backgroundColor: BW.bg,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingBottom: 24,
    paddingTop: 8,
  },
  dateModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BW.hairline,
  },
  dateModalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  dateModalBtnMuted: {
    fontSize: 17,
    color: BW.muted,
  },
  dateModalBtnStrong: {
    fontSize: 17,
    fontWeight: '600',
    color: BW.fg,
  },
});
