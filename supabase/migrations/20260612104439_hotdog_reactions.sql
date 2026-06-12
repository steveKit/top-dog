-- TASK-030 — Hot dog reactions (cosmetic flair)
--
-- A cosmetic emoji-reaction mechanic for hot dogs (decision #12: VOTE drives
-- ranking; REACTION is cosmetic with MANY allowed). Members drop hot-dog-themed
-- emoji on a photo and see per-emoji counts. Reactions are flair ONLY — this
-- migration deliberately adds NO denormalized counter to hot_dogs and does NOT
-- touch vote_count / peak_votes / the crown. Per-emoji counts are computed at
-- READ time (summarizeReactions in src/lib/features/reactions/summarize.ts), so
-- there is structurally no way for a reaction to influence ranking.
--
-- Auth / write model (mirrors hot_dogs, NOT votes):
--   - Reactions are plain owner-scoped RLS writes — there is no denormalized
--     counter to maintain, so no SECURITY DEFINER RPC is involved (unlike votes).
--     INSERT and DELETE are owner-scoped via the (select auth.uid()) idiom; the
--     toggle is insert/delete (no UPDATE path, so no UPDATE policy).
--   - SELECT is open to authenticated members: reactions are public flair.
--   - UNIQUE(user_id, hot_dog_id, emoji) gives toggle semantics per emoji (a
--     given emoji is on/off for a user/dog) while allowing MANY DIFFERENT emojis
--     per user/dog — which is what satisfies decision #12's "many".
--
-- Allowed-emoji validation is AUTHORITATIVE at the app boundary
-- (src/lib/features/reactions/emojiSet.ts:isAllowedReactionEmoji), not a rigid DB
-- enum: M6 will expand the set, and a CHECK enum would force a migration every
-- time. The DB keeps only a length sanity CHECK as a backstop against abuse.
--
-- Gotcha (M0 lesson): schema-qualify all extension-provided functions/types
-- (extensions.gen_random_uuid()) — the hosted migration role lacks `extensions`
-- in its search_path, so an unqualified reference passes local `db reset` but
-- fails hosted `db push`.

-- ---------------------------------------------------------------------------
-- hotdog_reactions
-- ---------------------------------------------------------------------------
-- One row per (user, dog, emoji) reaction. Both FKs cascade from their parents
-- (profiles cascades from auth.users; hot_dogs cascades from profiles), so
-- deleting a user or a dog removes the dependent reactions. `emoji` is the raw
-- emoji text; the allowed-set check lives at the app boundary (see header).

create table public.hotdog_reactions (
  id          uuid        primary key default extensions.gen_random_uuid(),
  user_id     uuid        not null references public.profiles (id) on delete cascade,
  hot_dog_id  uuid        not null references public.hot_dogs (id) on delete cascade,
  emoji       text        not null,
  created_at  timestamptz not null default now(),
  -- Toggle semantics: a given emoji is on/off per (user, dog); many DIFFERENT
  -- emojis are allowed for the same user/dog (decision #12 "many").
  constraint hotdog_reactions_unique unique (user_id, hot_dog_id, emoji),
  -- Length sanity backstop. The authoritative allowed-emoji validation is at the
  -- app boundary (isAllowedReactionEmoji); this CHECK only bounds abuse of the
  -- free-text column (a single emoji grapheme cluster is comfortably under 16).
  constraint hotdog_reactions_emoji_length check (char_length(emoji) <= 16)
);

comment on table public.hotdog_reactions is
  'One row per (user, dog, emoji) cosmetic reaction. UNIQUE(user_id, hot_dog_id, '
  'emoji) => toggle per emoji, many DIFFERENT emojis allowed. Flair only: NO '
  'denormalized counter, never affects vote_count/peak_votes/the crown '
  '(decision #12). Counts computed at read time (summarizeReactions).';
comment on column public.hotdog_reactions.user_id is
  'The reacting member (public.profiles id). Cascades from auth.users.';
comment on column public.hotdog_reactions.hot_dog_id is
  'The hot dog the reaction is on.';
comment on column public.hotdog_reactions.emoji is
  'Raw reaction emoji text. Allowed-set validation is at the app boundary '
  '(isAllowedReactionEmoji), not a DB enum — M6 expands the set without a '
  'migration. The DB keeps only a length sanity CHECK.';

-- The feed load lists reactions for a SET of dog ids (listReactionsForDogs), so
-- an index on hot_dog_id supports that read. (user_id is already indexed as the
-- leading column of the UNIQUE constraint.)
create index hotdog_reactions_hot_dog_id_idx on public.hotdog_reactions (hot_dog_id);

-- ---------------------------------------------------------------------------
-- hotdog_reactions RLS
-- ---------------------------------------------------------------------------
-- Default-deny: enabling RLS with no policy blocks all access; we add explicit
-- policies. Uses the (select auth.uid()) subselect idiom so the planner caches
-- it as an initplan (Supabase RLS perf pattern), matching the baseline. Unlike
-- votes, reactions are plain owner-scoped client writes (no RPC) because there
-- is no server-maintained counter to protect.

alter table public.hotdog_reactions enable row level security;

-- Read: any authenticated member may view any reaction (reactions are public
-- flair; the feed shows per-emoji counts and who-reacted-by-me state).
create policy "hotdog_reactions_select_authenticated"
  on public.hotdog_reactions
  for select
  to authenticated
  using (true);

-- Insert: a member may create only their OWN reactions. The user_id is pinned to
-- auth.uid(), so a client cannot forge a reaction as another user.
create policy "hotdog_reactions_insert_own"
  on public.hotdog_reactions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Delete: a member may delete only their own reactions (the un-react half of the
-- toggle).
create policy "hotdog_reactions_delete_own"
  on public.hotdog_reactions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- No UPDATE policy: a reaction is immutable. Toggling is INSERT (react) /
-- DELETE (un-react); changing the emoji is delete-then-insert, never an update.
-- Default-deny covers UPDATE.
