# Milestone M3: Reactions & Per-Dog Stats

> **Status:** `complete`
> Index: [[TASKS]] · Architecture: [[PROJECT]] · Conventions: [[CLAUDE]]
> **Goal:** cosmetic reactions, peak votes.

## Active Tasks

_None — all M3 tasks are complete and the milestone is closed (see below)._

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

### TASK-032: E2E hardening — `/app/feed` + `/app/dogs/[id]` flows [`complete`] [`P2`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-024 (feed), TASK-031 (detail route)
**Origin:** promoted from DW-011 (feed E2E gap) + the PR #45 review (detail-route E2E gap).
**PR:** #47 (`5cf5879`, squash-merged, with TASK-033) · **Reviewer:** APPROVE
**Acceptance Criteria:**

- [x] End-to-end `@smoke`-style E2E for `/app/feed` cast → move → remove against
      the live local stack (closes DW-011)
- [x] E2E for `/app/dogs/[id]` detail view: RLS-scoped read access, signed-URL
      image render, and a 404 on a missing/invalid dog id
- [x] Reactions surface on the feed exercised end-to-end (react / un-react toggle)
- [x] Suite stays green and serialized under `workers: 1`; db-reset precondition
      documented

**Notes:**

**Pure test coverage — zero schema, RLS, RPC, app-code, or migration change.**
This task promoted DW-011 (the `/app/feed` E2E gap) into M3 and subsumed DW-013
(the detail-route E2E gap from the TASK-031 review). New spec
`tests/feed-detail.e2e.ts` (`@smoke`) drives a real browser against the **live
LOCAL stack only** (the non-localhost-guarded helper aborts if the resolved URL
isn't local; the service key stays Node-side; fixtures use unique
`crypto.randomUUID()` ids). It covers: a `/app/feed` cast → move → remove flow
asserting the **authoritative** `vote_count` and the global crown via
service-role read-backs; the feed react / un-react toggle against authoritative
reaction counts; `/app/dogs/[id]` non-owner image **render + decode** plus a
signed-URL shape assertion; and a **404 on both a non-existent and a malformed
(non-uuid) id**. It is serialized under `workers: 1` with `describe.serial` and a
per-test crown reset, consistent with the existing `@security` suite's shared-DB
discipline.

**This is the task that earned its keep:** running it surfaced a latent **P0** —
non-owner `hotdogs` images never rendered because the loads minted signed URLs
with the viewer's owner-only RLS client (the feed's entire purpose is browsing
OTHER members' dogs). The `@smoke` suite had masked it by only ever viewing the
user's OWN dog. The fix landed as **TASK-033** in the same PR; the deferred E2E
(DW-011) more than paid for itself.

**Precondition:** the spec uses live-stack fixtures, so run against a clean DB —
`supabase db reset` (stack up) before `pnpm test:e2e --grep @smoke`. The shared
db-reset precondition for the `@security`/`@smoke` suites is now documented in
[[CLAUDE]] Commands and [[README]] (tracked as DW-014).

**Metrics (after `supabase db reset`):** `pnpm test` 423/0, `pnpm check` 0
errors, `pnpm lint` clean, `@smoke` 4/0 (including the 3-test reproduction),
`@security` 31/0. Reviewer APPROVE.

This task **closed M3** together with the P0 fix it surfaced (TASK-033).

### TASK-033: Fix non-owner signed-URL rendering + malformed-id 404 (P0) [`complete`] [`P0`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-024 (feed), TASK-031 (detail route)
**Origin:** P0 bug surfaced by TASK-032's feed/detail E2E.
**PR:** #47 (`5cf5879`, squash-merged) · **Reviewer:** APPROVE · **Fix cycles:** 1
**Acceptance Criteria:**

- [x] Feed + detail loads mint `hotdogs` signed URLs via the service client
      (`$lib/server`) after the `safeGetSession` auth gate (decision #6 model
      preserved: private bucket + TTL signed URLs; service client server-only)
- [x] `/app/dogs/[id]` with a malformed (non-uuid) id returns 404, not 500
- [x] TASK-032's `feed-detail.e2e.ts` passes (non-owner image render; bad id → 404)
- [x] No regression: `@smoke` + `@security` green; `pnpm test` / `check` / `lint`
      clean

**Notes:**

**The bug (P0).** The feed (`/app/feed`) and dog-detail (`/app/dogs/[id]`) loads
minted `hotdogs` signed URLs with the **viewer's RLS-scoped client**
(`event.locals.supabase`), but the `hotdogs` bucket's only SELECT policy is
owner-only (`hotdogs_select_own`) and `createSignedUrl` is **RLS-gated at
creation** — so a non-owner could not mint a URL for another member's dog, and
every non-owned image rendered "Image unavailable." Latent since **TASK-024**
(the feed exists precisely to browse OTHERS' dogs to vote on); masked because the
`@smoke` suite only ever viewed the user's OWN dog until TASK-032's
`feed-detail.e2e.ts` viewed someone else's. The migration comment in
`20260608153759_rls_baseline_and_storage_buckets.sql` ("everyone else must use a
signed URL, which bypasses RLS") was **wrong about the creation side** — signing
is gated by storage SELECT, the bypass is only on the read of the resulting URL.

**The fix (user-approved Option 1).** The feed + detail loads now mint `hotdogs`
signed URLs via the privileged service client (`$lib/server` `getServiceClient()`),
constructed **AFTER** the `safeGetSession()` gate. The dog / owner / reaction
**queries stay on the RLS-scoped `event.locals.supabase`** — only the storage
signing uses the service client, and it only ever signs `image_path` from rows
the member's own RLS query already returned (no exposure widening). The
`/app/dogs` own-dogs gallery correctly **stays on the RLS client** (you sign your
own objects). **Decision #6's privacy model is preserved:** the bucket stays
private, URLs stay TTL-limited (1h signed URLs), and the service client is
server-only via the `$lib/server` import boundary. **No storage RLS / bucket
change.** The reviewer confirmed signing happens after auth, signs only
already-authorized rows, and that the own-dogs gallery was left on the RLS client.

**Malformed-id 404.** `/app/dogs/[id]` with a non-uuid id now returns **404**
(was 500) via a new `isUuid()` guard in `$lib/storage/paths.ts` (reusing the
existing `UUID_RE`) **before** the DB read; genuine read errors still map to 500.

**Lock-in tests.** New unit assertions (`detail-load.test.ts`,
`feed-action.test.ts`) pin that the signer is the **service client** and **NOT**
`event.locals.supabase` — the exact assertion that would have caught the original
P0 at the unit layer.

**Fix cycles: 1.** **Metrics (after `supabase db reset`):** `pnpm test` 423/0,
`pnpm check` 0 errors, `pnpm lint` clean, `@smoke` 4/0 (including the 3-test
reproduction), `@security` 31/0. Reviewer APPROVE. Two follow-ups were logged as
Discovered Work: direct `isUuid` unit coverage (the route test mocks it, so the
real `UUID_RE` is only exercised by the live-stack E2E — DW-015) and extracting
the service-role E2E helpers duplicated between `feed-detail.e2e.ts` and
`votes.e2e.ts` into `tests/helpers/` (DW-016).

This task **closed M3** together with TASK-032.

---

> **No caps.** Acceptance criteria, subtasks, and integration points are
> unbounded. Give each task as much specificity as it needs to be completed to
> spec — never trim detail to hit a count.
