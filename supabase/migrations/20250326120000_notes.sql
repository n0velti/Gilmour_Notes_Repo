-- Notes: body + optional due window (due_at end-of-day instant, due_anchor_at for ring progress)
create table public.notes (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null default '',
  due_at timestamptz,
  due_anchor_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now ()
);

create index notes_user_created_idx on public.notes (user_id, created_at);

alter table public.notes enable row level security;

create policy "notes_select_own" on public.notes for select
  using (auth.uid () = user_id);

create policy "notes_insert_own" on public.notes for insert
  with check (auth.uid () = user_id);

create policy "notes_update_own" on public.notes for update
  using (auth.uid () = user_id);

create policy "notes_delete_own" on public.notes for delete
  using (auth.uid () = user_id);
