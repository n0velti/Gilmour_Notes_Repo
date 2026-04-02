import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

import { BW } from '@/constants/monochrome';
import { useAuth } from '@/contexts/auth-context';
import {
  formatDaysLeftValue,
  endOfDueDayMs,
  formatDueDateLong,
} from '@/lib/note-due-format';
import { dbNoteToBlock, fetchNoteById, updateNoteBody, updateNoteDue } from '@/lib/notes';

export default function NoteDetailsScreen() {
  const { session } = useAuth();
  const params = useLocalSearchParams<{ noteId?: string }>();
  const rawId = params.noteId;
  const noteId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [dueAt, setDueAt] = useState<number | undefined>();
  const [createdAt, setCreatedAt] = useState<number | undefined>();
  const [editingNote, setEditingNote] = useState(false);

  const [duePickerOpen, setDuePickerOpen] = useState(false);
  const [duePickerTemp, setDuePickerTemp] = useState(() => new Date());
  const duePickerOpenRef = useRef(false);
  const bodySaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bodyInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    duePickerOpenRef.current = duePickerOpen;
  }, [duePickerOpen]);

  useEffect(() => {
    return () => {
      if (bodySaveTimer.current) clearTimeout(bodySaveTimer.current);
    };
  }, []);

  const scheduleBodySave = useCallback(
    (text: string) => {
      const uid = session?.user?.id;
      const id = noteId?.trim();
      if (!uid || !id) return;
      if (bodySaveTimer.current) clearTimeout(bodySaveTimer.current);
      bodySaveTimer.current = setTimeout(() => {
        bodySaveTimer.current = undefined;
        updateNoteBody(id, text).catch((e) => {
          console.error(e);
          Alert.alert('Could not save', 'Check your connection and try again.');
        });
      }, 450);
    },
    [session?.user?.id, noteId]
  );

  const onBodyChange = (text: string) => {
    setBody(text);
    scheduleBodySave(text);
  };

  const toggleEditNote = () => {
    if (editingNote) {
      Keyboard.dismiss();
      setEditingNote(false);
      return;
    }
    setEditingNote(true);
    queueMicrotask(() => bodyInputRef.current?.focus());
  };

  const loadNote = useCallback(async () => {
    if (!noteId?.trim()) {
      setError('Missing note');
      return;
    }
    const row = await fetchNoteById(noteId);
    if (!row) {
      setError('Note not found');
      return;
    }
    const b = dbNoteToBlock(row);
    setBody(b.text);
    setDueAt(b.dueAt);
    setCreatedAt(b.createdAt);
  }, [noteId]);

  useEffect(() => {
    if (!noteId?.trim()) {
      setLoading(false);
      setError('Missing note');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await loadNote();
      } catch {
        if (!cancelled) setError('Could not load note');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [noteId, loadNote]);

  const applyDueFromDate = async (picked: Date) => {
    if (!noteId?.trim()) return;
    const at = endOfDueDayMs(picked);
    const anchor = Date.now();
    setDueAt(at);
    if (session?.user?.id) {
      try {
        await updateNoteDue(noteId, at, anchor);
      } catch (e) {
        console.error(e);
        Alert.alert('Could not save', 'Could not update due date.');
      }
    }
  };

  const openDuePicker = () => {
    if (Platform.OS === 'web') {
      Alert.alert('Due date', 'Set due dates in the iOS or Android app.');
      return;
    }
    const base =
      dueAt != null ? new Date(dueAt) : new Date(Date.now() + 86400000);
    setDuePickerTemp(base);
    setDuePickerOpen(true);
  };

  const closeDuePicker = () => {
    setDuePickerOpen(false);
  };

  const confirmDuePicker = () => {
    void applyDueFromDate(duePickerTemp);
    closeDuePicker();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator color={BW.fg} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <View style={styles.center}>
          <Text style={styles.muted}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const addedLabel =
    createdAt != null
      ? new Date(createdAt).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : '—';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollInner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator>
          <View style={styles.noteHeaderRow}>
            <Text style={styles.sectionLabelFlat}>Note</Text>
            <Pressable
              onPress={toggleEditNote}
              style={({ pressed }) => [styles.editIconBtn, pressed && { opacity: 0.55 }]}
              accessibilityRole="button"
              accessibilityLabel={editingNote ? 'Done editing note' : 'Edit note'}>
              <MaterialIcons
                name={editingNote ? 'check' : 'edit'}
                size={22}
                color={BW.fg}
              />
            </Pressable>
          </View>

          {editingNote ? (
            <TextInput
              ref={bodyInputRef}
              style={styles.noteEditor}
              value={body}
              onChangeText={onBodyChange}
              multiline
              placeholder="Write your note…"
              placeholderTextColor={BW.muted}
              scrollEnabled
              textAlignVertical="top"
              {...(Platform.OS === 'android' ? { includeFontPadding: false } : {})}
            />
          ) : (
            <Text style={styles.noteReadonly}>{body.trim() ? body : '—'}</Text>
          )}

          <Text style={[styles.sectionLabel, styles.metaSectionGap]}>Details</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Due date</Text>
            <Text style={styles.detailValue} numberOfLines={3}>
              {dueAt != null ? formatDueDateLong(dueAt) : '—'}
            </Text>
          </View>

          {Platform.OS !== 'web' ? (
            <Pressable
              style={({ pressed }) => [styles.dueBtn, pressed && { opacity: 0.7 }]}
              onPress={openDuePicker}
              accessibilityRole="button"
              accessibilityLabel={dueAt != null ? 'Change due date' : 'Set due date'}>
              <Text style={styles.dueBtnText}>
                {dueAt != null ? 'Change due date' : 'Set due date'}
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Added</Text>
            <Text style={styles.detailValue} numberOfLines={3}>
              {addedLabel}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Days left</Text>
            <Text style={styles.detailValue} numberOfLines={3}>
              {formatDaysLeftValue(dueAt)}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {duePickerOpen && Platform.OS === 'android' ? (
        <DateTimePicker
          value={duePickerTemp}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(ev, date) => {
            if (ev.type === 'dismissed' || !duePickerOpenRef.current) {
              closeDuePicker();
              return;
            }
            if (ev.type === 'set' && date) {
              void applyDueFromDate(date);
              closeDuePicker();
            }
          }}
        />
      ) : null}

      {duePickerOpen && Platform.OS === 'ios' ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={closeDuePicker}>
          <View style={styles.dateModalRoot}>
            <Pressable style={styles.dateModalBackdrop} onPress={closeDuePicker} />
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
                <Pressable style={styles.dateModalBtn} onPress={closeDuePicker}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BW.bg,
  },
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  muted: {
    fontSize: 16,
    color: BW.muted,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  noteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionLabelFlat: {
    fontSize: 12,
    fontWeight: '600',
    color: BW.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  editIconBtn: {
    padding: 4,
    marginRight: -4,
  },
  noteReadonly: {
    fontSize: 17,
    lineHeight: 24,
    color: BW.fg,
  },
  noteEditor: {
    fontSize: 17,
    lineHeight: 24,
    color: BW.fg,
    minHeight: 120,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BW.borderSoft,
    backgroundColor: BW.bg,
    ...(Platform.OS === 'android' ? { textAlignVertical: 'top' as const } : {}),
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: BW.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  metaSectionGap: {
    marginTop: 18,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BW.hairline,
  },
  detailLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: BW.muted,
    flexShrink: 0,
    maxWidth: '42%',
  },
  detailValue: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    color: BW.fg,
    textAlign: 'right',
  },
  dueBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BW.borderSoft,
  },
  dueBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: BW.fg,
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
