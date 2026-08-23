-- CyberWrap account and reward foundation.
-- Run after analytics_events.sql in the Supabase SQL Editor.
-- This migration intentionally does not implement point awarding,
-- gameplay crediting, coupons, or checkout.

create table if not exists public.player_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  phone_number text not null unique,
  cycle_started_at timestamptz not null default now(),
  cycle_ends_at timestamptz not null default now() + interval '7 days',
  cycle_points integer not null default 0,
  daily_points integer not null default 0,
  daily_period_started_at timestamptz not null default now(),
  play_seconds integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_rewards_cycle_points_nonnegative check (cycle_points >= 0),
  constraint player_rewards_daily_points_nonnegative check (daily_points >= 0),
  constraint player_rewards_play_seconds_nonnegative check (play_seconds >= 0),
  constraint player_rewards_cycle_order check (cycle_ends_at > cycle_started_at)
);

create index if not exists player_rewards_user_id_idx
  on public.player_rewards (user_id);

alter table public.player_rewards enable row level security;

revoke all on table public.player_rewards from anon, authenticated;
grant select on table public.player_rewards to authenticated;

drop policy if exists "users can read their own reward record" on public.player_rewards;
create policy "users can read their own reward record"
  on public.player_rewards
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- No INSERT, UPDATE, or DELETE policies are granted to clients.
-- Trusted server functions will own all reward mutations.

create or replace function public.create_player_rewards_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.player_rewards (user_id, name, phone_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    regexp_replace(coalesce(new.phone, ''), '^\\+', '')
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_player_rewards on auth.users;
create trigger on_auth_user_created_player_rewards
  after insert on auth.users
  for each row execute procedure public.create_player_rewards_for_user();

create or replace function public.touch_player_rewards_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists player_rewards_updated_at on public.player_rewards;
create trigger player_rewards_updated_at
  before update on public.player_rewards
  for each row execute procedure public.touch_player_rewards_updated_at();

comment on table public.player_rewards is
  'Server-owned CyberWrap reward state; clients may read only their own row.';

create or replace function public.get_my_player_rewards()
returns setof public.player_rewards
language plpgsql
security definer
set search_path = public
as $$
declare
  current_record public.player_rewards;
  server_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into current_record
    from public.player_rewards
    where user_id = auth.uid()
    for update;

  if not found then
    return;
  end if;

  if server_now >= current_record.cycle_ends_at then
    update public.player_rewards
      set cycle_started_at = server_now,
          cycle_ends_at = server_now + interval '7 days',
          cycle_points = 0,
          play_seconds = 0,
          daily_points = 0,
          daily_period_started_at = server_now
      where user_id = auth.uid()
      returning * into current_record;
  elsif server_now >= current_record.daily_period_started_at + interval '24 hours' then
    update public.player_rewards
      set daily_points = 0,
          daily_period_started_at = server_now
      where user_id = auth.uid()
      returning * into current_record;
  end if;

  return next current_record;
end;
$$;

revoke all on function public.get_my_player_rewards() from public, anon;
grant execute on function public.get_my_player_rewards() to authenticated;