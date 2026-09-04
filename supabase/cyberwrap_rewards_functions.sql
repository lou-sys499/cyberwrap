-- CyberWrap Rewards Functions
-- These functions are compatible with the provided table structure
-- Run this in your Supabase SQL Editor after creating the table

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