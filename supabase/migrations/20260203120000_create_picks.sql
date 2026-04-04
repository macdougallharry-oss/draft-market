-- Run in Supabase SQL Editor or via `supabase db push` if using CLI.
-- Table: weekly locked picks per user.

create table public.picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_number integer not null,
  year integer not null,
  coin_symbol text not null,
  coin_name text not null,
  direction text not null check (direction in ('long', 'short')),
  confidence integer not null,
  entry_price numeric not null,
  created_at timestamptz not null default now()
);

create index picks_user_week_year_idx on public.picks (user_id, week_number, year);

alter table public.picks enable row level security;

create policy "Users can insert own picks"
  on public.picks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can read own picks"
  on public.picks
  for select
  to authenticated
  using (auth.uid() = user_id);
