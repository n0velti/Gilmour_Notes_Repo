import { supabase } from '@/lib/supabase';

/** PostgREST: relation missing from schema cache (table not created yet). */
export function isNotesTableMissingError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'PGRST205'
  );
}

export const NOTES_TABLE_SETUP_HINT =
  'Open Supabase Dashboard → SQL, paste and run the file supabase/migrations/20250326120000_notes.sql';

export type DbNote = {
  id: string;
  body: string;
  due_at: string | null;
  due_anchor_at: string | null;
  created_at: string;
};

export function dbNoteToBlock(row: DbNote): {
  id: string;
  text: string;
  createdAt: number;
  dueAt?: number;
  dueAnchorAt?: number;
} {
  return {
    id: row.id,
    text: row.body,
    createdAt: new Date(row.created_at).getTime(),
    dueAt: row.due_at ? new Date(row.due_at).getTime() : undefined,
    dueAnchorAt: row.due_anchor_at ? new Date(row.due_anchor_at).getTime() : undefined,
  };
}

export async function fetchNotesForUser(): Promise<DbNote[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('id, body, due_at, due_anchor_at, created_at')
    .order('created_at', { ascending: true });
  if (error) {
    if (isNotesTableMissingError(error)) {
      console.warn(`Notes: ${NOTES_TABLE_SETUP_HINT}`);
      return [];
    }
    throw error;
  }
  return data ?? [];
}

export async function fetchNoteById(id: string): Promise<DbNote | null> {
  const { data, error } = await supabase
    .from('notes')
    .select('id, body, due_at, due_anchor_at, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    if (isNotesTableMissingError(error)) return null;
    throw error;
  }
  return data;
}

export async function insertNote(row: {
  id: string;
  userId: string;
  body: string;
  createdAtMs: number;
}) {
  const { error } = await supabase.from('notes').insert({
    id: row.id,
    user_id: row.userId,
    body: row.body,
    created_at: new Date(row.createdAtMs).toISOString(),
  });
  if (error) throw error;
}

export async function updateNoteBody(id: string, body: string) {
  const { error } = await supabase
    .from('notes')
    .update({ body, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function updateNoteDue(
  id: string,
  dueAt: number | null,
  dueAnchorAt: number | null
) {
  const { error } = await supabase
    .from('notes')
    .update({
      due_at: dueAt != null ? new Date(dueAt).toISOString() : null,
      due_anchor_at: dueAnchorAt != null ? new Date(dueAnchorAt).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteNote(id: string) {
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) throw error;
}
