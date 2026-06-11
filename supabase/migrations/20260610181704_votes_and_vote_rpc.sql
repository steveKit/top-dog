-- TASK-021 — Votes: table + RLS + transactional vote RPC (move-vote + counter + crown)
--
-- The competitive write at the heart of Top Dog (decision #13). A member casts a
-- single active vote for someone else's hot dog; the same primitive MOVES that
-- vote when re-cast at a different dog, or REMOVES it. Each cast/move/remove
-- recomputes the affected dogs' denormalized `hot_dogs.vote_count`, bumps
-- `hot_dogs.peak_votes`, and re-derives the Top Dog crown — all in ONE
-- transaction (CLAUDE.md: "competitive writes go through a single-transaction
-- RPC; never multi-step client writes").
--
-- Auth model:
--   - Votes are written EXCLUSIVELY through the SECURITY DEFINER RPCs below.
--     There is NO client INSERT/UPDATE/DELETE policy on `votes` (mirrors the
--     invites pattern). Authenticated members may only SELECT.
--   - The voter identity is derived from (select auth.uid()) INSIDE the function;
--     a client-supplied voter id is never trusted, so a vote cannot be forged as
--     another user.
--   - EXECUTE on the RPCs is granted to `authenticated` only — voting requires
--     auth (NOT anon, unlike redeem_invite which serves pre-auth sign-up).
--
-- Where each invariant is enforced (defence in depth):
--   - one active vote per user .. `UNIQUE(voter_id)` constraint (DB-authoritative)
--                                 + the cast RPC's upsert-by-voter logic.
--   - no self-vote ............... primarily the RPC's owner==voter guard; ALSO a
--                                 row-level guard so even a hypothetical direct
--                                 write path cannot self-vote — see votes_no_self_vote.
--   - vote_count consistency ..... recomputed from COUNT(votes) for the affected
--                                 dogs inside the txn (no blind increment → no
--                                 drift under concurrency). vote_count stays
--                                 non-client-writable (TASK-013 column grants;
--                                 the SECURITY DEFINER RPC is the only writer).
--
-- Gotcha (M0 lesson): schema-qualify all extension-provided functions/types
-- (extensions.gen_random_uuid()) — the hosted migration role lacks `extensions`
-- in its search_path, so an unqualified reference passes local `db reset` but
-- fails hosted `db push`.

-- ---------------------------------------------------------------------------
-- votes
-- ---------------------------------------------------------------------------
-- One row per active vote. `UNIQUE(voter_id)` enforces "at most one active vote
-- per user" at the DB level — this is what turns a re-cast into a MOVE (the RPC
-- re-points the existing row rather than inserting a second). `voter_id` and
-- `hot_dog_id` reference public.profiles / public.hot_dogs, which both cascade
-- from auth.users, so deleting a user (or a dog) removes the dependent votes.

create table public.votes (
  id          uuid        primary key default extensions.gen_random_uuid(),
  voter_id    uuid        not null unique references public.profiles (id) on delete cascade,
  hot_dog_id  uuid        not null references public.hot_dogs (id) on delete cascade,
  created_at  timestamptz not null default now()
);

comment on table public.votes is
  'One row per active vote (UNIQUE voter_id => at most one active vote per user). '
  'Written exclusively by the SECURITY DEFINER vote RPCs; no client write policy. '
  'Decision #13.';
comment on column public.votes.voter_id is
  'The voting member (public.profiles id). UNIQUE: a member has at most one '
  'active vote — re-casting MOVES it (cast_vote re-points this row).';
comment on column public.votes.hot_dog_id is
  'The hot dog the vote is currently cast for.';

-- The vote RPC recomputes vote_count as COUNT(votes) grouped by hot_dog_id, and
-- removing/moving a vote needs to find the dog the voter was previously on; an
-- index on hot_dog_id supports both. (voter_id is already indexed by the UNIQUE
-- constraint.)
create index votes_hot_dog_id_idx on public.votes (hot_dog_id);

-- ---------------------------------------------------------------------------
-- votes RLS
-- ---------------------------------------------------------------------------
-- Default-deny: enabling RLS with no policy blocks all access. We add only a
-- SELECT policy for authenticated members (so the UI can show who voted / vote
-- state). ALL writes go through the RPCs below — there is intentionally NO
-- INSERT/UPDATE/DELETE policy, exactly like invites. Uses the (select auth.uid())
-- subselect idiom so the planner caches it as an initplan (Supabase RLS perf
-- pattern).

alter table public.votes enable row level security;

-- Read: any authenticated member may view votes.
create policy "votes_select_authenticated"
  on public.votes
  for select
  to authenticated
  using (true);

-- No INSERT/UPDATE/DELETE policy. Casting/moving/removing a vote is performed
-- exclusively by the SECURITY DEFINER RPCs below. Default-deny covers all writes.

-- ---------------------------------------------------------------------------
-- Row-level self-vote guard (defence in depth)
-- ---------------------------------------------------------------------------
-- The cast RPC already rejects a self-vote (owner == voter) and is the only
-- supported write path. This trigger-backed guard is a SECOND, row-level barrier
-- so even a hypothetical direct write (e.g. a future mis-grant, or a privileged
-- bug) cannot create a self-vote. It can't be a table CHECK because the relation
-- between voter_id and the dog's owner_id requires a lookup into hot_dogs.

create function public.votes_reject_self_vote()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if exists (
    select 1
      from public.hot_dogs hd
     where hd.id = new.hot_dog_id
       and hd.owner_id = new.voter_id
  ) then
    raise exception 'a user may not vote for their own hot dog'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function public.votes_reject_self_vote() is
  'Row-level guard: rejects any INSERT/UPDATE that would make a vote point at the '
  'voter''s own hot dog. Defence in depth behind the cast_vote RPC self-vote check.';

create trigger votes_no_self_vote
  before insert or update on public.votes
  for each row
  execute function public.votes_reject_self_vote();

-- ---------------------------------------------------------------------------
-- recompute_top_dog() — crown recompute (private helper)
-- ---------------------------------------------------------------------------
-- Re-derives the Top Dog crown from current vote_count + the CURRENT
-- profiles.top_dog_since values, and maintains profiles.is_current_top_dog /
-- profiles.top_dog_since. Called inside the vote RPCs (same transaction).
--
-- *** CROWN LOCKSTEP — this MUST mirror selectTopDog() in
--     src/lib/features/voting/ranking.ts. The three ordering rules are: ***
--   1. Eligibility: only dogs with vote_count >= 1 are crownable.
--   2. Order among eligible dogs:
--        vote_count          DESC   (strictly-highest vote count wins)
--        top_dog_since       ASC NULLS LAST
--                                   (sticky: earliest current crown-holder wins
--                                    the tie; a never-crowned owner's NULL sorts
--                                    LAST, so it loses to any real timestamp)
--        hot_dogs.id         ASC    (lexicographic — final deterministic tie-break)
--   3. The crown follows the winning DOG's owner_id; top_dog_since is the OWNER's
--      value (join hot_dogs -> profiles on owner_id) — which is why we ORDER BY
--      p.top_dog_since, not anything on the dog.
--
-- selectTopDog() uses the EXISTING top_dog_since to PICK the winner (it does not
-- recompute it first), so this query reads the current profiles.top_dog_since to
-- order, then only AFTER picking decides whether the crown changed hands.
--
-- Stickiness rule (matches the comparator's "earliest topDogSince wins"):
--   - no eligible dog            -> clear the crown from any current holder.
--   - winner's owner == current  -> sticky: change NOTHING (preserve top_dog_since).
--   - winner's owner != current  -> hand off: new holder gets is_current_top_dog =
--                                   true, top_dog_since = now(); previous holder is
--                                   cleared (false, NULL). Setting a fresh now()
--                                   only on a NEW reign is what makes the SQL
--                                   stickiness match selectTopDog's comparator.

create function public.recompute_top_dog()
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  winner_owner uuid;
  current_holder uuid;
begin
  -- Step 1: pick the winning dog's owner using the EXACT selectTopDog ordering,
  -- reading the CURRENT profiles.top_dog_since to break ties (sticky).
  select hd.owner_id
    into winner_owner
    from public.hot_dogs hd
    join public.profiles p on p.id = hd.owner_id
   where hd.vote_count >= 1
   order by hd.vote_count desc,
            p.top_dog_since asc nulls last,
            hd.id asc
   limit 1;

  -- Current crown holder (at most one; the table allows several but this logic
  -- keeps it to one — defensively clear all non-winners below).
  select id
    into current_holder
    from public.profiles
   where is_current_top_dog
   limit 1;

  if winner_owner is null then
    -- Step 2: no eligible dog -> no Top Dog. Clear any current holder(s).
    update public.profiles
       set is_current_top_dog = false,
           top_dog_since = null
     where is_current_top_dog;
    return;
  end if;

  if current_holder is not null and current_holder = winner_owner then
    -- Step 3: same owner retains the crown -> sticky, change nothing. (Still
    -- defensively clear any OTHER stray holders so exactly one row is crowned.)
    update public.profiles
       set is_current_top_dog = false,
           top_dog_since = null
     where is_current_top_dog
       and id <> winner_owner;
    return;
  end if;

  -- Step 4: crown changes hands. Clear every previous holder, then crown the new
  -- owner with a fresh now() (a NEW reign starts now — this is what makes SQL
  -- stickiness match the comparator).
  update public.profiles
     set is_current_top_dog = false,
         top_dog_since = null
   where is_current_top_dog
     and id <> winner_owner;

  update public.profiles
     set is_current_top_dog = true,
         top_dog_since = now()
   where id = winner_owner;
end;
$$;

comment on function public.recompute_top_dog() is
  'Re-derives the Top Dog crown and maintains profiles.is_current_top_dog / '
  'top_dog_since. MIRRORS selectTopDog() in src/lib/features/voting/ranking.ts: '
  'eligibility vote_count >= 1; order vote_count DESC, top_dog_since ASC NULLS '
  'LAST (sticky), hot_dogs.id ASC; sticky reign keeps its top_dog_since, a new '
  'reign gets a fresh now(). Private helper — called inside the vote RPCs.';

-- recompute_top_dog is an internal helper; clients never call it directly. Revoke
-- the implicit PUBLIC execute grant so only the vote RPCs (which run as the
-- function owner under SECURITY DEFINER) reach it. `revoke ... from public` alone
-- is INEFFECTIVE on Supabase: new public functions get an EXPLICIT execute grant
-- to `anon` and `authenticated`, which a PUBLIC-only revoke does not strip — so we
-- revoke from all three roles. The vote RPCs still reach it under SECURITY DEFINER
-- as the function owner, which is not subject to these grants.
revoke execute on function public.recompute_top_dog() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Column-level privileges on public.profiles: crown columns are NOT client-writable
-- ---------------------------------------------------------------------------
-- Decision #24 pattern (mirrors hot_dogs vote_count/peak_votes; see
-- 20260609181013_hot_dogs.sql). The `profiles` table got RLS row policies but
-- never column-level write grants, so an authenticated user could forge crown
-- state via a plain PostgREST UPDATE (is_current_top_dog / top_dog_since /
-- days_as_top_dog are all server-maintained and must be unreachable from the
-- client). RLS gates WHICH ROWS a user may touch; column privileges gate WHICH
-- COLUMNS — both are needed.
--
-- We revoke table-wide INSERT and UPDATE from `authenticated`, then re-grant ONLY
-- the columns the app legitimately writes from the client:
--   - INSERT: id, handle, display_name, avatar_path  (createProfile in
--     src/lib/features/profiles/profiles.ts supplies exactly these). `id` stays
--     insertable because it IS the auth.uid the row keys on (the insert RLS policy
--     pins auth.uid() = id). Omitted columns fall to their DEFAULTs: joined_at =>
--     now(), days_as_top_dog => 0, is_current_top_dog => false, top_dog_since =>
--     NULL — so a direct PostgREST insert can't forge an opening crown.
--   - UPDATE: handle, display_name, avatar_path  (the safe profile-edit surface;
--     a future handle/display-name/avatar edit path writes only these). `id` is
--     intentionally NOT updatable, and the crown columns are excluded so a client
--     UPDATE can never set them.
--
-- The crown columns days_as_top_dog / is_current_top_dog / top_dog_since are
-- excluded from BOTH grants: recompute_top_dog() (above) and the keep-alive tally
-- maintain them, running as the table owner (SECURITY DEFINER), which bypasses
-- these column grants. Restricting only UPDATE would leave the INSERT path open,
-- so both are column-restricted — exactly the decision #24 insert+update pair.
revoke insert on public.profiles from authenticated;
grant insert (id, handle, display_name, avatar_path) on public.profiles to authenticated;

revoke update on public.profiles from authenticated;
grant update (handle, display_name, avatar_path) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- recompute_vote_count(dog) — authoritative counter recompute (private helper)
-- ---------------------------------------------------------------------------
-- Recomputes hot_dogs.vote_count for ONE dog from COUNT(votes) (no blind
-- increment → no drift under concurrent votes) and bumps peak_votes when the
-- fresh count exceeds the stored peak. No-ops when dog_id is null (the "no
-- previous dog" case on a first-time cast). SECURITY DEFINER so it can write the
-- counters that are NOT client-writable (TASK-013 column grants).

create function public.recompute_vote_count(dog_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  fresh_count integer;
begin
  if dog_id is null then
    return;
  end if;

  select count(*)::integer
    into fresh_count
    from public.votes
   where hot_dog_id = dog_id;

  update public.hot_dogs
     set vote_count = fresh_count,
         peak_votes = greatest(peak_votes, fresh_count)
   where id = dog_id;
end;
$$;

comment on function public.recompute_vote_count(uuid) is
  'Recomputes hot_dogs.vote_count for one dog from COUNT(votes) (authoritative, '
  'drift-free under concurrency) and bumps peak_votes. Private helper — called '
  'inside the vote RPCs.';

-- As with recompute_top_dog: `revoke ... from public` does not strip the explicit
-- anon/authenticated grants Supabase adds to new public functions, so revoke from
-- all three. The vote RPCs reach it under SECURITY DEFINER as the owner.
revoke execute on function public.recompute_vote_count(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- cast_vote(target_dog) RPC — cast OR move a vote
-- ---------------------------------------------------------------------------
-- Casts the caller's vote for target_dog, or MOVES an existing vote there. The
-- voter is derived from (select auth.uid()) INSIDE the function — a client cannot
-- forge a vote as another user. One transaction:
--   - reject if unauthenticated                          (SQLSTATE 28000)
--   - reject if the target dog does not exist            (SQLSTATE P0002 no_data_found)
--   - reject if the target dog's owner == voter (self)   (SQLSTATE 23514 via trigger,
--                                                         pre-checked here for a
--                                                         clean error)
--   - upsert-by-voter: because of UNIQUE(voter_id), casting when a vote already
--     exists MOVES it (re-points the existing row). We capture the PREVIOUS dog
--     so its count can be recomputed too.
--   - recompute vote_count for both old & new dogs, then recompute the crown.
-- Returns the new/updated vote id.
--
-- Error contract (the TS wrapper maps these SQLSTATEs to typed sentinels):
--   28000 -> unauthenticated, 23514 -> self-vote, P0002 -> no such dog.

create function public.cast_vote(target_dog uuid)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  voter uuid := (select auth.uid());
  dog_owner uuid;
  previous_dog uuid;
  vote_id uuid;
begin
  if voter is null then
    raise exception 'must be authenticated to vote'
      using errcode = '28000';
  end if;

  -- Resolve & validate the target dog. Lock nothing extra; the recompute reads
  -- COUNT(votes) authoritatively.
  select owner_id
    into dog_owner
    from public.hot_dogs
   where id = target_dog;

  if dog_owner is null then
    raise exception 'no such hot dog: %', target_dog
      using errcode = 'P0002';
  end if;

  if dog_owner = voter then
    -- Pre-check for a clean, specific error (the row-level trigger would also
    -- reject this with 23514, but raising here keeps the message precise).
    raise exception 'a user may not vote for their own hot dog'
      using errcode = '23514';
  end if;

  -- Find the voter's CURRENT dog (if any) before re-pointing, so its count is
  -- recomputed after a move.
  select hot_dog_id
    into previous_dog
    from public.votes
   where voter_id = voter;

  -- Idempotent / no-op move: already voting for this exact dog. Nothing to
  -- recompute; return the existing vote id.
  if previous_dog is not null and previous_dog = target_dog then
    select id into vote_id from public.votes where voter_id = voter;
    return vote_id;
  end if;

  -- Upsert by voter_id: insert a new vote, or MOVE the existing one to the new
  -- dog. UNIQUE(voter_id) makes the conflict target the single active vote.
  insert into public.votes (voter_id, hot_dog_id)
       values (voter, target_dog)
  on conflict (voter_id)
  do update set hot_dog_id = excluded.hot_dog_id,
                created_at = now()
    returning id into vote_id;

  -- Recompute counters for the new dog and (if this was a move) the old dog,
  -- then re-derive the crown — all in this transaction.
  perform public.recompute_vote_count(target_dog);
  perform public.recompute_vote_count(previous_dog);  -- no-ops when null
  perform public.recompute_top_dog();

  return vote_id;
end;
$$;

comment on function public.cast_vote(uuid) is
  'Casts or MOVES the caller''s single active vote to target_dog. Voter derived '
  'from auth.uid() (never trusts a client id). Rejects unauthenticated (28000), '
  'self-vote (23514), and unknown dog (P0002). Recomputes vote_count for the old '
  '+ new dogs and the crown in one transaction. Returns the vote id.';

grant execute on function public.cast_vote(uuid) to authenticated;
-- Voting requires auth (decision #23): strip the implicit public/anon EXECUTE so
-- the grant surface matches the "authenticated only" intent. (The RPC also rejects
-- a null auth.uid() with 28000, but the grant is the primary gate.)
revoke execute on function public.cast_vote(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- remove_vote() RPC — clear the caller's active vote
-- ---------------------------------------------------------------------------
-- Deletes the caller's active vote (if any) and recomputes the affected dog's
-- vote_count + the crown. Voter derived from auth.uid(). Idempotent: removing
-- when there is no vote is a no-op that still returns cleanly. Returns the
-- hot_dog_id the vote was removed from, or NULL when there was no vote.

create function public.remove_vote()
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  voter uuid := (select auth.uid());
  removed_dog uuid;
begin
  if voter is null then
    raise exception 'must be authenticated to vote'
      using errcode = '28000';
  end if;

  delete from public.votes
   where voter_id = voter
  returning hot_dog_id into removed_dog;

  if removed_dog is null then
    -- Nothing to remove; no recompute needed.
    return null;
  end if;

  perform public.recompute_vote_count(removed_dog);
  perform public.recompute_top_dog();

  return removed_dog;
end;
$$;

comment on function public.remove_vote() is
  'Removes the caller''s active vote (voter derived from auth.uid()). Recomputes '
  'the affected dog''s vote_count and the crown in one transaction. Returns the '
  'hot_dog_id the vote was on, or NULL if there was no active vote. Rejects '
  'unauthenticated (28000).';

grant execute on function public.remove_vote() to authenticated;
-- Voting requires auth (decision #23): strip the implicit public/anon EXECUTE so
-- the grant surface matches the "authenticated only" intent.
revoke execute on function public.remove_vote() from public, anon;
