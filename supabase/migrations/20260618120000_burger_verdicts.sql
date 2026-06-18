-- TASK-073 — Hamburger Court verdict + HAMBURGER LIAR / HERETIC consequences
--
-- The MODERATION half of the 🍔 Hamburger Court (TASK-071 shipped the report half:
-- members flag another member's dog as a hamburger, tripping a render-time
-- HAMBURGER ALARM). Here the CURRENT TOP DOG adjudicates a flagged dog and renders
-- a per-dog verdict, with a consequence on each branch:
--   - not_a_hamburger  -> every REPORTER of that dog is branded a HAMBURGER LIAR
--                         (render-time profile banner, decays ~7 days);
--   - confirmed_hamburger -> the dog's OWNER is branded a HAMBURGER HERETIC
--                         (render-time profile banner, PERSISTENT, derived from the
--                         verdict — no separate consequence table).
--
-- Auth model (mirrors the vote RPC, decision #13, and the Top-Dog gate of
-- mustard_sprays, decision #25):
--   - The verdict + LIAR rows are written EXCLUSIVELY through the SECURITY DEFINER
--     RPC `render_burger_verdict` below. There is NO client INSERT/UPDATE/DELETE
--     policy on `burger_verdicts` or `hamburger_liars`. Authenticated members may
--     only SELECT (so the banners/stamps render).
--   - The adjudicating Top Dog is derived from (select auth.uid()) INSIDE the RPC;
--     a client-supplied actor id is never trusted, so a verdict cannot be forged
--     as another member.
--   - The Top-Dog gate is an EXISTS on the non-client-writable `is_current_top_dog`
--     crown column (decision #25). That column is server-maintained
--     (recompute_top_dog, SECURITY DEFINER) and NOT client-writable, which is what
--     makes the gate trustworthy — a member cannot set their own crown to satisfy
--     the check. The gate is enforced at the DB (the RPC), not just the UI.
--   - EXECUTE on the RPC is granted to `authenticated` only (NOT anon — adjudicating
--     requires auth and the crown).
--
-- CONFIRMED-BRANCH RESOLUTION (documented per the AC): a verdict RESOLVES the dog's
-- render-time HAMBURGER ALARM (TASK-071's summarizeBurgerAlarm over burger_alarms).
--   - not_a_hamburger  -> the alarm is considered adjudicated/CLEARED: the render
--                         surfaces suppress the alarm for any dog with a verdict.
--   - confirmed_hamburger -> the alarm CONVERTS to a persistent "CONFIRMED HAMBURGER"
--                         stamp driven by the verdict store (NOT the decaying report
--                         timestamps). The render surfaces read the verdict and show
--                         the persistent stamp instead of the decaying alarm.
-- This is render-time (decision #15): the DB stores the raw verdict + raw report
-- rows; the decayed/cleared/stamped display state is computed at render. We do NOT
-- delete burger_alarms rows on a verdict — keeping them preserves the audit trail
-- and lets the render layer decide; the verdict is the authoritative resolution.
--
-- Gotcha (M0 lesson): schema-qualify all extension-provided functions
-- (extensions.gen_random_uuid()) — the hosted migration role lacks `extensions`
-- in its search_path, so an unqualified reference passes local `db reset` but
-- fails hosted `db push`.

-- ---------------------------------------------------------------------------
-- burger_verdicts — per-dog verdict store (server-maintained, non-client-writable)
-- ---------------------------------------------------------------------------
-- One row per adjudicated dog (UNIQUE hot_dog_id => a dog has at most one verdict;
-- re-ruling UPDATEs the existing row inside the RPC). `decided_by` references the
-- adjudicating Top Dog (profiles, cascades from auth.users). The HERETIC brand is
-- DERIVED from this table (owner has a dog whose verdict = confirmed_hamburger) —
-- no separate consequence table. Persistent: there is no expiry on a verdict.

create table public.burger_verdicts (
  id          uuid        primary key default extensions.gen_random_uuid(),
  hot_dog_id  uuid        not null unique references public.hot_dogs (id) on delete cascade,
  verdict     text        not null check (verdict in ('confirmed_hamburger', 'not_a_hamburger')),
  decided_by  uuid        not null references public.profiles (id) on delete cascade,
  decided_at  timestamptz not null default now()
);

comment on table public.burger_verdicts is
  'One row per adjudicated hot dog (UNIQUE hot_dog_id => at most one verdict; re-ruling '
  'UPDATEs the row inside the RPC). Server-maintained: written EXCLUSIVELY by the '
  'render_burger_verdict SECURITY DEFINER RPC; no client write policy (decision #24/#25 '
  'style — non-client-writable). A confirmed_hamburger verdict brands the dog OWNER a '
  'HAMBURGER HERETIC (derived, persistent); a not_a_hamburger verdict brands the dog''s '
  'REPORTERS HAMBURGER LIARs (see hamburger_liars). Ranking-inert (decision #12): never '
  'touches vote_count/peak_votes/the crown.';
comment on column public.burger_verdicts.hot_dog_id is
  'The adjudicated hot dog. UNIQUE: one verdict per dog (re-ruling re-points this row).';
comment on column public.burger_verdicts.verdict is
  'confirmed_hamburger (it IS a hamburger — brand the owner a HERETIC) or '
  'not_a_hamburger (it is NOT — brand the reporters LIARs). CHECK-constrained.';
comment on column public.burger_verdicts.decided_by is
  'The adjudicating member — must be the current Top Dog at decision time (enforced by '
  'the RPC''s EXISTS gate on the non-client-writable is_current_top_dog). Derived from '
  'auth.uid() inside the RPC, never client-supplied.';
comment on column public.burger_verdicts.decided_at is
  'When the verdict was rendered.';

-- The HERETIC derivation joins hot_dogs -> burger_verdicts on hot_dog_id filtered by
-- verdict; hot_dog_id is already the UNIQUE index. The render surfaces also look up a
-- SET of dog ids' verdicts (for the alarm clear/stamp decision); the UNIQUE index on
-- hot_dog_id supports that read.

-- ---------------------------------------------------------------------------
-- burger_verdicts RLS — SELECT for all authenticated; NO client writes
-- ---------------------------------------------------------------------------
-- Default-deny: enabling RLS with no policy blocks all access. We add only a SELECT
-- policy so the banners/stamps render for everyone. ALL writes go through the RPC —
-- there is intentionally NO INSERT/UPDATE/DELETE policy (mirrors votes, decision #13).
-- Uses the (select auth.uid()) subselect idiom so the planner caches it as an
-- initplan (Supabase RLS perf pattern) — here SELECT is select-all so the idiom is
-- not strictly needed, but the table is read-everywhere.

alter table public.burger_verdicts enable row level security;

-- Read: any authenticated member may view any verdict — verdicts drive public
-- render-time banners/stamps (CONFIRMED HAMBURGER on the dog, HERETIC on the owner).
create policy "burger_verdicts_select_authenticated"
  on public.burger_verdicts
  for select
  to authenticated
  using (true);

-- No INSERT/UPDATE/DELETE policy. Rendering a verdict is performed exclusively by the
-- render_burger_verdict SECURITY DEFINER RPC. Default-deny covers all writes.

-- ---------------------------------------------------------------------------
-- hamburger_liars — LIAR brand store (server-maintained, non-client-writable)
-- ---------------------------------------------------------------------------
-- One row per (reporter, dog) the RPC brands a LIAR when a dog is ruled
-- not_a_hamburger. Cosmetic / many-allowed (decision #12): NO denormalized counter,
-- never touches vote_count/peak_votes/the crown. UNLIKE the cosmetic tables that
-- write through plain owner-scoped RLS (reactions/mustard/walls), this is written
-- ONLY by the RPC (it's a server-imposed consequence, not a self-service toggle), so
-- it gets the votes-style "no client write policy" lockdown — authenticated members
-- may only SELECT (the banner renders on the reporter's profile for everyone).
-- UNIQUE(reporter_id, hot_dog_id) makes the RPC's per-reporter insert idempotent
-- under a re-rule.

create table public.hamburger_liars (
  id          uuid        primary key default extensions.gen_random_uuid(),
  reporter_id uuid        not null references public.profiles (id) on delete cascade,
  hot_dog_id  uuid        not null references public.hot_dogs (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint hamburger_liars_unique unique (reporter_id, hot_dog_id)
);

comment on table public.hamburger_liars is
  'One row per (reporter, dog) brand minted when a dog is ruled not_a_hamburger. '
  'Server-maintained: written EXCLUSIVELY by render_burger_verdict; no client write '
  'policy. Cosmetic / many-allowed (decision #12): NO denormalized counter, '
  'ranking-inert. The LIAR banner on the reporter''s PROFILE decays over ~7 days at '
  'RENDER time from created_at (summarizeLiarBrand, decision #15) — the DB stores only '
  'the raw timestamp.';
comment on column public.hamburger_liars.reporter_id is
  'The branded reporter (a member who reported the dog that was ruled not a hamburger).';
comment on column public.hamburger_liars.hot_dog_id is
  'The dog whose not_a_hamburger verdict produced this brand. UNIQUE with reporter_id '
  'so a re-rule''s re-insert is idempotent.';
comment on column public.hamburger_liars.created_at is
  'When the brand was minted. The RENDER-time LIAR banner decays over ~7 days from this '
  '(summarizeLiarBrand); never store the decayed state.';

-- The render path reads LIAR rows for ONE profile (the reporter) to drive the banner,
-- so an index on reporter_id supports that read. (reporter_id is also the leading
-- column of the UNIQUE constraint, so this index is redundant for equality lookups —
-- kept explicit for clarity / parity with burger_alarms.)
create index hamburger_liars_reporter_id_idx on public.hamburger_liars (reporter_id);

-- ---------------------------------------------------------------------------
-- hamburger_liars RLS — SELECT for all authenticated; NO client writes
-- ---------------------------------------------------------------------------
alter table public.hamburger_liars enable row level security;

-- Read: any authenticated member may view any LIAR brand — the banner is public flair
-- rendered on the branded reporter's profile for everyone (no anonymity here: a LIAR
-- brand is a public consequence, unlike the anonymous report that preceded it).
create policy "hamburger_liars_select_authenticated"
  on public.hamburger_liars
  for select
  to authenticated
  using (true);

-- No INSERT/UPDATE/DELETE policy. LIAR rows are minted exclusively by the RPC.
-- Default-deny covers all writes.

-- ---------------------------------------------------------------------------
-- render_burger_verdict(target_dog, the_verdict) RPC — sole write path
-- ---------------------------------------------------------------------------
-- The current Top Dog rules on a flagged dog. In ONE transaction:
--   - reject if unauthenticated                              (SQLSTATE 28000)
--   - reject if the caller is NOT the current Top Dog         (SQLSTATE 42501)
--   - reject an invalid verdict value                         (SQLSTATE 22023)
--   - reject if the target dog does not exist                 (SQLSTATE P0002)
--   - upsert the per-dog verdict (UNIQUE hot_dog_id => re-rule MOVES the row),
--     stamping decided_by = the adjudicating Top Dog and decided_at = now();
--   - on not_a_hamburger: mint a HAMBURGER LIAR row for EVERY current reporter of
--     the dog (idempotent via ON CONFLICT on the UNIQUE(reporter_id, hot_dog_id));
--   - on confirmed_hamburger: clear any stale LIAR rows for this dog (a re-rule from
--     "not a hamburger" to "confirmed" must not leave the reporters — who were
--     RIGHT — branded liars). The HERETIC brand is DERIVED from the verdict, so no
--     row is minted for it.
-- The verdict actor is derived from (select auth.uid()) INSIDE the function — a
-- client cannot forge a verdict as another member. Returns the verdict row id.
--
-- Error contract (the TS wrapper maps these SQLSTATEs to typed sentinels):
--   28000 -> unauthenticated, 42501 -> not the Top Dog, 22023 -> bad verdict value,
--   P0002 -> no such dog.

create function public.render_burger_verdict(target_dog uuid, the_verdict text)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  dog_exists boolean;
  verdict_id uuid;
begin
  if actor is null then
    raise exception 'must be authenticated to render a verdict'
      using errcode = '28000';
  end if;

  -- Gate: ONLY the current Top Dog may adjudicate. EXISTS on the non-client-writable
  -- is_current_top_dog (decision #25) — a member cannot self-grant the crown to pass
  -- this. This is the DB-authoritative gate (the UI also hides the surface).
  if not exists (
    select 1
      from public.profiles p
     where p.id = actor
       and p.is_current_top_dog
  ) then
    raise exception 'only the current Top Dog may render a verdict'
      using errcode = '42501';
  end if;

  -- Validate the verdict value (defence in depth behind the CHECK constraint, with a
  -- distinct SQLSTATE so the wrapper can give a precise message).
  if the_verdict is null or the_verdict not in ('confirmed_hamburger', 'not_a_hamburger') then
    raise exception 'invalid verdict: %', the_verdict
      using errcode = '22023';
  end if;

  -- Resolve & validate the target dog.
  select true
    into dog_exists
    from public.hot_dogs
   where id = target_dog;

  if dog_exists is null then
    raise exception 'no such hot dog: %', target_dog
      using errcode = 'P0002';
  end if;

  -- Upsert the per-dog verdict (UNIQUE hot_dog_id => re-rule re-points the row).
  insert into public.burger_verdicts (hot_dog_id, verdict, decided_by)
       values (target_dog, the_verdict, actor)
  on conflict (hot_dog_id)
  do update set verdict = excluded.verdict,
                decided_by = excluded.decided_by,
                decided_at = now()
    returning id into verdict_id;

  if the_verdict = 'not_a_hamburger' then
    -- Brand every CURRENT reporter of the dog a HAMBURGER LIAR. Idempotent: a re-rule
    -- re-runs this and ON CONFLICT keeps the original created_at (the brand's clock
    -- does not reset on re-confirmation of the same verdict).
    insert into public.hamburger_liars (reporter_id, hot_dog_id)
    select ba.reporter_id, ba.hot_dog_id
      from public.burger_alarms ba
     where ba.hot_dog_id = target_dog
    on conflict (reporter_id, hot_dog_id) do nothing;
  else
    -- confirmed_hamburger: the reporters were RIGHT. Clear any stale LIAR brands for
    -- this dog (e.g. a re-rule from not_a_hamburger -> confirmed_hamburger must not
    -- leave vindicated reporters branded). The HERETIC brand on the owner is DERIVED
    -- from the verdict row above, so nothing is minted here.
    delete from public.hamburger_liars
     where hot_dog_id = target_dog;
  end if;

  return verdict_id;
end;
$$;

comment on function public.render_burger_verdict(uuid, text) is
  'The current Top Dog rules on a flagged dog. Upserts a per-dog verdict and, on '
  'not_a_hamburger, brands every reporter a HAMBURGER LIAR (idempotent); on '
  'confirmed_hamburger, clears any stale LIAR brands (the HERETIC brand on the owner '
  'is derived from the verdict). Actor derived from auth.uid() (never a client id). '
  'Gated on the non-client-writable is_current_top_dog (decision #25). Rejects '
  'unauthenticated (28000), non-Top-Dog (42501), bad verdict (22023), unknown dog '
  '(P0002). Ranking-inert (decision #12). Sole write path for burger_verdicts + '
  'hamburger_liars.';

-- Adjudicating requires auth AND the crown: strip the implicit public/anon EXECUTE so
-- the grant surface matches the "authenticated only" intent (the RPC also rejects a
-- null auth.uid() with 28000 and a non-Top-Dog with 42501, but the grant is the
-- primary gate). `revoke ... from public` alone is INEFFECTIVE on Supabase (new
-- public functions get explicit anon/authenticated grants), so revoke from all three,
-- then re-grant to authenticated only.
revoke execute on function public.render_burger_verdict(uuid, text) from public, anon, authenticated;
grant execute on function public.render_burger_verdict(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Base Data API grants (decision #28)
-- ---------------------------------------------------------------------------
-- auto_expose_new_tables is pinned false, so these new public tables MUST declare
-- their own base grants — a passing RLS policy is necessary but NOT sufficient for
-- PostgREST (it also needs the base table GRANT). Both tables are written ONLY by the
-- SECURITY DEFINER RPC (which runs as the table owner, bypassing these grants), so
-- the client roles get SELECT only:
--   - authenticated: SELECT only (RLS allows reads; all writes go through the RPC).
--   - service_role: full DML — backs server-side reads and the E2E harness.
--   - anon: NOTHING.
grant select on public.burger_verdicts to authenticated;
grant select, insert, update, delete on public.burger_verdicts to service_role;

grant select on public.hamburger_liars to authenticated;
grant select, insert, update, delete on public.hamburger_liars to service_role;
