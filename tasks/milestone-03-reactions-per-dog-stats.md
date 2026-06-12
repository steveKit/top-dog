# Milestone M3: Reactions & Per-Dog Stats

> **Status:** `active`
> Index: [[TASKS]] · Architecture: [[PROJECT]] · Conventions: [[CLAUDE]]
> **Goal:** cosmetic reactions, peak votes.

## Active Tasks

### TASK-032: E2E hardening — `/app/feed` + `/app/dogs/[id]` flows [`pending`] [`P2`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-024 (feed), TASK-031 (detail route)
**Origin:** promoted from DW-011 (feed E2E gap) + the PR #45 review (detail-route E2E gap).
**Acceptance Criteria:**

- [ ] End-to-end `@security`/`@smoke`-style E2E for `/app/feed` cast → move →
      remove against the live local stack (closes DW-011)
- [ ] E2E for `/app/dogs/[id]` detail view: RLS-scoped read access, signed-URL
      image render, and a 404 on a missing/invalid dog id
- [ ] Reactions surface on the feed exercised end-to-end (react / un-react
      toggle) if low-cost alongside the vote flow
- [ ] Suite stays green and serialized under `workers: 1`; document any required
      `supabase db reset` precondition

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

### TASK-031: Per-dog stats [`complete`] [`P3`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-021
**PR:** #45 (`e1ffa0e`, squash-merged) · **Reviewer:** APPROVE · **Fix cycles:** 0
**Acceptance Criteria:**

- [x] Track/display peak_votes per dog
- [x] Stats visible on the dog detail view

**Notes:**

**Pure display/wiring — zero schema, RLS, RPC, or migration change.**
`peak_votes` / `vote_count` already exist on `hot_dogs`, server-maintained by
the M2 vote RPC (`cast_vote` recomputes `vote_count` authoritatively from
`COUNT(votes)` and bumps `peak_votes` via `greatest()` in-transaction). This
task only surfaces those columns — there is no new write path and the
column-grant lockdown (decision #24) is untouched.

New per-concern query module `src/lib/features/hotdogs/detail.ts`:
`getDogDetail(supabase, dogId, viewerId)` returns a discriminated
`DetailResult<DogDetail>` carrying `vote_count`, `peak_votes`, caption,
`created_at`, `image_path`, and a normalized owner `profiles` embed (handle,
display_name, is_current_top_dog, top_dog_since). A `DOG_NOT_FOUND` sentinel is
kept **distinct from a real read error** so the route can map the two to
different HTTP statuses. The file is named `detail.ts` (per-concern) mirroring
the established `voting/feed.ts` vs `voting/votes.ts` split, not folded into a
catch-all module.

New route `/app/dogs/[id]` (`src/routes/(protected)/app/dogs/[id]/`): a
`safeGetSession`-gated load that maps `DOG_NOT_FOUND` → `error(404)` and a read
error → `error(500)` (raw SDK message logged server-side only, never surfaced),
mints the image signed URL via the `$lib/storage` barrel with **graceful null
degradation** on a failed mint, and attaches a **read-only** reaction summary
(`listReactionsForDogs` + the pure `summarizeReactions`). The page renders a
larger image, caption, owner link, and a **Stats** block (Peak votes / Current
votes), plus `<TopDogBadge>` when the owner holds the crown. **Reactions here
are display-only — no react/unreact actions** (decision #12: interactive
reactions stay on the feed; the detail view is a read surface).

`src/lib/features/voting/feed.ts` gained `peak_votes` as an **additive** field
on the `listVotableDogs` select / `VotableDog` type / mapper (read-only column;
no write-path change), and the feed + `/app/dogs` tiles grew a per-tile
`Peak: N` indicator and a "View details" link into the new route.

**DW-010 folded in:** the obsolete `votes.ts` module-doc comment (which still
claimed the wrapper had "no non-test caller by design," untrue since TASK-024
wired `/app/feed`) was corrected — comment-only.

**Three minor review notes, all reviewer-recommended no-change:** (a)
`getDogDetail`'s `viewerId` param is currently unused but kept for parity with
`feed.ts` and future viewer-relative reads (scoped `eslint-disable`); (b) a dead
`|| owner.display_name` link fallback (`profiles.handle` is NOT NULL, so it can
never fire); (c) no E2E for `/app/dogs/[id]` — now addressed by the promoted
TASK-032.

**Metrics:** `pnpm test` 420 pass (new: detail query 14, detail load 12, feed
`peak_votes` cases); `@smoke` + `@security` (31) green; `pnpm check` 0 errors,
lint clean. Reviewer APPROVE, 0 fix cycles.

This task did **not** close M3 — DW-011 (the `/app/feed` E2E gap) was promoted
into M3 as a new **TASK-032 (E2E hardening)**, which also subsumes the
detail-route E2E gap from this PR's review and remains the active M3 task.

---

> **No caps.** Acceptance criteria, subtasks, and integration points are
> unbounded. Give each task as much specificity as it needs to be completed to
> spec — never trim detail to hit a count.
