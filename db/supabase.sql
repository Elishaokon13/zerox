-- Supabase schema for ZeroX data ops
-- Run this in Supabase SQL editor or via the CLI (psql) against your project

-- 1) Weekly leaderboard (one row per season+address)
create table if not exists public.leaderboard_entries (
  season text not null,
  address text not null,
  alias text,
  pfp_url text,
  wins integer not null default 0,
  draws integer not null default 0,
  losses integer not null default 0,
  points integer not null default 0,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leaderboard_entries_pkey primary key (season, address)
);

-- Safe migration in case table already existed
do $$ begin
  begin
    alter table public.leaderboard_entries add column if not exists pfp_url text;
  exception when others then null;
  end;
end $$;

create index if not exists leaderboard_entries_points_idx
  on public.leaderboard_entries (season, points desc, wins desc);

-- 2) Timed sprint leaderboard (10-min windows, one row per window_start+address)
create table if not exists public.sprint_entries (
  window_start bigint not null,
  address text not null,
  wins integer not null default 0,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sprint_entries_pkey primary key (window_start, address)
);

create index if not exists sprint_entries_rank_idx
  on public.sprint_entries (window_start, wins desc);

-- 3) Loss settlement gate (blocks gameplay until unpaid loss is settled)
create table if not exists public.loss_settlements (
  address text not null primary key,
  required boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 4) Per-game sessions tracking
create table if not exists public.game_sessions (
  id uuid not null default gen_random_uuid(),
  address text not null,
  result text, -- 'win' | 'loss' | 'draw'
  requires_settlement boolean not null default false,
  settled boolean not null default false,
  tx_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_sessions_pkey primary key (id)
);
create index if not exists game_sessions_address_idx on public.game_sessions (address, created_at desc);
-- Index to quickly query unpaid losses for gating
create index if not exists game_sessions_unpaid_idx on public.game_sessions (address, requires_settlement, settled, created_at desc);

-- 5) Daily Check-ins (30-day streak tracking)
create table if not exists public.daily_checkins (
  address text not null,
  day date not null,
  completed boolean not null default false,
  game_result text, -- 'win' | 'loss' | 'draw'
  bonus_claimed boolean not null default false,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_checkins_pkey primary key (address, day)
);

create index if not exists daily_checkins_address_idx on public.daily_checkins (address, day desc);
create index if not exists daily_checkins_completed_idx on public.daily_checkins (day, completed);

-- 6) Payout logs for faucet caps (per-address per-day)
create table if not exists public.payout_logs (
  address text not null,
  day date not null,
  count integer not null default 0,
  total_amount numeric not null default 0,
  updated_at timestamptz not null default now(),
  inserted_at timestamptz not null default now(),
  constraint payout_logs_pkey primary key (address, day)
);
create index if not exists payout_logs_day_idx on public.payout_logs (day);

-- 6b) Charge logs for auditing
create table if not exists public.charge_logs (
  address text not null,
  day date not null,
  count integer not null default 0,
  total_amount numeric not null default 0,
  updated_at timestamptz not null default now(),
  inserted_at timestamptz not null default now(),
  constraint charge_logs_pkey primary key (address, day)
);
create index if not exists charge_logs_day_idx on public.charge_logs (day);

-- 6c) Weekly payouts for top 3 leaderboard users
create table if not exists public.weekly_payouts (
  week_start date not null,
  rank integer not null,
  address text not null,
  alias text,
  amount_eth numeric not null,
  tx_hash text,
  paid_at timestamptz,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_payouts_pkey primary key (week_start, rank)
);
create index if not exists weekly_payouts_week_idx on public.weekly_payouts (week_start);
create index if not exists weekly_payouts_address_idx on public.weekly_payouts (address);

-- 6d) Referral system for rewarding referrals
create table if not exists public.referrals (
  id uuid not null default gen_random_uuid(),
  referrer_address text not null,
  referred_address text not null,
  points_awarded integer not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referrals_pkey primary key (id),
  constraint referrals_unique unique (referrer_address, referred_address)
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_address);
create index if not exists referrals_referred_idx on public.referrals (referred_address);

-- 7) User Notification Tokens (for Farcaster Mini App notifications)
create table if not exists public.user_notifications (
  id uuid not null default gen_random_uuid(),
  address text not null,
  fid integer not null,
  notification_token text not null,
  notification_url text not null,
  is_active boolean not null default true,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_notifications_pkey primary key (id),
  constraint user_notifications_address_fid_unique unique (address, fid)
);

create index if not exists user_notifications_address_idx on public.user_notifications (address);
create index if not exists user_notifications_fid_idx on public.user_notifications (fid);
create index if not exists user_notifications_active_idx on public.user_notifications (is_active);

-- 6) Brackets (8-player single-elim, best-of-3)
create table if not exists public.brackets (
  id uuid not null default gen_random_uuid(),
  name text not null,
  admin_address text not null,
  status text not null default 'open', -- open|filled|in_progress|completed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brackets_pkey primary key (id)
);

create table if not exists public.bracket_players (
  bracket_id uuid not null references public.brackets(id) on delete cascade,
  seed integer not null,
  address text not null,
  alias text,
  pfp_url text,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bracket_players_pkey primary key (bracket_id, seed)
);
create index if not exists bracket_players_bracket_idx on public.bracket_players (bracket_id);

