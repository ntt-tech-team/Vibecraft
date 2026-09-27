-- ============================================================
--  VibeCraft — Round 1 Trial v2: a proper "not started" state.
--  Run in the Supabase SQL editor AFTER round1.sql. Safe to re-run, and safe while the games are
--  open (it never touches the current window or anyone's stage clears).
--
--  The page tells three "closed" states apart:
--    • never opened (r1_opened_at is null)     → "Waiting for the organisers to begin"
--    • the timer ran out                       → "Time's up!"
--    • the organiser pressed Close early       → "The organisers have closed The Trial"
--  and /admin gets a Reset button that puts The Trial back to "not started" after a test run.
-- ============================================================

alter table public.event_config add column if not exists r1_closed_early boolean not null default false;

-- Same as round1.sql, plus 'closed_early'.
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
    'closed_early', c.r1_closed_early,
    'team', case when t.id is null then null else jsonb_build_object('id', t.id, 'name', t.name) end,
    'clears', case when t.id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('stage', r.stage, 'cleared_at', r.cleared_at, 'elapsed_s', r.elapsed_s) order by r.stage)
      from public.r1_clears r where r.team_id = t.id), '[]'::jsonb) end
  );
end $$;

create or replace function public.admin_r1_open(p_minutes int)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.event_config
     set r1_opened_at = now(),
         r1_open_until = now() + make_interval(mins => greatest(1, least(coalesce(p_minutes, 15), 120))),
         r1_closed_early = false
   where id = 1;
end $$;

create or replace function public.admin_r1_extend(p_minutes int)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.event_config
     set r1_open_until = greatest(coalesce(r1_open_until, now()), now())
                         + make_interval(mins => greatest(1, least(coalesce(p_minutes, 1), 30))),
         r1_closed_early = false
   where id = 1 and r1_opened_at is not null;
end $$;

create or replace function public.admin_r1_close()
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.event_config set r1_open_until = now(), r1_closed_early = true
   where id = 1 and (r1_open_until is null or r1_open_until > now());
end $$;

-- Back to "not started" (after a test run). Saved stage clears are kept.
create or replace function public.admin_r1_reset()
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.event_config set r1_opened_at = null, r1_open_until = null, r1_closed_early = false where id = 1;
end $$;
