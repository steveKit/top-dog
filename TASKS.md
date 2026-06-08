# Task Queue — Top Dog

> **Status key:** `pending` | `in_progress` | `blocked` | `complete`
> **Priority key:** `P0` (critical) | `P1` (high) | `P2` (medium) | `P3` (low)
> **Size key:** `S` (< 1 hour) | `M` (1-4 hours) | `L` (4+ hours)
> See [[PROJECT]] for architecture decisions and [[CLAUDE]] for conventions.

## Active Tasks

---

## Milestone M0 — Scaffold & Infra [`in_progress`]

Goal: SvelteKit + Supabase wired, SSR auth, RLS baseline, keep-alive, secrets.

### TASK-004: Keep-alive workflow secrets + verify [`pending`] [`P1`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-003
**Description:** Finalize `.github/workflows/keepalive.yml` against the real schema.
The workflow was disabled via `gh workflow disable` during M0 (no hosted project
yet → daily scheduled runs were failing and emailing the owner). Re-enabling and
verifying it green is part of this task, once the hosted project + secrets exist.
**Acceptance Criteria:**

- [ ] Workflow queries an existing table (`profiles`) and returns 200
- [ ] Repo secrets `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` documented in README
- [ ] `workflow_dispatch` manual run succeeds
- [ ] Keep-alive workflow re-enabled (`gh workflow enable "Supabase keep-alive"`) after secrets are set, and a run completes green (it was disabled during M0 to silence pre-setup failure emails)

### TASK-005: Global storage guard [`pending`] [`P1`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-002
**Description:** Mitigation for adversarial finding D — bound total storage.
**Acceptance Criteria:**

- [ ] Pure function: given used bytes, returns `ok` / `warn` (≥800MB) / `block` (≥950MB)
- [ ] Upload path checks the guard before accepting new uploads (TDD)
- [ ] Friendly UI message when blocked

---

## Milestone M1 — Vertical Slice [`pending`]

Goal: invite -> profile -> upload one compressed dog -> see it. END-TO-END.
**All later milestones must keep the @smoke test passing.**

### TASK-010: Invite generation + redemption [`pending`] [`P0`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-001, TASK-003
**Description:** User-generated invite links; redeem on sign-up.
**Acceptance Criteria:**

- [ ] `invites` table migration + RLS (inviter creates; token single-use)
- [ ] Generate invite link (unique token) for an authed user
- [ ] Sign-up via valid token consumes it; invalid/used token rejected
- [ ] Integration: redemption wired into the sign-up flow

### TASK-011: Profile creation [`pending`] [`P0`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-010
**Description:** Create profile with @handle, display name, avatar.
**Acceptance Criteria:**

- [ ] On first sign-in, prompt to set unique @handle (validated, case-insensitive unique)
- [ ] Optional avatar upload to `avatars` bucket via storage module
- [ ] Profile page shows handle, join date, stats (zeros initially)
- [ ] Integration: profile row created post-redemption

### TASK-012: Client-side WebP compression [`pending`] [`P0`] [`M`]

**Owner:** unassigned
**Dependencies:** none
**Description:** Resize/encode images to WebP in-browser before upload.
**Acceptance Criteria:**

- [ ] Pure-ish module: resize to ≤1280px, WebP ~80%, target ~100–200 KB
- [ ] Uses `canvas.toBlob` (zero deps)
- [ ] Unit tests for dimension math; rejects non-image input
- [ ] Returns a Blob ready for storage upload

### TASK-013: Hot dog upload + display [`pending`] [`P0`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-002, TASK-011, TASK-012
**Description:** Upload a compressed hot dog, store path ref, render via signed URL.
**Acceptance Criteria:**

- [ ] `hot_dogs` table migration + RLS (owner CRUD; vote_count not client-writable)
- [ ] Upload flow: compress -> storage.upload(hotdogs/) -> insert row with image_path
- [ ] Hot dog renders via signed URL
- [ ] Per-user 100 cap enforced ("delete one to add another")
- [ ] Delete removes BOTH the row AND the storage object (no orphans)

### TASK-014: Vertical-slice smoke test [`pending`] [`P0`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-013
**Description:** Playwright `@smoke` covering the full slice.
**Acceptance Criteria:**

- [ ] `@smoke`: redeem invite -> set handle -> upload one dog -> see it rendered
- [ ] Runs against the local Supabase stack
- [ ] `pnpm test:e2e --grep @smoke` passes

---

## Milestone M2 — Voting & Top Dog Engine [`pending`]

Goal: vote rules, ranking, sticky tie-break, daily tally, badge. TDD-first.

### TASK-020: Ranking + sticky tie-break logic [`pending`] [`P0`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-013
**Description:** Pure logic for crown selection (adversarial finding A). TDD.
**Acceptance Criteria:**

