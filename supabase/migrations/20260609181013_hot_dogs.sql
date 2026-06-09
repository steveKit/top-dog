-- TASK-013 — Hot dogs: table + RLS + storage-usage RPC
--
-- The core M1 vertical-slice table (PROJECT.md Data Model, decisions #6/#10/#11).
-- One row per uploaded hot dog photo. The image BYTES live in the private
-- `hotdogs` storage bucket; this table stores only a text `image_path` ref
-- (decision #6) plus a denormalized `byte_size` (the WebP size) used to compute
-- global storage usage for the upload guard (decision #11).
--
-- Counters (`vote_count`, `peak_votes`) are denormalized and SERVER-MAINTAINED:
-- they are written only by the M2 vote RPC, never by a client. We enforce that
-- with column-level privileges on BOTH write paths — revoke UPDATE / grant
-- UPDATE(caption), and revoke INSERT / grant INSERT only on the columns the app
-- supplies — so neither an owner UPDATE nor a direct INSERT can touch the
-- counters (RLS only checks owner_id, so the column grant is the real guard).
--
-- Gotcha (M0 lesson): schema-qualify all extension-provided functions/types
-- (extensions.gen_random_uuid()) — the hosted migration role lacks `extensions`
-- in its search_path, so an unqualified reference passes local but fails push.

-- ---------------------------------------------------------------------------
-- hot_dogs
-- ---------------------------------------------------------------------------
-- `owner_id` references public.profiles (not auth.users directly): a hot dog
-- belongs to a profile, and the profile cascades from auth.users, so deleting a
-- user removes their profile and (via this cascade) their hot dogs.
-- `image_path` is the `{owner_id}/{dog_id}.webp` key into the private `hotdogs`
-- bucket. `byte_size` is the stored WebP size, summed across ALL rows to drive
-- the global storage guard. `vote_count`/`peak_votes` are server-maintained.

create table public.hot_dogs (
  id          uuid        primary key default extensions.gen_random_uuid(),
  owner_id    uuid        not null references public.profiles (id) on delete cascade,
  image_path  text        not null,
  caption     text,
  created_at  timestamptz not null default now(),
  vote_count  integer     not null default 0,
  peak_votes  integer     not null default 0,
  byte_size   integer     not null,
  constraint hot_dogs_byte_size_nonneg check (byte_size >= 0),
  -- DB-authoritative caption bound (L2: a direct API poster can't bypass it).
  -- The app action enforces the same 280 limit for friendly UX; this CHECK is
  -- the backstop. NULL is allowed (no caption); the limit applies only to text.
  constraint hot_dogs_caption_length check (caption is null or char_length(caption) <= 280)
);

comment on table public.hot_dogs is
  'One row per uploaded hot dog photo. Image bytes live in the private hotdogs '
  'bucket; this table stores only the text path ref plus byte_size for the '
  'global storage guard. vote_count/peak_votes are server-maintained (M2 RPC).';
comment on column public.hot_dogs.image_path is
  'Text path into the private hotdogs storage bucket ({owner_id}/{dog_id}.webp); '
  'image bytes are never stored in the DB (decision #6).';
comment on column public.hot_dogs.byte_size is
  'Size in bytes of the stored WebP. Summed across all rows (app_storage_bytes) '
  'to compute global storage usage for the upload guard (decision #11). '
  'CLIENT-SUPPLIED via the app upload path: a direct API insert could understate '
  'it (a trigger cannot see the real storage-object size), so the storage guard '
  'is a best-effort SOFT measure, not a hard quota — accepted for v1 under the '
  'invite-only trust model; revisit if the trust model changes.';
comment on column public.hot_dogs.vote_count is
  'Denormalized vote count. Server-maintained by the M2 vote RPC; NOT '
  'client-writable (column-level privileges revoke UPDATE on this column).';
comment on column public.hot_dogs.peak_votes is
  'Highest vote_count this dog has ever reached. Server-maintained; NOT '
  'client-writable.';

-- Owner-scoped reads of "my dogs" (the upload page grid) filter by owner_id.
create index hot_dogs_owner_id_idx on public.hot_dogs (owner_id);

-- ---------------------------------------------------------------------------
-- hot_dogs RLS
-- ---------------------------------------------------------------------------
-- Default-deny: enabling RLS with no policy blocks all access; we then add
-- explicit policies. Uses the (select auth.uid()) subselect idiom so the planner
-- caches it as an initplan (Supabase RLS perf pattern), matching the baseline.

alter table public.hot_dogs enable row level security;

-- Read: any authenticated member may view any hot dog row (feeds/profiles read
-- rows). The image BYTES stay protected by the private bucket + signed URLs —
-- row RLS is not the bytes guard. Mirrors profiles_select_authenticated.
create policy "hot_dogs_select_authenticated"
  on public.hot_dogs
  for select
  to authenticated
  using (true);

-- Insert: a member may create only their own rows.
create policy "hot_dogs_insert_own"
  on public.hot_dogs
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

-- Update: a member may update only their own rows. Combined with the
-- column-level privileges below, an owner may write only `caption` — the
-- denormalized counters are unreachable from the client even through this
-- policy. (No caption-edit feature ships in M1, but the column-level grant is
-- the durable enforcement seam for when it does.)
create policy "hot_dogs_update_own"
  on public.hot_dogs
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Delete: a member may delete only their own rows (orphan-free delete +
-- "delete one to add another" cap — decision #10). The app deletes the row and
-- removes the storage object in the same flow.
create policy "hot_dogs_delete_own"
  on public.hot_dogs
  for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------------------
-- Column-level privileges: counters are NOT client-writable
-- ---------------------------------------------------------------------------
-- "Owner CRUD" but the denormalized counters (vote_count, peak_votes) are
-- server-only. RLS gates WHICH ROWS a user may touch; column privileges gate
-- WHICH COLUMNS. Revoking UPDATE on the whole table and re-granting it only on
-- `caption` means an owner UPDATE can never set vote_count/peak_votes — those
-- are maintained exclusively by the M2 vote RPC (running with elevated rights).
-- SELECT/DELETE remain governed by the policies above.
revoke update on public.hot_dogs from authenticated;
grant update (caption) on public.hot_dogs to authenticated;

-- INSERT is column-restricted by the SAME mechanism, for the same reason: the
-- hot_dogs_insert_own RLS policy only checks owner_id, so without this grant a
-- direct PostgREST insert (browser publishable key) could seed vote_count /
-- peak_votes and corrupt the M2 ranking. Revoking table-wide INSERT and
-- re-granting only the columns the app's createHotDog supplies means a client
-- cannot supply the counters at all — vote_count, peak_votes, and created_at
-- are omitted, so they always fall to their column DEFAULTs (0/0/now()). This
-- column-level grant — not RLS — is what actually prevents clients seeding the
-- denormalized counters on insert.
revoke insert on public.hot_dogs from authenticated;
grant insert (id, owner_id, image_path, caption, byte_size) on public.hot_dogs to authenticated;

-- ---------------------------------------------------------------------------
-- app_storage_bytes RPC — global storage usage for the upload guard
-- ---------------------------------------------------------------------------
-- Returns the sum of byte_size across ALL hot_dogs (global, not per-user) so the
-- upload path can call evaluateUpload() before accepting a new upload
-- (decision #11). Avatars are a minor unaccounted component — acceptable for M1.
--
-- SECURITY DEFINER so the aggregate sees every row regardless of the caller's
-- RLS (the hot_dogs SELECT policy already exposes all rows to authenticated, but
-- the definer rights keep the total correct even if that policy tightens later).
-- Empty search_path + schema-qualified references, matching the invite RPCs.

create function public.app_storage_bytes()
  returns bigint
  language sql
  security definer
  set search_path = ''
  stable
as $$
  select coalesce(sum(byte_size), 0)::bigint from public.hot_dogs;
$$;

comment on function public.app_storage_bytes() is
  'Sum of byte_size across all hot_dogs (global storage usage in bytes). Drives '
  'the upload guard (evaluateUpload) per decision #11. Avatars are not counted '
  '(minor unaccounted component, acceptable for M1). Because byte_size is '
  'client-supplied (see the byte_size column comment), a direct API insert could '
  'understate it, so this total is a BEST-EFFORT SOFT GUARD INPUT, not a hard '
  'quota — accepted for v1 under the invite-only trust model; revisit if the '
  'trust model changes.';

grant execute on function public.app_storage_bytes() to authenticated;
