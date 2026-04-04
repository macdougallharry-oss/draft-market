-- Leaderboard needs to aggregate every user's picks for the week.
-- Existing policy only allowed reading own rows; add a read-all policy for authenticated users.

create policy "Authenticated users can read all picks for leaderboard"
  on public.picks
  for select
  to authenticated
  using (true);
