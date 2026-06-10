# Top Dog — Project Overview

## Status

**Phase:** Active Development
**Last Updated:** 2026-06-10

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

**Milestone M2 — Voting & Top Dog Engine is now in progress.** Its first task has
landed: TASK-020 (ranking + sticky tie-break logic, PR #25 `835c2f0`). The
crown-selection contract from decision #13 is now realized as the **pure
`selectTopDog` seam** in `src/lib/features/voting/ranking.ts` — a strict
total-order comparator (vote count desc → earliest non-null `topDogSince` sticky,
null-last → `id` tie-break) that returns the leading dog (whose `ownerId` is the
Top Dog) or `null` when no dog has a vote. It is an accepted TDD-first orphan
until TASK-021 (Vote RPC) wires it in as the crown-recompute seam.

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

See [[Handoffs/handoff-003]] for session context.

See [[CLAUDE]] for stack/conventions and [[TASKS]] for the work queue.

## Architecture Decisions

| #   | Decision                     | Choice                                                                                                                                                                                                                                            | Rationale                                                                                                                                                                                                                                           | Date       |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | Coding paradigm              | Pragmatic/modular, typed, feature-folder structure                                                                                                                                                                                                | SvelteKit + TS naturally encourages module/feature organization; keeps pure game logic separable from UI/wiring                                                                                                                                     | 2026-06-05 |
| 2   | Testing paradigm             | Adaptive: TDD-first for pure logic, test-after for UI/wiring                                                                                                                                                                                      | Vote/ranking, days-as-Top-Dog tally, mustard decay, emoji filter have crisp specs worth TDD; UI is exploratory                                                                                                                                      | 2026-06-05 |
| 3   | Hosting/data platform        | Supabase (Postgres + Auth + Storage + RLS + Realtime)                                                                                                                                                                                             | Single platform for a solo dev; auth, DB, storage, realtime in one; generous free tier                                                                                                                                                              | 2026-06-05 |
| 4   | Frontend framework           | SvelteKit 2 + Svelte 5 (runes), `@supabase/ssr`                                                                                                                                                                                                   | Cookie-based SSR auth; small bundles; runes for reactive state                                                                                                                                                                                      | 2026-06-05 |
| 5   | API keys                     | Publishable (`sb_publishable_*`) + secret (`sb_secret_*`)                                                                                                                                                                                         | Legacy anon/service_role keys deprecate end-2026                                                                                                                                                                                                    | 2026-06-05 |
| 6   | Image storage                | Two buckets: `hotdogs` (private, signed URLs) + `avatars` (public-read). DB stores only text path refs (`{owner_id}/{dog_id}.webp`); bytes never in Postgres                                                                                      | Keeps DB small; signed URLs protect private content; path-only refs decouple schema from storage backend                                                                                                                                            | 2026-06-05 |
| 7   | Storage abstraction          | Thin swappable storage module; one file to swap to Cloudflare R2 later                                                                                                                                                                            | R2 (10 GB free) is the documented escape hatch from Supabase's 1 GB cap                                                                                                                                                                             | 2026-06-05 |
| 8   | Image format                 | WebP, encoded client-side (canvas.toBlob); AVIF deferred                                                                                                                                                                                          | Zero-dep, universal browser support; AVIF encode needs ~1MB WASM. Revisit near 1 GB cap                                                                                                                                                             | 2026-06-05 |
| 9   | Client compression           | Resize ~1280px max, WebP ~80%, target ~100–200 KB/photo                                                                                                                                                                                           | Linchpin that makes the 1 GB free-tier cap viable (~6,800 photos)                                                                                                                                                                                   | 2026-06-05 |
| 10  | Per-user photo cap           | 100 hot dogs/user (soft cap, "delete one to add another"); delete removes BOTH DB row + storage object                                                                                                                                            | Prevents orphans; bounds per-user storage                                                                                                                                                                                                           | 2026-06-05 |
| 11  | Global storage guard         | Monitoring threshold: warn ~800 MB, block new uploads ~950 MB                                                                                                                                                                                     | Graceful degradation before Supabase's hard 1 GB                                                                                                                                                                                                    | 2026-06-05 |
| 12  | Vote vs reaction             | VOTE = single, movable, one-per-user, not-own-dog, drives ranking. REACTION = cosmetic, many allowed, no ranking effect                                                                                                                           | Clear separation of competitive signal vs flair                                                                                                                                                                                                     | 2026-06-05 |
| 13  | Top Dog definition           | User whose single highest-voted dog leads by vote count; tie-break = earliest to hold crown (sticky)                                                                                                                                              | Deterministic crown with stable tie resolution                                                                                                                                                                                                      | 2026-06-05 |
| 14  | Days as Top Dog              | One per calendar day held; multiple reigns same day = one day; `top_dog_days` unique (profile_id, day)                                                                                                                                            | Simple, idempotent daily tally                                                                                                                                                                                                                      | 2026-06-05 |
| 15  | Mustard                      | Sprayed on PROFILES; persistent but decays over 24h; drip/opacity computed at RENDER time from stored timestamp + position (no cron for render)                                                                                                   | Avoids per-spray cron; cheap reads                                                                                                                                                                                                                  | 2026-06-05 |
| 16  | Emoji handling               | Hot-dog-only emoji library; **filter at RENDER time** (store original body)                                                                                                                                                                       | OVERRIDES earlier "on store" decision — filtering at render is reversible and never corrupts stored user text (adversarial finding F)                                                                                                               | 2026-06-05 |
| 17  | Invites                      | Invite-only; user-generated invite links; no invite cap for v1                                                                                                                                                                                    | Controlled growth without heavy infra                                                                                                                                                                                                               | 2026-06-05 |
| 18  | Local dev environment        | Supabase CLI local stack (`supabase start`, Docker); migrations in `supabase/migrations/`                                                                                                                                                         | Standard hosted-Supabase pattern; satisfies "DBs containerized in dev"                                                                                                                                                                              | 2026-06-05 |
| 19  | Runtime/tool management      | mise: node 24.16.0, pnpm 11.5.2, supabase 2.105.0                                                                                                                                                                                                 | Pinned, reproducible toolchain                                                                                                                                                                                                                      | 2026-06-05 |
| 20  | Package manager              | pnpm                                                                                                                                                                                                                                              | Fast, strict, disk-efficient; first-class SvelteKit support                                                                                                                                                                                         | 2026-06-05 |
| 21  | Security level               | L2 (Standard)                                                                                                                                                                                                                                     | Auth + DMs + user uploads + PII                                                                                                                                                                                                                     | 2026-06-05 |
| 22  | Invite single-use guard      | Authoritative single-use signal is `invites.consumed_at` (FK never nulls it); `consumed_by` is `on delete set null` for audit only, guarded by a one-directional CHECK                                                                            | Keying the guard on a column an FK can null would re-open a spent token if the redeemer is deleted — guard must key on a never-nulled column                                                                                                        | 2026-06-09 |
| 23  | Invite redemption path       | Consumption via anon-executable SECURITY DEFINER RPCs (`redeem_invite` / `invite_is_redeemable`), `search_path=''`, schema-qualified; no client UPDATE/DELETE on `invites`                                                                        | Redemption happens pre-auth (can't use inviter's RLS); a single-transaction RPC is the controlled write path — consistent with the consuming-writes-via-RPC convention                                                                              | 2026-06-09 |
| 24  | Non-client-writable counters | Server-maintained counters (`vote_count`, `peak_votes`, `created_at`) are blocked from client writes via **column-level GRANTs on both INSERT and UPDATE** — revoke table-wide, then re-grant only safe columns; omitted columns fall to DEFAULTs | RLS alone gates rows, not columns; restricting only UPDATE leaves the INSERT path open to seed a forged opening counter. Column-level grants on both write paths close it (caught in TASK-013 review). Reusable for any future denormalized counter | 2026-06-09 |

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
hotdog_reactions  id, user_id, hot_dog_id, emoji, created_at  (cosmetic, many)
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

## Milestones

| Milestone                      | Target                                                                              | Status      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M0 — Scaffold & infra          | SvelteKit + Supabase, SSR auth, RLS baseline, keep-alive, secrets, security-profile | complete    | All 5 tasks done (TASK-001/002/003/004/005). Hosted Supabase project live: schema pushed, repo secrets set, keep-alive enabled + verified green (HTTP 200). Tag `milestone-00-scaffold-infra`. See M0 close notes above                                                                                                                                                                                                                                                                                                                          |
| M1 — Vertical slice            | invite → profile → upload one compressed dog → see it + smoke test                  | complete    | All 5 tasks done: TASK-010 invite mint + redemption (PR #13 `ef59aea`), TASK-012 client WebP compression (PR #16 `2828468`, new `src/lib/image/` seam), TASK-011 profile creation + onboarding funnel (PR #18 `38db5d9`, new `src/lib/features/profiles/` module), TASK-013 hot dog upload + display (PR #20 `c552be5`, last M0 foundational orphan resolved), and TASK-014 `@smoke` + `@security` E2E (PR #22 `aed7e90`). Tag `milestone-01-vertical-slice`. All later milestones must keep the `@smoke` test passing. See M1 close notes above |
| M2 — Voting & Top Dog engine   | vote/move rules, ranking, sticky tie-break, daily tally, badge                      | in progress | TDD-first. TASK-020 landed (ranking + sticky tie-break logic, PR #25 `835c2f0`) — pure `selectTopDog` crown-selection seam (`src/lib/features/voting/ranking.ts`), accepted orphan until TASK-021 (Vote RPC) consumes it                                                                                                                                                                                                                                                                                                                         |
| M3 — Reactions & per-dog stats | cosmetic reactions, peak votes                                                      | pending     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| M4 — Mustard mechanic          | spray + render-time decay + >24h prune                                              | pending     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| M5 — Walls & DMs               | message walls + direct messages                                                     | pending     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| M6 — Emoji library             | hot-dog emoji set + render filter + random sprinkle                                 | pending     | TDD-first for filter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| M7 — Safety & polish           | upload limits, report button, polish                                                | pending     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
