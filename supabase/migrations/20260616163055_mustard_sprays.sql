-- TASK-041 — Mustard sprays (Top Dog cosmetic flair on profiles)
--
-- The current Top Dog may spray mustard on any member's PROFILE at a clicked
-- (x,y) position. Sprays are COSMETIC flair (decision #15) — like hot dog
-- reactions (decision #12), they have NO denormalized counter, NO ranking
-- effect, and never touch vote_count / peak_votes / the crown. Because there
-- is no server-maintained counter to protect, this is a PLAIN RLS WRITE, NOT a
-- SECURITY DEFINER RPC — the deliberate inverse of the consuming-writes-via-RPC
-- convention (see the CLAUDE.md "Cosmetic / many-allowed tables" gotcha). The
-- one difference from reactions is an EXTRA authorization predicate on INSERT:
-- only the current Top Dog may spray.
--
-- Decay model: opacity decays linearly over 24h and is computed at RENDER time
-- from the stored `sprayed_at` timestamp (decision #15, mustardOpacity in
-- src/lib/features/mustard/decay.ts). The DB stores ONLY the raw timestamp —
-- never the decayed opacity. Sprays persist across crown changes and are
-- immutable + unlimited; removal of fully-faded rows happens ONLY via the
-- separate TASK-042 daily prune job (a future SECURITY DEFINER RPC that
-- bypasses RLS), never by the sprayer or target — so there is no client
-- UPDATE/DELETE path here (default-deny covers both).
--
-- Position is stored RELATIVE in [0,1] (x = left fraction, y = top fraction of
-- the profile area's bounding box) so it survives layout / screen-size changes.
--
-- Gotcha (M0 lesson): schema-qualify all extension-provided functions
-- (extensions.gen_random_uuid()) — the hosted migration role lacks `extensions`
-- in its search_path, so an unqualified reference passes local `db reset` but
-- fails hosted `db push`.

-- ---------------------------------------------------------------------------
-- mustard_sprays
-- ---------------------------------------------------------------------------
-- One row per spray. Both FKs cascade from profiles (which cascades from
-- auth.users), so deleting a member removes the sprays they made AND the sprays
-- on their profile. Self-spray (sprayer == target) is ALLOWED — a Top Dog
-- mustarding their own profile is harmless cosmetic, so there is no
-- sprayer != target restriction.

create table public.mustard_sprays (
  id                 uuid        primary key default extensions.gen_random_uuid(),
  sprayer_id         uuid        not null references public.profiles (id) on delete cascade,
  target_profile_id  uuid        not null references public.profiles (id) on delete cascade,
  -- Relative position in [0,1] (fraction of the profile area's bounding box),
  -- robust to layout / screen size. The app boundary (addSpray) validates the
  -- range authoritatively; these CHECKs are the DB backstop.
  x                  real        not null,
  y                  real        not null,
  sprayed_at         timestamptz not null default now(),
  constraint mustard_sprays_x_range check (x >= 0 and x <= 1),
  constraint mustard_sprays_y_range check (y >= 0 and y <= 1)
);

comment on table public.mustard_sprays is
  'One row per mustard spray the current Top Dog lands on a member profile. '
  'Cosmetic flair (decision #15): NO denormalized counter, never affects '
  'vote_count/peak_votes/the crown. Plain RLS write (NOT an RPC) — the INSERT '
  'policy gates to the current Top Dog. Opacity is computed at RENDER time from '
  'sprayed_at (mustardOpacity); the DB stores only the raw timestamp. Immutable '
  'and unlimited; faded rows are pruned by the separate TASK-042 job, never by '
  'a client UPDATE/DELETE.';
comment on column public.mustard_sprays.sprayer_id is
  'The member who sprayed (must be the current Top Dog at spray time, enforced '
  'by the INSERT policy). Cascades from auth.users.';
comment on column public.mustard_sprays.target_profile_id is
  'The profile the spray lands on. Self-spray (== sprayer_id) is allowed.';
comment on column public.mustard_sprays.x is
  'Relative horizontal position in [0,1] (fraction of the profile area width).';
comment on column public.mustard_sprays.y is
  'Relative vertical position in [0,1] (fraction of the profile area height).';
comment on column public.mustard_sprays.sprayed_at is
  'When the spray landed. RENDER-time opacity decays linearly over 24h from this '
  '(mustardOpacity); never store the decayed value.';

-- The render query reads all sprays for ONE profile (listSpraysForProfile),
-- so an index on target_profile_id supports that read.
create index mustard_sprays_target_profile_id_idx
  on public.mustard_sprays (target_profile_id);

-- ---------------------------------------------------------------------------
-- mustard_sprays RLS
-- ---------------------------------------------------------------------------
-- Default-deny: enabling RLS with no policy blocks all access; we add explicit
-- SELECT and INSERT policies only. Uses the (select auth.uid()) subselect idiom
-- so the planner caches it as an initplan (Supabase RLS perf pattern). Like
-- reactions, this is a plain RLS write (no RPC); UNLIKE reactions, INSERT
-- carries an extra current-Top-Dog predicate.

alter table public.mustard_sprays enable row level security;

-- Read: any authenticated member may view any spray — sprays are public flair
-- rendered on the target's profile for everyone.
create policy "mustard_sprays_select_authenticated"
  on public.mustard_sprays
  for select
  to authenticated
  using (true);

-- Insert: ONLY the current Top Dog may spray. Two conjuncts:
--   1. sprayer_id is pinned to auth.uid() — a client cannot forge a spray as
--      another member.
--   2. an EXISTS check confirms the caller's own profile has is_current_top_dog.
-- This predicate is trustworthy because is_current_top_dog is server-maintained
-- and NON-client-writable (decision #25) — a member cannot set their own crown
-- to satisfy this check.
create policy "mustard_sprays_insert_top_dog"
  on public.mustard_sprays
  for insert
  to authenticated
  with check (
    sprayer_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_current_top_dog
    )
  );

-- No UPDATE policy, no DELETE policy: sprays are immutable and persistent
-- (decision #15 — persistent but decays over 24h). Neither the sprayer nor the
-- target may remove them; faded rows are reaped only by the TASK-042 daily
-- prune job (a future SECURITY DEFINER RPC that bypasses RLS). Default-deny
-- covers UPDATE and DELETE.
