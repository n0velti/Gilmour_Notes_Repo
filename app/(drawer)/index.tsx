import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { HeaderHeightContext } from '@react-navigation/elements';
import { useFocusEffect } from '@react-navigation/native';
import { DrawerToggleButton, useDrawerStatus } from '@react-navigation/drawer';
import { router, useNavigation } from 'expo-router';
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import {
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { NoteDueIndicator } from '@/components/note-due-indicator';
import { NoteSwipeableRow } from '@/components/note-swipeable-row';
import { BW } from '@/constants/monochrome';
import { useAuth } from '@/contexts/auth-context';
import {
  dbNoteToBlock,
  deleteNote,
  fetchNotesForUser,
  insertNote,
  isNotesTableMissingError,
  NOTES_TABLE_SETUP_HINT,
  updateNoteBody,
} from '@/lib/notes';
import { calendarDaysDelta } from '@/lib/note-due-format';
import { randomUUID } from '@/lib/random-id';

const IS_NATIVE = Platform.OS === 'ios' || Platform.OS === 'android';
/** Keyboard accessory bar height (matches circular controls + padding). */
const ACCESSORY_HEIGHT = 48;
const MENU_GAP = 0;
/** Pulls the keybar down over the keyboard top */
const ACCESSORY_BOTTOM_INSET = 18;
/** Due ring: single-line row; slightly smaller than text line for balance. */
const NOTE_DUE_SIZE = 36;
/** Text field height + vertical padding on `noteRowWrap` (`paddingVertical` × 2). */
const NOTE_ROW_MIN_HEIGHT = 40 + 10;

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
  return b.createdAt ?? 0;
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

function ringProgress(dueAt: number, anchorAt: number): number {
  const total = Math.max(dueAt - anchorAt, 60_000);
  const left = dueAt - Date.now();
  return Math.max(0, Math.min(1, left / total));
}

/** e.g. `Thurs: 2-Apr-2026` */
function formatHeaderDate(d: Date = new Date()): string {
  const weekdayLabels = [
    'Sun',
    'Mon',
    'Tues',
    'Wed',
    'Thurs',
    'Fri',
    'Sat',
  ] as const;
  const monthLabels = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ] as const;
  const w = weekdayLabels[d.getDay()];
  const day = d.getDate();
  const m = monthLabels[d.getMonth()];
  const y = d.getFullYear();
  return `${w}: ${day}-${m}-${y}`;
}

/** Very subtle resting separator (thin light black). */
const NOTE_LINE_SUBTLE = 'rgba(0,0,0,0.08)';

/** Thicker, darker line that pulsates height + opacity when a note is focused. */
function NoteHairlinePulse({ pulse }: { pulse: Animated.Value }) {
  const height = pulse.interpolate({
    inputRange: [0.35, 1],
    outputRange: [1, 2.75],
  });
  const opacity = pulse.interpolate({
    inputRange: [0.35, 1],
    outputRange: [0.4, 1],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        width: '100%',
        height,
        backgroundColor: BW.fg,
        opacity,
      }}
    />
  );
}

