-- TASK-050 — Profile message walls
--
-- Members may post short text messages on ANY member's profile WALL (mirrors
-- the global feed model: any member reads/posts on any wall). Wall messages are
-- a COSMETIC / many-allowed surface (like hot dog reactions, decision #12, and
-- mustard sprays, decision #15): there is NO denormalized counter, NO ranking
-- effect, and they never touch vote_count / peak_votes / the crown. Because
-- there is no server-maintained denormalized column to protect, this is a PLAIN
-- owner-scoped RLS WRITE, NOT a SECURITY DEFINER RPC — the deliberate inverse of
-- the consuming-writes-via-RPC convention (see the CLAUDE.md "Cosmetic /
-- many-allowed tables" gotcha). Corollary: decision #24's insert/update
-- column-grant lockdown does NOT apply here — `id`/`created_at` being
-- client-insertable is inert because there is no denormalized column to forge.
--
-- Body storage: we store the ORIGINAL message body VERBATIM. The future M6 emoji
-- library applies a RENDER-time filter (like mustard decay and reactions) —
-- never persist filtered/transformed text. The DB keeps only a length sanity
-- CHECK as an abuse backstop; app-boundary validation (non-empty after trim,
-- within bound) is the authoritative guard.
--
-- Gotcha (M0 lesson): schema-qualify all extension-provided functions/types
-- (extensions.gen_random_uuid()) — the hosted migration role lacks `extensions`
-- in its search_path, so an unqualified reference passes local `db reset` but
-- fails hosted `db push`.

-- ---------------------------------------------------------------------------
-- wall_messages
-- ---------------------------------------------------------------------------
-- One row per message. Both FKs cascade from profiles (which cascades from
-- auth.users), so deleting a member removes the messages they AUTHORED as well
-- as the messages on THEIR wall. Self-post (author == wall owner) is allowed —
-- a member writing on their own wall is harmless.

create table public.wall_messages (
  id          uuid        primary key default extensions.gen_random_uuid(),
  profile_id  uuid        not null references public.profiles (id) on delete cascade,
  author_id   uuid        not null references public.profiles (id) on delete cascade,
  -- The ORIGINAL message body, stored verbatim. M6 applies a render-time emoji
  -- filter; never persist the filtered/transformed text. The app boundary
  -- (postWallMessage) validates non-empty-after-trim authoritatively; this CHECK
  -- is the DB length backstop (walls allow a bit more than the 280-char
  -- hot_dogs.caption — 1000 chars is a roomy upper bound for a wall note).
  body        text        not null,
  created_at  timestamptz not null default now(),
  constraint wall_messages_body_length check (char_length(body) <= 1000)
);

comment on table public.wall_messages is
  'One row per message posted on a member profile WALL. Any member may post on '
  'any wall (mirrors the global feed model). Cosmetic / many-allowed (like '
  'reactions decision #12, sprays decision #15): NO denormalized counter, never '
  'affects vote_count/peak_votes/the crown. Plain owner-scoped RLS write (NOT an '
  'RPC) — INSERT pins author_id to auth.uid(). Stores the ORIGINAL body verbatim; '
  'M6 applies a RENDER-time emoji filter, never persisted. Immutable (no UPDATE).';
comment on column public.wall_messages.profile_id is
  'The wall owner (public.profiles id) the message is posted on. Cascades from '
  'auth.users. Self-post (== author_id) is allowed.';
comment on column public.wall_messages.author_id is
  'The member who posted the message. Pinned to auth.uid() by the INSERT policy '
  'so a poster cannot forge another author. Cascades from auth.users.';
comment on column public.wall_messages.body is
  'The ORIGINAL message body, stored verbatim. M6 applies a render-time emoji '
  'filter; never persist the filtered output. DB keeps only a length sanity CHECK.';
comment on column public.wall_messages.created_at is
  'When the message was posted. Walls render latest-first (created_at desc).';

-- The wall render query reads all messages for ONE profile, latest-first
-- (listWallMessages), so an index on profile_id supports that read.
create index wall_messages_profile_id_idx on public.wall_messages (profile_id);

-- ---------------------------------------------------------------------------
-- wall_messages RLS
-- ---------------------------------------------------------------------------
-- Default-deny: enabling RLS with no policy blocks all access; we add explicit
-- SELECT / INSERT / DELETE policies only. Uses the (select auth.uid()) subselect
-- idiom so the planner caches it as an initplan (Supabase RLS perf pattern),
-- matching the baseline. Plain owner-scoped client writes (no RPC) because there
-- is no server-maintained counter to protect.

alter table public.wall_messages enable row level security;

-- Read: any authenticated member may view any wall message (walls are public,
-- consistent with the global feed model).
create policy "wall_messages_select_authenticated"
  on public.wall_messages
  for select
  to authenticated
  using (true);

-- Insert: a member may post on ANY wall, but author_id is pinned to auth.uid()
-- so a poster cannot forge a message as another member. profile_id (the wall
-- owner) is unrestricted — that is the point: you post on OTHER members' walls.
create policy "wall_messages_insert_own_author"
  on public.wall_messages
  for insert
  to authenticated
  with check (author_id = (select auth.uid()));

-- Delete: the message AUTHOR may remove their own message, OR the WALL OWNER may
-- remove a message from their own wall (moderate your own wall). Either side of
-- the disjunction is a server-maintained, non-forgeable identity check against
-- auth.uid().
create policy "wall_messages_delete_author_or_owner"
  on public.wall_messages
  for delete
  to authenticated
  using (
    author_id = (select auth.uid())
    or profile_id = (select auth.uid())
  );

-- No UPDATE policy: messages are immutable — we store the ORIGINAL body and
-- never mutate it. Editing is delete-then-repost, never an update. Default-deny
-- covers UPDATE.
