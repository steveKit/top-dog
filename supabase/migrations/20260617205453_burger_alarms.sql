-- TASK-071 — Burger alarms (🍔 "that's a hamburger, not a hot dog" report)
--
-- A for-fun moderation flair: a member taps a 🍔 button on ANOTHER member's hot
-- dog to flag it as a hamburger. Enough fresh reports trip a render-time
-- HAMBURGER ALARM (police-tape banners) wherever that dog's image renders.
--
-- This is decision #12 (cosmetic / many-allowed, NO denormalized counter, never
-- touches vote_count/peak_votes/the crown) composed with decision #15 (the alarm
-- state is computed at RENDER time from raw timestamps — see
-- src/lib/features/reports/alarm.ts — the DB stores only the raw report rows,
-- never the decayed alarm state). Because there is no server-maintained counter
-- to protect, this is a PLAIN owner-scoped RLS write, NOT a SECURITY DEFINER RPC
-- (the inverse of the consuming-writes-via-RPC convention; see the CLAUDE.md
-- "Cosmetic / many-allowed tables" gotcha).
--
-- ANONYMITY is the one twist vs. hotdog_reactions: a reporter is ANONYMOUS. The
-- SELECT policy is owner-scoped to the reporter (NOT select-all like reactions),
-- so a member can read only their OWN report rows — no member can ever read who
-- else reported a dog. The per-dog alarm aggregate (how many reports, are they
-- fresh) is read SERVER-SIDE with the service client (getBurgerAlarmCounts) and
-- only the count/timestamps — never reporter ids — are returned to the page.
--
-- This migration is ONLY the report + alarm-display half. The Top-Dog verdict +
-- HAMBURGER LIES consequence is TASK-073 (later); nothing here builds that.
--
-- Gotcha (M0 lesson): schema-qualify all extension-provided functions
-- (extensions.gen_random_uuid()) — the hosted migration role lacks `extensions`
-- in its search_path, so an unqualified reference passes local `db reset` but
-- fails hosted `db push`.

-- ---------------------------------------------------------------------------
-- burger_alarms
-- ---------------------------------------------------------------------------
-- One row per (reporter, dog) report. Both FKs cascade from their parents
-- (profiles cascades from auth.users; hot_dogs cascades from profiles), so
-- deleting a member or a dog removes the dependent reports.
-- UNIQUE(reporter_id, hot_dog_id) gives a single-report-per-member toggle (a
-- member has reported a given dog or not). MANY different members may report the
-- same dog — that "many" is what trips the alarm. NO denormalized counter.

create table public.burger_alarms (
  id          uuid        primary key default extensions.gen_random_uuid(),
  reporter_id uuid        not null references public.profiles (id) on delete cascade,
  hot_dog_id  uuid        not null references public.hot_dogs (id) on delete cascade,
  created_at  timestamptz not null default now(),
  -- Toggle semantics: one report per member per dog (report / retract). Many
  -- DIFFERENT members may report the same dog (decision #12 "many").
  constraint burger_alarms_unique unique (reporter_id, hot_dog_id)
);

comment on table public.burger_alarms is
  'One row per (reporter, dog) "that''s a hamburger" report. UNIQUE(reporter_id, '
  'hot_dog_id) => one report per member per dog (report/retract toggle), many '
  'DIFFERENT members may report the same dog. Flair only: NO denormalized '
  'counter, never affects vote_count/peak_votes/the crown (decision #12). The '
  'alarm state is computed at RENDER time from created_at (summarizeBurgerAlarm, '
  'decision #15). The reporter is ANONYMOUS: SELECT is owner-scoped to the '
  'reporter, so no member can read who else reported; the per-dog aggregate is '
  'read server-side and reporter ids are never returned to the client.';
comment on column public.burger_alarms.reporter_id is
  'The reporting member (public.profiles id). Cascades from auth.users. NEVER '
  'exposed to other members — the SELECT policy is owner-scoped, preserving '
  'reporter anonymity.';
comment on column public.burger_alarms.hot_dog_id is
  'The hot dog being reported as a hamburger.';
comment on column public.burger_alarms.created_at is
  'When the report landed. The RENDER-time alarm auto-quiets 24h after the last '
  'report (summarizeBurgerAlarm); never store the decayed alarm state.';

-- The render path reads reports for a SET of dog ids (getBurgerAlarmCounts), so
-- an index on hot_dog_id supports that read. (reporter_id is already indexed as
-- the leading column of the UNIQUE constraint.)
create index burger_alarms_hot_dog_id_idx on public.burger_alarms (hot_dog_id);

-- ---------------------------------------------------------------------------
-- burger_alarms RLS
-- ---------------------------------------------------------------------------
-- Default-deny: enabling RLS with no policy blocks all access; we add explicit
-- policies. Uses the (select auth.uid()) subselect idiom so the planner caches it
-- as an initplan (Supabase RLS perf pattern). UNLIKE hotdog_reactions, SELECT is
-- owner-scoped (NOT select-all) — that owner-scoped SELECT is precisely what
-- makes the reporter anonymous: a member sees only their own report rows.

alter table public.burger_alarms enable row level security;

-- Read: a member may read ONLY their OWN report rows (drives the viewer's
-- report/retract toggle state). Deliberately NOT a select-all policy — that is
-- what keeps the reporter anonymous (no member can read who else reported). The
-- per-dog alarm aggregate is read server-side with the service client.
create policy "burger_alarms_select_own"
  on public.burger_alarms
  for select
  to authenticated
  using ((select auth.uid()) = reporter_id);

-- Insert: a member may create only their OWN report. Two conjuncts:
--   1. reporter_id is pinned to auth.uid() — a client cannot forge a report as
--      another member.
--   2. a NOT EXISTS check blocks reporting a dog you OWN — you can't report your
--      own hot dog as a hamburger.
create policy "burger_alarms_insert_own"
  on public.burger_alarms
  for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and not exists (
      select 1
      from public.hot_dogs h
      where h.id = hot_dog_id
        and h.owner_id = (select auth.uid())
    )
  );

-- Delete: a member may retract only their own report (the un-report half of the
-- toggle).
create policy "burger_alarms_delete_own"
  on public.burger_alarms
  for delete
  to authenticated
  using ((select auth.uid()) = reporter_id);

-- No UPDATE policy: a report is immutable. Toggling is INSERT (report) /
-- DELETE (retract). Default-deny covers UPDATE.

-- ---------------------------------------------------------------------------
-- burger_alarms base Data API grants (decision #28)
-- ---------------------------------------------------------------------------
-- auto_expose_new_tables is pinned false, so this new public table MUST declare
-- its own base grants — a passing RLS policy is necessary but NOT sufficient for
-- PostgREST (it also needs the base table GRANT). This is a cosmetic table with
-- NO denormalized counter, so there is no decision #24/#25 column lockdown to
-- preserve; INSERT is column-scoped to just the columns the app supplies
-- (reporter_id, hot_dog_id) for tidiness — id/created_at fall to DEFAULTs.
--
--   - authenticated: SELECT (RLS still gates to own rows), column-scoped INSERT,
--     row-level DELETE (the retract half of the toggle).
--   - service_role: full DML — backs getBurgerAlarmCounts' anonymous server-side
--     aggregate read and the E2E harness. (BYPASSRLS by design.)
--   - anon: NOTHING.

grant select on public.burger_alarms to authenticated;
grant insert (reporter_id, hot_dog_id) on public.burger_alarms to authenticated;
grant delete on public.burger_alarms to authenticated;
grant select, insert, update, delete on public.burger_alarms to service_role;
