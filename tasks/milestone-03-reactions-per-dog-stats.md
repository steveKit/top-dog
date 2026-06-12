# Milestone M3: Reactions & Per-Dog Stats

> **Status:** `active`
> Index: [[TASKS]] · Architecture: [[PROJECT]] · Conventions: [[CLAUDE]]
> **Goal:** cosmetic reactions, peak votes.

## Active Tasks

### TASK-031: Per-dog stats [`pending`] [`P3`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-021
**Acceptance Criteria:**

- [ ] Track/display peak_votes per dog
- [ ] Stats visible on the dog detail view

## Completed Tasks (this milestone)

### TASK-030: Hot dog reactions (cosmetic) [`complete`] [`P2`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-013
**PR:** #43 (`b27dc63`, squash-merged) · **Reviewer:** APPROVE · **Fix cycles:** 0
**Acceptance Criteria:**

- [x] `hotdog_reactions` migration + RLS (many per user, no ranking effect)
- [x] Drop hot-dog emoji reactions on a photo; render counts
- [x] Reactions explicitly do NOT change vote_count or ranking

**Notes:**

Migration `20260612104439_hotdog_reactions.sql` adds the `hotdog_reactions`
table (`id` uuid PK via `extensions.gen_random_uuid()`, `user_id` →
`profiles on delete cascade`, `hot_dog_id` → `hot_dogs on delete cascade`,
`emoji` text, `created_at`) with `UNIQUE(user_id, hot_dog_id, emoji)` and a
`char_length(emoji) <= 16` CHECK. The UNIQUE is per-emoji, so a user can stack
many DISTINCT emojis on one dog (decision #12 "many allowed") while each emoji
toggles once. RLS: SELECT for `authenticated`, owner-scoped INSERT/DELETE via
the `(select auth.uid()) = user_id` initplan idiom.

**Plain owner-scoped RLS write, deliberately NOT a SECURITY-DEFINER RPC — the
inverse of the consuming-writes-via-RPC convention.** The RPC convention
(decisions #12/#24, votes/tally) exists to maintain a denormalized counter
transactionally; reactions have **no counter, no trigger, and nothing that
touches `vote_count`/`peak_votes`/crown**. Counts are computed at read time by
the pure `summarizeReactions(rows, viewerId)` aggregator (count-desc / emoji-asc,
→ `{emoji, count, reactedByMe}[]`). Because the table carries no
server-maintained denormalized column, AC #3 ("reactions explicitly do NOT
change vote_count or ranking") is satisfied **structurally** rather than by code
discipline — there is no write path that could touch ranking state. This also
means decision #24's column-grant lockdown correctly does **not** apply here:
the reviewer verified `created_at`/`id` are client-insertable but inert (no
denormalized column to forge).

Feature module `src/lib/features/reactions/`: `emojiSet.ts` (interim hardcoded
`REACTION_EMOJIS` hot-dog set + `isAllowedReactionEmoji`), `summarize.ts` (the
pure aggregator), and `reactions.ts` (`addReaction`/`removeReaction`/
`listReactionsForDogs` server wrappers returning a discriminated
`ReactionResult`; a 23505 unique-violation maps to a benign idempotent add and
a missing-row delete is a no-op idempotent remove; sentinels keyed on SQLSTATE,
raw errors logged server-side only). New component
`src/lib/components/ReactionBar.svelte` (Svelte 5 runes; the picker hides
already-owned emojis since the owned chip is itself the un-react affordance).
Wired into `/app/feed` (`+page.server.ts` load attaches per-dog summaries;
`react`/`unreact` form actions). Emoji is validated at the app boundary twice
(action + wrapper) as deliberate defense-in-depth.

**Trust boundary:** the viewer id is taken from `safeGetSession()` and never
client-supplied — pinned by a test that submits a hostile `user_id`. The
interim `REACTION_EMOJIS` set is a placeholder slated to be sourced from the M6
emoji library (`src/lib/features/emoji/`); tracked as Discovered Work so it
isn't left as only a code comment.

**Metrics:** `pnpm test` 396 pass; new `@security` live-DB E2E
`tests/reactions.e2e.ts` (4 cases) proves owner-scoped INSERT RLS rejects
forging another user's reaction and that an insert+delete cycle leaves
`vote_count`/`peak_votes` unchanged; `@smoke` still green; `pnpm check` 0
errors, lint clean. Reviewer APPROVE, 0 fix cycles. Two minor review notes,
both reviewer-recommended no-change: (a) emoji validated twice (deliberate
defense-in-depth); (b) `created_at`/`id` client-insertable but verified inert
(no server-maintained denormalized column, so the decision #24 lockdown
correctly does not apply).

This task did **not** close M3 — TASK-031 (per-dog stats) remains active.

---

> **No caps.** Acceptance criteria, subtasks, and integration points are
> unbounded. Give each task as much specificity as it needs to be completed to
> spec — never trim detail to hit a count.