- [ ] Pure module: given dogs with (vote_count, top_dog_since), returns the Top Dog
- [ ] Highest vote_count wins; ties -> earliest `top_dog_since` (sticky)
- [ ] Tests cover: clear winner, tie, crown handoff, no-votes edge case

### TASK-021: Vote RPC (move-vote + counter + crown) [`pending`] [`P0`] [`L`]

**Owner:** unassigned
**Dependencies:** TASK-020
**Description:** Transactional vote logic (adversarial findings A + B).
**Acceptance Criteria:**

- [ ] `votes` migration: UNIQUE(voter_id), RLS forbids voting own dog
- [ ] Postgres RPC: cast/move vote, update `vote_count`, recompute crown, set `top_dog_since` — one transaction
- [ ] `vote_count` never client-writable; no drift under concurrent votes
- [ ] Tests: cast, move, remove, self-vote rejected, counter consistency

### TASK-022: Daily Top Dog tally job [`pending`] [`P1`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-021
**Description:** Idempotent days-as-Top-Dog count (finding C neighbor).
**Acceptance Criteria:**

- [ ] `top_dog_days` migration UNIQUE(profile_id, day)
- [ ] Pure tally logic TDD'd: multiple reigns same calendar day = one day
- [ ] Wired into the keep-alive workflow (runs daily)
- [ ] `profiles.days_as_top_dog` reflects the count

### TASK-023: Top Dog badge UI [`pending`] [`P2`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-021
**Description:** Show the hot dog badge on the current Top Dog.
**Acceptance Criteria:**

- [ ] Badge renders on the current Top Dog's profile + their dog
- [ ] Updates after a crown handoff

---

## Milestone M3 — Reactions & Per-Dog Stats [`pending`]

### TASK-030: Hot dog reactions (cosmetic) [`pending`] [`P2`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-013
**Acceptance Criteria:**

- [ ] `hotdog_reactions` migration + RLS (many per user, no ranking effect)
- [ ] Drop hot-dog emoji reactions on a photo; render counts
- [ ] Reactions explicitly do NOT change vote_count or ranking

### TASK-031: Per-dog stats [`pending`] [`P3`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-021
**Acceptance Criteria:**

- [ ] Track/display peak_votes per dog
- [ ] Stats visible on the dog detail view

---

## Milestone M4 — Mustard Mechanic [`pending`]

### TASK-040: Mustard decay math [`pending`] [`P1`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-021
**Description:** Render-time decay (finding C). TDD.
**Acceptance Criteria:**

- [ ] Pure function: given sprayed_at + now, returns opacity (full -> 0 over 24h)
- [ ] Tests: fresh, half-life, expired, future timestamp guard

### TASK-041: Mustard spray + render [`pending`] [`P1`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-040
**Acceptance Criteria:**

- [ ] `mustard_sprays` migration + RLS (only current Top Dog may insert)
- [ ] Top Dog sprays on a target PROFILE at (x,y); unlimited sprays
- [ ] Sprays render with computed decay; persist across crown changes

### TASK-042: Mustard prune job [`pending`] [`P1`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-041
**Description:** Bound table growth (adversarial finding C).
**Acceptance Criteria:**

- [ ] Daily job deletes sprays older than 24h
- [ ] Wired into the keep-alive workflow alongside the tally

---

## Milestone M5 — Walls & DMs [`pending`]

### TASK-050: Message walls [`pending`] [`P2`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-011
**Acceptance Criteria:**

- [ ] `wall_messages` migration + RLS (store ORIGINAL body; author/owner may delete)
- [ ] Post to and render a profile's wall

### TASK-051: Direct messages [`pending`] [`P2`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-011
**Acceptance Criteria:**

- [ ] `dms` migration + RLS (only sender/recipient read; sender inserts)
- [ ] Send/receive DMs; mark read_at

---

## Milestone M6 — Emoji Library [`pending`]

Goal: hot-dog emoji set + render-time filter + random sprinkle. TDD-first.

### TASK-060: Emoji filter + sprinkle logic [`pending`] [`P2`] [`M`]

**Owner:** unassigned
**Dependencies:** none
**Description:** Filter at RENDER (decision 16 — store original). TDD.
**Acceptance Criteria:**

- [ ] Pure function: replace all non-hot-dog emoji with hot-dog emoji at render
- [ ] Random hot-dog emoji sprinkle into wall messages (seeded for testability)
- [ ] Original stored text is never mutated
- [ ] Tests: mixed emoji input, no-emoji input, sprinkle determinism

### TASK-061: Apply emoji filter in walls/DMs render [`pending`] [`P2`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-060, TASK-050, TASK-051
**Acceptance Criteria:**

