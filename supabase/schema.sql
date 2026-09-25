create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  title text not null,
  messages jsonb not null default '[]'::jsonb,
  updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  created_at timestamptz not null default now(),
  unique(owner_user_id, client_id)
);

alter table public.chats enable row level security;

drop policy if exists "Users can read their own chats" on public.chats;
create policy "Users can read their own chats" on public.chats for select using (auth.uid() = owner_user_id);

drop policy if exists "Users can insert their own chats" on public.chats;
create policy "Users can insert their own chats" on public.chats for insert with check (auth.uid() = owner_user_id);

drop policy if exists "Users can update their own chats" on public.chats;
create policy "Users can update their own chats" on public.chats for update using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

drop policy if exists "Users can delete their own chats" on public.chats;
create policy "Users can delete their own chats" on public.chats for delete using (auth.uid() = owner_user_id);

create index if not exists chats_owner_updated_idx on public.chats(owner_user_id, updated_at desc);
