-- ============================================================
--  VibeCraft — Round 1 Technical Task ("The Trial": three games) + the team registration switch.
--  Run in the Supabase SQL editor AFTER dragon.sql and dragon_v2.sql. Safe to re-run, and safe
--  for the live site (registration stays open by default, so the Dragon behaves as before).
--
--  Access model (same as the Dragon):
--    • Participants never touch these tables. /api/round1 calls the r1_* functions with the
--      server secret (DRAGON_SECRET); each one checks that secret first.
--    • The organiser uses the admin_* functions from /admin.
--  Team setup (name → team key) still goes through /api/dragon, so one key works all day.
-- ============================================================

-- ---------- tables -------------------------------------------------------------
create table if not exists public.event_config (
  id                int primary key default 1 check (id = 1),
  registration_open boolean not null default true,
  r1_opened_at      timestamptz,   -- when the organiser last pressed Open; "time taken" counts from here
  r1_open_until     timestamptz,   -- the games stop counting at this moment
  updated_at        timestamptz not null default now()
);
insert into public.event_config (id) values (1) on conflict (id) do nothing;
alter table public.event_config enable row level security;

drop trigger if exists event_config_touch on public.event_config;
create trigger event_config_touch before update on public.event_config
  for each row execute function public.touch_updated_at();

-- One row per team per stage. A team earns its 1 advantage point with stage 3.
create table if not exists public.r1_clears (
  team_id    bigint not null references public.teams (id) on delete cascade,
  stage      int not null check (stage between 1 and 3),
  cleared_at timestamptz not null default now(),
  elapsed_s  int not null,         -- seconds from r1_opened_at to this clear
  primary key (team_id, stage)
);
alter table public.r1_clears enable row level security;

-- ---------- team setup now respects the registration switch -------------------
-- Same as dragon.sql, plus the 'registration_closed' check.
create or replace function public.dragon_team_setup(p_secret text, p_name text, p_key text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name     text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_name_key text;
  v_id       bigint;
begin
  perform public.dragon_check_server(p_secret);
  if not coalesce((select registration_open from public.event_config where id = 1), true) then
    raise exception 'registration_closed';
  end if;
  v_name_key := regexp_replace(lower(v_name), '[^a-z0-9]', '', 'g');
  if char_length(v_name) not between 2 and 40 or char_length(v_name_key) < 2 then
    raise exception 'bad_name';
  end if;
  if exists (select 1 from public.teams where name_key = v_name_key) then
    raise exception 'name_taken';
  end if;
  if (select count(*) from public.teams) >= 400 then
    raise exception 'team_limit';
  end if;
  insert into public.teams (name, name_key, key_hash)
  values (v_name, v_name_key, public.team_key_hash(p_key))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'name', v_name);
exception
  when unique_violation then raise exception 'name_taken';
end $$;

-- ---------- server functions (called by /api/round1 with the server secret) ---
-- Page state: the game window, the registration switch, and the team's cleared stages.
create or replace function public.r1_status(p_secret text, p_key text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  c public.event_config;
  t public.teams;
begin
  perform public.dragon_check_server(p_secret);
  select * into c from public.event_config where id = 1;
  select * into t from public.teams where key_hash = public.team_key_hash(p_key);
  return jsonb_build_object(
    'now', now(),
    'registration_open', c.registration_open,
    'opened_at', c.r1_opened_at,
    'open_until', c.r1_open_until,
    'team', case when t.id is null then null else jsonb_build_object('id', t.id, 'name', t.name) end,
    'clears', case when t.id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('stage', r.stage, 'cleared_at', r.cleared_at, 'elapsed_s', r.elapsed_s) order by r.stage)
      from public.r1_clears r where r.team_id = t.id), '[]'::jsonb) end
  );
end $$;

-- Record a stage clear. Returns {ok:false, reason} or {ok:true, ...r1_status}.
create or replace function public.r1_clear(p_secret text, p_key text, p_stage int)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  c         public.event_config;
  t         public.teams;
  v_elapsed int;
begin
  perform public.dragon_check_server(p_secret);
  select * into c from public.event_config where id = 1;
  -- lock the team row so two teammates' laptops clearing at once can't race
  select * into t from public.teams where key_hash = public.team_key_hash(p_key) for update;
  if t.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_team');
  end if;
  if p_stage is null or p_stage not between 1 and 3 then
    return jsonb_build_object('ok', false, 'reason', 'bad_stage');
  end if;
  if exists (select 1 from public.r1_clears where team_id = t.id and stage = p_stage) then
    return jsonb_build_object('ok', true) || public.r1_status(p_secret, p_key);
  end if;
  if c.r1_opened_at is null or c.r1_open_until is null or now() >= c.r1_open_until then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  if p_stage > 1 and not exists (select 1 from public.r1_clears where team_id = t.id and stage = p_stage - 1) then
    return jsonb_build_object('ok', false, 'reason', 'locked');
  end if;
  v_elapsed := floor(extract(epoch from (now() - c.r1_opened_at)))::int;
  -- sanity check: nobody honestly clears stage N within N×8 seconds of the start
  if v_elapsed < p_stage * 8 then
    return jsonb_build_object('ok', false, 'reason', 'too_fast');
  end if;
  insert into public.r1_clears (team_id, stage, elapsed_s) values (t.id, p_stage, v_elapsed)
  on conflict (team_id, stage) do nothing;
  return jsonb_build_object('ok', true) || public.r1_status(p_secret, p_key);
end $$;

-- ---------- organiser functions (/admin, signed in as the organiser) ----------
-- Everything the Round 1 panel shows, including every team's points so far.
create or replace function public.admin_r1_overview()
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'now', now(),
    'config', (select to_jsonb(c) from public.event_config c where c.id = 1),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'created_at', t.created_at,
        'clears', coalesce((
          select jsonb_agg(jsonb_build_object('stage', r.stage, 'cleared_at', r.cleared_at, 'elapsed_s', r.elapsed_s) order by r.stage)
          from public.r1_clears r where r.team_id = t.id), '[]'::jsonb),
        'dragon_points', coalesce((
          select sum(l.points) from public.dragon_clears d
          join public.dragon_levels l on l.level = d.level where d.team_id = t.id), 0)
      ) order by t.name_key)
      from public.teams t), '[]'::jsonb)
  );
end $$;

-- Open the games for p_minutes. Restarts the clock that "time taken" counts from.
create or replace function public.admin_r1_open(p_minutes int)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.event_config
     set r1_opened_at = now(),
         r1_open_until = now() + make_interval(mins => greatest(1, least(coalesce(p_minutes, 15), 120)))
   where id = 1;
end $$;

-- Add minutes without restarting the clock (also re-opens a window that just closed).
create or replace function public.admin_r1_extend(p_minutes int)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.event_config
     set r1_open_until = greatest(coalesce(r1_open_until, now()), now())
                         + make_interval(mins => greatest(1, least(coalesce(p_minutes, 1), 30)))
   where id = 1 and r1_opened_at is not null;
end $$;

create or replace function public.admin_r1_close()
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.event_config set r1_open_until = now()
   where id = 1 and (r1_open_until is null or r1_open_until > now());
end $$;

create or replace function public.admin_set_registration(p_open boolean)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.event_config set registration_open = coalesce(p_open, true) where id = 1;
end $$;
