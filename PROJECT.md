# Top Dog — Project Overview

## Status

**Phase:** Active Development
**Last Updated:** 2026-06-09

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
7-day auto-pause timer). The project is **ready to begin M1 (vertical slice)**.

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

**Milestone M1 — Vertical Slice is now in progress.** Two M1 tasks have landed:
TASK-010 (invite generation + redemption, PR #13 `ef59aea`) and TASK-012
(client-side WebP compression, PR #16 `2828468`). The invite-only growth path
(decision #17) is end-to-end — an authed user mints a unique invite link at
`(protected)/app/invite`, and the public `/sign-up` flow consumes it (pre-check →
`signUp` → atomic redeem RPC → session-branch redirect). Client compression
(decisions #8/#9, the linchpin that makes the 1 GB free-tier cap viable) now has
its pure resize/encode pipeline in place as a shared seam. M1 is **not closed**:
TASK-011 (profile creation), TASK-013 (hot dog upload + display), and TASK-014
(the `@smoke` vertical slice) remain.

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

See [[Handoffs/handoff-002]] for session context.

See [[CLAUDE]] for stack/conventions and [[TASKS]] for the work queue.

## Architecture Decisions

| #   | Decision                | Choice                                                                                                                                                                     | Rationale                                                                                                                                                              | Date       |
| --- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | Coding paradigm         | Pragmatic/modular, typed, feature-folder structure                                                                                                                         | SvelteKit + TS naturally encourages module/feature organization; keeps pure game logic separable from UI/wiring                                                        | 2026-06-05 |
| 2   | Testing paradigm        | Adaptive: TDD-first for pure logic, test-after for UI/wiring                                                                                                               | Vote/ranking, days-as-Top-Dog tally, mustard decay, emoji filter have crisp specs worth TDD; UI is exploratory                                                         | 2026-06-05 |
| 3   | Hosting/data platform   | Supabase (Postgres + Auth + Storage + RLS + Realtime)                                                                                                                      | Single platform for a solo dev; auth, DB, storage, realtime in one; generous free tier                                                                                 | 2026-06-05 |
| 4   | Frontend framework      | SvelteKit 2 + Svelte 5 (runes), `@supabase/ssr`                                                                                                                            | Cookie-based SSR auth; small bundles; runes for reactive state                                                                                                         | 2026-06-05 |
| 5   | API keys                | Publishable (`sb_publishable_*`) + secret (`sb_secret_*`)                                                                                                                  | Legacy anon/service_role keys deprecate end-2026                                                                                                                       | 2026-06-05 |
| 6   | Image storage           | Two buckets: `hotdogs` (private, signed URLs) + `avatars` (public-read). DB stores only text path refs (`{owner_id}/{dog_id}.webp`); bytes never in Postgres               | Keeps DB small; signed URLs protect private content; path-only refs decouple schema from storage backend                                                               | 2026-06-05 |
| 7   | Storage abstraction     | Thin swappable storage module; one file to swap to Cloudflare R2 later                                                                                                     | R2 (10 GB free) is the documented escape hatch from Supabase's 1 GB cap                                                                                                | 2026-06-05 |
| 8   | Image format            | WebP, encoded client-side (canvas.toBlob); AVIF deferred                                                                                                                   | Zero-dep, universal browser support; AVIF encode needs ~1MB WASM. Revisit near 1 GB cap                                                                                | 2026-06-05 |
| 9   | Client compression      | Resize ~1280px max, WebP ~80%, target ~100–200 KB/photo                                                                                                                    | Linchpin that makes the 1 GB free-tier cap viable (~6,800 photos)                                                                                                      | 2026-06-05 |
| 10  | Per-user photo cap      | 100 hot dogs/user (soft cap, "delete one to add another"); delete removes BOTH DB row + storage object                                                                     | Prevents orphans; bounds per-user storage                                                                                                                              | 2026-06-05 |
| 11  | Global storage guard    | Monitoring threshold: warn ~800 MB, block new uploads ~950 MB                                                                                                              | Graceful degradation before Supabase's hard 1 GB                                                                                                                       | 2026-06-05 |
| 12  | Vote vs reaction        | VOTE = single, movable, one-per-user, not-own-dog, drives ranking. REACTION = cosmetic, many allowed, no ranking effect                                                    | Clear separation of competitive signal vs flair                                                                                                                        | 2026-06-05 |
| 13  | Top Dog definition      | User whose single highest-voted dog leads by vote count; tie-break = earliest to hold crown (sticky)                                                                       | Deterministic crown with stable tie resolution                                                                                                                         | 2026-06-05 |
| 14  | Days as Top Dog         | One per calendar day held; multiple reigns same day = one day; `top_dog_days` unique (profile_id, day)                                                                     | Simple, idempotent daily tally                                                                                                                                         | 2026-06-05 |
| 15  | Mustard                 | Sprayed on PROFILES; persistent but decays over 24h; drip/opacity computed at RENDER time from stored timestamp + position (no cron for render)                            | Avoids per-spray cron; cheap reads                                                                                                                                     | 2026-06-05 |
| 16  | Emoji handling          | Hot-dog-only emoji library; **filter at RENDER time** (store original body)                                                                                                | OVERRIDES earlier "on store" decision — filtering at render is reversible and never corrupts stored user text (adversarial finding F)                                  | 2026-06-05 |
| 17  | Invites                 | Invite-only; user-generated invite links; no invite cap for v1                                                                                                             | Controlled growth without heavy infra                                                                                                                                  | 2026-06-05 |
| 18  | Local dev environment   | Supabase CLI local stack (`supabase start`, Docker); migrations in `supabase/migrations/`                                                                                  | Standard hosted-Supabase pattern; satisfies "DBs containerized in dev"                                                                                                 | 2026-06-05 |
| 19  | Runtime/tool management | mise: node 24.16.0, pnpm 11.5.2, supabase 2.105.0                                                                                                                          | Pinned, reproducible toolchain                                                                                                                                         | 2026-06-05 |
| 20  | Package manager         | pnpm                                                                                                                                                                       | Fast, strict, disk-efficient; first-class SvelteKit support                                                                                                            | 2026-06-05 |
| 21  | Security level          | L2 (Standard)                                                                                                                                                              | Auth + DMs + user uploads + PII                                                                                                                                        | 2026-06-05 |
| 22  | Invite single-use guard | Authoritative single-use signal is `invites.consumed_at` (FK never nulls it); `consumed_by` is `on delete set null` for audit only, guarded by a one-directional CHECK     | Keying the guard on a column an FK can null would re-open a spent token if the redeemer is deleted — guard must key on a never-nulled column                           | 2026-06-09 |
| 23  | Invite redemption path  | Consumption via anon-executable SECURITY DEFINER RPCs (`redeem_invite` / `invite_is_redeemable`), `search_path=''`, schema-qualified; no client UPDATE/DELETE on `invites` | Redemption happens pre-auth (can't use inviter's RLS); a single-transaction RPC is the controlled write path — consistent with the consuming-writes-via-RPC convention | 2026-06-09 |

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

| Milestone                      | Target                                                                              | Status      | Notes                                                                                                                                                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 — Scaffold & infra          | SvelteKit + Supabase, SSR auth, RLS baseline, keep-alive, secrets, security-profile | complete    | All 5 tasks done (TASK-001/002/003/004/005). Hosted Supabase project live: schema pushed, repo secrets set, keep-alive enabled + verified green (HTTP 200). Tag `milestone-00-scaffold-infra`. See M0 close notes above                      |
| M1 — Vertical slice            | invite → profile → upload one compressed dog → see it + smoke test                  | in progress | Two tasks landed: TASK-010 invite mint + redemption (PR #13 `ef59aea`) and TASK-012 client WebP compression (PR #16 `2828468`, new `src/lib/image/` seam). TASK-011/013/014 remain. All later milestones must keep the `@smoke` test passing |
| M2 — Voting & Top Dog engine   | vote/move rules, ranking, sticky tie-break, daily tally, badge                      | pending     | TDD-first                                                                                                                                                                                                                                    |
| M3 — Reactions & per-dog stats | cosmetic reactions, peak votes                                                      | pending     |                                                                                                                                                                                                                                              |
| M4 — Mustard mechanic          | spray + render-time decay + >24h prune                                              | pending     |                                                                                                                                                                                                                                              |
| M5 — Walls & DMs               | message walls + direct messages                                                     | pending     |                                                                                                                                                                                                                                              |
| M6 — Emoji library             | hot-dog emoji set + render filter + random sprinkle                                 | pending     | TDD-first for filter                                                                                                                                                                                                                         |
| M7 — Safety & polish           | upload limits, report button, polish                                                | pending     |                                                                                                                                                                                                                                              |
