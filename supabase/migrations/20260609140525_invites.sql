-- TASK-010 — Invites: table + RLS + single-use redemption RPC
--
-- Invite-only growth (decision #17): authenticated members mint single-use
-- invite tokens; a new user redeems a token during sign-up. Schema matches the
-- PROJECT.md Data Model:
--   invites(id, inviter_id, token unique, created_at, consumed_by, consumed_at)
--
-- Auth model:
--   - Inviter (authenticated) may INSERT/SELECT only their own invites (RLS).
--   - Consumption happens while the redeemer is still UNAUTHENTICATED (anon),
--     so it cannot rely on the inviter's RLS. It runs through a SECURITY DEFINER
--     RPC (`redeem_invite`) that atomically marks the token used — matching the
--     project's "competitive writes go through a single-transaction RPC"
--     convention. No client UPDATE/DELETE policy exists; consumption is the RPC's
--     sole responsibility.
--
-- Gotcha (M0 lesson): schema-qualify all extension-provided functions/types
-- (extensions.gen_random_uuid()), since the hosted migration role lacks
-- `extensions` in its search_path.

-- ---------------------------------------------------------------------------
-- invites
-- ---------------------------------------------------------------------------
-- `token` is an app-generated, unguessable string (Web Crypto, base64url).
-- `consumed_at` is the single source of truth for "spent": NULL until redemption,
-- set to a timestamp once the token is consumed. The FK never touches it, so it
-- survives redeemer deletion. `consumed_by` is the redeemer FK kept purely as an
-- audit reference; it may be nulled by ON DELETE SET NULL after a redeemer is
-- removed without un-spending the token. Single-use is enforced by the
-- conditional UPDATE in the RPC (consumed_at IS NULL guard), not a partial index
-- — `token` is globally unique.

create table public.invites (
  id          uuid        primary key default extensions.gen_random_uuid(),
  inviter_id  uuid        not null references auth.users (id) on delete cascade,
  token       text        not null unique,
  created_at  timestamptz not null default now(),
  consumed_by uuid        references auth.users (id) on delete set null,
  consumed_at timestamptz,
  constraint invites_token_length check (char_length(token) between 16 and 256),
  -- `consumed_at` is the authoritative spent-signal; `consumed_by` is the audit
  -- FK that may be nulled by ON DELETE SET NULL. The invariant is one-directional
  -- so it never collides with SET NULL: if a redeemer is recorded, the token must
  -- be marked spent. The valid post-deletion state (consumed_by NULL, consumed_at
  -- set) is allowed; the nonsensical (consumed_by set, consumed_at NULL) is not.
  constraint invites_consumed_consistency check (
    consumed_by is null or consumed_at is not null
  )
);

comment on table public.invites is
  'Single-use invite tokens. Created by authenticated members; consumed during '
  'sign-up via the redeem_invite RPC (SECURITY DEFINER). Decision #17.';
comment on column public.invites.token is
  'Unguessable app-generated token (Web Crypto base64url). Globally unique.';
comment on column public.invites.consumed_by is
  'auth.users id of the redeemer (audit reference). Nulled by ON DELETE SET NULL '
  'if the redeemer is later deleted; this does NOT un-spend the token.';
comment on column public.invites.consumed_at is
  'Authoritative spent-signal: NULL means unspent and redeemable, a timestamp '
  'means the token is consumed. The single-use RPC guard keys off this column.';

-- Lookup by token is the hot path for redemption; the `unique` constraint
-- already creates the supporting index, so no extra index is needed.

-- ---------------------------------------------------------------------------
-- invites RLS
-- ---------------------------------------------------------------------------
-- Default-deny: enabling RLS with no policy blocks all access; we add explicit
-- policies for the inviter only. The redeemer never touches this table through
-- RLS — they go through the SECURITY DEFINER RPC below.

alter table public.invites enable row level security;

-- Select: a member may view only the invites they created (to list/share their
-- own links and see which are spent). Uses the (select auth.uid()) subselect
-- idiom so the planner caches it as an initplan (Supabase RLS perf pattern).
create policy "invites_select_own"
  on public.invites
  for select
  to authenticated
  using ((select auth.uid()) = inviter_id);

-- Insert: a member may create only invites attributed to themselves. The token
-- value is supplied by the app; created_at/consumed_* use column defaults/NULL.
create policy "invites_insert_own"
  on public.invites
  for insert
  to authenticated
  with check ((select auth.uid()) = inviter_id);

-- No UPDATE or DELETE policy. Consumption is performed exclusively by
-- redeem_invite() (SECURITY DEFINER); clients have no reason to mutate or remove
-- invites directly. Default-deny covers both.

-- ---------------------------------------------------------------------------
-- redeem_invite RPC
-- ---------------------------------------------------------------------------
-- Atomically consumes a single-use token on behalf of a freshly signed-up user.
-- Returns the invite id on success, or NULL when the token is invalid or already
-- spent. Single-use is enforced by the conditional UPDATE: only a row whose
-- `consumed_at IS NULL` is matched, so a second redemption updates zero rows and
-- returns NULL. Keying off `consumed_at` (not `consumed_by`) means a token stays
-- spent even after its redeemer is deleted and `consumed_by` is nulled by the FK.
-- The body is a single statement → one transaction.
--
-- SECURITY DEFINER: runs with the function owner's privileges so an anonymous
-- (pre-auth) caller can mark the token spent without an RLS grant. The function
-- pins an empty search_path and validates inputs to stay safe under definer
-- rights (every object reference inside is schema-qualified).

create function public.redeem_invite(invite_token text, redeemer_id uuid)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  consumed_id uuid;
begin
  if invite_token is null or char_length(invite_token) = 0 then
    return null;
  end if;
  if redeemer_id is null then
    return null;
  end if;

  update public.invites
     set consumed_by = redeemer_id,
         consumed_at = now()
   where token = invite_token
     and consumed_at is null
  returning id into consumed_id;

  -- consumed_id is NULL when no unspent row matched (invalid or already-used).
  return consumed_id;
end;
$$;

comment on function public.redeem_invite(text, uuid) is
  'Atomically consumes a single-use invite token for redeemer_id. Returns the '
  'invite id on success or NULL if the token is invalid or already spent. '
  'Single-use is enforced by the consumed_at IS NULL guard in the UPDATE.';

-- Allow the anonymous role (pre-auth sign-up) and authenticated users to call
-- the RPC. The definer rights inside the function are what actually permit the
-- write; EXECUTE just gates who may invoke it.
grant execute on function public.redeem_invite(text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- invite_is_redeemable RPC (best-effort pre-check)
-- ---------------------------------------------------------------------------
-- Read-only check used BEFORE signUp to reject an invalid/already-used token
-- without creating an orphaned auth.users row. This is best-effort only: a token
-- can be consumed in the narrow window between this check and the redeem_invite
-- UPDATE, which is why the conditional UPDATE remains the authoritative
-- single-use guard. Keyed off `consumed_at` to match the spent-signal.
--
-- SECURITY DEFINER with an empty search_path so an anonymous (pre-auth) caller
-- can probe redeemability without an RLS grant; every reference is
-- schema-qualified.

create function public.invite_is_redeemable(invite_token text)
  returns boolean
  language sql
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
      from public.invites
     where token = invite_token
       and consumed_at is null
  );
$$;

comment on function public.invite_is_redeemable(text) is
  'Read-only, best-effort check that an invite token exists and is unspent '
  '(consumed_at IS NULL). Used as a pre-signUp gate; redeem_invite remains the '
  'authoritative single-use guard.';

grant execute on function public.invite_is_redeemable(text) to anon, authenticated;