export default function NotesScreen() {
  const navigation = useNavigation();
  const { session, initialized } = useAuth();
  /** Fallback when header context is missing (avoids throw from useHeaderHeight on some layouts). */
  const headerHeight = useContext(HeaderHeightContext) ?? 56;
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const drawerStatus = useDrawerStatus();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [dateLabel, setDateLabel] = useState(() => formatHeaderDate());
  const [sortMode, setSortMode] = useState<SortMode>('time');
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const bodySaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);
  const noteFocusPulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (!focusedNoteId) {
      noteFocusPulse.stopAnimation();
      noteFocusPulse.setValue(0);
      return;
    }
    noteFocusPulse.setValue(0.35);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(noteFocusPulse, {
          toValue: 1,
          duration: 600,
          useNativeDriver: false,
        }),
        Animated.timing(noteFocusPulse, {
          toValue: 0.35,
          duration: 600,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [focusedNoteId, noteFocusPulse]);

  const displayedBlocks = useMemo(
    () => sortBlocks(blocks, sortMode),
    [blocks, sortMode]
  );

  /** Fills the scroll body so the filler Pressable can expand to the bottom of the screen. */
  const scrollContentStyle = useMemo(
    () => [
      styles.scrollContentGrow,
      {
        minHeight: Math.max(
          0,
          windowHeight - headerHeight - insets.bottom
        ),
      },
    ],
    [windowHeight, headerHeight, insets.bottom]
  );

  const cycleSortMode = useCallback(() => {
    setSortMode((m) =>
      m === 'time' ? 'dueAsc' : m === 'dueAsc' ? 'dueDesc' : 'time'
    );
  }, []);

  useEffect(() => {
    if (!initialized) return;
    if (!session?.user?.id) {
      setBlocks([]);
    }
  }, [initialized, session?.user?.id]);

  useEffect(() => {
    return () => {
      Object.values(bodySaveTimers.current).forEach(clearTimeout);
      bodySaveTimers.current = {};
    };
  }, []);

  /** Cannot add another row while an empty note row exists */
  const canAddNote = !blocks.some((b) => b.text.trim() === '');

  useFocusEffect(
    useCallback(() => {
      setDateLabel(formatHeaderDate());
      if (!initialized || !session?.user?.id) return;
      let cancelled = false;
      (async () => {
        try {
          const rows = await fetchNotesForUser();
          if (cancelled) return;
          setBlocks((prev) => {
            const serverBlocks = rows.map(dbNoteToBlock);
            const serverIds = new Set(serverBlocks.map((b) => b.id));
            const pendingLocal = prev.filter((b) => !serverIds.has(b.id));
            return [...serverBlocks, ...pendingLocal];
          });
        } catch (e) {
          if (!isNotesTableMissingError(e)) {
            console.error('Failed to load notes', e);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [initialized, session?.user?.id])
  );

  useEffect(() => {
    if (drawerStatus === 'open') {
      Keyboard.dismiss();
    }
  }, [drawerStatus]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeftContainerStyle: [
        styles.headerLeftContainer,
        { paddingLeft: 4 + insets.left },
      ],
      headerLeft: (props: ComponentProps<typeof DrawerToggleButton>) => (
        <View style={styles.headerLeftRow}>
          <DrawerToggleButton {...props} tintColor={BW.fg} />
          <Pressable
            onPress={() => router.push('/(drawer)/calendar')}
            style={styles.headerDateBesideMenu}
            hitSlop={8}>
            <Text
              style={styles.headerDateTextLeft}
              numberOfLines={1}
              ellipsizeMode="tail"
              {...(Platform.OS === 'ios'
                ? { adjustsFontSizeToFit: true, minimumFontScale: 0.72 }
                : {})}>
              {dateLabel}
            </Text>
          </Pressable>
        </View>
      ),
      headerTitle: () => null,
      headerTitleContainerStyle: {
        flex: 0,
        width: 0,
        maxWidth: 0,
        margin: 0,
        padding: 0,
        overflow: 'hidden',
      },
      headerRightContainerStyle: [
        styles.headerRightContainer,
        /**
         * Match `noteRowWrap` horizontal padding (16). Header already applies
         * `marginEnd: insets.right` on the right slot — do not add insets again here
         * or the sort control sits left of the due indicators.
         */
        { paddingRight: 16 },
      ],
      headerRight: () => (
        <View style={styles.headerRightRow}>
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
  }, [navigation, dateLabel, cycleSortMode, sortMode, insets.left]);

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
    const tryFocus = (attemptsLeft: number) => {
      const input = inputRefs.current[id];
      if (input) {
        input.focus();
        return;
      }
      if (attemptsLeft <= 0) return;
      requestAnimationFrame(() => tryFocus(attemptsLeft - 1));
    };
    requestAnimationFrame(() => tryFocus(12));
  };

  const scheduleBodySave = useCallback(
    (id: string, text: string) => {
      const uid = session?.user?.id;
      if (!uid) return;
      const prevT = bodySaveTimers.current[id];
      if (prevT) clearTimeout(prevT);
      bodySaveTimers.current[id] = setTimeout(() => {
        delete bodySaveTimers.current[id];
        updateNoteBody(id, text).catch((e) => console.error('Failed to save note', e));
      }, 450);
    },
    [session?.user?.id]
  );

  const createBlockAndInsert = useCallback(
    async (initialText: string) => {
      const id = randomUUID();
      const createdAt = Date.now();
      const uid = session?.user?.id;
      if (uid) {
        try {
          await insertNote({ id, userId: uid, body: initialText, createdAtMs: createdAt });
        } catch (e) {
          if (isNotesTableMissingError(e)) {
            Alert.alert('Database setup', NOTES_TABLE_SETUP_HINT);
          } else {
            Alert.alert('Could not save note', 'Check your connection and try again.');
          }
          return;
        }
      }
      setBlocks((prev) => [...prev, { id, text: initialText, createdAt }]);
      queueMicrotask(() => focusBlockById(id));
    },
    [session?.user?.id]
  );

  const onChangeBlockById = (id: string, text: string) => {
    if (text === '') {
      const t = bodySaveTimers.current[id];
      if (t) clearTimeout(t);
      delete bodySaveTimers.current[id];
      if (session?.user?.id) {
        deleteNote(id).catch((e) => console.error('Failed to delete note', e));
      }
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
    scheduleBodySave(id, text);
  };

  const appendBlock = useCallback(() => {
    if (!canAddNote) return;
    void createBlockAndInsert('');
  }, [canAddNote, createBlockAndInsert]);

  /** Tap empty area: add note if allowed, otherwise focus the empty row so the keyboard opens. */
  const onTapAddOrFocusEmpty = useCallback(() => {
    if (canAddNote) {
      appendBlock();
      return;
    }
    const empty = blocks.find((b) => b.text.trim() === '');
    if (empty) {
      setTimeout(() => focusBlockById(empty.id), 50);
    }
  }, [canAddNote, blocks, appendBlock]);

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

  const openNoteDetails = (blockId: string) => {
    Keyboard.dismiss();
    router.push({
      pathname: '/note-details',
      params: { noteId: blockId },
    });
  };

  const onPlusMenuDate = () => {
    setPlusMenuOpen(false);
    router.push('/(drawer)/calendar');
  };

  const onPlusMenuUrgent = () => {
    setPlusMenuOpen(false);
    if (blocks.length === 0) {
      void createBlockAndInsert('[URGENT] ');
      return;
    }
    setBlocks((prev) => {
      const next = [...prev];
      const last = next.length - 1;
      const newText = next[last].text.trim()
        ? `${next[last].text.trim()} [URGENT] `
        : '[URGENT] ';
      next[last] = { ...next[last], text: newText };
      const lid = next[last].id;
      queueMicrotask(() => focusBlockById(lid));
      if (session?.user?.id) {
        updateNoteBody(lid, newText).catch((e) =>
          console.error('Failed to save note', e)
        );
      }
      return next;
    });
  };

  const showAccessory = IS_NATIVE && keyboardHeight > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <View style={styles.root}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={scrollContentStyle}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="on-drag">
            {blocks.length === 0 ? (
              <Pressable
                style={({ pressed }) => [
                  styles.addNoteArea,
                  styles.addNoteAreaFill,
                  !canAddNote && styles.addRowDisabled,
                  pressed && styles.addNoteAreaPressed,
                ]}
                onPress={onTapAddOrFocusEmpty}
                hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}>
                <View style={styles.addRowInner}>
                  <MaterialIcons name="add" size={20} color={BW.fg} />
                  <Text style={styles.addRowTextEmphasis}>add new note</Text>
                </View>
                <View style={styles.addNoteAreaSpacer} />
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
                  const dueDeltaDays =
                    block.dueAt != null ? calendarDaysDelta(block.dueAt) : 0;
                  const isFirstInList = displayedBlocks[0]?.id === block.id;

                  const rowFocused = focusedNoteId === block.id;
                  const isLastInList = index === displayedBlocks.length - 1;
                  const prevId =
                    index > 0 ? displayedBlocks[index - 1]?.id : undefined;
                  /** Line above this row: list top (index 0) or shared boundary with previous note. */
                  const pulseTopHairline =
                    index === 0
                      ? rowFocused
                      : rowFocused || focusedNoteId === prevId;
                  /** Line below last note only (boundary before add area). */
                  const pulseBottomHairline = isLastInList && rowFocused;

                  return (
                    <View key={block.id} style={styles.noteBlock}>
                      <NoteSwipeableRow
                        onDelete={() => onChangeBlockById(block.id, '')}>
                        <View style={styles.noteRowChrome}>
                          {pulseTopHairline ? (
                            <NoteHairlinePulse pulse={noteFocusPulse} />
                          ) : (
                            <View style={styles.noteHairlineIdle} />
                          )}
                          <View style={styles.noteRowWrap}>
                            <View style={styles.noteLeftCol}>
                              <TextInput
                                ref={(r) => {
                                  inputRefs.current[block.id] = r;
                                }}
                                style={styles.blockInput}
                                multiline={false}
                                numberOfLines={1}
                                placeholder={isFirstInList ? 'Tap to type…' : ''}
                                placeholderTextColor={BW.muted}
                                value={block.text}
                                onChangeText={(t) =>
                                  onChangeBlockById(block.id, t.replace(/\r?\n/g, ' '))
                                }
                                onFocus={() => setFocusedNoteId(block.id)}
                                onBlur={() =>
                                  setFocusedNoteId((cur) =>
                                    cur === block.id ? null : cur
                                  )
                                }
                                scrollEnabled={false}
                                {...(Platform.OS === 'android'
                                  ? { textAlignVertical: 'center' as const }
                                  : {})}
                                {...iosInputProps}
                              />
                            </View>
                            <View style={styles.noteDueColumn}>
                              <NoteDueIndicator
                                hasDue={hasDue}
                                dueDeltaDays={dueDeltaDays}
                                progress={progress}
                                size={NOTE_DUE_SIZE}
                                onPress={() => openNoteDetails(block.id)}
                                style={styles.noteDueIndicatorRoot}
                              />
                            </View>
                          </View>
                          {isLastInList ? (
                            pulseBottomHairline ? (
                              <NoteHairlinePulse pulse={noteFocusPulse} />
                            ) : (
                              <View style={styles.noteHairlineIdle} />
                            )
                          ) : null}
                        </View>
                      </NoteSwipeableRow>
                    </View>
                  );
                })}

                <Pressable
                  style={({ pressed }) => [
                    styles.addNoteArea,
                    {
                      minHeight: Math.max(
                        280,
                        windowHeight - headerHeight - insets.bottom - 80
                      ),
                    },
                    Platform.OS === 'web' ? { cursor: 'pointer' as const } : null,
                    pressed && styles.addNoteAreaPressed,
                  ]}
                  onPress={onTapAddOrFocusEmpty}
                  accessibilityRole="button"
                  accessibilityLabel="Add new note">
                  <View style={styles.addRowInner}>
                    <MaterialIcons name="add" size={18} color={BW.fg} />
                    <Text style={styles.addRowTextEmphasis}>add new note</Text>
                  </View>
                  <View style={styles.addNoteAreaSpacer} />
                </Pressable>
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
            <View style={styles.accAccessoryLeft}>
              <Pressable
                style={({ pressed }) => [styles.accCircleBtn, pressed && styles.accCirclePressed]}
                onPress={() => setPlusMenuOpen(true)}
                accessibilityLabel="More options"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="add" size={18} color={BW.muted} />
              </Pressable>
            </View>
            <View style={styles.accAccessoryRight}>
              <Pressable
                style={({ pressed }) => [styles.accCircleBtn, pressed && styles.accCirclePressed]}
                onPress={() => {}}
                accessibilityLabel="Microphone"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="mic" size={18} color={BW.muted} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.accCircleBtn, pressed && styles.accCirclePressed]}
                onPress={() => Keyboard.dismiss()}
                accessibilityLabel="Hide keyboard"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="keyboard-arrow-down" size={18} color={BW.muted} />
              </Pressable>
            </View>
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
    paddingTop: 10,
    paddingBottom: 24,
    flexGrow: 1,
  },
  /** Full remaining area under notes: one tappable surface (no fill; same bg as screen) */
  addNoteArea: {
    width: '100%',
    flexGrow: 1,
    flexDirection: 'column',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    marginTop: 4,
    paddingTop: 8,
    paddingBottom: 8,
  },
  /** When there are no notes yet, stretch to fill the scroll body */
  addNoteAreaFill: {
    flex: 1,
    minHeight: 200,
  },
  addNoteAreaPressed: {
    opacity: 0.92,
  },
  addNoteAreaSpacer: {
    flex: 1,
    flexGrow: 1,
    minHeight: 1,
  },
  addRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
    width: '100%',
    paddingHorizontal: 16,
  },
  addRowDisabled: {
    opacity: 0.42,
  },
  noteBlock: {
    width: '100%',
    alignSelf: 'stretch',
  },
  noteRowChrome: {
    width: '100%',
  },
  /** Idle separator: hairline-thin, very light black. */
  noteHairlineIdle: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    minHeight: 1,
    backgroundColor: NOTE_LINE_SUBTLE,
  },
  noteRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: NOTE_ROW_MIN_HEIGHT,
    paddingTop: 5,
    paddingBottom: 5,
    paddingHorizontal: 16,
    width: '100%',
  },
  noteLeftCol: {
    flex: 1,
    minWidth: 0,
    height: 40,
    justifyContent: 'center',
  },
  noteDueColumn: {
    width: NOTE_DUE_SIZE,
    height: NOTE_DUE_SIZE,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteDueIndicatorRoot: {
    marginTop: 0,
    alignSelf: 'center',
  },
  blockInput: {
    flex: 1,
    width: '100%',
    height: 40,
    maxHeight: 40,
    paddingVertical: 0,
    paddingHorizontal: 0,
    fontSize: 17,
    lineHeight: 20,
    color: BW.fg,
    backgroundColor: BW.bg,
    overflow: 'hidden',
    textAlign: 'left',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
    ...(Platform.OS === 'web'
      ? ({
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        } as const)
      : {}),
  },
  addRowTextEmphasis: {
    fontSize: 15,
    fontWeight: '600',
    color: BW.fg,
    letterSpacing: 0.15,
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
    minHeight: 44,
    justifyContent: 'flex-start',
  },
  headerDateBesideMenu: {
    paddingVertical: 0,
    paddingLeft: 4,
    minWidth: 0,
    flexShrink: 1,
    justifyContent: 'center',
  },
  headerDateTextLeft: {
    color: BW.fg,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'left',
    flexShrink: 1,
    maxWidth: '100%',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  headerRightContainer: {
    flexGrow: 0,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconBtn: {
    padding: 6,
  },
  sortCircle: {
    width: NOTE_DUE_SIZE,
    height: NOTE_DUE_SIZE,
    borderRadius: NOTE_DUE_SIZE / 2,
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: BW.bg,
    zIndex: 100,
    elevation: 100,
  },
  accAccessoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accAccessoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  /** Same diameter as note due-date rings (`NOTE_DUE_SIZE`). */
  accCircleBtn: {
    width: NOTE_DUE_SIZE,
    height: NOTE_DUE_SIZE,
    borderRadius: NOTE_DUE_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BW.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BW.bg,
  },
  accCirclePressed: {
    opacity: 0.72,
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
});
