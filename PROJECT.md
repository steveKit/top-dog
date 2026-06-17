# Top Dog — Project Overview

## Status

**Phase:** Active Development
**Last Updated:** 2026-06-17

Invite-only social app for showing off homemade hot dogs. Users upload photos,
cast a single movable vote for the best hot dog (not their own), and compete for
"Top Dog" status. The Top Dog earns a badge and can spray decaying mustard on
other profiles.

**Milestone M0 — Scaffold & Infra is complete.** All five tasks landed: TASK-001
(SSR auth, PR #1 `3978cee`), TASK-002 (swappable storage seam, PR #5 `505f4a1`),
TASK-003 (RLS baseline + `hotdogs`/`avatars` buckets, PR #3 `cdf7bed`), TASK-005
(global storage guard, PR #7 `d95eafc`), and TASK-004 (keep-alive — ops task, no
PR). The **hosted Supabase project is now live**: the schema is pushed
(`supabase db push`), the two GitHub repo secrets (`SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`) are set, and the keep-alive workflow is enabled and
**verified green** (manual run returned HTTP 200 against `profiles`, resetting the
7-day auto-pause timer).

The auth-trust boundary is established by `safeGetSession()`, which validates
the JWT via `supabase.auth.getUser()` and refuses an unvalidated `getSession()`
(implements decision #4). Env presence is validated at the boundary via
`getPublicSupabaseConfig()` (the app reads `$env/dynamic/*`, not static).

### Milestone M0 close notes

Two items from the going-live session are recorded here for auditability:

1. **Hosted/local migration parity fix (PR #9).** `supabase db push` to the hosted
   DB failed with `type "citext" does not exist` because the migration referenced
   the extension-provided type unqualified. The local migration role has
   `extensions` in its `search_path`; the hosted role does not. Fixed by
   schema-qualifying as `extensions.citext`. **Reusable lesson:** all future
   migrations (invites, hot_dogs, vote RPC) must schema-qualify extension types.
   Captured as a [[CLAUDE]] gotcha and in the README migration guide.
2. **Accepted foundational orphans (M0 wiring audit).** The audit flagged three
   exports with no non-test consumers yet — `getServiceClient`
   (`$lib/server/supabase.ts`), the `$lib/storage` module
   (`upload`/`getSignedUrl`/`getPublicUrl`/`remove` + `hotdogPath`/`avatarPath`),
   and `evaluateUpload` (`$lib/storage/guard.ts`). These are **foundational seams,
   not dead code** — each has a dependency-declared M1 consumer: the storage module
   → TASK-011 (avatar upload) + TASK-013 (hot dog upload); `evaluateUpload` →
   TASK-013 (wiring carried as explicit ACs there); `getServiceClient` →
   privileged server ops in M1. All three were reviewer-accepted during their PRs,
   and the user explicitly approved closing M0 with this documented exception. The
   auth foundation (hooks, layouts, protected route, `getPublicSupabaseConfig`) is
   fully wired.

**Milestone M1 — Vertical Slice is complete.** All five M1 tasks have landed:
TASK-010 (invite generation + redemption, PR #13 `ef59aea`), TASK-012 (client-side
WebP compression, PR #16 `2828468`), TASK-011 (profile creation, PR #18 `38db5d9`),
TASK-013 (hot dog upload + display, PR #20 `c552be5`), and TASK-014 (the `@smoke`
vertical slice, PR #22 `aed7e90`). The invite-only growth path (decision #17) is
end-to-end — an authed user mints a unique invite link at `(protected)/app/invite`,
and the public `/sign-up` flow consumes it (pre-check → `signUp` → atomic redeem
RPC → session-branch redirect). Client compression (decisions #8/#9, the linchpin
that makes the 1 GB free-tier cap viable) is in place as a shared seam. The redeemed
user has an **onboarding funnel** that sets a validated unique `@handle` and
optionally an avatar; a member can **upload a compressed hot dog and see it rendered
via a signed URL**, guarded by the per-user 100 cap and the global storage guard,
with orphan-safe upload/delete ordering. **All M0 foundational orphans are now
wired.** The whole slice is locked in by a Playwright `@smoke` that later milestones
must keep green.

**Milestone M2 — Voting & Top Dog Engine is complete.** All five tasks have landed:
TASK-020 (ranking + sticky tie-break logic, PR #25 `835c2f0`), TASK-021 (Vote RPC,
PR #28 `a170676`), TASK-022 (daily Top Dog tally, PR #31 `4351aa9`), TASK-023 (badge
UI, PR #37 `6d1b206`), and TASK-024 (vote-casting feed, PR #40 `94d2e52`). The
crown-selection contract from decision #13 is realized as the **pure `selectTopDog`
seam** in `src/lib/features/voting/ranking.ts` — a strict total-order comparator
(vote count desc → earliest non-null `topDogSince` sticky, null-last → `id`
tie-break). TASK-021 consumes it: the `cast_vote` / `remove_vote` SECURITY DEFINER
RPCs are the **sole write path** for votes (no client write), recomputing
`vote_count` authoritatively from `COUNT(votes)` in-transaction (drift-free) and
recomputing the crown with SQL that provably **mirrors** `selectTopDog` —
discharging the forward-looking lockstep constraint raised at the TASK-020 review.
TASK-022 then counts reign-time into the `days_as_top_dog` stat: the
`tally_top_dog_day()` SECURITY DEFINER RPC is idempotent at two layers
(`UNIQUE(profile_id, day)` + `ON CONFLICT DO NOTHING`, plus `days_as_top_dog`
recomputed authoritatively from `COUNT` — never a blind `+1`) and is wired into the
daily keep-alive workflow as an anon-callable, no-caller-input job (decision #26).
TASK-023 (badge UI) added the read-only display layer — a shared `<TopDogBadge>` on
the Top Dog's profile and their winning-dog tile, with the winning dog resolved by
**reusing the pure `selectTopDog` comparator** so the badge stays in lockstep with
`recompute_top_dog()` (no parallel ordering). TASK-024 closed the loop: a **global
vote feed** at `/app/feed` that lists every _other_ member's dog sorted by
`vote_count` desc (so it doubles as the live leaderboard), each rendered via a
signed URL, wiring the previously-orphaned `castVote` / `removeVote` wrappers into
server-side form actions — a member can finally cast, move, and remove a vote.
**The M2-close wiring audit re-passed** (DW-009 resolved): `castVote` / `removeVote`
/ `listVotableDogs` / `getCurrentVote` all now have a production consumer in
`/app/feed`. **Voting is now end-to-end** (browse feed → cast / move / remove → Top
Dog crown + badge).

**Milestone M3 — Reactions & per-dog stats is complete** (4 tasks; tag
`milestone-03-reactions-per-dog-stats`): cosmetic hot-dog emoji reactions
(structurally inert to ranking), per-dog stats + a `/app/dogs/[id]` detail
view, and a live-stack feed/detail E2E that caught and fixed a non-owner
signed-URL P0 (decision #27). See the M3 close notes below.

**Milestone M4 — Mustard Mechanic is complete.** All three tasks have landed:
TASK-040 (mustard decay math, PR #53 `5afd0da`), TASK-041 (mustard spray +
render, PR #55 `e1eafb9`), and TASK-042 (mustard prune job, PR #57 `6452407`).
The **mustard mechanic is shipped end to end**: a pure render-time decay seam
(`mustardOpacity`, full → 0 over 24h) realizing decision #15, a Top-Dog-gated
spray that renders an opacity-decayed overlay on a target profile (a plain
owner-scoped RLS write whose `WITH CHECK` authorizes against the
non-client-writable crown column, decision #25), and a daily
`prune_mustard_sprays()` job — the table's sole DELETE path, mirroring
`tally_top_dog_day()` — wired into the keep-alive workflow as an anon-callable,
idempotent, no-input job (decision #26). Sprays are immutable + persistent
across crown changes; the drip is computed entirely at render from the stored
timestamp. **Hosted-push gate pending:** the two new migrations must be
`supabase db push`ed to hosted before the next scheduled keep-alive run (see
Process notes). Next: M5 — Walls & DMs.

**Milestone M5 — Walls & DMs is complete** (4 tasks; tag `milestone-05-walls-dms`).
Two new social surfaces landed — **profile message walls** (`wall_messages`,
TASK-050) and private **direct messages** (`dms`, TASK-051) — both as decision #12
**cosmetic / many-allowed tables with no denormalized counter**, writing through
plain owner-scoped RLS (the deliberate inverse of the consuming-writes-via-RPC
convention). Both store the **original message body verbatim** (so the M6 emoji
render-time filter stays free to apply later); DMs add a conversation-scoped privacy
SELECT and a `read_at`-only mutation boundary (decision #24's column-grant mechanism
applied to a privacy column), with a pure render-time `summarizeConversations` inbox
collapse. Mid-milestone, M5 also **absorbed and remediated a project-wide Data API
grant regression**: the Supabase CLI's `auto_expose_new_tables` default flipped to
`false` (2026-05-30), so a fresh `supabase db reset` stopped issuing the implicit base
table GRANTs PostgREST needs alongside RLS — turning `@smoke`/`@security` RED and
breaking the real invite path. TASK-052 restored the grants explicitly
(`restore_data_api_grants` migration) while preserving the decision #24/#25 column
lockdowns and decision #12 RPC-only write paths, pinned `auto_expose_new_tables =
false` in config so local matches cloud, and the model is now recorded as **decision
#28**; TASK-053 added the `tests/grants.e2e.ts` guard locking the matrix in against
future drift. **Hosted-push gate deferred:** three unpushed migrations
(`wall_messages`, `dms`, `restore_data_api_grants`) must reach hosted in one
`supabase db push` — tracked as **TASK-054** in [[tasks/deferred]], a user-gated ops
follow-up with no auto-pause risk (no keep-alive step depends on them). See the M5
close notes below. Next: M6 — Emoji library.

**Milestone M6 — Emoji library is complete** (2 tasks; tag `milestone-06-emoji-library`).
TASK-060 landed the **pure render-time emoji seam** — a new dependency-free feature folder
`src/lib/features/emoji/` (`emojiSet.ts` curated `HOTDOG_EMOJIS` + `isHotdogEmoji`;
`filter.ts` `filterToHotdog` grapheme-cluster-safe via `Intl.Segmenter` + `sprinkleHotdog`
deterministic via a hand-written `mulberry32` PRNG, zero deps) — and TASK-061 wired it into
the live render surfaces via a new pure composition layer
`src/lib/features/emoji/render.ts` (`renderWallBody` = filter + seeded sprinkle for walls;
`renderMessageBody` = filter only for DMs), realizing **decision #16** (hot-dog-only library;
filter at RENDER time; the ORIGINAL stored body is NEVER mutated). The filter is now live on
the profile wall, the DM thread, and the DM inbox preview, all through Svelte auto-escaped
text (no `{@html}` → XSS-safe), so decision #16's "store original" guarantee holds
**structurally** — there is no persist path that could mutate the stored body. **No new
architecture-decision row** (decision #16 already exists). DW-019 (VS16-decorated
library-emoji handling) is **resolved/accepted** in TASK-061; DW-020 (a render-DOM E2E gap)
is an accepted tracked gap. See the M6 progress notes and close notes below.

### Milestone M1 progress notes

1. **Single-use invariant keys on `consumed_at`, not `consumed_by` (TASK-010,
   PR #13).** The `invites` table tracks consumption with two columns; the redeem
   guard and the single-use CHECK key on `consumed_at` (which the FK never nulls),
   while `consumed_by` → `auth.users` uses `on delete set null` for audit only,
   guarded by a one-directional CHECK `(consumed_by is null or consumed_at is not
null)`. An earlier bidirectional CHECK + `on delete set null` pairing both
   blocked deleting any redeemer _and_ would have let a spent token become
   re-redeemable after its redeemer was deleted — caught and fixed in review.
   **Reusable lesson:** single-use guards must key on a column the FK never nulls
   (captured as a [[CLAUDE]] gotcha).
2. **Pre-auth redemption via anon-executable SECURITY DEFINER RPCs.** Redemption
   runs while unauthenticated, so it can't use the inviter's RLS; `redeem_invite`
   / `invite_is_redeemable` (both `search_path=''`, schema-qualified, granted
   `anon` + `authenticated`) are the controlled single-transaction write path —
   reinforcing the project convention that consuming writes go through RPC.
3. **`getServiceClient` M0 seam now partially realized.** The sign-up action's
   orphaned-account cleanup (`getServiceClient().auth.admin.deleteUser` on a
   lost-race redeem failure after a successful `signUp`, so the email stays
   reusable) is the **first real consumer** of the privileged service client —
   the M0 "accepted foundational orphan" is now server-side wired.
4. **New shared `src/lib/image/` seam for client compression (TASK-012, PR #16).**
   WebP compression (decisions #8/#9) landed as `src/lib/image/compress.ts` — a
   feature-agnostic utility placed **parallel to `src/lib/storage/`, deliberately
   NOT under a feature folder**, because both TASK-011 (avatar upload) and TASK-013
   (hot dog upload) consume it. It splits along a pure/canvas seam:
   `fitWithinMaxEdge` is the PURE aspect-preserving downscale (caps the longest
   edge, never upscales, throws on invalid dims), and `compressToWebp`
   type-validates input first, then decodes → resizes on canvas → encodes
   `image/webp` (defaults maxEdge 1280, quality 0.8) with zero new dependencies.
   Like the M0 storage guard, the module is an **accepted foundational orphan** —
   no non-test consumer until TASK-011/013 wire it into the upload paths. Real
   pixel-encoding fidelity (~100–200 KB target) is deferred to the TASK-014
   Playwright `@smoke` (the node Vitest env can't simulate a real canvas); the unit
   tests own the deterministic dimension math, type-rejection, and option flow.
5. **Profile creation + onboarding funnel (TASK-011, PR #18).** Feature module
   `src/lib/features/profiles/` follows the `invites/` shape: a pure `handle.ts`
   validator enforcing the charset `^[A-Za-z0-9_]{2,32}$` at the app boundary (the
   DB CHECK is length-only; casing preserved, uniqueness case-insensitive via
   `citext`), plus typed server wrappers in `profiles.ts`. `createProfile` maps a
   Postgres `23505` unique-violation to a `HANDLE_TAKEN` sentinel keyed on SQLSTATE
   (never constraint text) — best-effort pre-check backed by the authoritative DB
   UNIQUE constraint, mirroring TASK-010's invite pattern. The
   `(protected)/app/+layout.server.ts` load routes a profile-less authenticated
   user to `/app/onboarding` (no redirect loop; unauthenticated → `/sign-in`
   preserved), satisfying "profile row created post-redemption." Onboarding
   validates the handle, defaults `display_name` to the handle if blank, and
   optionally compresses an avatar client-side via `compressToWebp` then uploads it
   to `{uid}/avatar.webp` (owner prefix built from the trusted `user.id`) — the
   **first live consumer of both the image and storage seams**, realizing two of
   the accepted M0/M1 foundational orphans. Upload **fails closed**: a storage
   failure aborts before any profile insert. The PR also hardened `compressToWebp`
   with a `try/finally` so the decoded `ImageBitmap` is always released (resolving
   the TASK-012 bitmap-leak nit, now reachable via its first live consumer).
6. **Hot dog upload + display + delete (TASK-013, PR #20).** Migration
   `20260609181013_hot_dogs.sql` adds the `hot_dogs` table (with `byte_size` and a
   caption-length CHECK ≤280) plus an `app_storage_bytes()` SECURITY DEFINER RPC for
   the global guard. RLS: SELECT for `authenticated` (image **bytes** are protected
   by the private bucket + signed URLs, not row RLS), owner-scoped write via
   `(select auth.uid())`. Counters (`vote_count` / `peak_votes` / `created_at`) are
   made non-client-writable via **column-level privileges on BOTH write paths** —
   `grant update (caption)` and `grant insert (id, owner_id, image_path, caption,
byte_size)` after revoking table-wide write — so a direct PostgREST insert cannot
   forge an opening counter (decision #24). The reviewer caught that the original PR
   restricted only UPDATE, leaving the INSERT path open; the column-level INSERT
   grant closed it. The upload route (`/app/dogs`) compresses client-side, enforces
   the 100-per-user cap, runs `evaluateUpload` (the global guard), uploads to
   `hotdogs/{uid}/{id}.webp` under the trusted owner prefix, then inserts — failing
   closed with a **compensating storage delete** if the insert fails, so no object
   is orphaned. Display lists the owner's dogs with per-row signed URLs (1h TTL,
   per-row graceful degradation); delete removes the row first, then the object. This
   wires `evaluateUpload` / the `$lib/storage` barrel as the storage guard's first
   live consumer, **resolving the last M0 foundational orphan**. Accepted v1
   residual: `byte_size` is a client-supplied soft guard input (a direct insert could
   understate it), so the global guard is best-effort, not a hard quota — carried as
   Discovered Work in [[TASKS]].

### Milestone M1 close notes

M1 delivered the **full vertical slice** end to end: invite-only sign-up +
single-use redemption → profile onboarding (`@handle` + optional avatar) →
client-side WebP compression → hot dog upload to the **private** bucket (per-user
100 cap + global storage guard) → **signed-URL render** → orphan-free delete. The
entire path is gated by a Playwright `@smoke` (TASK-014) that all later milestones
must keep green.

1. **All M0 foundational orphans are now wired.** M0 closed with three exports that
   had no non-test consumer yet — each is now live: `getServiceClient` (TASK-010,
   sign-up orphan-account cleanup), the `$lib/storage` module (TASK-011 avatars +
   TASK-013 hot dogs), and `evaluateUpload` (TASK-013, re-exported from the
   `$lib/storage` barrel as the storage guard's first live consumer). No dead code
   remains from the M0 seam-first approach.
2. **L2 security posture realized at the DB.** The slice lands the project's
   defense-at-the-DB stance concretely: a single-use invite RPC (`consumed_at`
   guard, decisions #22/#23), owner-scoped RLS everywhere via the
   `(select auth.uid())` initplan idiom, **column-level privileges** keeping the
   denormalized counters (`vote_count` / `peak_votes` / `created_at`)
   non-client-writable on both INSERT and UPDATE (decision #24), and storage
   **owner-prefix** policies binding objects to `auth.uid()/...`.
3. **Accepted v1 residual + regression backstop.** One residual is carried into
   v1: `hot_dogs.byte_size` is a client-supplied **soft** storage-guard input (a
   direct insert could understate it), so the global guard is best-effort, not a
   hard quota — accepted under the invite-only trust model and tracked as Discovered
   Work in [[TASKS]]. As the regression backstop, `@smoke` now exercises the live UI
   slice and a sibling `@security` E2E (`tests/db-guards.e2e.ts`) asserts the
   migration-level write guards (forged-counter and oversized-caption inserts both
   rejected) against a live Postgres — guards that unit tests cannot reach.
4. **Accepted minor test-only export (M1 wiring audit).** The milestone wiring
   audit came back clean save for one benign finding: `isValidHandle`
   (`src/lib/features/profiles/handle.ts`) is exported but has **no production
   consumer** — it is exercised only by its own unit tests, while the wired,
   production-used validator is `validateHandle` (the onboarding route). It is a
   redundant one-line sibling predicate
   (`HANDLE_PATTERN.test(normalizeHandle(raw))`), not unwired functionality —
   far more trivial than, but analogous to, the M0 "accepted foundational
   orphans" precedent above. Accepted and documented at M1 close; the optional
   tidy (drop the `export` or remove the redundant predicate) is tracked as
   non-blocking Discovered Work in [[TASKS]].

### Milestone M2 progress notes

1. **Vote RPC — cast/move/remove + drift-free counter + crown (TASK-021, PR #28).**
   Migration `20260610181704_votes_and_vote_rpc.sql` adds the `votes` table
   (`UNIQUE(voter_id)`, one active vote per user — decision #12) with default-deny
   RLS: SELECT-only for `authenticated` and **no client write path** — voting is
   mediated entirely by RPC, and a BEFORE INSERT/UPDATE trigger rejects self-votes
   at the DB. Two SECURITY DEFINER RPCs (`search_path=''`, schema-qualified,
   EXECUTE to `authenticated` only) own all writes: `cast_vote(target_dog uuid)`
   casts-or-moves a vote and `remove_vote()` retracts it, each in one transaction;
   **voter identity is derived from `(select auth.uid())` inside the RPC**, never
   client-supplied. `vote_count` is recomputed authoritatively from the live
   `COUNT(votes)` **inside the transaction** (so it cannot drift under concurrent
   votes — closes adversarial finding B), and `peak_votes` bumped via
   `greatest()`. `recompute_top_dog()` reproduces `selectTopDog`'s total order in
   SQL (`vote_count` DESC → earliest non-null `top_dog_since`, NULL last, sticky →
   ascending `hot_dogs.id`), setting a fresh `now()` only on a new reign — the
   reviewer **empirically confirmed** the SQL stays in lockstep with the TS
   comparator, discharging the forward-looking lockstep constraint from the
   TASK-020 review. The typed wrapper `src/lib/features/voting/votes.ts`
   (`castVote` / `removeVote`) returns a discriminated `VoteResult` with sentinels
   keyed on SQLSTATE (`28000`/`23514`/`P0002`), and is an accepted orphan-by-design
   until route wiring (a later M2 task).
2. **Two L2 fix-cycle security findings closed (TASK-021 review).** (a) The crown
   columns on `profiles` (`is_current_top_dog` / `top_dog_since` /
   `days_as_top_dog`) were client-forgeable — `profiles` had no column-level write
   grants, so a plain PostgREST INSERT/UPDATE could seed or overwrite them. Fixed
   by applying **decision #24's insert+update column-grant pattern** (previously on
   `hot_dogs`) to the `profiles` crown columns — see decision #25. (b)
   `revoke execute ... from public` was insufficient to lock down the private
   `recompute_*` helpers: Supabase explicitly grants EXECUTE on new `public.*`
   functions to `anon` and `authenticated`, so the helpers stayed callable until
   the grant was revoked from `public, anon, authenticated`. Captured as a
   [[CLAUDE]] gotcha for all future SECURITY DEFINER helpers.
3. **Daily Top Dog tally — idempotent at two layers, anon-callable (TASK-022,
   PR #31).** Migration `20260611174243_top_dog_days_and_tally.sql` adds the
   `top_dog_days` table (`profile_id` → `profiles on delete cascade`, `day date`,
   `UNIQUE(profile_id, day)` per decision #14) under default-deny RLS — SELECT-only
   for `authenticated`, **no client write path**. The `tally_top_dog_day()` SECURITY
   DEFINER RPC (`search_path=''`, schema-qualified) finds the current Top Dog, does
   `insert (holder, current_date) on conflict (profile_id, day) do nothing`, then
   recomputes `days_as_top_dog = count(top_dog_days)` **authoritatively (never a
   blind `+1`)** — so re-runs and early triggers can't drift the count, the **same
   drift-free discipline as the TASK-021 vote RPC**. It is a no-op when no current
   Top Dog exists. **The auth model is decision #26 (A1):** the RPC takes **no
   caller input** (`pronargs = 0`) and only ever records the actual current Top Dog's
   `current_date`, so it is EXECUTE-granted to `anon` + `authenticated` and the daily
   keep-alive workflow calls it via PostgREST with the **existing publishable key** —
   deliberately avoiding a new repo secret. The reviewer empirically confirmed it is
   not forgeable and is self-limiting (worst case: an anon caller triggers today's
   idempotent tally early — exactly what the cron does); this sets the auth pattern
   for the M4 mustard-prune job (TASK-042), wired into the same workflow. The tally
   step **fails the workflow on non-2xx**, so a broken tally turns it red (also
   protecting the 7-day auto-pause guarantee). `days_as_top_dog` and `top_dog_days`
   stay non-client-writable (the RPC is the sole writer), verified by 7 live-DB
   `@security` specs (`tests/tally.e2e.ts`). Reviewer APPROVE, 0 fix cycles.
   Test-infra note: `playwright.config.ts` is pinned to `workers: 1` because the
   `@security` suite mutates the global singleton crown against one shared local
   Postgres — default multi-worker parallelism races across spec files (pre-existing
   latent fragility this third crown-mutating spec surfaced).
4. **Top Dog badge UI — read-only, `selectTopDog` lockstep (TASK-023, PR #37).**
   The display layer for the crown the engine maintains, landed with **zero SQL /
   RLS / RPC changes**. New shared component `src/lib/components/TopDogBadge.svelte`
   (👑, `role="status"`, optional `label`); the profile page refactored its inline
   badge to it against the same `profiles.is_current_top_dog` gate, and `/app/dogs`
   grew a badge on the winning-dog tile. The winning dog is resolved by **reusing
   the pure `selectTopDog` comparator** (`$lib/features/voting/ranking.ts`) — the
   load fetches the signed-in user's own profile, maps their dogs to `RankableDog`,
   and runs the same single-source-of-truth seam the vote RPC writes from, so there
   is **no parallel ordering** and the badge stays in lockstep with
   `recompute_top_dog()` (decision #13). Both surfaces derive from live server crown
   state on each load (never cached). +8 test-after unit cases for the load wiring
   (`dogs-action.test.ts`, real `selectTopDog` left unmocked); `pnpm test` 320/320,
   `pnpm check` 0 errors, lint clean, `@smoke` + `@security` (27/27) green. Reviewer
   APPROVE, 0 fix cycles, 2 minor non-blocking notes (unstyled `class="badge"`,
   consistent with the app-wide unstyled markup; a redundant `rankable.length > 0`
   guard before `selectTopDog`).
   **M2 is held open** by the wiring audit, not closed: the vote wrapper
   (`castVote` / `removeVote` in `src/lib/features/voting/votes.ts`) still has **no
   production consumer** — there is no vote-casting UI anywhere in the app, so a
   member cannot actually cast a vote. TASK-021 repeatedly deferred this to "a later
   M2 task" that was never created. A vote-casting UI task must land and re-pass the
   wiring audit before M2 can close (logged as DW-009 in [[TASKS]]).
5. **Vote-casting feed — the missing consumer, closing DW-009 (TASK-024, PR #40).**
   New global feed route `src/routes/(protected)/app/feed/` (`+page.server.ts` load
   - `vote` / `remove` form actions, `+page.svelte` leaderboard/feed UI) consuming
     the previously-orphaned `castVote` / `removeVote` wrappers, plus a new query
     module `src/lib/features/voting/feed.ts` (`listVotableDogs(supabase, viewerId)` —
     self-excluded, owner `profiles` embed, `vote_count` desc → `id` asc, discriminated
     `FeedResult`; and `getCurrentVote(supabase, viewerId)`). **Zero schema / RLS / RPC
     / migration changes and zero new dependencies** — pure consumption of the existing
     vote RPCs, the `selectTopDog`-maintained crown, and the `$lib/storage` signed-URL
     barrel. The **design choice** is that the vote-casting surface is a single global
     feed that **doubles as the live leaderboard** (chosen over a per-profile vote
     button because the app had no discovery path — nowhere to browse other members'
     dogs, so nowhere a vote could originate). It is a UI-surface choice with no new
     invariant, so it is recorded here rather than as an architecture-decision row; the
     authoritative crown remains `recompute_top_dog()`, and the feed ordering merely
     mirrors the leaderboard read. **Security posture (L2), verified at review:** both
     the load and the two actions gate on `safeGetSession()`; the **voter id is never
     client-supplied** (the actions pass only the target dog id and the RPC derives the
     voter from `auth.uid()` — pinned by a `feed-action.test.ts` test); all mutations
     go through the SECURITY-DEFINER RPCs on the RLS-scoped `event.locals.supabase` (no
     direct vote writes); and `VoteResult` sentinels map to friendly `fail()` copy with
     raw Supabase errors logged server-side only (no raw error leakage). The embed is
     normalized for supabase-js's array-vs-object to-one quirk, and the feed degrades
     per-row on a failed signed-URL mint (and to "no current vote" on a read failure)
     rather than blanking. Test-after coverage: `feed.test.ts` (16) + `feed-action.test.ts`
     (18); gates `pnpm test` 354/354, `pnpm check` 0 errors, lint clean, `@smoke` green.
     Reviewer APPROVE, 0 fix cycles, 2 minor non-blocking notes (DW-010 obsolete
     `votes.ts` module-doc comment; DW-011 no `/feed` E2E — accepted tracked gap).

### Milestone M2 close notes

M2 delivered the **complete Voting & Top Dog engine** end to end: a strict
total-order crown comparator (`selectTopDog`), the `cast_vote` / `remove_vote`
SECURITY-DEFINER RPCs as the sole drift-free write path, the idempotent daily
`tally_top_dog_day()` job feeding `days_as_top_dog`, the read-only `<TopDogBadge>`
display layer, and finally the global vote feed that lets a member browse, cast,
move, and remove a vote — so the crown the engine maintains is now driven by real
member votes, not just covered by tests.

1. **The M2-close wiring audit re-passed (DW-009 resolved).** The audit had held
   M2 open because the vote wrappers (`castVote` / `removeVote`) had no production
   consumer — there was no vote-casting surface, so a member could not actually
   cast a vote. TASK-024's `/app/feed` route is that consumer; `castVote` /
   `removeVote` / `listVotableDogs` / `getCurrentVote` are all now wired into a
   production load + form actions. No vote-engine orphan remains.
2. **L2 security held at every layer of the new surface.** The feed reuses the
   project's established posture rather than introducing new trust assumptions:
   `safeGetSession()`-gated load and actions, voter id derived from `auth.uid()`
   inside the RPC (never client-supplied — pinned by a test), all writes through the
   SECURITY-DEFINER RPCs on the RLS-scoped client, sentinel-mapped user messages
   with raw errors logged server-side only. No schema / RLS / RPC change was needed
   to land the consumer safely.
3. **Accepted tracked gap (DW-011).** No E2E exercises the `/feed` route end-to-end
   (cast → move → remove against the live local stack). This is an accepted gap, not
   unwired functionality: the action orchestration is unit-tested and the RLS/RPC
   guarantees are covered by the live-DB `@security` specs (`votes.e2e.ts` /
   `tally.e2e.ts`). A future M2/M3 E2E hardening task is the candidate home.

### Milestone M3 progress notes

1. **Cosmetic reactions — plain owner-scoped RLS, not an RPC (TASK-030, PR #43
   `b27dc63`).** Migration `20260612104439_hotdog_reactions.sql` adds the
   `hotdog_reactions` table (`id` uuid PK, `user_id` → `profiles on delete
cascade`, `hot_dog_id` → `hot_dogs on delete cascade`, `emoji` text,
   `created_at`) with `UNIQUE(user_id, hot_dog_id, emoji)` and a
   `char_length(emoji) <= 16` CHECK. The per-emoji UNIQUE realizes decision #12's
   "many allowed": a user may stack many DISTINCT emojis on one dog, each
   toggling once. RLS is SELECT for `authenticated` and owner-scoped
   INSERT/DELETE via the `(select auth.uid()) = user_id` initplan idiom. **The
   write path is a plain RLS insert/delete, deliberately NOT a SECURITY-DEFINER
   RPC — the inverse of the project's consuming-writes-via-RPC convention.** That
   convention exists to maintain a denormalized counter transactionally;
   reactions have **no counter, no trigger, and nothing that touches
   `vote_count` / `peak_votes` / crown** — counts are computed at read time by
   the pure `summarizeReactions(rows, viewerId)` aggregator. So AC #3 ("reactions
   explicitly do NOT change vote_count or ranking") holds **structurally**, not by
   code discipline: there is no write path that could touch ranking state. This is
   decision #12 implemented (no new decision row); it also means decision #24's
   column-grant lockdown correctly does **not** apply here (the reviewer verified
   `created_at` / `id` are client-insertable but inert — no denormalized column to
   forge). The reusable shape is a **cosmetic / many-allowed table pattern** for
   future flair surfaces (relevant to M6 emoji). New feature module
   `src/lib/features/reactions/` (`emojiSet.ts`, pure `summarize.ts`, server
   `reactions.ts` with a discriminated `ReactionResult`; idempotent
   add — 23505 → benign — and idempotent remove — missing row → no-op) plus
   `src/lib/components/ReactionBar.svelte` (Svelte 5 runes; the picker hides
   already-owned emojis since the owned chip is the un-react affordance), wired
   into `/app/feed`. **Security (L2):** viewer id from `safeGetSession()`, never
   client-supplied (pinned by a hostile-`user_id` test); emoji validated at the
   app boundary twice (action + wrapper, deliberate defense-in-depth); raw errors
   logged server-side only. The interim hardcoded `REACTION_EMOJIS` set is a
   placeholder to be sourced from the M6 emoji library — tracked as DW-012.
   Metrics: `pnpm test` 396 pass; new `@security` live-DB E2E
   `tests/reactions.e2e.ts` (4 cases) proves owner-scoped INSERT RLS rejects
   forging another user's reaction and that insert+delete leaves
   `vote_count` / `peak_votes` unchanged; `@smoke` green, `pnpm check` 0 errors,
   lint clean. Reviewer APPROVE, 0 fix cycles, 2 minor no-change notes.
2. **Per-dog stats — display/wiring only, zero schema change (TASK-031, PR #45
   `e1ffa0e`).** `peak_votes` / `vote_count` already live on `hot_dogs`,
   server-maintained by the M2 vote RPC, so this task surfaces them with **no
   migration, RLS, RPC, or write-path change**. New per-concern query module
   `src/lib/features/hotdogs/detail.ts` (`getDogDetail` → discriminated
   `DetailResult<DogDetail>`, normalized owner `profiles` embed, a
   `DOG_NOT_FOUND` sentinel kept distinct from a real read error) and a new
   route `/app/dogs/[id]`: a `safeGetSession`-gated load mapping not-found →
   `error(404)` and a read error → `error(500)` (raw SDK message logged
   server-side only), the image signed URL minted via `$lib/storage` with
   graceful null degradation, and a **read-only** reaction summary
   (`listReactionsForDogs` + the pure `summarizeReactions`). The page renders a
   larger image, caption, owner link, a **Stats** block (Peak / Current votes),
   and `<TopDogBadge>` when the owner holds the crown. Reactions on the detail
   view are display-only — no react/unreact actions, keeping interactive
   reactions on the feed (decision #12). `voting/feed.ts` gained `peak_votes` as
   an **additive** read-only select field, and the feed + `/app/dogs` tiles grew
   a per-tile `Peak: N` indicator and a "View details" link. **DW-010 folded in**
   (obsolete `votes.ts` module-doc comment corrected, comment-only). Metrics:
   `pnpm test` 420 pass; `@smoke` + `@security` (31) green; `pnpm check` 0
   errors, lint clean. Reviewer APPROVE, 0 fix cycles, 3 minor no-change notes
   (unused-but-parity `viewerId` param; a dead `|| owner.display_name` fallback
   since `handle` is NOT NULL; the missing detail-route E2E). **M3 stays open:**
   DW-011 (the `/app/feed` E2E gap) was promoted into M3 as a new **TASK-032
   (E2E hardening)** that also subsumes this PR's detail-route E2E gap (DW-013)
   and remains the active M3 task.

3. **E2E hardening — the test that surfaced a P0 (TASK-032, PR #47 `5cf5879`).**
   Pure test coverage (zero schema / RLS / RPC / app-code change) promoting DW-011
   (the `/app/feed` E2E gap) and subsuming DW-013 (the detail-route gap). New spec
   `tests/feed-detail.e2e.ts` (`@smoke`) drives a real browser against the **live
   LOCAL stack only** (non-localhost-guarded helper, service key Node-side, unique
   `crypto.randomUUID()` fixtures): a `/app/feed` cast → move → remove asserting
   the **authoritative** `vote_count` + global crown via service-role read-backs;
   the feed react / un-react toggle against authoritative reaction counts;
   `/app/dogs/[id]` non-owner image **render + decode** + signed-URL shape; and a
   **404 on both a non-existent and a malformed id**. Serialized under
   `workers: 1` with `describe.serial` + a per-test crown reset. Running it
   **surfaced a latent P0** — non-owner `hotdogs` images never rendered because
   the loads minted signed URLs with the viewer's owner-only RLS client; the
   `@smoke` suite had masked it by only ever viewing the user's OWN dog. The fix
   landed as TASK-033 in the same PR. The deferred E2E (DW-011) earned its keep.
   Reviewer APPROVE.
4. **P0 fix — non-owner signed-URL rendering + malformed-id 404 (TASK-033, PR #47
   `5cf5879`).** The feed and dog-detail loads minted `hotdogs` signed URLs with
   the **viewer's RLS-scoped client**, but the bucket's only SELECT policy is
   owner-only (`hotdogs_select_own`) and `createSignedUrl` is **RLS-gated at
   creation** — so a non-owner could not mint a URL for another member's dog and
   every non-owned image rendered "Image unavailable." Latent since TASK-024 (the
   feed exists to browse OTHERS' dogs). The storage-baseline migration comment
   ("signed URL bypasses RLS") was wrong about the **creation** side. **Fix
   (user-approved Option 1):** the feed + detail loads now mint `hotdogs` signed
   URLs via the privileged service client (`$lib/server` `getServiceClient()`)
   constructed **after** the `safeGetSession()` gate; the dog / owner / reaction
   **queries stay on the RLS-scoped client**, and the signer only signs
   `image_path` from rows the member's own RLS query already returned (no exposure
   widening). The `/app/dogs` own-dogs gallery correctly stays on the RLS client.
   **Decision #6's privacy model is preserved** (bucket stays private, URLs stay
   1h TTL signed, service client server-only via `$lib/server`); **no storage RLS
   / bucket change.** Also: `/app/dogs/[id]` with a malformed (non-uuid) id now
   returns **404** (was 500) via a new `isUuid()` guard in `$lib/storage/paths.ts`
   (reusing `UUID_RE`) before the DB read; genuine read errors still 500. Lock-in
   unit assertions (`detail-load.test.ts`, `feed-action.test.ts`) pin that the
   signer is the **service client** and NOT `event.locals.supabase` — the test
   that would have caught the original P0. Metrics (after `supabase db reset`):
   `pnpm test` 423/0, `pnpm check` 0 errors, lint clean, `@smoke` 4/0,
   `@security` 31/0. Reviewer APPROVE, 1 fix cycle. Two follow-ups logged as
   Discovered Work (DW-015 direct `isUuid` unit coverage; DW-016 extract the
   shared service-role E2E helpers).

### Milestone M3 close notes

M3 added the **cosmetic-flair and per-dog-stats surfaces** on top of the M2
voting engine, and hardened the feed/detail flows with a live-stack E2E that
immediately paid for itself by catching a P0:

1. **Cosmetic reactions, structurally inert to ranking.** Hot-dog emoji reactions
   (`hotdog_reactions`, many DISTINCT emojis per user, owner-scoped RLS
   insert/delete, render-time counts via the pure `summarizeReactions`) deliver
   decision #12's "many allowed, no ranking effect" — and because the table
   carries **no server-maintained denormalized column**, the "no ranking effect"
   guarantee holds **structurally** (there is no write path that could touch
   `vote_count` / `peak_votes` / crown), not by code discipline. Deliberately a
   plain RLS write, NOT an RPC — the inverse of the consuming-writes-via-RPC
   convention, which only exists to maintain counters transactionally. Captured as
   a reusable [[CLAUDE]] gotcha for future flair surfaces (M6 emoji).
2. **Per-dog stats + a dog detail view, display-only.** `peak_votes` /
   `vote_count` (already server-maintained by the M2 vote RPC) are surfaced on a
   new `/app/dogs/[id]` route (`getDogDetail` query, 404/500 mapping, Stats block,
   read-only reaction summary, `<TopDogBadge>`) and as a per-tile `Peak: N`
   indicator on the feed/`/app/dogs` tiles — **zero schema / RLS / RPC / write-path
   change.**
3. **E2E hardening caught a latent P0.** The promoted DW-011 E2E
   (`feed-detail.e2e.ts`) viewed another member's dog for the first time and
   exposed that non-owner `hotdogs` images never rendered — signed-URL **creation**
   is RLS-gated, so the viewer's owner-only client could not sign another member's
   object. The `@smoke` suite had masked it by only viewing the user's OWN dog. The
   fix (TASK-033, user-approved Option 1) mints those signed URLs server-side with
   the service client **after** the `safeGetSession()` gate, signing only
   already-authorized rows, with **decision #6's private-bucket + TTL model
   preserved** and no storage RLS change. A reusable [[CLAUDE]] gotcha now records
   that `createSignedUrl` is RLS-gated at creation and that cross-member views of
   private-bucket content must sign server-side. A malformed-id `isUuid()` 404
   guard and unit lock-in tests (signer must be the service client) round it out.

See [[Handoffs/handoff-008]] for session context.

### Milestone M4 progress notes

1. **Mustard decay math — pure render-time seam, TDD-first (TASK-040, PR #53
   `5afd0da`).** New pure module `src/lib/features/mustard/decay.ts` mirroring
   the `voting/ranking.ts` shape (**no SvelteKit/Supabase imports**, fully
   unit-testable): `MUSTARD_LIFESPAN_MS = 24h` (single source of truth) and
   `mustardOpacity(sprayedAt, now)` → opacity in `[0,1]` — `1.0` at age 0,
   linear decay to `0.0` across 24h, clamped to `0.0` once expired (never
   negative), with a future-timestamp clock-skew guard clamping to `1.0`. It
   accepts `Date | string | number` (ISO is how a Postgres `timestamptz`
   arrives) and throws on an invalid date. This **realizes decision #15**
   (mustard decays over 24h; opacity computed at **RENDER time** from the stored
   timestamp, no cron for rendering) — a direct implementation of an existing
   decision, so **no new architecture-decision row**. **Zero schema / RLS / RPC
   / migration / dependency change.** TDD-first per decision #2 (mustard decay
   is a named TDD-first spec): co-located `decay.test.ts` with 19 cases (fresh /
   quarter / half / three-quarter life / exact-24h / 48h over-life clamp /
   24h−1ms micro-boundary / clock-skew / `Date`-ISO-epoch input parity /
   invalid-input throws / `[0,1]` sweep). **Orphan-by-design** like
   `voting/ranking.ts` — TASK-041 (spray + render) is the named immediate
   consumer, so **no Discovered Work logged**. One post-approval comment-only
   tidy: a stale `// TDD STUB` header was replaced with a "no non-test caller by
   design" note mirroring `ranking.ts`. Metrics: `pnpm test` 442/442,
   `pnpm check` 0 errors, `pnpm lint` clean. Reviewer APPROVE, 0 fix cycles. M4
   stays open — TASK-041 (spray + render) and TASK-042 (>24h prune job) remain.
2. **Mustard spray + render — cosmetic flair with a Top-Dog `WITH CHECK` gate
   (TASK-041, PR #55 `e1eafb9`).** Migration
   `20260616163055_mustard_sprays.sql` adds the `mustard_sprays` table
   (`id`, `sprayer_id` → `profiles on delete cascade`, `target_profile_id` →
   `profiles on delete cascade`, `x`/`y` `real` in `[0,1]` with range CHECKs,
   `sprayed_at timestamptz`; index on `target_profile_id`;
   `extensions.gen_random_uuid()` schema-qualified per the M0 hosted-parity
   lesson). Like `hotdog_reactions` (decision #12 / TASK-030) it carries **no
   denormalized counter and nothing that touches `vote_count` / `peak_votes` /
   the crown**, so it is a **plain owner-scoped RLS write, the inverse of the
   consuming-writes-via-RPC convention** — the "no ranking effect" half of
   decision #15 holds **structurally**, not by discipline. **The one new wrinkle
   vs the reactions precedent is an authorization conjunct on INSERT:** the
   `mustard_sprays_insert_top_dog` policy is
   `sprayer_id = (select auth.uid()) AND EXISTS (… profiles p where p.id =
(select auth.uid()) and p.is_current_top_dog)` — so **only the current Top
   Dog may spray**, with the sprayer pinned to the caller. **The gate is
   trustworthy because the `is_current_top_dog` column it reads is
   server-maintained and non-client-writable (decision #25)** — a member cannot
   set their own crown to self-satisfy the check. There is **no UPDATE and no
   DELETE policy**: sprays are immutable + persistent across crown changes
   (decision #15), and faded rows are reaped only by the TASK-042 prune job,
   never by the sprayer or target. **Architecture-decision judgment call:** the
   "plain-RLS cosmetic write whose `WITH CHECK` authorizes against a
   server-maintained, non-client-writable column to gate a privileged-but-cosmetic
   write" is a **reusable technique layered on existing decisions #12/#15/#25**,
   not a new product/architecture invariant — so it is captured as a reusable
   [[CLAUDE]] **gotcha** (extending the existing "Cosmetic / many-allowed tables"
   gotcha) rather than a new decision row. Future privileged-flair surfaces (e.g.
   an M5 "only Top Dog can …" gate) reuse the same shape. **Render wiring**
   consumes the TASK-040 seam: `src/lib/features/mustard/sprays.ts` (`addSpray`
   / `listSpraysForProfile` on the RLS-scoped client, discriminated
   `SprayResult<T>`, `42501` → `NOT_TOP_DOG` / `23514` → position error, last-24h
   read filter via `MUSTARD_LIFESPAN_MS`) wires the previously-orphan-by-design
   `mustardOpacity` / `MUSTARD_LIFESPAN_MS`, and the profile page
   (`(protected)/app/profile/[handle]/`) renders an absolutely-positioned mustard
   overlay at `opacity = mustardOpacity(sprayed_at, now)` (render-time decay; the
   DB stores only the raw timestamp) with a click-to-spray affordance gated on the
   viewer's own `canSpray`. **Trust boundaries (L2, verified at review):** sprayer
   from `safeGetSession()`, target from the trusted `params.handle`, only `x`/`y`
   from the form (validated at the `addSpray` boundary + DB CHECK backstop); the
   Top-Dog gate is RLS-enforced and not bypassable (non-Top-Dog rejected, forged
   `sprayer_id` rejected, gate column not self-satisfiable), with cross-crown
   persistence proven by a byte-for-byte deep-equal E2E assertion. Standard
   implementer-first, test-after; coverage: `sprays.test.ts`,
   `spray-action.test.ts`, updated `profile-load.test.ts`, live-DB
   `tests/mustard.e2e.ts` (`@security`, 5 new RLS cases). One minor non-blocking
   finding logged as **DW-017** (a missing `x`/`y` coerces to `0` and sprays at
   `(0,0)` instead of returning 400 — cosmetic-only, Top-Dog-gated, pinned by a
   unit test). Metrics: `pnpm test` 481/481, `pnpm check` 0 errors,
   `pnpm lint` clean, `@security` 36, `@smoke` 4. Reviewer APPROVE, 0 fix cycles.
   **M4 stays open — TASK-042 (>24h prune job) remains;** its migration + prune
   RPC must be `supabase db push`ed to hosted before the prune step ships (the
   2026-06-16 hosted-drift lesson).
3. **Mustard prune job — the sole DELETE path, anon-callable + idempotent
   (TASK-042, PR #57 `6452407`).** Migration
   `20260616170706_mustard_prune.sql` adds `public.prune_mustard_sprays()`
   (`security definer`, `search_path=''`, schema-qualified) which deletes
   `mustard_sprays where sprayed_at < now() - interval '24 hours'` and returns
   the pruned count, plus a btree index on `sprayed_at` so the daily DELETE
   range-scans only the expired tail. **It is the only DELETE path the table
   has:** TASK-041 gave `mustard_sprays` no client UPDATE/DELETE policy (sprays
   are immutable + persistent — decision #15), so this SECURITY DEFINER function
   bypasses RLS to reap faded rows, **exactly as `tally_top_dog_day()` is the
   sole writer of `top_dog_days`** — a privileged scheduled RPC owning the one
   write the client cannot do. **Auth is decision #26 applied to a destructive
   job:** the RPC takes **no caller input** (`pronargs = 0`) and its predicate is
   fixed to rows provably >24h old — already opacity-0 / invisible per
   `mustardOpacity` — so it is idempotent (a re-run prunes 0), **not forgeable**
   (a caller cannot direct it at a specific or fresh spray; it deletes exactly
   the cron's expired set), and self-limiting (worst case deletes only
   already-invisible rows). That is why an **anon DELETE** is safe here where an
   arbitrary client DELETE would not be: granting `anon` EXECUTE widens no real
   capability, so the keep-alive workflow calls it with the **existing publishable
   key — no new repo secret** (after `revoke execute … from public` then grant to
   `anon, authenticated`, the same Supabase-grant gotcha as the tally/vote RPCs).
   This extends decision #26 from a recording job to a cleanup job — **no new
   decision row**. `.github/workflows/keepalive.yml` gains a third step
   ("Prune mustard sprays (>24h, idempotent)") after the tally, structurally
   identical to it — PostgREST RPC POST with **fail-on-non-2xx** so a broken
   prune turns the workflow red (preserving the auto-pause-guard + tally + prune
   three-job daily shape). Standard implementer-first, test-after; new live-DB
   spec `tests/mustard-prune.e2e.ts` (`@security`, 4 cases: deletes >24h / keeps
   fresh, anon-callable, idempotent, no-input/not-forgeable). Metrics:
   `pnpm test` 481/481, `pnpm check` 0 errors, `pnpm lint` clean, `@security` 40
   (incl. the 4 new prune cases), `@smoke` 4. Reviewer APPROVE, 0 fix cycles.
   **This closes M4.** Hosted-push gate: the `mustard_sprays` + `mustard_prune`
   migrations must be `supabase db push`ed to hosted before the next scheduled
   keep-alive run or the prune step 404s (the 2026-06-16 hosted-drift class — see
   Process notes).

### Milestone M4 close notes

M4 — Mustard Mechanic delivered the **full mustard mechanic end to end**: the
pure render-time decay seam, the Top-Dog-gated spray + render on profiles, and
the daily >24h prune job that bounds table growth — all built on existing
decisions (#12 cosmetic-write, #15 mustard, #25 non-client-writable crown
columns, #26 anon-callable idempotent jobs) with **no new
architecture-decision row** needed.

1. **A pure decay seam, then its consumer (decisions #15 + #2).** TASK-040
   landed `mustardOpacity` / `MUSTARD_LIFESPAN_MS` in
   `src/lib/features/mustard/decay.ts` as a pure, TDD-first render-time seam
   (full → 0 over 24h, clock-skew clamped) mirroring `voting/ranking.ts` — the
   single source of truth for how a spray fades, with **no schema/RLS/RPC
   change**. TASK-041 then wired it: the profile page renders each spray at
   `opacity = mustardOpacity(sprayed_at, now)`, so the DB stores only the raw
   timestamp and the drip is computed entirely at render (decision #15 — no cron
   for rendering).
2. **Cosmetic flair with a privileged authorization conjunct.** The
   `mustard_sprays` write is a **plain owner-scoped RLS insert, NOT an RPC** —
   the deliberate inverse of the consuming-writes-via-RPC convention, like
   `hotdog_reactions`, because the table carries no denormalized counter, so the
   "no ranking effect" half of decision #15 holds **structurally**. The one
   wrinkle is an INSERT `WITH CHECK` that gates spraying to the **current Top Dog**
   by reading `is_current_top_dog` — trustworthy precisely because that column is
   server-maintained and non-client-writable (decision #25), so a member cannot
   self-satisfy the gate. This "plain-RLS cosmetic write authorized against a
   non-client-writable column" was captured as a reusable [[CLAUDE]] gotcha
   (extending the cosmetic-table gotcha), not a new decision row — a technique
   layered on #12/#15/#25.
3. **The prune job completes the loop with a destructive twin of the tally.**
   Sprays are immutable + persistent (no client UPDATE/DELETE), so the daily
   `prune_mustard_sprays()` SECURITY DEFINER RPC is their **sole DELETE path**,
   structurally paralleling `tally_top_dog_day()` as the sole writer of
   `top_dog_days`. It applies decision #26 to a destructive op: no caller input,
   deletes only provably-expired (invisible) rows, so anon-callable / idempotent
   / not-forgeable — wired into the same keep-alive workflow with fail-on-non-2xx,
   no new secret.
4. **Hosted-push gate (PENDING at M4 close).** TASK-041/042 add two migrations
   (`mustard_sprays`, `mustard_prune`) and a new scheduled prune step. Per the
   2026-06-16 hosted-drift lesson, those migrations MUST be `supabase db push`ed
   to hosted **before the next scheduled keep-alive run**, or the prune step 404s
   exactly as the M2/M3 migrations did. As of this writing the push has not been
   done — the director surfaces it to the user as a post-merge ops step (see
   Process notes).

### Milestone M5 progress notes

1. **Message walls — another cosmetic / many-allowed table, plain owner-scoped RLS
   (TASK-050, PR #60 `d3c7a4d`).** Migration `20260616184139_wall_messages.sql` adds
   the `wall_messages` table (`id` uuid PK `extensions.gen_random_uuid()`
   schema-qualified per the M0 hosted-parity lesson; `profile_id` wall-owner FK and
   `author_id` poster FK both → `profiles on delete cascade`; `body` text storing the
   **ORIGINAL** message with a `char_length(body) <= 1000` CHECK; `created_at`; index
   on `profile_id`). Like `hotdog_reactions` (decision #12 / TASK-030) and
   `mustard_sprays` (TASK-041), it carries **no denormalized counter and nothing that
   touches `vote_count` / `peak_votes` / the crown**, so it is a **plain owner-scoped
   RLS write, the deliberate inverse of the consuming-writes-via-RPC convention** —
   decision #12 implemented, **not a new architecture-decision row**. Decision
   #24/#25's column-grant lockdown correctly does **not** apply (`created_at` / `id`
   are client-insertable but inert — there is no server-maintained column to forge).
   RLS via the `(select auth.uid())` initplan idiom: SELECT for all `authenticated`
   members (any member reads any wall, like the global feed); INSERT
   `with check (author_id = (select auth.uid()))` so the author is **un-forgeable**;
   DELETE `using (author_id = (select auth.uid()) OR profile_id = (select auth.uid()))`
   — **either the message author or the wall owner** may remove a message (a two-principal
   moderation path, the one twist vs. the single-owner reactions/sprays precedents);
   and **no UPDATE policy** (messages are immutable). The **store-ORIGINAL-body
   invariant** is deliberate: it keeps the **M6 emoji render-time filter** free to
   apply at render later (never persist the filtered text), mirroring the mustard /
   emoji render-time discipline. New feature module
   `src/lib/features/walls/walls.ts` — discriminated `WallResult<T>` wrappers:
   `postWallMessage` (boundary-validates non-empty + ≤1000, author derived from the
   session), `listWallMessages` (latest 50, `created_at` desc, normalizes the
   array-vs-object author embed), `deleteWallMessage`; SQLSTATE-keyed sentinels, raw
   errors logged server-side only. Wired into the **existing** profile route
   (`(protected)/app/profile/[handle]/+page.server.ts` wall load + `post` /
   `deleteMessage` actions, `safeGetSession()`-gated, author/wall-owner from the
   session / route param and never client input; `+page.svelte` wall render + post box
   - delete affordance shown only to the author or wall owner) — the **existing mustard
     spray UI is preserved**. **Security posture (L2), verified at review:** the INSERT
     author pin is un-forgeable (forge → `42501`, pinned by a live E2E); DELETE is scoped
     to the stored row (no client-widenable path); the body is stored verbatim and
     rendered through Svelte auto-escaping (no `{@html}` → no XSS). **Zero new
     dependencies and no new discovered work** surfaced by the reviewer. Coverage:
     `walls.test.ts`, `wall-action.test.ts`, live-DB `@security` `tests/walls.e2e.ts`
     (7 RLS specs), plus a stale-test fix to `profile-load.test.ts`. Metrics at merge:
     `pnpm test` 514 pass, `pnpm check` 0 errors, lint clean (modulo a pre-existing,
     director-owned `TASKS.md` Prettier warning), `@smoke` 4, `@security` 47. Reviewer
     APPROVE, 0 fix cycles. **M5 stays open — TASK-051 (direct messages) remains;** this
     migration must be `supabase db push`ed to hosted per the 2026-06-16 hosted-drift
     lesson.
2. **Direct messages — the same cosmetic-table shape with a privacy boundary (TASK-051,
   PR #62 `4ac8ff8`).** Migration `20260616191804_dms.sql` adds the `dms` table
   (`sender_id` / `recipient_id` → `profiles on delete cascade`, `body` ≤2000 CHECK,
   `created_at`, nullable `read_at`; conversation-lookup index). Like `wall_messages` it
   carries **no denormalized counter**, so the base write is a **plain owner-scoped RLS
   write** (decision #12) — **not a new decision**. The two wrinkles vs. the public wall
   are both **reuses, not new decisions**: (1) **privacy RLS** — SELECT scoped to a
   conversation participant (`sender_id = (select auth.uid()) OR recipient_id = (select
auth.uid())`), INSERT pins the sender un-forgeably, no DELETE (DMs immutable); (2) the
   **`read_at`-only mutation boundary applies the decision #24 column-grant mechanism** —
   the recipient-only UPDATE policy plus a column-level `grant update (read_at)` (after
   revoking table-wide UPDATE) means even the recipient cannot rewrite `body` / `sender_id`
   / `recipient_id` / `created_at`. Same mechanism as the denormalized-counter lockdown,
   applied to a privacy column. New `src/lib/features/dms/` module with the **pure
   `summarizeConversations`** aggregator (render-time inbox collapse — preview + unread
   count, no stored counter, mirroring `summarizeReactions`), wired into `/app/messages`
   (inbox) + `/app/messages/[handle]` (thread), plus a "Message @handle" button and nav
   link. **Security (L2):** sender pin un-forgeable, privacy SELECT scope and `read_at`-only
   column grant both proven by live E2E. Zero new deps, no new discovered work. Metrics:
   `pnpm test` 540, `@security` 54, `@smoke` 4, `pnpm check` 0 errors, lint clean. Reviewer
   APPROVE, 0 fix cycles.
3. **Data API grant regression — auto-expose flip remediated (TASK-052, PR #66
   `18f9baa`).** A **P0 mid-milestone hotfix** for a project-wide regression: on 2026-05-30
   the Supabase CLI's `auto_expose_new_tables` default flipped to `false`, so a fresh
   `supabase db reset` stopped issuing the **implicit base table GRANTs** the schema had
   silently relied on since M0. PostgREST authorizes in **two layers** — a passing RLS
   policy is necessary but not sufficient; the role also needs the base `GRANT` — so with
   the implicit grants gone, `@smoke`/`@security` went RED and the real `createInvite()`
   path returned `permission denied`, even though nothing in the diff had changed
   (root-caused + scoped by a read-only architect dispatch). Fix: new idempotent migration
   `20260617000000_restore_data_api_grants.sql` restoring **exactly what auto-expose used
   to provide** (authenticated SELECT on all 9 tables; INSERT/DELETE only on the
   counter-free cosmetic tables; DELETE on `hot_dogs`; service_role full DML; **anon
   nothing**) while **preserving every existing lockdown** — no table-wide write re-granted
   on `profiles` / `hot_dogs` / `dms` (decision #24/#25 intact), no write on `votes` /
   `top_dog_days` (decision #12 RPC-only). Plus `auto_expose_new_tables = false` is now
   **pinned in `supabase/config.toml`** so local matches cloud and the permanent
   post-2026-10-30 platform behavior. The grant model is now **explicit** — recorded as
   **decision #28**. 0 production fix cycles (2 stale `@security` assertions updated to the
   stronger grant-layer `42501` behavior). Metrics: `pnpm test` 573, `@security` 57,
   `@smoke` 4. Reviewer APPROVE.
4. **Grant-invariant verification guard (TASK-053, PR #68 `7603438`).** The regression
   backstop for TASK-052: a checked-in `@security` spec `tests/grants.e2e.ts` (11 cases)
   asserting the **required AND forbidden** grant matrix against the live local Postgres,
   so a future `supabase db reset` or stray `GRANT` edit can't silently re-drift and quietly
   re-break a path. Focused on the gaps the existing specs don't cover — **`anon` has
   nothing** (zero-row SELECT + `42501` INSERT on all 9 tables, **every table seeded** so
   the assertion is non-vacuous), **`authenticated` cannot write `votes` / `top_dog_days`**
   (`42501`), plus consolidated positive base-grant checks. Pure test coverage (zero
   schema / RLS / RPC / app-code change). 1 fix cycle (3 findings: dropped a duplicate
   `dms.read_at` case owned by `dms.e2e.ts`, de-vacuumed the anon-SELECT by seeding all 9
   tables, hardened crown cleanup to clear-first + `finally`). **Closes M5.** Metrics:
   `pnpm test` 573, `@security` 68, `@smoke` 4, `pnpm check` 0 errors, lint clean. Reviewer
   APPROVE.

### Milestone M5 close notes

M5 — Walls & DMs delivered **two new social surfaces** (profile message walls and
private direct messages) and, mid-stream, **absorbed and remediated a project-wide Data
API grant regression** that the auto-expose default flip exposed. The two features shipped
**entirely on existing decisions** — no new architecture-decision row for either; the
grants hotfix did warrant one (**decision #28**), because it converts an
implicit-platform-behavior dependency into an explicit, committed, tested invariant.

1. **Walls + DMs are both decision #12 cosmetic-table writes.** `wall_messages` (TASK-050)
   and `dms` (TASK-051) join `hotdog_reactions` and `mustard_sprays` as **plain
   owner-scoped RLS writes with no denormalized counter**, the deliberate inverse of the
   consuming-writes-via-RPC convention. Both **store the original body verbatim** (so the
   M6 emoji render-time filter stays free to apply later) and derive any aggregate at read
   time (the pure `summarizeConversations` inbox collapse mirrors `summarizeReactions`).
   The only new shapes — the wall's **two-principal delete** (author OR wall owner), the
   DM's **conversation-scoped privacy SELECT**, and the DM's **`read_at`-only column grant**
   (decision #24's mechanism applied to a privacy column rather than a counter) — are all
   **reuses of existing mechanisms**, captured in the per-task notes, not new decisions.
2. **A grant regression turned the suite red — and exposed an implicit dependency.** The
   2026-05-30 `auto_expose_new_tables` flip stopped a fresh `supabase db reset` from
   issuing the implicit base table GRANTs the schema had leaned on since M0. Because
   PostgREST needs the base `GRANT` **in addition to** a passing RLS policy, the real
   invite path broke with `permission denied` while every RLS policy was intact — a failure
   that looked like nothing had changed. Root-caused by a read-only architect dispatch and
   fixed by the `restore_data_api_grants` migration (TASK-052), which makes the grant model
   **explicit and committed** while preserving the decision #24/#25 column lockdowns and the
   decision #12 RPC-only write paths, and pins `auto_expose_new_tables = false` so local
   matches cloud. **Decision #28** records the new invariant; TASK-053's `tests/grants.e2e.ts`
   guard locks it in so a future reset can't silently re-drift.
3. **Hosted-push gate (DEFERRED to TASK-054, user-gated ops).** M5 adds **three** unpushed
   migrations — `20260616184139_wall_messages.sql`, `20260616191804_dms.sql`, and
   `20260617000000_restore_data_api_grants.sql` — that must reach hosted in a **single**
   `supabase db push` (the grant fix matters on hosted too: any table pushed after 2026-05-30
   may be ungranted). Unlike M2/M3/M4, **no keep-alive step depends on these RPCs/tables**, so
   the delay carries **no auto-pause risk** — which is why the push was deferred out of the
   milestone as a user-gated ops follow-up rather than a close blocker. Tracked as **TASK-054**
   in [[tasks/deferred]]; see Process notes.

### Milestone M6 progress notes

1. **Emoji filter + sprinkle — pure render-time seam, TDD-first (TASK-060, PR #71
   `a2e309d`).** New dependency-free feature folder `src/lib/features/emoji/` realizing
   **decision #16** (hot-dog-only library; filter at **RENDER** time; the ORIGINAL stored
   body is NEVER mutated) — a direct implementation of an existing decision, so **no new
   architecture-decision row**. `emojiSet.ts` exports the curated `HOTDOG_EMOJIS`
   (`🌭 🥖 🌮 🥨 🧂 🍟 🔥`, deliberately **single-codepoint / modifier-free** so each member
   is always exactly one grapheme cluster — the invariant both transforms rely on) plus
   `isHotdogEmoji(grapheme)`. `filter.ts` exports two pure functions: `filterToHotdog(text)`
   replaces every **non-library** emoji with a hot-dog emoji, iterating by grapheme
   **CLUSTER** via `Intl.Segmenter` so ZWJ sequences, skin-tone modifiers, and
   regional-indicator flags are matched as one unit and **never split mid-codepoint** (emoji
   detected via `\p{Extended_Pictographic}` OR `\p{Regional_Indicator}`, since flags are
   built from regional indicators that aren't themselves Extended_Pictographic); and
   `sprinkleHotdog(text, seed, opts?)` deterministically sprinkles library emoji using a
   **hand-written `mulberry32` PRNG — zero dependencies** (same `(text, seed)` → identical
   output), only ever **ADDING** library emoji and never removing/reordering existing
   tokens. Both return a new string and never mutate the input. **Zero schema / RLS / RPC /
   migration / dependency change.** **TDD-first** per decision #2 (emoji replacement +
   sprinkle is a named TDD-first spec): RED → GREEN → verify, covering mixed-emoji input,
   no-emoji passthrough, and sprinkle determinism. Like `voting/ranking.ts` and
   `mustard/decay.ts` it is **orphan-by-design** — **no production consumer yet**; the filter
   is wired into walls/DM render by **TASK-061**, so **no Discovered Work is logged for the
   missing consumer**. Two **non-behavioral pre-merge cleanups** (neither a bug): stale TDD
   "STUB" banner comments removed, and a dead `_SPRINKLE_SOURCE` export the reviewer flagged
   was dropped. One **non-blocking, forward-looking reviewer finding logged as DW-019**:
   exact-string membership in `isHotdogEmoji` means a VS16-decorated variant of a library
   emoji (e.g. `🔥` + U+FE0F) is replaced with `🌭` rather than preserved — benign against the
   AC, and the right place to DECIDE intended behavior is TASK-061 when real user content
   flows through the filter. Metrics: `pnpm test` 603/603, `pnpm check` 0 errors,
   `pnpm lint` clean. Reviewer APPROVE, 0 fix cycles. **M6 stays open — TASK-061 (apply the
   filter in walls/DM render) remains.**
2. **Apply the emoji filter in walls/DM render — the consumer, closing M6 (TASK-061, PR #72
   `3d85087`).** New pure composition layer `src/lib/features/emoji/render.ts` (no
   SvelteKit/Supabase imports, unit-testable in isolation) wires the previously
   orphan-by-design TASK-060 seam into the live render surfaces, realizing the consumer half
   of **decision #16** (filter at RENDER time; the ORIGINAL stored body is NEVER mutated) —
   **no new architecture-decision row**. It exposes two render functions encoding a deliberate
   **wall-vs-DM split**: `renderWallBody(body, id)` = `sprinkleHotdog(filterToHotdog(body),
stringToSeed(id))` (walls get **filter + seeded sprinkle**) and `renderMessageBody(body)` =
   `filterToHotdog(body)` (DM thread + inbox preview get **filter only** — the random hot-dog
   sprinkle is scoped to WALL messages by TASK-060's AC). The sprinkle seed is a hand-written
   **FNV-1a `stringToSeed`** (zero dependencies) over the message's **immutable uuid `id`**, so
   a given wall message sprinkles the **same** way on every re-render (no per-render jitter) —
   the stable counterpart to TASK-060's deterministic `mulberry32`. Wired into **three
   components**: the wall (`profile/[handle]/+page.svelte`), the DM thread
   (`messages/[handle]/+page.svelte`), and the DM inbox preview (`messages/+page.svelte`), all
   keeping the body inside Svelte **auto-escaped text** (no `{@html}` → rendering hot-dog emoji
   is **XSS-safe**). Because the filter/sprinkle output is only ever a render-time return value
   (never written back), decision #16's "store original" guarantee holds **structurally** —
   there is no persist path that could mutate the stored body. **Zero server / DB / RLS / RPC /
   migration / dependency change.** **DW-019 resolved (accepted):** the `render.ts` header
   comment documents the accepted decision that a VS16-decorated library emoji (e.g. `🔥` +
   U+FE0F) is replaced with `🌭` rather than preserved — benign, output is still a hot-dog
   emoji, so no grapheme-normalization pass is warranted. **One accepted tracked test gap
   logged as DW-020:** no E2E asserts the browser-rendered wall/DM DOM shows the FILTERED body
   (the store-original half is covered by `tests/walls.e2e.ts`'s verbatim-body test and the
   render wiring by `render.test.ts`), a sibling of DW-011/DW-013. Standard implementer-first,
   test-after: `render.test.ts` adds 19 unit cases. Metrics: `pnpm test` 622/622, `pnpm check`
   0 errors, `pnpm lint` clean, `@smoke` 4/4. Reviewer **APPROVE, 0 production fix cycles** (2
   minor non-blocking test-strength notes only). **This closes M6.**

### Milestone M6 close notes

M6 — Emoji library delivered the **hot-dog emoji rendering mechanic end to end**: a pure,
dependency-free render-time filter + deterministic sprinkle (TASK-060), then its wiring into
every user-text surface (TASK-061). Both tasks shipped **entirely on existing decision #16**
— **no new architecture-decision row** — extending the project's established pure-logic-first
seam pattern (`voting/ranking.ts`, `mustard/decay.ts`) one more time.

1. **A pure transform seam, then its render-time consumer (decisions #16 + #2).** TASK-060
   landed the curated hot-dog `HOTDOG_EMOJIS` library plus `filterToHotdog` (grapheme-cluster
   safe via `Intl.Segmenter`, so ZWJ / skin-tone / flag sequences are never split mid-codepoint)
   and `sprinkleHotdog` (deterministic via a hand-written `mulberry32` PRNG, zero deps) as a
   TDD-first **orphan-by-design** module. TASK-061's `render.ts` is the consumer: `renderWallBody`
   composes filter + a **seeded** sprinkle (FNV-1a over the message's immutable uuid, so renders
   are stable), `renderMessageBody` applies filter only — the **wall-vs-DM split** that scopes the
   random sprinkle to walls per TASK-060's AC. The filter now runs on the profile wall, the DM
   thread, and the DM inbox preview.
2. **Decision #16's "store original" holds structurally, and the render is XSS-safe.** Because the
   M5 social surfaces store the body **verbatim** (`wall_messages` / `dms`) and the emoji transform
   is a pure render-time return value that is never written back, there is **no persist path that
   could corrupt the stored text** — the "store original, filter at render" guarantee is structural,
   not a code-discipline promise. All three components render through Svelte **auto-escaped text**
   (no `{@html}`), so emitting hot-dog emoji introduces **no XSS surface**. Zero server / DB / RLS /
   RPC / migration / dependency change across the whole milestone.
3. **Two accepted, documented dispositions.** **DW-019** (VS16-decorated library emoji replaced with
   `🌭` rather than preserved) is **resolved/accepted** in TASK-061 — the output is still a hot-dog
   emoji, benign against decision #16, recorded in the `render.ts` header comment. **DW-020** (no E2E
   asserts the browser-rendered wall/DM DOM shows the filtered body) is an **accepted tracked gap**, a
   sibling of DW-011/DW-013 covered at the unit/store-original layers, a candidate for a future M6/M7
   E2E hardening task. Minor accepted observation: the `HotdogEmoji` type alias
   (`src/lib/features/emoji/emojiSet.ts`) is a zero-runtime, type-only export with no external
   consumer — kept for API symmetry, analogous to the M1 `isValidHandle` minor; not worth a DW item.

See [[CLAUDE]] for stack/conventions and [[TASKS]] for the work queue.

## Architecture Decisions

| #   | Decision                                | Choice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Date       |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | Coding paradigm                         | Pragmatic/modular, typed, feature-folder structure                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | SvelteKit + TS naturally encourages module/feature organization; keeps pure game logic separable from UI/wiring                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 2026-06-05 |
| 2   | Testing paradigm                        | Adaptive: TDD-first for pure logic, test-after for UI/wiring                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Vote/ranking, days-as-Top-Dog tally, mustard decay, emoji filter have crisp specs worth TDD; UI is exploratory                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 2026-06-05 |
| 3   | Hosting/data platform                   | Supabase (Postgres + Auth + Storage + RLS + Realtime)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Single platform for a solo dev; auth, DB, storage, realtime in one; generous free tier                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 2026-06-05 |
| 4   | Frontend framework                      | SvelteKit 2 + Svelte 5 (runes), `@supabase/ssr`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Cookie-based SSR auth; small bundles; runes for reactive state                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 2026-06-05 |
| 5   | API keys                                | Publishable (`sb_publishable_*`) + secret (`sb_secret_*`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Legacy anon/service_role keys deprecate end-2026                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 2026-06-05 |
| 6   | Image storage                           | Two buckets: `hotdogs` (private, signed URLs) + `avatars` (public-read). DB stores only text path refs (`{owner_id}/{dog_id}.webp`); bytes never in Postgres                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Keeps DB small; signed URLs protect private content; path-only refs decouple schema from storage backend                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 2026-06-05 |
| 7   | Storage abstraction                     | Thin swappable storage module; one file to swap to Cloudflare R2 later                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | R2 (10 GB free) is the documented escape hatch from Supabase's 1 GB cap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 2026-06-05 |
| 8   | Image format                            | WebP, encoded client-side (canvas.toBlob); AVIF deferred                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Zero-dep, universal browser support; AVIF encode needs ~1MB WASM. Revisit near 1 GB cap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 2026-06-05 |
| 9   | Client compression                      | Resize ~1280px max, WebP ~80%, target ~100–200 KB/photo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Linchpin that makes the 1 GB free-tier cap viable (~6,800 photos)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 2026-06-05 |
| 10  | Per-user photo cap                      | 100 hot dogs/user (soft cap, "delete one to add another"); delete removes BOTH DB row + storage object                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Prevents orphans; bounds per-user storage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 2026-06-05 |
| 11  | Global storage guard                    | Monitoring threshold: warn ~800 MB, block new uploads ~950 MB                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Graceful degradation before Supabase's hard 1 GB                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 2026-06-05 |
| 12  | Vote vs reaction                        | VOTE = single, movable, one-per-user, not-own-dog, drives ranking. REACTION = cosmetic, many allowed, no ranking effect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Clear separation of competitive signal vs flair                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 2026-06-05 |
| 13  | Top Dog definition                      | User whose single highest-voted dog leads by vote count; tie-break = earliest to hold crown (sticky)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Deterministic crown with stable tie resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 2026-06-05 |
| 14  | Days as Top Dog                         | One per calendar day held; multiple reigns same day = one day; `top_dog_days` unique (profile_id, day)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Simple, idempotent daily tally                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 2026-06-05 |
| 15  | Mustard                                 | Sprayed on PROFILES; persistent but decays over 24h; drip/opacity computed at RENDER time from stored timestamp + position (no cron for render)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Avoids per-spray cron; cheap reads                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 2026-06-05 |
| 16  | Emoji handling                          | Hot-dog-only emoji library; **filter at RENDER time** (store original body)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | OVERRIDES earlier "on store" decision — filtering at render is reversible and never corrupts stored user text (adversarial finding F)                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 2026-06-05 |
| 17  | Invites                                 | Invite-only; user-generated invite links; no invite cap for v1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Controlled growth without heavy infra                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 2026-06-05 |
| 18  | Local dev environment                   | Supabase CLI local stack (`supabase start`, Docker); migrations in `supabase/migrations/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Standard hosted-Supabase pattern; satisfies "DBs containerized in dev"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 2026-06-05 |
| 19  | Runtime/tool management                 | mise: node 24.16.0, pnpm 11.5.2, supabase 2.106.0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Pinned, reproducible toolchain                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 2026-06-05 |
| 20  | Package manager                         | pnpm                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Fast, strict, disk-efficient; first-class SvelteKit support                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 2026-06-05 |
| 21  | Security level                          | L2 (Standard)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Auth + DMs + user uploads + PII                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 2026-06-05 |
| 22  | Invite single-use guard                 | Authoritative single-use signal is `invites.consumed_at` (FK never nulls it); `consumed_by` is `on delete set null` for audit only, guarded by a one-directional CHECK                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Keying the guard on a column an FK can null would re-open a spent token if the redeemer is deleted — guard must key on a never-nulled column                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 2026-06-09 |
| 23  | Invite redemption path                  | Consumption via anon-executable SECURITY DEFINER RPCs (`redeem_invite` / `invite_is_redeemable`), `search_path=''`, schema-qualified; no client UPDATE/DELETE on `invites`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Redemption happens pre-auth (can't use inviter's RLS); a single-transaction RPC is the controlled write path — consistent with the consuming-writes-via-RPC convention                                                                                                                                                                                                                                                                                                                                                                                                                                | 2026-06-09 |
| 24  | Non-client-writable counters            | Server-maintained counters (`vote_count`, `peak_votes`, `created_at`) are blocked from client writes via **column-level GRANTs on both INSERT and UPDATE** — revoke table-wide, then re-grant only safe columns; omitted columns fall to DEFAULTs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | RLS alone gates rows, not columns; restricting only UPDATE leaves the INSERT path open to seed a forged opening counter. Column-level grants on both write paths close it (caught in TASK-013 review). Reusable for any future denormalized counter                                                                                                                                                                                                                                                                                                                                                   | 2026-06-09 |
| 25  | Non-client-writable crown columns       | The `profiles` crown columns (`is_current_top_dog`, `top_dog_since`, `days_as_top_dog`) are blocked from client writes by applying decision #24's insert+update column-grant pattern: `revoke insert/update on profiles from authenticated`, then `grant insert (id, handle, display_name, avatar_path)` + `grant update (handle, display_name, avatar_path)`. Crown columns fall to DEFAULTs / are non-updatable; `recompute_top_dog()` (SECURITY DEFINER) is the sole maintainer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `profiles` previously had no column-level write grants, so an authenticated user could forge crown state via a plain PostgREST INSERT/UPDATE (caught in TASK-021 review). Extends the decision #24 pattern from `hot_dogs` counters to every server-maintained denormalized column                                                                                                                                                                                                                                                                                                                    | 2026-06-11 |
| 26  | Daily tally auth model (A1)             | A privileged-but-input-free scheduled job is an anon-callable, idempotent SECURITY DEFINER RPC. `tally_top_dog_day()` takes **no caller input** (`pronargs = 0`) and only ever records the actual current Top Dog's `current_date`; it is EXECUTE-granted to `anon` + `authenticated` so the keep-alive GitHub Actions workflow can call it via PostgREST with the **existing publishable key** — no new repo secret. Idempotent at two layers (`UNIQUE(profile_id, day)` + `ON CONFLICT DO NOTHING`; `days_as_top_dog` recomputed authoritatively from `COUNT`)                                                                                                                                                                                                                                                                                                                                                                                                                           | Avoids minting/managing a service-key secret in CI for a job that records only server-known facts; reviewer empirically confirmed it is not forgeable and is self-limiting (worst case: an anon caller triggers today's idempotent tally early — exactly what the cron does). Sets the auth pattern for the M4 mustard-prune job (TASK-042), wired into the same workflow                                                                                                                                                                                                                             | 2026-06-11 |
| 27  | Cross-member private-bucket signed URLs | Signed URLs for another member's private-bucket (`hotdogs`) content are minted **server-side with the service client** (`$lib/server` `getServiceClient()`), constructed **after** the `safeGetSession()` gate, signing only `image_path` values from rows the viewer's own RLS query already returned. The dog / owner / reaction queries stay on the RLS-scoped `event.locals.supabase`; only the signer is privileged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `storage.createSignedUrl` is **RLS-gated at creation**, and the only `hotdogs` SELECT policy is owner-only (`hotdogs_select_own`) — so the viewer's RLS-scoped client can sign only its OWN objects, leaving every cross-member image unrenderable (P0 latent since TASK-024, surfaced by the TASK-032 feed E2E). Corrected realization of decision #6: the bucket stays private and URLs stay 1h-TTL signed, no storage RLS / bucket change; signing only already-authorized rows does not widen exposure. Lock-in unit tests pin the signer as the service client                                   | 2026-06-12 |
| 28  | Explicit Data API grant model           | The Supabase Data API (PostgREST) base GRANTs are **explicit and committed**, never platform-implicit. `auto_expose_new_tables = false` is pinned in `supabase/config.toml`, and **every new `public` table migration MUST declare its own base grants**: `authenticated` SELECT + only the writes its RLS actually allows (INSERT/DELETE on counter-free cosmetic tables, nothing on RPC-only surfaces); `service_role` full DML; **`anon` nothing**. PostgREST authz is **two-layer** — a passing RLS policy is necessary but **not sufficient**; the base table GRANT is also required. Grants must **never re-open a locked column table-wide**: preserve the decision #24/#25 column-level lockdowns (`profiles` / `hot_dogs` / `dms`) and the decision #12 RPC-only write paths (`votes` / `top_dog_days`). The baseline restore lives in `20260617000000_restore_data_api_grants.sql`; `tests/grants.e2e.ts` (`@security`) locks the required AND forbidden matrix in against drift | The CLI's `auto_expose_new_tables` default flipped `true`→`false` on 2026-05-30, so a fresh `supabase db reset` stopped issuing the implicit base GRANTs the schema had silently depended on since M0 — `@smoke`/`@security` went RED and the real invite path broke with `permission denied` though every RLS policy was intact (TASK-052, root-caused by an architect dispatch). The platform removes auto-expose entirely after 2026-10-30, so explicit grants are also the permanent forward path. Interacts with #12/#24/#25: the restore preserves those lockdowns rather than blanket-granting | 2026-06-17 |

### Accepted Risks (from Adversarial Review)

| Risk                                                          | Severity       | Why we proceed                                                                | Mitigation task                                      |
| ------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| Crown recompute + sticky tie-break under concurrent votes (A) | Medium         | Solvable with a single transactional SQL function                             | TASK in M2: ranking RPC + `top_dog_since`, TDD'd     |
| Denormalized `vote_count` drift (B)                           | Medium         | Counter updated only inside the vote transaction; RLS blocks client writes    | M2 vote RPC + trigger                                |
| Unbounded `mustard_sprays` growth (C)                         | Medium         | Daily GH Actions job already exists for the tally; add a prune of >24h sprays | M4 prune job                                         |
| 1 GB storage cap viability (D)                                | Medium         | Client compression + per-user cap + global guard + R2 escape hatch            | M0 guard + M1 compression                            |
| Supabase single-platform lock-in (E)                          | Low (accepted) | Storage abstracted; auth/DB lock-in accepted for solo-dev velocity            | Documented; storage module isolates the largest risk |

## External Integrations

| Service           | Purpose                                                   | Auth Method                              | Base URL / SDK                           | Rate Limits           | Notes                                |
| ----------------- | --------------------------------------------------------- | ---------------------------------------- | ---------------------------------------- | --------------------- | ------------------------------------ |
| Supabase Auth     | Email + invite-link sign-in                               | Publishable/secret keys, cookie sessions | `@supabase/ssr`, `@supabase/supabase-js` | Free tier             | SSR via `hooks.server.ts`            |
| Supabase Postgres | App data                                                  | RLS + secret key (server)                | supabase-js                              | 500 MB DB             | Migrations in `supabase/migrations/` |
| Supabase Storage  | Hot dog + avatar images                                   | Signed URLs (private), public (avatars)  | supabase-js storage                      | 1 GB / 5 GB egress/mo | `hotdogs` private, `avatars` public  |
| GitHub Actions    | Daily keep-alive ping + Top Dog day tally + mustard prune | Repo secrets                             | scheduled workflow                       | —                     | Prevents 7-day auto-pause            |

## Data Model

```
profiles      id, handle(@unique), display_name, avatar_path, joined_at,
              days_as_top_dog, is_current_top_dog, top_dog_since
hot_dogs      id, owner_id→profiles, image_path, caption, created_at,
              vote_count(denormalized), peak_votes
votes         voter_id→profiles, hot_dog_id→hot_dogs, created_at
              UNIQUE(voter_id)  -- one active vote; CHECK voter != owner (RLS)
hotdog_reactions  id, user_id, hot_dog_id, emoji, created_at
              UNIQUE(user_id, hot_dog_id, emoji)  -- cosmetic; many DISTINCT
              emojis per user; owner-scoped RLS insert/delete (no RPC, no
              counter) — counts computed at render, never affects ranking
mustard_sprays    id, sprayer_id, target_profile_id, x, y, sprayed_at
              (drip computed at render; pruned >24h by daily job)
top_dog_days  profile_id, day(date)   UNIQUE(profile_id, day)
wall_messages id, wall_owner_id, author_id, body(original text), created_at
dms           id, sender_id, recipient_id, body, created_at, read_at
invites       id, inviter_id, token(unique), created_at, consumed_by, consumed_at
```

All tables protected by Row-Level Security. Authz enforced at the DB, not just UI.

### Runtime Data Flow

```
Invite link -> Auth.signUp -> profiles row (handle, avatar)
Photo file -> client WebP compress -> storage.upload(hotdogs/) -> hot_dogs row (image_path)
Vote click -> voting RPC (move vote, update vote_count, recompute crown) -> Top Dog + badge
Daily cron -> top_dog_days tally + mustard prune + keep-alive ping
Mustard spray (Top Dog only) -> mustard_sprays row -> render-time decay on target profile
Wall post -> wall_messages(original) -> emoji filter at render + random hot-dog sprinkle
```

## Known Limitations

- v1 non-goals: no push/email notifications, no comments on hot dogs, no global
  search, no native mobile app.
- Moderation v1: hard upload size/count limits + a report button only.
- Free tier: 1 GB storage / 500 MB DB / 5 GB egress per month; project
  auto-pauses after 7 days of no DB activity (mitigated by keep-alive ping).
- AVIF deferred (WASM encode cost); revisit near the 1 GB storage cap.

### Process notes

- **Task queue migrated to the indexed per-milestone layout (2026-06-11).** The
  monolithic `TASKS.md` is now an index/dashboard; each milestone's tasks live in
  its own `tasks/milestone-NN-slug.md` file (M2 active, M3–M7 pre-exploded),
  cross-milestone logs are `tasks/discovered.md` + `tasks/deferred.md`, and the
  completed pre-migration milestones (M0, M1) are grandfathered into
  `TASKS-ARCHIVE.md`. New completed milestones freeze in their own file rather than
  moving to the archive. See [[TASKS]] for the index and [[CLAUDE]] Project Map for
  the canonical wikilink targets.
- **Hosted schema drift resolved + keep-alive green again (2026-06-16, ops
  session).** The daily keep-alive workflow had been red for 4 runs. Root cause was
  **hosted schema drift**, not a secrets or auto-pause problem: the M2/M3 migrations
  (`20260610181704_votes_and_vote_rpc.sql`,
  `20260611174243_top_dog_days_and_tally.sql`,
  `20260612104439_hotdog_reactions.sql`) had never been `supabase db push`ed to
  hosted since the M0/M1 going-live, so the workflow's `Tally Top Dog day` step
  (`tally_top_dog_day()`) got a PostgREST 404. The `ping` step succeeded throughout,
  so the hosted DB was never actually at auto-pause risk (the daily read kept it
  alive even while the workflow showed red). Fixed by `supabase db push` (three
  migrations applied to hosted) + a workflow re-trigger → green. No repo diff (a
  hosted-DB + workflow-rerun action). **Durable lesson:** push hosted migrations
  **per-milestone** — at milestone close, or whenever a migration lands — not just at
  going-live, so a milestone's new RPCs are reachable before any scheduled job calls
  them. This gate applies immediately to M4: TASK-042 adds a fourth migration + a
  second prune RPC wired into the same keep-alive workflow, and that migration MUST
  be pushed to hosted before the prune step ships or this exact failure recurs.
- **M4 hosted-push gate — PENDING as of 2026-06-16 (M4 close).** M4 added two new
  migrations (`20260616163055_mustard_sprays.sql`,
  `20260616170706_mustard_prune.sql`) and a new scheduled keep-alive step that
  calls `prune_mustard_sprays()` via PostgREST. Both migrations **must be
  `supabase db push`ed to hosted before the next scheduled keep-alive run**, or the
  new prune step gets a PostgREST 404 and turns the workflow red — the exact
  hosted-drift class that took the workflow red for 4 runs over the M2/M3
  migrations. As of this writing the push has **not** been done; the director will
  surface it to the user as a post-merge ops step. This is the per-milestone
  hosted-push discipline from the entry above, applied at M4 close.
- **Session continuity — M4 built + closed in one session
  ([[Handoffs/handoff-011]], 2026-06-16).** M4 (pre-exploded) was activated,
  built end to end, and tagged in a single session; all three tasks landed
  reviewer APPROVE / 0 fix cycles. See the handoff for the full session record
  and the pending hosted-push gate. Next: M5 — Walls & DMs.

## Milestones

| Milestone                      | Target                                                                              | Status   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 — Scaffold & infra          | SvelteKit + Supabase, SSR auth, RLS baseline, keep-alive, secrets, security-profile | complete | All 5 tasks done (TASK-001/002/003/004/005). Hosted Supabase project live: schema pushed, repo secrets set, keep-alive enabled + verified green (HTTP 200). Tag `milestone-00-scaffold-infra`. See M0 close notes above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| M1 — Vertical slice            | invite → profile → upload one compressed dog → see it + smoke test                  | complete | All 5 tasks done: TASK-010 invite mint + redemption (PR #13 `ef59aea`), TASK-012 client WebP compression (PR #16 `2828468`, new `src/lib/image/` seam), TASK-011 profile creation + onboarding funnel (PR #18 `38db5d9`, new `src/lib/features/profiles/` module), TASK-013 hot dog upload + display (PR #20 `c552be5`, last M0 foundational orphan resolved), and TASK-014 `@smoke` + `@security` E2E (PR #22 `aed7e90`). Tag `milestone-01-vertical-slice`. All later milestones must keep the `@smoke` test passing. See M1 close notes above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| M2 — Voting & Top Dog engine   | vote/move rules, ranking, sticky tie-break, daily tally, badge                      | complete | All 5 tasks done. TASK-020 (ranking + sticky tie-break, PR #25 `835c2f0`) — pure `selectTopDog` seam. TASK-021 (Vote RPC, PR #28 `a170676`) — `cast_vote`/`remove_vote` SECURITY DEFINER RPCs (sole write path), drift-free `vote_count` from `COUNT(votes)` in-transaction, crown recompute mirrors `selectTopDog`; decision #25 (crown-column write lockdown) added in the fix cycle. TASK-022 (daily tally, PR #31 `4351aa9`) — `top_dog_days` + idempotent anon-callable `tally_top_dog_day()` RPC (decision #26) wired into keep-alive. TASK-023 (badge UI, PR #37 `6d1b206`) — read-only `<TopDogBadge>`, winning dog resolved by reusing `selectTopDog`. TASK-024 (vote-casting feed, PR #40 `94d2e52`) — global `/app/feed` (browse + cast/move/remove) doubling as the live leaderboard, consuming `castVote`/`removeVote`; **M2-close wiring audit re-passed (DW-009 resolved)**, voting is now end-to-end. Tag `milestone-02-voting-top-dog-engine`. See M2 close notes above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| M3 — Reactions & per-dog stats | cosmetic reactions, peak votes                                                      | complete | All 4 tasks done. TASK-030 (cosmetic reactions, PR #43 `b27dc63`) — `hotdog_reactions` table + owner-scoped RLS insert/delete (deliberately not an RPC; no denormalized counter, render-time counts, so it structurally cannot affect ranking), `ReactionBar` wired into `/app/feed`. TASK-031 (per-dog stats, PR #45 `e1ffa0e`) — display/wiring only (no schema change): new `src/lib/features/hotdogs/detail.ts` query + `/app/dogs/[id]` detail route (404/500 mapping, read-only reaction summary, Stats block, `<TopDogBadge>`), `peak_votes` surfaced on the feed/tiles. TASK-032 (E2E hardening, PR #47 `5cf5879`) — live-stack `feed-detail.e2e.ts` covering feed cast/move/remove + react toggle + detail render + 404s, which surfaced a P0. TASK-033 (P0 fix, PR #47 `5cf5879`) — non-owner `hotdogs` signed URLs now minted server-side via the service client after the auth gate (decision #6 model preserved, no storage RLS change) + malformed-id `isUuid()` 404 guard. Tag `milestone-03-reactions-per-dog-stats`. See M3 close notes above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| M4 — Mustard mechanic          | spray + render-time decay + >24h prune                                              | complete | All 3 tasks done. TASK-040 (mustard decay math, PR #53 `5afd0da`) — pure render-time `src/lib/features/mustard/decay.ts` (`MUSTARD_LIFESPAN_MS` + `mustardOpacity`, full→0 over 24h, clock-skew clamp), TDD-first (19 unit cases), realizing decision #15; orphan-by-design with TASK-041 as the named consumer, no schema/RLS/RPC change. TASK-041 (mustard spray + render, PR #55 `e1eafb9`) — `mustard_sprays` table + plain owner-scoped RLS write with a **Top-Dog `WITH CHECK` INSERT gate** (only the current Top Dog may spray; gate trustworthy because `is_current_top_dog` is non-client-writable per decision #25), immutable/persistent (no UPDATE/DELETE), profile-page overlay rendered at render-time decay via `mustardOpacity` (consumes the TASK-040 seam); cosmetic flair like reactions but with the extra authz conjunct — captured as a reusable [[CLAUDE]] gotcha, not a new decision row. TASK-042 (mustard prune job, PR #57 `6452407`) — `prune_mustard_sprays()` SECURITY DEFINER RPC (the table's **sole DELETE path**, mirroring `tally_top_dog_day()`) deletes >24h sprays + `sprayed_at` index; anon-callable / idempotent / not-forgeable (decision #26 applied to a destructive job — no input, deletes only provably-invisible rows), wired into keep-alive as a third fail-on-non-2xx step. Tag `milestone-04-mustard-mechanic`. **Hosted-push gate pending** — the `mustard_sprays` + `mustard_prune` migrations must be `supabase db push`ed to hosted before the next keep-alive run (see Process notes). See M4 close notes above                                                                                                          |
| M5 — Walls & DMs               | message walls + direct messages                                                     | complete | All 4 tasks done. TASK-050 (message walls, PR #60 `d3c7a4d`) — `wall_messages` table, plain owner-scoped RLS (decision #12, no counter), stores original body verbatim, SELECT any member / un-forgeable author pin / two-principal DELETE (author OR wall owner) / no UPDATE, wired into the profile route. TASK-051 (direct messages, PR #62 `4ac8ff8`) — `dms` table with a privacy boundary (participant-scoped SELECT, sender-pinned INSERT, no DELETE) + a `read_at`-only UPDATE column grant (decision #24's mechanism applied to a privacy column), pure `summarizeConversations` inbox collapse, `/app/messages` inbox + `/app/messages/[handle]` thread routes. TASK-052 (restore Data API grants, PR #66 `18f9baa`) — **P0 hotfix** for the 2026-05-30 `auto_expose_new_tables` default flip that stopped a fresh `supabase db reset` issuing the implicit base GRANTs PostgREST needs alongside RLS; new `restore_data_api_grants` migration makes grants explicit (authenticated SELECT all 9 tables; INSERT/DELETE only on counter-free cosmetic tables; DELETE on `hot_dogs`; service_role full DML; anon nothing) preserving the decision #24/#25 lockdowns + decision #12 RPC-only paths, `auto_expose_new_tables = false` pinned in config — recorded as **decision #28**. TASK-053 (grant-invariant verification, PR #68 `7603438`) — `tests/grants.e2e.ts` (`@security`, 11 cases) locks the required AND forbidden grant matrix in against drift. Tag `milestone-05-walls-dms`. **Hosted-push gate deferred to TASK-054** (three migrations in one `supabase db push`; user-gated ops, no auto-pause risk — see [[tasks/deferred]]). See M5 close notes above |
| M6 — Emoji library             | hot-dog emoji set + render filter + random sprinkle                                 | complete | All 2 tasks done. TASK-060 (emoji filter + sprinkle, PR #71 `a2e309d`) — new dependency-free `src/lib/features/emoji/` (`emojiSet.ts` curated `HOTDOG_EMOJIS` + `isHotdogEmoji`; `filter.ts` `filterToHotdog` grapheme-cluster-safe via `Intl.Segmenter` + `sprinkleHotdog` deterministic via a hand-written `mulberry32` PRNG, zero deps), realizing **decision #16** (hot-dog-only library, filter at RENDER, store original); **TDD-first**, orphan-by-design, no schema/RLS/RPC change, no new decision row. TASK-061 (apply filter in walls/DM render, PR #72 `3d85087`) — new pure composition layer `src/lib/features/emoji/render.ts` (`renderWallBody` = filter + seeded sprinkle for walls via an FNV-1a per-message-uuid seed; `renderMessageBody` = filter only for DMs), wired into the profile wall + DM thread + DM inbox preview, all through Svelte auto-escaped text (no `{@html}` → XSS-safe); decision #16's store-original guarantee holds structurally (no persist path). DW-019 (VS16-decorated library emoji → `🌭`) **resolved/accepted**; DW-020 (render-DOM E2E gap) accepted tracked gap. No new decision row. Reviewer APPROVE, 0 fix cycles each; `pnpm test` 622/622, `@smoke` 4/4. Tag `milestone-06-emoji-library`. See M6 progress + close notes above                                                                                                                                                                                                                                                                                                                                                                                           |
| M7 — Safety & polish           | upload limits, report button, polish                                                | pending  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
