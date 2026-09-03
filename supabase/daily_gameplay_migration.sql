-- =====================================================
-- CyberWrap Daily Gameplay Cap & Economy Database Migration
-- Phase 18B: 5 Runs Per Calendar Day System
--
-- Run this migration in your Supabase SQL Editor.
-- This creates the persistent tracking table, RLS policies,
-- and atomic database functions for managing the daily 5-run gameplay allowance.
-- =====================================================

-- -----------------------------------------------------
-- TABLE: cyberwrap_daily_usage
-- -----------------------------------------------------

create table if not exists public.cyberwrap_daily_usage (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null,
  usage_date text not null, -- Format: YYYY-MM-DD (UTC date)
  runs_used integer not null default 0,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint uq_cyberwrap_daily_usage_player_date unique (player_id, usage_date)
);

-- Index for rapid daily query lookups
create index if not exists idx_cyberwrap_daily_usage_player_date 
  on public.cyberwrap_daily_usage(player_id, usage_date);

create index if not exists idx_cyberwrap_daily_usage_updated_at
  on public.cyberwrap_daily_usage(updated_at desc);

-- -----------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------

alter table public.cyberwrap_daily_usage enable row level security;

-- Prevent direct table access from public client; force access through security definer RPCs
create policy "Allow read access via functions only"
  on public.cyberwrap_daily_usage for select
  using (false);

create policy "Allow insert via functions only"
  on public.cyberwrap_daily_usage for insert
  with check (false);

create policy "Allow update via functions only"
  on public.cyberwrap_daily_usage for update
  using (false);

-- -----------------------------------------------------
-- RPC FUNCTIONS
-- -----------------------------------------------------

-- 1. Get current player's daily gameplay runs status
create or replace function public.get_daily_run_status(
  requested_player_id uuid,
  requested_date text default to_char(timezone('utc', now()), 'YYYY-MM-DD')
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_runs integer := 0;
  max_limit constant integer := 5;
begin
  if requested_player_id is null then
    raise exception 'Player ID is required';
  end if;

  select runs_used into current_runs
  from public.cyberwrap_daily_usage
  where player_id = requested_player_id
    and usage_date = requested_date;

  if current_runs is null then
    current_runs := 0;
  end if;

  return jsonb_build_object(
    'success', true,
    'daily_runs_used', current_runs,
    'daily_run_limit', max_limit,
    'daily_runs_remaining', greatest(0, max_limit - current_runs),
    'can_start_run', current_runs < max_limit,
    'daily_run_date', requested_date
  );
end;
$$;

-- 2. Atomically claim a daily gameplay run (Max 5 runs per calendar day)
create or replace function public.claim_daily_gameplay_run(
  requested_player_id uuid,
  requested_date text default to_char(timezone('utc', now()), 'YYYY-MM-DD')
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_runs integer := 0;
  new_runs integer := 0;
  max_limit constant integer := 5;
begin
  if requested_player_id is null then
    raise exception 'Player ID is required';
  end if;

  -- Advisory lock based on player_id hash + offset to serialize concurrent requests for this player
  perform pg_advisory_xact_lock(hashtext(requested_player_id::text || '_daily_run'));

  -- Check existing runs used today
  select runs_used into current_runs
  from public.cyberwrap_daily_usage
  where player_id = requested_player_id
    and usage_date = requested_date;

  if current_runs is null then
    current_runs := 0;
  end if;

  -- Enforce strict daily cap
  if current_runs >= max_limit then
    return jsonb_build_object(
      'success', false,
      'error', 'daily_limit_reached',
      'message', 'You have completed all 5 runs for today. Come back tomorrow for 5 new delivery runs.',
      'daily_runs_used', current_runs,
      'daily_run_limit', max_limit,
      'daily_runs_remaining', 0,
      'can_start_run', false,
      'daily_run_date', requested_date
    );
  end if;

  -- Increment atomically
  new_runs := current_runs + 1;

  insert into public.cyberwrap_daily_usage (player_id, usage_date, runs_used, updated_at)
  values (requested_player_id, requested_date, new_runs, now())
  on conflict (player_id, usage_date)
  do update set
    runs_used = public.cyberwrap_daily_usage.runs_used + 1,
    updated_at = now()
  returning runs_used into new_runs;

  return jsonb_build_object(
    'success', true,
    'daily_runs_used', new_runs,
    'daily_run_limit', max_limit,
    'daily_runs_remaining', greatest(0, max_limit - new_runs),
    'can_start_run', new_runs < max_limit,
    'daily_run_date', requested_date,
    'message', 'Run started! ' || greatest(0, max_limit - new_runs) || ' runs remaining today.'
  );
end;
$$;

-- -----------------------------------------------------
-- PERMISSIONS
-- -----------------------------------------------------

grant execute on function public.get_daily_run_status(uuid, text) to anon, authenticated;
grant execute on function public.claim_daily_gameplay_run(uuid, text) to anon, authenticated;