create table if not exists public.bracket_matches (
  id uuid not null default gen_random_uuid(),
  bracket_id uuid not null references public.brackets(id) on delete cascade,
  round integer not null, -- 1 qf, 2 sf, 3 final
  p1_seed integer not null,
  p2_seed integer not null,
  p1_wins integer not null default 0,
  p2_wins integer not null default 0,
  status text not null default 'pending', -- pending|active|done
  winner_seed integer,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bracket_matches_pkey primary key (id)
);
create index if not exists bracket_matches_bracket_idx on public.bracket_matches (bracket_id, round);

-- Triggers to maintain updated_at columns
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;$$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_leaderboard_entries_touch'
  ) then
    create trigger trg_leaderboard_entries_touch
      before update on public.leaderboard_entries
      for each row execute function public.touch_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_sprint_entries_touch'
  ) then
    create trigger trg_sprint_entries_touch
      before update on public.sprint_entries
      for each row execute function public.touch_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_loss_settlements_touch'
  ) then
    create trigger trg_loss_settlements_touch
      before update on public.loss_settlements
      for each row execute function public.touch_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_game_sessions_touch'
  ) then
    create trigger trg_game_sessions_touch
      before update on public.game_sessions
      for each row execute function public.touch_updated_at();
  end if;
end $$;

-- Triggers for new tables
do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_payout_logs_touch'
  ) then
    create trigger trg_payout_logs_touch
      before update on public.payout_logs
      for each row execute function public.touch_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_user_notifications_touch'
  ) then
    create trigger trg_user_notifications_touch
      before update on public.user_notifications
      for each row execute function public.touch_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_daily_checkins_touch'
  ) then
    create trigger trg_daily_checkins_touch
      before update on public.daily_checkins
      for each row execute function public.touch_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_brackets_touch'
  ) then
    create trigger trg_brackets_touch
      before update on public.brackets
      for each row execute function public.touch_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_bracket_players_touch'
  ) then
    create trigger trg_bracket_players_touch
      before update on public.bracket_players
      for each row execute function public.touch_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_bracket_matches_touch'
  ) then
    create trigger trg_bracket_matches_touch
      before update on public.bracket_matches
      for each row execute function public.touch_updated_at();
  end if;
end $$;

-- Enable RLS for new tables
alter table public.payout_logs enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.user_notifications enable row level security;
alter table public.brackets enable row level security;
alter table public.bracket_players enable row level security;
alter table public.bracket_matches enable row level security;
alter table public.weekly_payouts enable row level security;
alter table public.referrals enable row level security;

-- PVP feature removed - table and related objects deleted

-- Policies for payout logs
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'payout_select') then
    create policy payout_select on public.payout_logs for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'payout_upsert') then
    create policy payout_upsert on public.payout_logs for insert with check (true);
    create policy payout_update on public.payout_logs for update using (true) with check (true);
  end if;
end $$;

-- Policies for daily check-ins
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'checkins_select') then
    create policy checkins_select on public.daily_checkins for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'checkins_upsert') then
    create policy checkins_insert on public.daily_checkins for insert with check (true);
    create policy checkins_update on public.daily_checkins for update using (true) with check (true);
  end if;
end $$;

-- Policies for user notifications
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'notifications_select') then
    create policy notifications_select on public.user_notifications for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'notifications_upsert') then
    create policy notifications_insert on public.user_notifications for insert with check (true);
    create policy notifications_update on public.user_notifications for update using (true) with check (true);
  end if;
end $$;

-- Policies for brackets
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'brackets_select') then
    create policy brackets_select on public.brackets for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'brackets_upsert') then
    create policy brackets_insert on public.brackets for insert with check (true);
    create policy brackets_update on public.brackets for update using (true) with check (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'bracket_players_select') then
    create policy bracket_players_select on public.bracket_players for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'bracket_players_upsert') then
    create policy bracket_players_insert on public.bracket_players for insert with check (true);
    create policy bracket_players_update on public.bracket_players for update using (true) with check (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'bracket_matches_select') then
    create policy bracket_matches_select on public.bracket_matches for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'bracket_matches_upsert') then
    create policy bracket_matches_insert on public.bracket_matches for insert with check (true);
    create policy bracket_matches_update on public.bracket_matches for update using (true) with check (true);
  end if;
end $$;

-- PVP policies removed

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'sprint_select_all') then
    create policy sprint_select_all on public.sprint_entries for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'sprint_upsert_anon') then
    create policy sprint_upsert_anon on public.sprint_entries for insert with check (true);
    create policy sprint_update_anon on public.sprint_entries for update using (true) with check (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'settlement_select_all') then
    create policy settlement_select_all on public.loss_settlements for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'settlement_upsert_anon') then
    create policy settlement_upsert_anon on public.loss_settlements for insert with check (true);
    create policy settlement_update_anon on public.loss_settlements for update using (true) with check (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'games_select_by_address') then
    create policy games_select_by_address on public.game_sessions for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'games_insert') then
    create policy games_insert on public.game_sessions for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'games_update') then
    create policy games_update on public.game_sessions for update using (true) with check (true);
  end if;
end $$;

-- Policies for weekly payouts
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'weekly_payouts_select') then
    create policy weekly_payouts_select on public.weekly_payouts for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'weekly_payouts_upsert') then
    create policy weekly_payouts_insert on public.weekly_payouts for insert with check (true);
    create policy weekly_payouts_update on public.weekly_payouts for update using (true) with check (true);
  end if;
end $$;

-- Policies for referrals
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'referrals_select') then
    create policy referrals_select on public.referrals for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'referrals_upsert') then
    create policy referrals_insert on public.referrals for insert with check (true);
    create policy referrals_update on public.referrals for update using (true) with check (true);
  end if;
end $$;


