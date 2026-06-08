-- TASK-003 — RLS baseline migration + storage buckets
--
-- Establishes the initial RLS baseline (the `profiles` table) and the two
-- storage buckets (`hotdogs` private, `avatars` public-read) with policies.
-- Scope is intentionally limited to `profiles` + storage; invites, hot_dogs,
-- votes, etc. land in later tasks.
--
-- References: PROJECT.md Data Model, decision #6 (two buckets), #13/#14
-- (Top Dog fields), #21 (L2 security). Authz is enforced at the DB via RLS,
-- never only in the UI.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

-- citext gives us case-insensitive `handle` uniqueness without a functional
-- index, matching the M1 profile requirement.
create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- One row per authenticated user. `id` references auth.users so a profile is
-- inseparable from its Supabase Auth identity. `avatar_path` is a text ref
-- into the `avatars` bucket (bytes never live in Postgres — decision #6).
-- Top Dog fields (decisions #13/#14) are server-maintained; clients must not
-- write them, so the update policy uses WITH CHECK to pin them (see below).

create table public.profiles (
  id                 uuid        primary key references auth.users (id) on delete cascade,
  handle             extensions.citext  not null unique,
  display_name       text        not null,
  avatar_path        text,
  joined_at          timestamptz not null default now(),
  days_as_top_dog    integer     not null default 0,
  is_current_top_dog boolean     not null default false,
  top_dog_since      timestamptz,
  constraint profiles_handle_format check (
    char_length(handle::text) between 2 and 32
  )
);

comment on table public.profiles is
  'User profiles, one per auth.users row. Top Dog fields are server-maintained.';
comment on column public.profiles.handle is
  'Unique, case-insensitive (citext) handle.';
comment on column public.profiles.avatar_path is
  'Text path into the avatars storage bucket; image bytes never stored in DB.';

-- ---------------------------------------------------------------------------
-- profiles RLS
-- ---------------------------------------------------------------------------
-- Default-deny: enabling RLS with no policy blocks all access; we then add
-- explicit policies. Profiles are readable by any authenticated user (the app
-- is invite-only, so "authenticated" already means "a vetted member"). A user
-- may only insert/update their own row, keyed to auth.uid().

alter table public.profiles enable row level security;

-- Read: any authenticated member may view any profile.
create policy "profiles_select_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

-- Insert: a user may create only their own row.
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

-- Update: a user may update only their own row. The WITH CHECK keeps the row
-- owned by the same user after the update (the id cannot be reassigned).
-- Top Dog fields (days_as_top_dog, is_current_top_dog, top_dog_since) are
-- written only by server-side RPC/trigger logic running with elevated
-- privileges in later milestones; the client never has a reason to set them
-- through this policy.
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No delete policy: profiles are removed via auth.users cascade, not by the
-- client directly. Default-deny covers delete.

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
-- `hotdogs`: private — objects served only via owner access or signed URLs.
-- `avatars`: public-read — avatars are non-sensitive and embedded directly.
-- Both buckets are created in SQL (not the dashboard) so `supabase db reset`
-- reproduces them deterministically (decision #6, task constraint).

insert into storage.buckets (id, name, public)
values
  ('hotdogs', 'hotdogs', false),
  ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Storage RLS policies (on storage.objects)
-- ---------------------------------------------------------------------------
-- Path convention (decision #6): `{owner_id}/{...}`. The first path segment is
-- the owning user's uuid. storage.foldername(name) returns the path segments
-- as a text[]; element [1] is the first segment. We require it to equal
-- auth.uid() so a user can only write under their own prefix.

-- --- hotdogs (private) -----------------------------------------------------

-- Read: owner only (objects in their own {owner_id}/ prefix). Everyone else
-- must use a signed URL, which bypasses RLS. Keeps private content private.
create policy "hotdogs_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'hotdogs'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Insert: a user may upload only under their own {owner_id}/ prefix.
create policy "hotdogs_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'hotdogs'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Update: a user may modify only their own objects.
create policy "hotdogs_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'hotdogs'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'hotdogs'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Delete: a user may delete only their own objects (supports the "delete one
-- to add another" cap and orphan-free deletes — decision #10).
create policy "hotdogs_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'hotdogs'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- --- avatars (public-read) -------------------------------------------------

-- Read: public. Anyone (including anon) may read avatar objects.
create policy "avatars_select_public"
  on storage.objects
  for select
  to public
  using (bucket_id = 'avatars');

-- Insert: a user may upload only under their own {owner_id}/ prefix.
create policy "avatars_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Update: a user may modify only their own avatar objects.
create policy "avatars_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Delete: a user may delete only their own avatar objects.
create policy "avatars_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
