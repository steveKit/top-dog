-- TASK-022 — Daily Top Dog tally: top_dog_days table + idempotent tally RPC
--
-- Realizes decision #14: "days as Top Dog" is counted as ONE row per calendar
-- day the crown is held. Multiple reigns on the same calendar day collapse to a
-- single day — enforced by UNIQUE(profile_id, day). The keep-alive workflow
-- calls tally_top_dog_day() once daily; the function is idempotent, so a second
-- call the same day (or an early workflow_dispatch) records nothing new.
--
-- Why SQL: same transactional-integrity rationale as the TASK-021 vote RPC. The
-- tally must atomically (a) record today for the current crown-holder and
-- (b) recompute that holder's profiles.days_as_top_dog from the authoritative
-- COUNT(top_dog_days) — never a blind increment, so re-runs can't drift the
-- counter. days_as_top_dog is in the column-grant-EXCLUDED (non-client-writable)
-- set from TASK-021; this SECURITY DEFINER function runs as the table owner and
-- bypasses those column grants, exactly like recompute_top_dog().
--
-- Gotcha (M0 lesson): schema-qualify all extension-provided functions/types
-- (extensions.gen_random_uuid()) — the hosted migration role lacks `extensions`
-- in its search_path, so an unqualified reference passes local `db reset` but
-- fails hosted `db push`.

-- ---------------------------------------------------------------------------
-- top_dog_days
-- ---------------------------------------------------------------------------
-- One row per (profile, calendar day held). UNIQUE(profile_id, day) is the
-- invariant that makes "multiple reigns same calendar day = one day" true at
-- the DB level (decision #14): the tally insert uses ON CONFLICT DO NOTHING
-- against this constraint. profile_id cascades from public.profiles (which
-- cascades from auth.users), so deleting a user removes their tally history.

create table public.top_dog_days (
  id          uuid  primary key default extensions.gen_random_uuid(),
  profile_id  uuid  not null references public.profiles (id) on delete cascade,
  day         date  not null,
  unique (profile_id, day)
);

comment on table public.top_dog_days is
  'One row per (profile, calendar day) the Top Dog crown was held. '
  'UNIQUE(profile_id, day) enforces "multiple reigns the same calendar day count '
  'as one day" (decision #14). Written exclusively by the SECURITY DEFINER '
  'tally_top_dog_day() RPC; no client write path — authenticated may only SELECT.';
comment on column public.top_dog_days.profile_id is
  'The crown-holder (public.profiles id) credited with this day.';
comment on column public.top_dog_days.day is
  'The calendar day (DATE) the crown was held — one row per held day.';

-- ---------------------------------------------------------------------------
-- top_dog_days RLS
-- ---------------------------------------------------------------------------
-- Default-deny: enabling RLS with no policy blocks all access. We add only a
-- SELECT policy for authenticated members (so the count / reign history can be
-- displayed). ALL writes go through tally_top_dog_day() — there is intentionally
-- NO INSERT/UPDATE/DELETE policy or grant, mirroring votes/invites.

alter table public.top_dog_days enable row level security;

-- Read: any authenticated member may view the tally history.
create policy "top_dog_days_select_authenticated"
  on public.top_dog_days
  for select
  to authenticated
  using (true);

-- No INSERT/UPDATE/DELETE policy. Recording a held day is performed exclusively
-- by the SECURITY DEFINER tally_top_dog_day() RPC. Default-deny covers all writes.

-- ---------------------------------------------------------------------------
-- tally_top_dog_day() RPC — record today for the current Top Dog (idempotent)
-- ---------------------------------------------------------------------------
-- Records the CURRENT calendar day for the current crown-holder and recomputes
-- their profiles.days_as_top_dog. Designed to be run once daily by the keep-alive
-- workflow, but is fully idempotent and safe to run repeatedly / early:
--   - No current Top Dog (cold state / no eligible dog) -> no-op, returns cleanly
--     (no error). The keep-alive ping still keeps the DB warm.
--   - Insert is ON CONFLICT (profile_id, day) DO NOTHING, so a second call the
--     same day records nothing — "multiple reigns same day = one day" (decision
--     #14).
--   - days_as_top_dog is recomputed from COUNT(top_dog_days) (authoritative, not
--     a blind increment) so re-runs never drift the counter.
--
-- SECURITY DEFINER + search_path='' so it can write days_as_top_dog, which is
-- non-client-writable (TASK-021 column grants exclude it). The function runs as
-- the table owner and bypasses those column grants, exactly like
-- recompute_top_dog(). Returns the tallied profile_id, or NULL when there is no
-- current Top Dog.

create function public.tally_top_dog_day()
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  holder uuid;
begin
  -- The current Top Dog is the global singleton profiles.is_current_top_dog.
  select id
    into holder
    from public.profiles
   where is_current_top_dog
   limit 1;

  if holder is null then
    -- No crown held (cold state / no eligible dog). Nothing to record.
    return null;
  end if;

  -- Idempotent same-day insert: a second call today does nothing.
  insert into public.top_dog_days (profile_id, day)
       values (holder, current_date)
  on conflict (profile_id, day) do nothing;

  -- Authoritative recompute (not a blind increment -> re-runs can't drift).
  update public.profiles
     set days_as_top_dog = (
       select count(*)
         from public.top_dog_days
        where profile_id = holder
     )
   where id = holder;

  return holder;
end;
$$;

comment on function public.tally_top_dog_day() is
  'Records the current calendar day for the current Top Dog (profiles.'
  'is_current_top_dog) and recomputes their profiles.days_as_top_dog from '
  'COUNT(top_dog_days). Idempotent (ON CONFLICT (profile_id, day) DO NOTHING + '
  'authoritative recompute): safe to run repeatedly the same day, and a no-op '
  'when there is no current Top Dog. Realizes decision #14 (one row per held '
  'calendar day). Called daily by the keep-alive workflow. Returns the tallied '
  'profile_id, or NULL when no crown is held.';

-- EXECUTE grant (decision A1 — anon-callable, no new secret): the keep-alive
-- workflow calls this RPC with the existing publishable (anon) key, so anon and
-- authenticated may execute it. This is safe because the RPC takes NO caller
-- input and only ever records the ACTUAL current Top Dog's today — repeated or
-- early calls are idempotent and self-limiting; a caller cannot forge a day for
-- an arbitrary profile. Keep the grant explicit (anon + authenticated only): as
-- with the vote RPCs, `revoke ... from public` alone is INEFFECTIVE on Supabase
-- (new public functions get an explicit anon/authenticated grant that a
-- PUBLIC-only revoke does not strip), so we revoke from public first, then grant
-- the two intended roles.
revoke execute on function public.tally_top_dog_day() from public;
grant execute on function public.tally_top_dog_day() to anon, authenticated;
