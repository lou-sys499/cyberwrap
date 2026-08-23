-- CyberWrap analytics event storage.
-- Run this migration in the Supabase SQL Editor.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  campaign text not null default 'direct',
  event text not null,
  timestamp bigint not null,
  game_version text not null,
  player_id uuid,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists analytics_events_timestamp_idx
  on public.analytics_events (timestamp desc);

create index if not exists analytics_events_event_idx
  on public.analytics_events (event);

create index if not exists analytics_events_session_id_idx
  on public.analytics_events (session_id);

create index if not exists analytics_events_campaign_idx
  on public.analytics_events (campaign);

alter table public.analytics_events
  add column if not exists player_id uuid;

create index if not exists analytics_events_player_id_idx
  on public.analytics_events (player_id);

alter table public.analytics_events enable row level security;

-- The game uses the publishable key and no user authentication, so it can
-- submit anonymous events but cannot read analytics data.
drop policy if exists "game can insert analytics events" on public.analytics_events;
create policy "game can insert analytics events"
  on public.analytics_events
  for insert
  to anon, authenticated
  with check (true);

-- Authenticated dashboard users can query analytics. Add your normal website
-- authentication and role checks here if the dashboard needs tighter access.
drop policy if exists "authenticated users can read analytics events" on public.analytics_events;
create policy "authenticated users can read analytics events"
  on public.analytics_events
  for select
  to authenticated
  using (true);

comment on table public.analytics_events is
  'Anonymous CyberWrap gameplay telemetry; event-specific fields are stored in data.';