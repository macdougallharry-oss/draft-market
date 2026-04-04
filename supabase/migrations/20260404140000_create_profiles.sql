-- Public username per auth user (onboarding).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  constraint profiles_username_len check (
    char_length(username) >= 3
    and char_length(username) <= 20
  ),
  constraint profiles_username_chars check (
    username ~ '^[a-zA-Z0-9_]+$'
  )
);

create unique index profiles_username_lower_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;

create policy "Anyone authenticated can read profiles"
  on public.profiles
  for select
  to authenticated
  using (true);

create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
