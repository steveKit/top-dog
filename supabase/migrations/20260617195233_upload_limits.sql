-- TASK-070 — Upload limits enforcement (M7, Safety & Polish)
--
-- Makes the hot-dog upload size + count limits HARD and SERVER-SIDE, at the
-- authoritative boundary (Supabase Storage API + the DB), so a direct PostgREST
-- insert with the browser publishable key cannot bypass them — not only the
-- SvelteKit form action. Folds in DW-005 (the client-supplied `byte_size`
-- soft-guard residual).
--
-- MAX_UPLOAD_BYTES = 2 MiB = 2097152 bytes. The TS single source of truth is
-- `MAX_UPLOAD_BYTES` in src/lib/features/hotdogs/hotdogs.ts (SQL can't import a
-- constant; keep these in sync). The per-user count cap literal 100 mirrors
-- `PER_USER_CAP` in that same module.
--
-- Three layers, all DB/Storage-authoritative (append-only — never edit the
-- already-pushed hot_dogs / baseline migrations):
--   1. Per-file hard cap on ACTUAL bytes via the Storage API bucket
--      `file_size_limit` — the Storage API rejects an over-limit upload
--      regardless of client (this is the real close of DW-005: it bounds the
--      true object size a trigger/CHECK cannot see).
--   2. A DB CHECK on the DECLARED `byte_size` — the authoritative backstop that
--      bounds the value feeding the global storage-sum guard (app_storage_bytes),
--      so a direct API insert can't seed an oversized declared size.
--   3. The per-user count cap, now DB-enforced via a BEFORE INSERT trigger (was
--      app-action-only) so a direct API insert can't exceed it either.
--
-- Gotcha (project convention): schema-qualify everything in a SECURITY DEFINER
-- function with `set search_path = ''`, and `revoke execute ... from public,
-- anon, authenticated` — `revoke from public` alone is NOT enough on Supabase
-- (it grants EXECUTE on new public.* functions to anon + authenticated).

-- ---------------------------------------------------------------------------
-- 1. Per-file hard cap on real bytes — Storage API bucket file_size_limit
-- ---------------------------------------------------------------------------
-- The Storage API enforces file_size_limit on the ACTUAL uploaded object size,
-- which neither a DB trigger nor a CHECK can observe (they only see the
-- client-declared byte_size). Setting it here is the hard close of DW-005's
-- "real object size" concern. Applied to both buckets for consistency — both
-- hot-dog photos and avatars go through the same client-side compression seam.

update storage.buckets set file_size_limit = 2097152 where id = 'hotdogs';
update storage.buckets set file_size_limit = 2097152 where id = 'avatars';

-- ---------------------------------------------------------------------------
-- 2. DB CHECK on declared byte_size — authoritative backstop
-- ---------------------------------------------------------------------------
-- Bounds the client-declared `byte_size` that feeds app_storage_bytes / the
-- global storage guard, so a direct PostgREST insert can't overshoot the
-- declared size past the per-file cap. The existing hot_dogs_byte_size_nonneg
-- CHECK (>= 0) stays; this adds the upper bound.
alter table public.hot_dogs
  add constraint hot_dogs_byte_size_max check (byte_size <= 2097152);

-- ---------------------------------------------------------------------------
-- 3. Per-user count cap — DB-enforced via BEFORE INSERT trigger
-- ---------------------------------------------------------------------------
-- The per-user cap (decision #10: 100 dogs, "delete one to add another") was
-- enforced ONLY in the SvelteKit upload action (countByOwner/isAtCap). This
-- trigger makes it authoritative at the DB so a direct PostgREST insert with
-- the browser publishable key can't exceed it either.
--
-- SECURITY DEFINER so the COUNT(*) sees every one of the owner's rows
-- regardless of the inserting caller's RLS (the hot_dogs SELECT policy already
-- exposes all rows to authenticated, but definer rights keep the count correct
-- even if that policy tightens later). Empty search_path + schema-qualified
-- references, matching the vote RPCs. The literal 100 mirrors PER_USER_CAP in
-- src/lib/features/hotdogs/hotdogs.ts — keep the two in sync (SQL can't import
-- the TS constant).

create function public.hot_dogs_enforce_per_user_cap()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  -- PER_USER_CAP = 100 (src/lib/features/hotdogs/hotdogs.ts). Reject when the
  -- owner is already AT the cap (a new row would make 101).
  if (
    select count(*) from public.hot_dogs hd where hd.owner_id = new.owner_id
  ) >= 100 then
    raise exception 'per-user hot dog cap reached (max 100) — delete one to add another'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function public.hot_dogs_enforce_per_user_cap() is
  'BEFORE INSERT guard: rejects a new hot dog when the owner already has 100 '
  'rows (PER_USER_CAP, decision #10). DB-authoritative backstop to the upload '
  'action''s count check, so a direct PostgREST insert can''t exceed the cap. '
  'Keep the literal 100 in sync with PER_USER_CAP in '
  'src/lib/features/hotdogs/hotdogs.ts.';

-- Lock the function down: revoke from public, anon AND authenticated — on
-- Supabase, revoke from public alone leaves the implicit anon/authenticated
-- EXECUTE grants intact. The trigger fires under the table owner's rights, so
-- no role needs to call it directly.
revoke execute on function public.hot_dogs_enforce_per_user_cap()
  from public, anon, authenticated;

create trigger hot_dogs_per_user_cap
  before insert on public.hot_dogs
  for each row
  execute function public.hot_dogs_enforce_per_user_cap();