- [ ] Wall + DM rendering pipes body through the filter
- [ ] Custom hot-dog emoji assets render correctly

---

## Milestone M7 — Safety & Polish [`pending`]

### TASK-070: Upload limits enforcement [`pending`] [`P1`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-013
**Acceptance Criteria:**

- [ ] Hard size + count limits enforced server-side (not just client)
- [ ] Clear errors on violation

### TASK-071: Report button [`pending`] [`P2`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-013, TASK-011
**Acceptance Criteria:**

- [ ] Report a hot dog or profile; stored for review
- [ ] RLS: reporter identity not exposed to reported user

### TASK-072: Polish pass [`pending`] [`P3`] [`M`]

**Owner:** unassigned
**Dependencies:** all prior milestones
**Acceptance Criteria:**

- [ ] Responsive layout, empty states, loading states
- [ ] `pnpm lint`, `pnpm check`, `pnpm test`, `@smoke` all green

---

## Completed Tasks

_Moved to TASKS-ARCHIVE.md when this section exceeds ~200 lines._

### ~~TASK-002: Storage module (swappable seam)~~ [`complete`]

**Completed:** 2026-06-08 · **PR:** #5 (squash `505f4a1`) · **Reviewer:** APPROVE
**Acceptance Criteria:**

- [x] `upload(bucket, path, blob)`, `getSignedUrl(path)`, `getPublicUrl(path)`, `remove(path)`
- [x] `hotdogs` (private) and `avatars` (public) bucket helpers
- [x] No `supabase.storage` calls exist outside this module
- [x] Unit tests for path construction (`{owner_id}/{dog_id}.webp`)

