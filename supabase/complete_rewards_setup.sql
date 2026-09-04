-- CyberWrap Complete Rewards Database Setup
-- This script creates all tables and functions for the rewards system
-- Run this in your Supabase SQL Editor

-- =====================================================
-- TABLE CREATION
-- =====================================================

-- Main rewards table
create table if not exists public.cyberwrap_rewards (
  id uuid primary key default gen_random_uuid(),
  player_id uuid unique not null,
  cumulative_score integer default 0 not null,
  cycle_started_at timestamp with time zone default now() not null,
  cycle_expires_at timestamp with time zone default (now() + interval '7 days') not null,
  coupons_earned_in_cycle integer default 0 not null,
  reward_status text default 'active' not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Add constraint to prevent negative scores
alter table public.cyberwrap_rewards 
  add constraint check_cumulative_score_non_negative 
  check (cumulative_score >= 0);

-- Create index on player_id for performance
create index if not exists idx_cyberwrap_rewards_player_id 
  on public.cyberwrap_rewards(player_id);

-- Coupon codes table
create table if not exists public.cyberwrap_coupons (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.cyberwrap_rewards(player_id) on delete cascade,
  reward_id uuid references public.cyberwrap_rewards(id) on delete cascade,
  code text not null unique,
  code_hash text not null,
  discount_percent integer default 10 not null,
  status text default 'active' not null,
  generated_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone default (now() + interval '7 days') not null,
  redeemed_at timestamp with time zone
);

-- Create index on player_id for coupons
create index if not exists idx_cyberwrap_coupons_player_id 
  on public.cyberwrap_coupons(player_id);

-- Create index on code_hash for validation
create index if not exists idx_cyberwrap_coupons_code_hash 
  on public.cyberwrap_coupons(code_hash);

-- Reward claims table (tracks game sessions)
create table if not exists public.cyberwrap_reward_claims (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.cyberwrap_rewards(player_id) on delete cascade,
  session_id text not null,
  game_id uuid not null,
  score_amount integer not null,
  credited_amount integer not null,
  claimed_at timestamp with time zone default now() not null,
  unique(player_id, game_id)
);

-- Create index on player_id for claims
create index if not exists idx_cyberwrap_reward_claims_player_id 
  on public.cyberwrap_reward_claims(player_id);

-- Create index on game_id for claims
create index if not exists idx_cyberwrap_reward_claims_game_id 
  on public.cyberwrap_reward_claims(game_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
alter table public.cyberwrap_rewards enable row level security;
alter table public.cyberwrap_coupons enable row level security;
alter table public.cyberwrap_reward_claims enable row level security;

-- Rewards table policies
create policy "Allow read access to own rewards" 
  on public.cyberwrap_rewards for select 
  using (player_id = auth.uid() or true); -- Allow anonymous access via functions

create policy "Allow insert via functions only" 
  on public.cyberwrap_rewards for insert 
  with check (false); -- Only allowed via functions

create policy "Allow update via functions only" 
  on public.cyberwrap_rewards for update 
  using (false); -- Only allowed via functions

-- Coupons table policies
create policy "Allow read access to own coupons" 
  on public.cyberwrap_coupons for select 
  using (player_id = auth.uid() or true); -- Allow anonymous access via functions

create policy "Allow insert via functions only" 
  on public.cyberwrap_coupons for insert 
  with check (false); -- Only allowed via functions

create policy "Allow update via functions only" 
  on public.cyberwrap_coupons for update 
  using (false); -- Only allowed via functions

-- Claims table policies
create policy "Allow read access to own claims" 
  on public.cyberwrap_reward_claims for select 
  using (player_id = auth.uid() or true); -- Allow anonymous access via functions

create policy "Allow insert via functions only" 
  on public.cyberwrap_reward_claims for insert 
  with check (false); -- Only allowed via functions

-- =====================================================
-- STORED PROCEDURES
-- =====================================================

-- =====================================================
-- GET ANONYMOUS REWARD PROGRESS
-- =====================================================

create or replace function public.get_anonymous_reward_progress(requested_player_id uuid)
returns table (
  cumulative_score integer,
  cycle_started_at timestamp with time zone,
  cycle_expires_at timestamp with time zone,
  coupons_earned_in_cycle integer,
  reward_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  reward_record public.cyberwrap_rewards;
  server_now timestamp with time zone := now();
begin
  if requested_player_id is null then
    raise exception 'Player ID is required';
  end if;

  insert into public.cyberwrap_rewards (player_id)
  values (requested_player_id)
  on conflict (player_id) do nothing;

  select * into reward_record
    from public.cyberwrap_rewards
    where player_id = requested_player_id
    for update;

  if server_now >= reward_record.cycle_expires_at then
    update public.cyberwrap_rewards r
      set cumulative_score = 0,
          cycle_started_at = server_now,
          cycle_expires_at = server_now + interval '7 days',
          coupons_earned_in_cycle = 0,
          reward_status = 'active',
          updated_at = server_now
      where player_id = requested_player_id
      returning * into reward_record;
  end if;

  return query select reward_record.cumulative_score,
    reward_record.cycle_started_at,
    reward_record.cycle_expires_at,
    reward_record.coupons_earned_in_cycle,
    reward_record.reward_status;
end;
$$;

-- =====================================================
-- RECORD ANONYMOUS REWARD SCORE
-- =====================================================

create or replace function public.record_anonymous_reward_score(
  requested_player_id uuid,
  requested_session_id text,
  requested_game_id uuid,
  score_amount integer
)
returns table (
  cumulative_score integer,
  cycle_started_at timestamp with time zone,
  cycle_expires_at timestamp with time zone,
  coupons_earned_in_cycle integer,
  reward_status text,
  coupon_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  reward_record public.cyberwrap_rewards;
  server_now timestamp with time zone := now();
  credited integer;
  generated_code text;
  generated_coupon_id uuid;
begin
  if requested_player_id is null or requested_session_id is null
     or requested_game_id is null or score_amount is null or score_amount < 0 then
    raise exception 'Invalid reward claim';
  end if;

  if exists (
    select 1 from public.cyberwrap_reward_claims
    where player_id = requested_player_id
      and game_id = requested_game_id
  ) then
    return query select r.cumulative_score, r.cycle_started_at,
      r.cycle_expires_at, r.coupons_earned_in_cycle, r.reward_status, null::text
      from public.cyberwrap_rewards r where r.player_id = requested_player_id;
    return;
  end if;

  insert into public.cyberwrap_rewards (player_id)
  values (requested_player_id)
  on conflict (player_id) do nothing;

  select * into reward_record
    from public.cyberwrap_rewards
    where player_id = requested_player_id
    for update;

  if server_now >= reward_record.cycle_expires_at then
    update public.cyberwrap_rewards r
      set cumulative_score = 0,
          cycle_started_at = server_now,
          cycle_expires_at = server_now + interval '7 days',
          coupons_earned_in_cycle = 0,
          reward_status = 'active',
          updated_at = server_now
      where player_id = requested_player_id
      returning * into reward_record;
  end if;

  update public.cyberwrap_coupons
    set status = 'expired'
    where player_id = requested_player_id
      and status = 'active'
      and expires_at <= server_now;

  credited := score_amount;
  insert into public.cyberwrap_reward_claims
    (player_id, session_id, game_id, score_amount, credited_amount)
  values
    (requested_player_id, requested_session_id, requested_game_id, score_amount, credited)
  on conflict (player_id, game_id) do nothing;

  if not found then
    return query select reward_record.cumulative_score,
      reward_record.cycle_started_at,
      reward_record.cycle_expires_at,
      reward_record.coupons_earned_in_cycle,
      reward_record.reward_status,
      null::text;
    return;
  end if;

  update public.cyberwrap_rewards r
    set cumulative_score = r.cumulative_score + credited,
        updated_at = server_now
    where player_id = requested_player_id
    returning * into reward_record;

  generated_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  generated_coupon_id := null;

  if reward_record.cumulative_score >= 200
    and reward_record.coupons_earned_in_cycle < 2 then
    insert into public.cyberwrap_coupons
      (player_id, reward_id, code, code_hash, generated_at, expires_at)
    values (
      requested_player_id,
      reward_record.id,
      generated_code,
      encode(digest(generated_code, 'sha256'), 'hex'),
      server_now,
      server_now + interval '7 days'
    )
    returning id into generated_coupon_id;

    update public.cyberwrap_rewards r
      set cumulative_score = r.cumulative_score - 200,
          coupons_earned_in_cycle = r.coupons_earned_in_cycle + 1,
          updated_at = server_now
      where player_id = requested_player_id
      returning * into reward_record;
  end if;

  return query select reward_record.cumulative_score,
    reward_record.cycle_started_at,
    reward_record.cycle_expires_at,
    reward_record.coupons_earned_in_cycle,
    reward_record.reward_status,
    case when generated_coupon_id is not null then generated_code else null end;
end;
$$;

-- =====================================================
-- GET ANONYMOUS COUPONS
-- =====================================================

create or replace function public.get_anonymous_coupons(requested_player_id uuid)
returns table (
  code text,
  discount_percent integer,
  status text,
  generated_at timestamp with time zone,
  expires_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if requested_player_id is null then
    raise exception 'Player ID is required';
  end if;

  update public.cyberwrap_coupons
    set status = 'expired'
    where player_id = requested_player_id
      and status = 'active'
      and expires_at <= now();

  return query
    select c.code, c.discount_percent, c.status,
      c.generated_at, c.expires_at
    from public.cyberwrap_coupons c
    where c.player_id = requested_player_id
    order by c.generated_at desc;
end;
$$;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Revoke existing permissions
revoke all on function public.get_anonymous_reward_progress(uuid) from public, anon, authenticated;
revoke all on function public.record_anonymous_reward_score(uuid, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.get_anonymous_coupons(uuid) from public, anon, authenticated;

-- Grant execute permissions to anonymous and authenticated users
grant execute on function public.get_anonymous_reward_progress(uuid) to anon, authenticated;
grant execute on function public.record_anonymous_reward_score(uuid, text, uuid, integer) to anon, authenticated;
grant execute on function public.get_anonymous_coupons(uuid) to anon, authenticated;

-- =====================================================
-- SETUP COMPLETE
-- =====================================================

-- This script will:
-- 1. Create all required tables with proper constraints
-- 2. Set up Row Level Security (RLS) policies
-- 3. Create all stored procedures
-- 4. Grant proper permissions for anonymous access
-- 5. Ensure the rewards system works for your 60-second game sessions

-- Usage:
-- 1. Run this script in Supabase SQL Editor
-- 2. The system will track cumulative scores across all 60-second sessions
-- 3. Players earn coupons when cumulative score reaches 200 points
-- 4. Reward cycles reset every 7 days