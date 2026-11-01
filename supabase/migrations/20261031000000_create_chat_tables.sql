create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  companion_id text,
  companion_name text,
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'A conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'bot')),
  content text not null,
  crisis boolean not null default false,
  error boolean not null default false,
  created_at timestamptz not null default now(),
  ordinal integer not null default 0
);

create index if not exists messages_conversation_ordinal_idx
  on public.messages(conversation_id, ordinal);

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "Users can read their profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "Users can insert their profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create policy "Users can update their profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can read their conversations"
  on public.conversations for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their conversations"
  on public.conversations for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their conversations"
  on public.conversations for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their conversations"
  on public.conversations for delete to authenticated
  using (auth.uid() = user_id);

create policy "Users can read their messages"
  on public.messages for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their messages"
  on public.messages for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their messages"
  on public.messages for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their messages"
  on public.messages for delete to authenticated
  using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