**Notes:** Landed the swappable storage seam (decisions #6/#7) as `src/lib/storage/`
— the single place `supabase.storage` is ever called, so swapping to Cloudflare R2
later touches one module. `index.ts` exposes `upload(client, bucket, path, blob, opts?)`,
`getSignedUrl(client, path, ttl?)` (always hotdogs/private), `getPublicUrl(client, path)`
(always avatars/public), and `remove(client, bucket, paths)`.

Key decisions: the `SupabaseClient` is **dependency-injected** — callers pass
`event.locals.supabase` for RLS-scoped ops or the service client for privileged
ops, so the module is auth-context-agnostic and stays unit-testable with a mocked
client. Errors are surfaced via a discriminated `StorageResult<T> = { ok: true; data } | { ok: false; error }` instead of throwing, pushing the error/success branch
into the caller's type. `StorageError` is derived **structurally** from the
installed `@supabase/supabase-js` return type — **zero new deps** (no import from
the transitive `@supabase/storage-js`).

Path helpers live in pure `paths.ts`: `hotdogPath(ownerId, dogId)` →
`{ownerId}/{dogId}.webp` and `avatarPath(ownerId)` → `{ownerId}/avatar.webp`, with
strict uuid validation on the **RLS-significant owner prefix** — this is the
prefix-containment guarantee that backs the storage write policies from TASK-003
(rejects traversal/slash/newline-bypass shapes before they can spoof another
owner's folder).

Review: APPROVE on a clean first pass (0 fix cycles) — reviewer confirmed the
seam invariant, prefix-containment security, zero new deps, and no server-client
leak. Metrics: 33 unit tests (path construction incl. hostile prefix-escape
vectors; mocked-client API behavior, bucket selection, error wrapping); `pnpm check`
and `pnpm lint` green.

### ~~TASK-003: RLS baseline migration + buckets~~ [`complete`]

**Completed:** 2026-06-08 · **PR:** #3 (squash `cdf7bed`) · **Reviewer:** APPROVE (empirical L2 RLS validation)
**Acceptance Criteria:**

- [x] `supabase/migrations/` initial migration creates `profiles` + RLS enabled
- [x] `hotdogs` (private) + `avatars` (public-read) buckets created with policies
- [x] Storage write policy restricts users to their `{owner_id}/` prefix
- [x] `supabase db reset` applies cleanly on local stack

**Notes:** Landed the RLS baseline plus storage buckets in one migration,
`20260608153759_rls_baseline_and_storage_buckets.sql`. Built the `public.profiles`
table matching the [[PROJECT]] Data Model: `citext` handle (case-insensitive
unique), FK to `auth.users` ON DELETE CASCADE, and a handle length CHECK (2–32).
RLS is enabled everywhere with a **default-deny + explicit-grant** design — select
for `authenticated`, insert/update own-row only (`auth.uid() = id`, enforced in
both USING and WITH CHECK so a row can't be reassigned to another owner). No client
delete (profiles cascade from `auth.users`).

Storage: both buckets are defined **in SQL** (deterministic under `supabase db
reset`, not dashboard-created) — `hotdogs` (private) and `avatars` (public-read).
`storage.objects` write/update/delete policies scope each user to their own
`{owner_id}/` prefix via `(storage.foldername(name))[1] = (select auth.uid()::text)`.
hotdogs read = owner-only (others use signed URLs); avatars read = public.

Two deliberate choices: (1) **`citext`** (core Postgres contrib, not a third-party
dep) gives case-insensitive-unique handles at the DB level; (2) policies use the
`(select auth.uid())` subselect idiom so the planner caches it as an initplan —
Supabase's documented RLS perf pattern.

Reviewer did **empirical L2 validation**: ran `supabase db reset` twice and
exercised the policies live as `authenticated`/`anon` roles — confirmed cross-user
writes blocked, hotdogs private, avatars public-read, and prefix-spoof / no-prefix
uploads rejected. APPROVE on a clean first pass (0 fix cycles; no standalone tester
— a migration/config task verified by `db reset` plus live policy testing).

Scope: only `profiles` + the two buckets are in this migration. The remaining
tables (`hot_dogs`, `votes`, etc.) get their RLS in their own feature milestones.

### ~~TASK-001: SSR Supabase client + auth hooks~~ [`complete`]

**Completed:** 2026-06-08 · **PR:** #1 (squash `3978cee`) · **Reviewer:** APPROVE
**Acceptance Criteria:**

- [x] `hooks.server.ts` creates a request-scoped Supabase client from cookies
- [x] `event.locals.supabase` + `event.locals.safeGetSession()` available
- [x] `+layout.server.ts` passes session; `+layout.ts` builds browser client
- [x] `app.d.ts` types `App.Locals` (supabase, safeGetSession)
- [x] Server-only secret-key client lives in `$lib/server/supabase.ts`
- [x] Integration: hooks registered; a protected route redirects unauthenticated users

**Notes:** Landed the SSR auth foundation. `hooks.server.ts` builds a
request-scoped `@supabase/ssr` client and exposes `event.locals.supabase` +
`event.locals.safeGetSession()` (plus typed `session`/`user`), with a global
`authGuard` redirecting unauthenticated users (303) to `/sign-in`. The
`(protected)/app` route group gets defense-in-depth via its own
`+layout.server.ts`. Server-only secret-key client is `getServiceClient()` in
`$lib/server/supabase.ts` (lazy singleton, no token refresh/persist); the two
`PUBLIC_` vars are read through a validated `getPublicSupabaseConfig()` accessor
that throws on missing/empty (L2 boundary validation).

Key decision: `safeGetSession()` validates the JWT via `supabase.auth.getUser()`
and refuses an unvalidated `getSession()` — this is the canonical auth-trust
boundary for the app; never trust a raw `getSession()`. Used `$env/dynamic/*`
(not `$env/static/*`) because no real `.env` is present at type-check time;
env presence is validated at the boundary instead.

Review: one cleanup round (no test-failure cycles) — deleted an orphan
browser-client factory and corrected a stale comment; reviewer then APPROVE.
Metrics: 21 unit tests passing; `pnpm check` and `pnpm lint` green.

Operational: the "Supabase keep-alive" GitHub Actions workflow was disabled
(`gh workflow disable`) during M0 — no hosted Supabase project/secrets exist
yet, so its daily scheduled runs were failing and emailing the owner.
Re-enabling and verifying it green is folded into TASK-004's acceptance criteria.

### ~~TASK-000: Project scaffolding~~ [`complete`]

**Completed:** 2026-06-05
**Notes:** SvelteKit 2 + Svelte 5 + Supabase scaffold; mise pins (node/pnpm/supabase); Vitest + Playwright + ESLint + Prettier wired; plenary docs, L2 security profile, keep-alive workflow, tech-specific agent configs; repo published to `main`. Quality gates green (check/lint/build/test).

---

## Discovered Work

_Tasks found during implementation that weren't in the original plan.
User decides when/whether to promote these to Active Tasks._

- **Handle character-set validation (M1, TASK-011):** the DB CHECK on
  `profiles.handle` enforces length 2–32 but **not** character set — whitespace
  and control characters are currently possible. Enforce an allowed handle
  character set at the application boundary in the M1 profile form action
  (TASK-011). Surfaced by the TASK-003 reviewer; not a defect in TASK-003,
  flagged so it isn't forgotten.
- **Automated RLS test harness:** there is currently no DB/RLS test harness —
  the project uses Vitest (unit/logic) + Playwright (E2E) only, and the TASK-003
  RLS policies were verified manually / by reviewer. Consider a lightweight RLS
  integration-test harness (e.g., Vitest connecting to the local Supabase stack
  as different roles) so future migrations get automated access-control coverage.
