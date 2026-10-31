-- =====================================================================
-- Xwin — Migration 0001: core schema, RLS, prediction + settlement RPCs
-- Virtual points only (no real money). Run in Supabase SQL editor or
-- via `supabase db push`.
-- =====================================================================

-- ---------- helpers ---------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- admins ----------------------------------------------------
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

-- ---------- profiles --------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 80),
  date_of_birth date,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- reference data -------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  country text,
  created_at timestamptz not null default now()
);

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  sport text not null default 'football',
  created_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id),
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid not null references public.teams(id),
  start_time timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled','live','finished','postponed','cancelled')),
  home_score int check (home_score >= 0),
  away_score int check (away_score >= 0),
  external_id text unique,              -- provider match id (future API sync)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_distinct_teams check (home_team_id <> away_team_id)
);
create index matches_start_idx on public.matches (start_time);
create index matches_status_idx on public.matches (status);
create index matches_competition_idx on public.matches (competition_id);
create trigger trg_matches_updated before update on public.matches
  for each row execute function public.set_updated_at();

-- ---------- markets & outcomes ---------------------------------------
create table public.markets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  market_type text not null
    check (market_type in ('match_result','over_under','both_teams_to_score','correct_score')),
  status text not null default 'open'
    check (status in ('open','suspended','closed','settled')),
  closes_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, market_type),
  unique (id, match_id)                 -- target for composite FK from predictions
);
create index markets_match_idx on public.markets (match_id);
create trigger trg_markets_updated before update on public.markets
  for each row execute function public.set_updated_at();

create table public.market_outcomes (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  -- codes: home_win|draw|away_win, over_2_5|under_2_5, yes|no, 2-1 (home-away)
  outcome_code text not null,
  label text not null,
  odds numeric(7,2) not null check (odds >= 1.01 and odds <= 1000),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (market_id, outcome_code),
  unique (id, market_id)                -- target for composite FK from predictions
);
create index outcomes_market_idx on public.market_outcomes (market_id);
create trigger trg_outcomes_updated before update on public.market_outcomes
  for each row execute function public.set_updated_at();

create table public.odds_history (
  id bigint generated always as identity primary key,
  outcome_id uuid not null references public.market_outcomes(id) on delete cascade,
  old_odds numeric(7,2),
  new_odds numeric(7,2) not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index odds_history_outcome_idx on public.odds_history (outcome_id, changed_at desc);

create or replace function public.log_odds_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into odds_history(outcome_id, old_odds, new_odds, changed_by)
    values (new.id, null, new.odds, auth.uid());
  elsif new.odds is distinct from old.odds then
    insert into odds_history(outcome_id, old_odds, new_odds, changed_by)
    values (new.id, old.odds, new.odds, auth.uid());
  end if;
  return new;
end $$;
create trigger trg_outcomes_odds_history after insert or update on public.market_outcomes
  for each row execute function public.log_odds_change();

-- ---------- predictions ----------------------------------------------
create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null,
  market_id uuid not null,
  outcome_id uuid not null,
  odds_snapshot numeric(7,2) not null check (odds_snapshot >= 1.01),
  status text not null default 'pending'
    check (status in ('pending','won','lost','void')),
  points_awarded int not null default 0,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- one prediction per user per market
  unique (user_id, market_id),
  -- the market must belong to the match, the outcome to the market
  foreign key (market_id, match_id) references public.markets (id, match_id),
  foreign key (outcome_id, market_id) references public.market_outcomes (id, market_id)
);
create index predictions_user_idx on public.predictions (user_id, created_at desc);
create index predictions_market_idx on public.predictions (market_id);
create trigger trg_predictions_updated before update on public.predictions
  for each row execute function public.set_updated_at();

create table public.user_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_predictions int not null default 0,
  correct_predictions int not null default 0,
  total_points int not null default 0,
  updated_at timestamptz not null default now()
);
create index user_stats_points_idx on public.user_stats (total_points desc, correct_predictions desc);

create table public.prediction_settlements (
  market_id uuid primary key references public.markets(id),  -- one settlement per market
  match_id uuid not null references public.matches(id),
  settled_by uuid,
  predictions_count int not null,
  settled_at timestamptz not null default now()
);

-- ---------- friendships ----------------------------------------------
create table public.friendships (
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  constraint friendships_not_self check (requester_id <> addressee_id)
);
-- block duplicates in the reverse direction too (A→B and B→A)
create unique index friendships_pair_uniq on public.friendships
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id, status);
create trigger trg_friendships_updated before update on public.friendships
  for each row execute function public.set_updated_at();

-- ---------- notifications, history, audit ----------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb not null default '{}',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, is_read, created_at desc);

