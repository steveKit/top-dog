# Top Dog — Project Overview

## Status

**Phase:** Active Development
**Last Updated:** 2026-06-05

Invite-only social app for showing off homemade hot dogs. Users upload photos,
cast a single movable vote for the best hot dog (not their own), and compete for
"Top Dog" status. The Top Dog earns a badge and can spray decaying mustard on
other profiles. Plenary complete; scaffold published to `main` (all quality
gates green). Starting M0 — next: TASK-001 (SSR auth) on `feat/m0-ssr-auth`.
See [[Handoffs/handoff-001]] for session context.

See [[CLAUDE]] for stack/conventions and [[TASKS]] for the work queue.

## Architecture Decisions

| #   | Decision                | Choice                                                                                                                                                       | Rationale                                                                                                                             | Date       |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | Coding paradigm         | Pragmatic/modular, typed, feature-folder structure                                                                                                           | SvelteKit + TS naturally encourages module/feature organization; keeps pure game logic separable from UI/wiring                       | 2026-06-05 |
| 2   | Testing paradigm        | Adaptive: TDD-first for pure logic, test-after for UI/wiring                                                                                                 | Vote/ranking, days-as-Top-Dog tally, mustard decay, emoji filter have crisp specs worth TDD; UI is exploratory                        | 2026-06-05 |
| 3   | Hosting/data platform   | Supabase (Postgres + Auth + Storage + RLS + Realtime)                                                                                                        | Single platform for a solo dev; auth, DB, storage, realtime in one; generous free tier                                                | 2026-06-05 |
| 4   | Frontend framework      | SvelteKit 2 + Svelte 5 (runes), `@supabase/ssr`                                                                                                              | Cookie-based SSR auth; small bundles; runes for reactive state                                                                        | 2026-06-05 |
| 5   | API keys                | Publishable (`sb_publishable_*`) + secret (`sb_secret_*`)                                                                                                    | Legacy anon/service_role keys deprecate end-2026                                                                                      | 2026-06-05 |
| 6   | Image storage           | Two buckets: `hotdogs` (private, signed URLs) + `avatars` (public-read). DB stores only text path refs (`{owner_id}/{dog_id}.webp`); bytes never in Postgres | Keeps DB small; signed URLs protect private content; path-only refs decouple schema from storage backend                              | 2026-06-05 |
| 7   | Storage abstraction     | Thin swappable storage module; one file to swap to Cloudflare R2 later                                                                                       | R2 (10 GB free) is the documented escape hatch from Supabase's 1 GB cap                                                               | 2026-06-05 |
| 8   | Image format            | WebP, encoded client-side (canvas.toBlob); AVIF deferred                                                                                                     | Zero-dep, universal browser support; AVIF encode needs ~1MB WASM. Revisit near 1 GB cap                                               | 2026-06-05 |
| 9   | Client compression      | Resize ~1280px max, WebP ~80%, target ~100–200 KB/photo                                                                                                      | Linchpin that makes the 1 GB free-tier cap viable (~6,800 photos)                                                                     | 2026-06-05 |
| 10  | Per-user photo cap      | 100 hot dogs/user (soft cap, "delete one to add another"); delete removes BOTH DB row + storage object                                                       | Prevents orphans; bounds per-user storage                                                                                             | 2026-06-05 |
| 11  | Global storage guard    | Monitoring threshold: warn ~800 MB, block new uploads ~950 MB                                                                                                | Graceful degradation before Supabase's hard 1 GB                                                                                      | 2026-06-05 |
| 12  | Vote vs reaction        | VOTE = single, movable, one-per-user, not-own-dog, drives ranking. REACTION = cosmetic, many allowed, no ranking effect                                      | Clear separation of competitive signal vs flair                                                                                       | 2026-06-05 |
| 13  | Top Dog definition      | User whose single highest-voted dog leads by vote count; tie-break = earliest to hold crown (sticky)                                                         | Deterministic crown with stable tie resolution                                                                                        | 2026-06-05 |
| 14  | Days as Top Dog         | One per calendar day held; multiple reigns same day = one day; `top_dog_days` unique (profile_id, day)                                                       | Simple, idempotent daily tally                                                                                                        | 2026-06-05 |
| 15  | Mustard                 | Sprayed on PROFILES; persistent but decays over 24h; drip/opacity computed at RENDER time from stored timestamp + position (no cron for render)              | Avoids per-spray cron; cheap reads                                                                                                    | 2026-06-05 |
| 16  | Emoji handling          | Hot-dog-only emoji library; **filter at RENDER time** (store original body)                                                                                  | OVERRIDES earlier "on store" decision — filtering at render is reversible and never corrupts stored user text (adversarial finding F) | 2026-06-05 |
| 17  | Invites                 | Invite-only; user-generated invite links; no invite cap for v1                                                                                               | Controlled growth without heavy infra                                                                                                 | 2026-06-05 |
| 18  | Local dev environment   | Supabase CLI local stack (`supabase start`, Docker); migrations in `supabase/migrations/`                                                                    | Standard hosted-Supabase pattern; satisfies "DBs containerized in dev"                                                                | 2026-06-05 |
| 19  | Runtime/tool management | mise: node 24.16.0, pnpm 11.5.2, supabase 2.105.0                                                                                                            | Pinned, reproducible toolchain                                                                                                        | 2026-06-05 |
| 20  | Package manager         | pnpm                                                                                                                                                         | Fast, strict, disk-efficient; first-class SvelteKit support                                                                           | 2026-06-05 |
| 21  | Security level          | L2 (Standard)                                                                                                                                                | Auth + DMs + user uploads + PII                                                                                                       | 2026-06-05 |

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

| Milestone                      | Target                                                                              | Status  | Notes                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------- | ------- | --------------------------------------------------------- |
| M0 — Scaffold & infra          | SvelteKit + Supabase, SSR auth, RLS baseline, keep-alive, secrets, security-profile | pending |                                                           |
| M1 — Vertical slice            | invite → profile → upload one compressed dog → see it + smoke test                  | pending | Vertical slice; all later milestones must keep it passing |
| M2 — Voting & Top Dog engine   | vote/move rules, ranking, sticky tie-break, daily tally, badge                      | pending | TDD-first                                                 |
| M3 — Reactions & per-dog stats | cosmetic reactions, peak votes                                                      | pending |                                                           |
| M4 — Mustard mechanic          | spray + render-time decay + >24h prune                                              | pending |                                                           |
| M5 — Walls & DMs               | message walls + direct messages                                                     | pending |                                                           |
| M6 — Emoji library             | hot-dog emoji set + render filter + random sprinkle                                 | pending | TDD-first for filter                                      |
| M7 — Safety & polish           | upload limits, report button, polish                                                | pending |                                                           |
