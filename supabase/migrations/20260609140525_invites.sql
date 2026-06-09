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
-- `consumed_by`/`consumed_at` are NULL until redemption; a non-null `consumed_by`
-- marks the token as spent. Single-use is enforced by the conditional UPDATE in
-- the RPC, not a partial index — `token` is globally unique.

create table public.invites (
  id          uuid        primary key default extensions.gen_random_uuid(),
  inviter_id  uuid        not null references auth.users (id) on delete cascade,
  token       text        not null unique,
  created_at  timestamptz not null default now(),
  consumed_by uuid        references auth.users (id) on delete set null,
  consumed_at timestamptz,
  constraint invites_token_length check (char_length(token) between 16 and 256),
  -- consumed_by and consumed_at move together: either both null (unspent) or
  -- both set (spent). Keeps the "spent" signal unambiguous.
  constraint invites_consumed_consistency check (
    (consumed_by is null) = (consumed_at is null)
  )
);

comment on table public.invites is
  'Single-use invite tokens. Created by authenticated members; consumed during '
  'sign-up via the redeem_invite RPC (SECURITY DEFINER). Decision #17.';
comment on column public.invites.token is
  'Unguessable app-generated token (Web Crypto base64url). Globally unique.';
comment on column public.invites.consumed_by is
  'auth.users id of the redeemer; NULL until the token is spent.';

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
-- `consumed_by IS NULL` is matched, so a second redemption updates zero rows and
-- returns NULL. The body is a single statement → one transaction.
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
     and consumed_by is null
  returning id into consumed_id;

  -- consumed_id is NULL when no unspent row matched (invalid or already-used).
  return consumed_id;
end;
$$;

comment on function public.redeem_invite(text, uuid) is
  'Atomically consumes a single-use invite token for redeemer_id. Returns the '
  'invite id on success or NULL if the token is invalid or already spent. '
  'Single-use is enforced by the consumed_by IS NULL guard in the UPDATE.';

-- Allow the anonymous role (pre-auth sign-up) and authenticated users to call
-- the RPC. The definer rights inside the function are what actually permit the
-- write; EXECUTE just gates who may invoke it.
grant execute on function public.redeem_invite(text, uuid) to anon, authenticated;
