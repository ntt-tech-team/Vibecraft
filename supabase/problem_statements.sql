-- ============================================================
--  VibeCraft — the problem statements in the Quest Book (Round 1 + Round 2).
--  Run in the Supabase SQL editor AFTER schema.sql (the Round 2 access code) and round1.sql
--  (event_config). Safe to re-run. Then run supabase/private/ps_content.sql for the text.
--
--  Access model:
--    • The text is secret: nobody can read ps_content directly (RLS on, no policies).
--    • Round 1: Phase 1 is public (it ships in the site). ps_round1() hands out Phase 2 only
--      once the organiser has pressed Reveal in /admin.
--    • Round 2: ps_round2(code) checks the hall code first, then returns the brief and Phase 1,
--      and Phase 2 only once the organiser has pressed Reveal.
--    • The organiser flips the switches with admin_ps_reveal() from /admin.
-- ============================================================

alter table public.event_config add column if not exists r1_p2_revealed boolean not null default false;
alter table public.event_config add column if not exists r2_p2_revealed boolean not null default false;

create table if not exists public.ps_content (
  round   int  not null check (round in (1, 2)),
  part    text not null check (part in ('brief', 'phase1', 'phase2')),
  content jsonb not null,   -- { title, intro, items: [{ label?, text }] } or, for 'brief', { title, scenario, challenge }
  primary key (round, part)
);
alter table public.ps_content enable row level security;
-- No SELECT policy → the anon key can never read the text directly.

-- ---------- participants ----------------------------------------------------------
-- Round 1: { revealed, phase2 } — phase2 is null until the organiser reveals it.
create or replace function public.ps_round1()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'revealed', c.r1_p2_revealed,
    'phase2', case when c.r1_p2_revealed
                then (select p.content from public.ps_content p where p.round = 1 and p.part = 'phase2') end)
  from public.event_config c
  where c.id = 1;
$$;

-- Round 2: { ok:false } for a wrong code, else { ok, brief, phase1, revealed, phase2 }.
create or replace function public.ps_round2(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case
    when not exists (
      select 1 from public.round2 r
      where r.id = 1 and upper(trim(p_code)) = upper(trim(r.access_code))
    ) then jsonb_build_object('ok', false)
    else jsonb_build_object(
      'ok', true,
      'brief',  (select p.content from public.ps_content p where p.round = 2 and p.part = 'brief'),
      'phase1', (select p.content from public.ps_content p where p.round = 2 and p.part = 'phase1'),
      'revealed', c.r2_p2_revealed,
      'phase2', case when c.r2_p2_revealed
                  then (select p.content from public.ps_content p where p.round = 2 and p.part = 'phase2') end)
  end
  from public.event_config c
  where c.id = 1;
$$;

revoke all on function public.ps_round1() from public;
revoke all on function public.ps_round2(text) from public;
grant execute on function public.ps_round1() to anon, authenticated;
grant execute on function public.ps_round2(text) to anon, authenticated;

-- ---------- organiser (/admin) ----------------------------------------------------
create or replace function public.admin_ps_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'r1_p2_revealed', c.r1_p2_revealed,
      'r2_p2_revealed', c.r2_p2_revealed,
      'loaded', coalesce((select jsonb_agg(p.round || ':' || p.part order by p.round, p.part) from public.ps_content p), '[]'::jsonb),
      'r2_code_set', exists (select 1 from public.round2 r where r.id = 1 and r.access_code <> 'CHANGE-ME-BEFORE-EVENT'))
    from public.event_config c
    where c.id = 1
  );
end $$;

create or replace function public.admin_ps_reveal(p_round int, p_revealed boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_round = 1 then
    update public.event_config set r1_p2_revealed = coalesce(p_revealed, false) where id = 1;
  elsif p_round = 2 then
    update public.event_config set r2_p2_revealed = coalesce(p_revealed, false) where id = 1;
  else
    raise exception 'unknown round %', p_round;
  end if;
end $$;
