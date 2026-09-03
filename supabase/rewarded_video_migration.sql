-- CyberWrap Rewarded Video Continue Mechanic Database Migration
-- Phase 18A: 6-Second Video Continue Reward (+15 Seconds)
--
-- Run this migration in your Supabase SQL Editor.
-- This creates the persistent tracking table, RLS policies,
-- and atomic database functions for managing the daily 3-continue limit.

-- =====================================================
-- TABLE CREATION
-- =====================================================

create table if not exists public.cyberwrap_video_continues (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null,
  claim_date text not null, -- Format: YYYY-MM-DD (UTC date)
  claimed_at timestamp with time zone default now() not null,
  reward_seconds integer default 15 not null
);

-- Indices for rapid daily query lookups
create index if not exists idx_cyberwrap_video_continues_player_date 
  on public.cyberwrap_video_continues(player_id, claim_date);

create index if not exists idx_cyberwrap_video_continues_claimed_at
  on public.cyberwrap_video_continues(claimed_at desc);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

alter table public.cyberwrap_video_continues enable row level security;

-- Only accessed via security definer RPC functions
create policy "Allow read access via functions only"
  on public.cyberwrap_video_continues for select
  using (false);

create policy "Allow insert via functions only"
  on public.cyberwrap_video_continues for insert
  with check (false);

-- =====================================================
-- RPC FUNCTIONS
-- =====================================================

-- 1. Get current player's daily video continue status
create or replace function public.get_rewarded_video_status(
  requested_player_id uuid,
  requested_date text default to_char(timezone('utc', now()), 'YYYY-MM-DD')
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  max_limit constant integer := 3;
begin
  if requested_player_id is null then
    raise exception 'Player ID is required';
  end if;

  select count(*)::integer into current_count
  from public.cyberwrap_video_continues
  where player_id = requested_player_id
    and claim_date = requested_date;

  return jsonb_build_object(
    'success', true,
    'daily_count', current_count,
    'daily_limit', max_limit,
    'remaining', greatest(0, max_limit - current_count),
    'can_claim', current_count < max_limit,
    'claim_date', requested_date
  );
end;
$$;

-- 2. Atomically claim a video continue (+15 seconds)
create or replace function public.claim_rewarded_video_continue(
  requested_player_id uuid,
  requested_date text default to_char(timezone('utc', now()), 'YYYY-MM-DD')
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  max_limit constant integer := 3;
  new_count integer;
begin
  if requested_player_id is null then
    raise exception 'Player ID is required';
  end if;

  -- Advisory lock based on player_id hash to serialize concurrent requests for this player
  perform pg_advisory_xact_lock(hashtext(requested_player_id::text));

  select count(*)::integer into current_count
  from public.cyberwrap_video_continues
  where player_id = requested_player_id
    and claim_date = requested_date;

  if current_count >= max_limit then
    return jsonb_build_object(
      'success', false,
      'error', 'daily_limit_reached',
      'message', 'You have used all 3 sponsored continues for today.',
      'daily_count', current_count,
      'daily_limit', max_limit,
      'remaining', 0
    );
  end if;

  -- Record claim
  insert into public.cyberwrap_video_continues (player_id, claim_date, reward_seconds)
  values (requested_player_id, requested_date, 15);

  new_count := current_count + 1;

  return jsonb_build_object(
    'success', true,
    'daily_count', new_count,
    'daily_limit', max_limit,
    'remaining', greatest(0, max_limit - new_count),
    'reward_seconds', 15,
    'claim_date', requested_date
  );
end;
$$;

-- =====================================================
-- PERMISSIONS
-- =====================================================

revoke all on function public.get_rewarded_video_status(uuid, text) from public, anon, authenticated;
revoke all on function public.claim_rewarded_video_continue(uuid, text) from public, anon, authenticated;

grant execute on function public.get_rewarded_video_status(uuid, text) to anon, authenticated;
grant execute on function public.claim_rewarded_video_continue(uuid, text) to anon, authenticated;