create table public.match_result_history (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  home_score int,
  away_score int,
  status text,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_id uuid,
  action text not null,
  table_name text,
  record_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.audit_admin_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare rec jsonb;
begin
  if public.is_admin() then
    rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
    insert into admin_audit_logs(admin_id, action, table_name, record_id, details)
    values (auth.uid(), tg_op, tg_table_name, rec->>'id', rec);
  end if;
  return coalesce(new, old);
end $$;
create trigger audit_matches after insert or update or delete on public.matches
  for each row execute function public.audit_admin_change();
create trigger audit_markets after insert or update or delete on public.markets
  for each row execute function public.audit_admin_change();
create trigger audit_outcomes after insert or update or delete on public.market_outcomes
  for each row execute function public.audit_admin_change();

-- ---------- new-user bootstrap ---------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, date_of_birth)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'مستخدم'),
    nullif(new.raw_user_meta_data->>'date_of_birth', '')::date
  );
  insert into user_stats (user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.admin_users enable row level security;
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.competitions enable row level security;
alter table public.matches enable row level security;
alter table public.markets enable row level security;
alter table public.market_outcomes enable row level security;
alter table public.odds_history enable row level security;
alter table public.predictions enable row level security;
alter table public.user_stats enable row level security;
alter table public.prediction_settlements enable row level security;
alter table public.friendships enable row level security;
alter table public.notifications enable row level security;
alter table public.match_result_history enable row level security;
alter table public.admin_audit_logs enable row level security;

-- admin_users: no client policies (managed via SQL / service role only)

-- profiles: own row only (date_of_birth is private). Others are exposed
-- through search_users() / get_leaderboard() which return name + avatar only.
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- public reference data: readable by signed-in users, writable by admins
do $$
declare t text;
begin
  foreach t in array array['teams','competitions','matches','markets','market_outcomes'] loop
    execute format('create policy %I on public.%I for select to authenticated using (true)', t||'_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_admin())', t||'_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t||'_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_admin())', t||'_del', t);
  end loop;
end $$;

create policy odds_history_read on public.odds_history for select to authenticated using (true);

-- predictions: read own; NO direct insert/update/delete (use place_prediction)
create policy predictions_select_own on public.predictions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- user_stats: read own; written only by trusted functions
create policy user_stats_select_own on public.user_stats for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy settlements_admin_read on public.prediction_settlements for select to authenticated
  using (public.is_admin());
create policy match_history_read on public.match_result_history for select to authenticated using (true);
create policy audit_admin_read on public.admin_audit_logs for select to authenticated
  using (public.is_admin());

-- friendships
create policy friendships_select on public.friendships for select to authenticated
  using (auth.uid() in (requester_id, addressee_id));
create policy friendships_insert on public.friendships for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');
create policy friendships_respond on public.friendships for update to authenticated
  using (addressee_id = auth.uid() and status = 'pending')
  with check (addressee_id = auth.uid() and status in ('accepted','rejected'));
create policy friendships_delete on public.friendships for delete to authenticated
  using (auth.uid() in (requester_id, addressee_id));
revoke update on public.friendships from authenticated;
grant update (status) on public.friendships to authenticated;

-- notifications: own only; user may mark as read
create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;

-- =====================================================================
-- RPC: place_prediction
-- The odds are always read server-side. The client may pass the odds it
-- displayed (p_expected_odds); if they changed, the call fails with
-- ODDS_CHANGED so the app can ask the user to confirm the new price.
-- =====================================================================
create or replace function public.place_prediction(
  p_outcome_id uuid,
  p_expected_odds numeric default null
) returns public.predictions
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  o public.market_outcomes;
  m public.markets;
  mt public.matches;
  result public.predictions;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;

  -- share-lock so a concurrent odds/status change commits before we read
  select * into o from market_outcomes where id = p_outcome_id for share;
  if not found then raise exception 'OUTCOME_NOT_FOUND'; end if;
  select * into m from markets where id = o.market_id for share;
  select * into mt from matches where id = m.match_id for share;

  if not o.is_active then raise exception 'OUTCOME_INACTIVE'; end if;
  if m.status <> 'open' then raise exception 'MARKET_NOT_OPEN'; end if;
  if now() >= m.closes_at then raise exception 'MARKET_CLOSED'; end if;
  if mt.status <> 'scheduled' or now() >= mt.start_time then
    raise exception 'MATCH_NOT_BETTABLE';
  end if;
  if p_expected_odds is not null and p_expected_odds <> o.odds then
    raise exception 'ODDS_CHANGED' using detail = o.odds::text;
  end if;

  begin
    insert into predictions (user_id, match_id, market_id, outcome_id, odds_snapshot)
    values (v_uid, m.match_id, m.id, o.id, o.odds)
    returning * into result;
  exception when unique_violation then
    raise exception 'ALREADY_PREDICTED';
  end;

  update user_stats
     set total_predictions = total_predictions + 1, updated_at = now()
   where user_id = v_uid;

  return result;
end $$;

-- =====================================================================
-- Scoring rules (single place to change them)
-- won  => round(10 * odds_snapshot) points; lost => 0
-- =====================================================================
create or replace function public.points_for_win(p_odds numeric)
returns int language sql immutable as $$ select round(10 * p_odds)::int $$;

-- is the outcome a winner for the given final score?
create or replace function public.is_winning_outcome(
  p_market_type text, p_code text, p_home int, p_away int
) returns boolean language plpgsql immutable as $$
declare parts text[]; line numeric;
begin
  case p_market_type
    when 'match_result' then
      return p_code = case when p_home > p_away then 'home_win'
                           when p_home = p_away then 'draw' else 'away_win' end;
    when 'both_teams_to_score' then
      return p_code = case when p_home > 0 and p_away > 0 then 'yes' else 'no' end;
    when 'correct_score' then
      return p_code = p_home || '-' || p_away;
    when 'over_under' then
      -- codes like over_2_5 / under_2_5  (line = 2.5)
      parts := regexp_match(p_code, '^(over|under)_(\d+)_(\d+)$');
      if parts is null then return false; end if;
      line := (parts[2] || '.' || parts[3])::numeric;
      return case when parts[1] = 'over' then (p_home + p_away) > line
                  else (p_home + p_away) < line end;
  end case;
  return false;
end $$;

-- =====================================================================
-- RPC: settle_match (admin only, idempotent per market)
-- =====================================================================
create or replace function public.settle_match(
  p_match_id uuid, p_home_score int, p_away_score int
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  mk record; n int; total int := 0; settled_markets int := 0;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_home_score < 0 or p_away_score < 0 then raise exception 'INVALID_SCORE'; end if;

  perform 1 from matches where id = p_match_id for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;

  update matches
     set status = 'finished', home_score = p_home_score, away_score = p_away_score
   where id = p_match_id;
  insert into match_result_history(match_id, home_score, away_score, status, changed_by)
  values (p_match_id, p_home_score, p_away_score, 'finished', auth.uid());

  for mk in
    select id, market_type from markets
     where match_id = p_match_id and status <> 'settled'
     for update
  loop
    -- guard against double settlement
    insert into prediction_settlements(market_id, match_id, settled_by, predictions_count)
    values (mk.id, p_match_id, auth.uid(), 0)
    on conflict (market_id) do nothing;
    if not found then continue; end if;

    with graded as (
      update predictions p
         set status = case when public.is_winning_outcome(mk.market_type, o.outcome_code,
                                                           p_home_score, p_away_score)
                           then 'won' else 'lost' end,
             points_awarded = case when public.is_winning_outcome(mk.market_type, o.outcome_code,
                                                                   p_home_score, p_away_score)
                                   then public.points_for_win(p.odds_snapshot) else 0 end,
             settled_at = now()
        from market_outcomes o
       where p.market_id = mk.id and p.status = 'pending' and o.id = p.outcome_id
      returning p.user_id, p.status, p.points_awarded
    ), agg as (
      select user_id,
             count(*) filter (where status = 'won') as wins,
             coalesce(sum(points_awarded), 0) as pts
        from graded group by user_id
    ), upd as (
      update user_stats s
         set correct_predictions = s.correct_predictions + agg.wins,
             total_points = s.total_points + agg.pts,
             updated_at = now()
        from agg where s.user_id = agg.user_id
      returning 1
    )
    select count(*) into n from graded;

    update prediction_settlements set predictions_count = n where market_id = mk.id;
    update markets set status = 'settled' where id = mk.id;
    total := total + n;
    settled_markets := settled_markets + 1;
  end loop;

  insert into admin_audit_logs(admin_id, action, table_name, record_id, details)
  values (auth.uid(), 'SETTLE_MATCH', 'matches', p_match_id::text,
          jsonb_build_object('home', p_home_score, 'away', p_away_score,
                             'markets', settled_markets, 'predictions', total));

  return jsonb_build_object('markets_settled', settled_markets, 'predictions_settled', total);
end $$;

-- =====================================================================
-- RPC: void_match (postponed / cancelled) — admin only
-- =====================================================================
create or replace function public.void_match(p_match_id uuid, p_status text default 'cancelled')
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_status not in ('cancelled','postponed') then raise exception 'INVALID_STATUS'; end if;

  update matches set status = p_status where id = p_match_id;
  update markets set status = 'closed' where match_id = p_match_id and status <> 'settled';
  if p_status = 'cancelled' then
    update predictions set status = 'void', points_awarded = 0, settled_at = now()
     where match_id = p_match_id and status = 'pending';
    get diagnostics n = row_count;
    update markets set status = 'settled' where match_id = p_match_id;
  else
    n := 0;
  end if;

  insert into admin_audit_logs(admin_id, action, table_name, record_id, details)
  values (auth.uid(), 'VOID_MATCH', 'matches', p_match_id::text,
          jsonb_build_object('status', p_status, 'voided', n));
  return n;
end $$;

-- =====================================================================
-- Leaderboard + user search (expose name/avatar only — never DOB/email)
-- p_period: 'all' | 'day' | 'week'.  Ties share a rank
-- (points desc, then correct predictions desc).
-- =====================================================================
create or replace function public.get_leaderboard(p_period text default 'all', p_limit int default 100)
returns table (rank bigint, user_id uuid, full_name text, avatar_url text,
               points bigint, correct_predictions bigint, total_predictions bigint)
language sql stable security definer set search_path = public as $$
  with scoped as (
    select user_id,
           coalesce(sum(points_awarded) filter (where status = 'won'), 0)::bigint as points,
           count(*) filter (where status = 'won')::bigint as correct,
           count(*) filter (where status in ('won','lost'))::bigint as total
      from predictions
     where p_period = 'all' and status in ('won','lost')
        or (p_period = 'day'  and status in ('won','lost') and settled_at >= date_trunc('day', now()))
        or (p_period = 'week' and status in ('won','lost') and settled_at >= date_trunc('week', now()))
     group by user_id
  )
  select rank() over (order by s.points desc, s.correct desc) as rank,
         s.user_id, pr.full_name, pr.avatar_url, s.points, s.correct, s.total
    from scoped s join profiles pr on pr.id = s.user_id
   order by rank, pr.full_name
   limit least(greatest(p_limit, 1), 500);
$$;

create or replace function public.search_users(p_query text)
returns table (id uuid, full_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select id, full_name, avatar_url
    from profiles
   where id <> auth.uid()
     and char_length(trim(p_query)) >= 2
     and full_name ilike '%' || replace(replace(trim(p_query), '%', ''), '_', '') || '%'
   order by full_name
   limit 20;
$$;

-- friends of the caller (accepted) with their name/avatar
create or replace function public.get_friends()
returns table (friend_id uuid, full_name text, avatar_url text, since timestamptz)
language sql stable security definer set search_path = public as $$
  select pr.id, pr.full_name, pr.avatar_url, f.updated_at
    from friendships f
    join profiles pr on pr.id = case when f.requester_id = auth.uid()
                                     then f.addressee_id else f.requester_id end
   where f.status = 'accepted' and auth.uid() in (f.requester_id, f.addressee_id)
   order by pr.full_name;
$$;

-- =====================================================================
-- Function privileges: internal helpers are not callable by clients
-- =====================================================================
revoke all on function public.place_prediction(uuid, numeric) from public;
revoke all on function public.settle_match(uuid, int, int) from public;
revoke all on function public.void_match(uuid, text) from public;
revoke all on function public.get_leaderboard(text, int) from public;
revoke all on function public.search_users(text) from public;
revoke all on function public.get_friends() from public;
grant execute on function public.place_prediction(uuid, numeric) to authenticated;
grant execute on function public.settle_match(uuid, int, int) to authenticated;  -- is_admin() enforced inside
grant execute on function public.void_match(uuid, text) to authenticated;        -- is_admin() enforced inside
grant execute on function public.get_leaderboard(text, int) to authenticated;
grant execute on function public.search_users(text) to authenticated;
grant execute on function public.get_friends() to authenticated;

-- Supabase grants EXECUTE to anon by default: remove it, and hide internal functions
revoke execute on function public.place_prediction(uuid, numeric), public.settle_match(uuid, int, int),
  public.void_match(uuid, text), public.get_leaderboard(text, int), public.search_users(text),
  public.get_friends() from anon;
revoke execute on function public.handle_new_user(), public.log_odds_change(), public.audit_admin_change(),
  public.set_updated_at(), public.points_for_win(numeric), public.is_winning_outcome(text, text, int, int)
  from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- =====================================================================
-- Realtime: odds, market status and match updates
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.matches;
    alter publication supabase_realtime add table public.markets;
    alter publication supabase_realtime add table public.market_outcomes;
  end if;
end $$;

-- To make yourself an admin (run once in the SQL editor):
--   insert into public.admin_users (user_id) values ('<your-auth-user-uuid>');
