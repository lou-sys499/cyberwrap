-- Anonymous CyberWrap rewards and coupons.
-- Run this after analytics_events.sql.
-- This does not modify or delete analytics data or auth tables.

create extension if not exists pgcrypto;

create table if not exists public.cyberwrap_rewards (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique,
  cumulative_score integer not null default 0,
  cycle_started_at timestamptz not null default now(),
  cycle_expires_at timestamptz not null default now() + interval '7 days',
  coupons_earned_in_cycle integer not null default 0,
  reward_status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cyberwrap_rewards_score_check check (cumulative_score >= 0),
  constraint cyberwrap_rewards_coupon_count_check check (coupons_earned_in_cycle between 0 and 2),
  constraint cyberwrap_rewards_status_check check (reward_status in ('active', 'expired')),
  constraint cyberwrap_rewards_cycle_check check (cycle_expires_at > cycle_started_at)
);

create table if not exists public.cyberwrap_coupons (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.cyberwrap_rewards(player_id) on delete cascade,
  reward_id uuid not null references public.cyberwrap_rewards(id) on delete cascade,
  code text not null,
  code_hash text not null unique,
  discount_percent integer not null default 20,
  status text not null default 'active',
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint cyberwrap_coupon_discount_check check (discount_percent = 20),
  constraint cyberwrap_coupon_status_check check (status in ('active', 'expired', 'redeemed')),
  constraint cyberwrap_coupon_expiry_check check (expires_at > generated_at)
);

create table if not exists public.cyberwrap_reward_claims (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null,
  session_id text not null,
  game_id uuid not null,
  score_amount integer not null,
  credited_amount integer not null default 0,
  coupon_id uuid references public.cyberwrap_coupons(id),
  created_at timestamptz not null default now(),
  constraint cyberwrap_claim_score_check check (score_amount > 0),
  constraint cyberwrap_claim_credited_check check (credited_amount >= 0),
  unique (player_id, game_id)
);

create index if not exists cyberwrap_rewards_cycle_expiry_idx
  on public.cyberwrap_rewards (cycle_expires_at);

create index if not exists cyberwrap_coupons_player_idx
  on public.cyberwrap_coupons (player_id);

create index if not exists cyberwrap_coupons_expiry_idx
  on public.cyberwrap_coupons (expires_at);

alter table public.cyberwrap_coupons
  add column if not exists code text;

-- Replace the earlier claim key if the first version of this migration was
-- already applied. A game can only be credited once for an anonymous player.
alter table public.cyberwrap_reward_claims
  drop constraint if exists cyberwrap_reward_claims_player_id_session_id_game_id_key;

alter table public.cyberwrap_reward_claims
  drop constraint if exists cyberwrap_reward_claims_player_id_game_id_key;

alter table public.cyberwrap_reward_claims
  add constraint cyberwrap_reward_claims_player_id_game_id_key
  unique (player_id, game_id);

alter table public.cyberwrap_rewards enable row level security;
alter table public.cyberwrap_coupons enable row level security;
alter table public.cyberwrap_reward_claims enable row level security;

revoke all on public.cyberwrap_rewards from anon, authenticated;
revoke all on public.cyberwrap_coupons from anon, authenticated;
revoke all on public.cyberwrap_reward_claims from anon, authenticated;

create or replace function public.get_anonymous_reward_progress(requested_player_id uuid)
returns table (
  cumulative_score integer,
  cycle_started_at timestamptz,
  cycle_expires_at timestamptz,
  coupons_earned_in_cycle integer,
  reward_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  reward_record public.cyberwrap_rewards;
  server_now timestamptz := now();
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
    update public.cyberwrap_rewards
      set cumulative_score = 0,
          cycle_started_at = server_now,
          cycle_expires_at = server_now + interval '7 days',
          coupons_earned_in_cycle = 0,
          reward_status = 'active'
      where player_id = requested_player_id
      returning * into reward_record;
  end if;

  update public.cyberwrap_coupons
    set status = 'expired'
    where player_id = requested_player_id
      and status = 'active'
      and expires_at <= server_now;

  return query select reward_record.cumulative_score,
    reward_record.cycle_started_at,
    reward_record.cycle_expires_at,
    reward_record.coupons_earned_in_cycle,
    reward_record.reward_status;
end;
$$;

create or replace function public.record_anonymous_reward_score(
  requested_player_id uuid,
  requested_session_id text,
  requested_game_id uuid,
  score_amount integer
)
returns table (
  cumulative_score integer,
  cycle_started_at timestamptz,
  cycle_expires_at timestamptz,
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
  server_now timestamptz := now();
  credited integer;
  generated_code text;
  generated_coupon_id uuid;
begin
  if requested_player_id is null or requested_session_id is null
     or requested_game_id is null or score_amount is null or score_amount <= 0 then
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
    update public.cyberwrap_rewards
      set cumulative_score = 0,
          cycle_started_at = server_now,
          cycle_expires_at = server_now + interval '7 days',
          coupons_earned_in_cycle = 0,
          reward_status = 'active'
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

  update public.cyberwrap_rewards
    set cumulative_score = public.cyberwrap_rewards.cumulative_score + credited,
        updated_at = server_now
    where player_id = requested_player_id
    returning * into reward_record;

  generated_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  generated_coupon_id := null;

    if reward_record.cumulative_score >= 2000
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

    update public.cyberwrap_rewards
      set cumulative_score = cumulative_score - 2000,
          coupons_earned_in_cycle = coupons_earned_in_cycle + 1,
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

revoke all on function public.get_anonymous_reward_progress(uuid) from public, anon, authenticated;
grant execute on function public.get_anonymous_reward_progress(uuid) to anon, authenticated;
revoke all on function public.record_anonymous_reward_score(uuid, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.record_anonymous_reward_score(uuid, text, uuid, integer) to anon, authenticated;

create or replace function public.get_anonymous_coupons(requested_player_id uuid)
returns table (
  code text,
  discount_percent integer,
  status text,
  generated_at timestamptz,
  expires_at timestamptz
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

revoke all on function public.get_anonymous_coupons(uuid) from public, anon, authenticated;
grant execute on function public.get_anonymous_coupons(uuid) to anon, authenticated;