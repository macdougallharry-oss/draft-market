-- One row per coin per user per fantasy week (prevents duplicate symbols).
alter table public.picks
  add constraint picks_user_week_coin_unique
  unique (user_id, week_number, year, coin_symbol);
