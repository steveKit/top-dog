# Task Queue — Top Dog

> **Status key:** `pending` | `in_progress` | `blocked` | `complete`
> **Priority key:** `P0` (critical) | `P1` (high) | `P2` (medium) | `P3` (low)
> **Size key:** `S` (< 1 hour) | `M` (1-4 hours) | `L` (4+ hours)
> See [[PROJECT]] for architecture decisions and [[CLAUDE]] for conventions.

## Active Tasks

---

## Milestone M0 — Scaffold & Infra [`complete`]

_All tasks complete. Details in Completed Tasks section below._

**Tag:** milestone-00-scaffold-infra

---

## Milestone M1 — Vertical Slice [`pending`]

Goal: invite -> profile -> upload one compressed dog -> see it. END-TO-END.
**All later milestones must keep the @smoke test passing.**

### TASK-011: Profile creation [`pending`] [`P0`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-010
**Description:** Create profile with @handle, display name, avatar.
**Acceptance Criteria:**

- [ ] On first sign-in, prompt to set unique @handle (validated, case-insensitive unique)
- [ ] Optional avatar upload to `avatars` bucket via storage module
- [ ] Profile page shows handle, join date, stats (zeros initially)
- [ ] Integration: profile row created post-redemption

### TASK-013: Hot dog upload + display [`pending`] [`P0`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-002, TASK-005, TASK-011, TASK-012
**Description:** Upload a compressed hot dog, store path ref, render via signed URL.
**Acceptance Criteria:**

- [ ] `hot_dogs` table migration + RLS (owner CRUD; vote_count not client-writable)
- [ ] Upload flow: compress -> storage.upload(hotdogs/) -> insert row with image_path
- [ ] Hot dog renders via signed URL
- [ ] Per-user 100 cap enforced ("delete one to add another")
- [ ] Delete removes BOTH the row AND the storage object (no orphans)
- [ ] Upload path calls the storage guard (`evaluateUpload`) before accepting uploads; over-cap uploads rejected with the friendly blocked message (deferred from TASK-005)
- [ ] Re-export the guard from the `$lib/storage` barrel (`index.ts`) so consumers import from one surface (reviewer note, TASK-005)

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

### ~~TASK-012: Client-side WebP compression~~ [`complete`]

**Completed:** 2026-06-09 · **PR:** #16 (squash `2828468`) · **Reviewer:** APPROVE (0 fix cycles, 2 minor notes)
**Acceptance Criteria:**

- [x] Pure-ish module: resize to ≤1280px, WebP ~80%, target ~100–200 KB
- [x] Uses `canvas.toBlob` (zero deps)
- [x] Unit tests for dimension math; rejects non-image input
- [x] Returns a Blob ready for storage upload

**Notes:** Landed client-side WebP compression (decisions #8/#9, adversarial
finding D) as a new **shared lib seam** `src/lib/image/compress.ts` (co-located
`compress.test.ts`). Deliberately placed at `src/lib/image/` — a feature-agnostic
utility **parallel to `src/lib/storage/`, NOT under a feature folder** — because
both TASK-011 (avatar upload) and TASK-013 (hot dog upload) consume it; a single
shared module avoids duplicating the resize/encode pipeline per feature. Zero new
dependencies (browser canvas APIs only).

The module splits along a **pure / canvas seam**, mirroring
`src/lib/storage/guard.ts`'s boundary-validation style. `fitWithinMaxEdge(width,
height, maxEdge)` is the **PURE** aspect-preserving downscale (the primary TDD
target): it caps the longest edge at `maxEdge`, **never upscales** (images already
within the cap are returned unchanged), returns rounded integer dims clamped ≥1
(so a thin image like 1281×1 can't round a short edge to a non-drawable 0px), and
throws `TypeError` on zero/negative/non-finite `width`/`height`/`maxEdge` (those
are upstream programming errors, not valid states). `compressToWebp(input, opts)`
is the canvas-bound pipeline: it **validates the image type FIRST** (rejects
empty/non-`image/` Blobs with a `TypeError` before any decode work), then decodes
via `createImageBitmap`, resizes on a `<canvas>`, and encodes `image/webp` via
`canvas.toBlob` at quality. Defaults: `maxEdge` 1280, `quality` 0.8 (decisions
#8/#9), targeting ~100–200 KB/photo.

Built **TDD**: 23 tests written red-first (dimension math incl. no-upscale,
longest-edge cap, fractional/clamp-to-1 edges; type rejection; option
flow-through), implemented to green, then 2 more added at verify (25 module tests
total). The pure dimension math, type-rejection, and option flow-through are fully
deterministic in the node Vitest env.

**Accepted foundational-seam orphan (same pattern as the M0 storage guard).** The
module has no non-test consumer yet — its consumers are TASK-011 (avatar upload)
and TASK-013 (hot dog upload), both dependency-declared and not yet built. The
reviewer confirmed this is the intended foundational-seam situation (identical to
`src/lib/storage/guard.ts` and the other M0 accepted orphans), not accidental dead
code.

**Deferred coverage gap (by design):** real WebP pixel-encoding fidelity — actual
output bytes against the ~100–200 KB target — can't be simulated in the node
Vitest env (no real canvas/`toBlob`). That fidelity check is deferred to the
TASK-014 Playwright `@smoke` (real browser); the unit tests own the deterministic
dimension math, type-rejection, and option flow-through.

Metrics: 25 module tests; 164 suite tests green; `pnpm check` 0 errors; `pnpm
lint` clean. **0 fix cycles** — reviewer APPROVE on the first pass with 2 minor
non-blocking notes (one folded into Discovered Work below; one informational).

### ~~TASK-010: Invite generation + redemption~~ [`complete`]

**Completed:** 2026-06-09 · **PR:** #13 (squash `ef59aea`) · **Reviewer:** APPROVE (1 fix cycle)
**Acceptance Criteria:**

- [x] `invites` table migration + RLS (inviter creates; token single-use)
- [x] Generate invite link (unique token) for an authed user
- [x] Sign-up via valid token consumes it; invalid/used token rejected
- [x] Integration: redemption wired into the sign-up flow

**Notes:** Landed invite-only growth (decision #17) as the **first M1 task** —
the end-to-end mint → redeem flow that gates account creation. Migration
`20260609140525_invites.sql` adds the `invites` table (id, `inviter_id` →
`auth.users`, unique `token`, `created_at`, `consumed_by` → `auth.users`,
`consumed_at`) with **default-deny + explicit-grant** RLS: owner-only
insert/select via the `(select auth.uid())` initplan idiom, and **no client
UPDATE/DELETE** — consumption is mediated entirely by RPC. Schema-qualified
`extensions.gen_random_uuid()`, applying the M0 hosted-parity lesson.

Two **SECURITY DEFINER** RPCs (`search_path=''`, fully schema-qualified, granted
to `anon` + `authenticated`) own consumption: `redeem_invite(invite_token text,
redeemer_id uuid) returns uuid` does the atomic single-use consumption, and
`invite_is_redeemable(invite_token text) returns boolean` is a read-only
pre-check. Redemption happens **while unauthenticated**, so it can't ride the
inviter's RLS — the anon-executable RPCs are the deliberate, controlled write
path. This reinforces the project's "competitive/consuming writes go through a
single-transaction RPC" convention.

Feature module `src/lib/features/invites/`: `token.ts` (Web Crypto token
generation + validation, **zero deps**) and `invites.ts` (`createInvite` /
`redeemInvite` / `isInviteRedeemable`, each returning a discriminated
`InviteResult<T>`). Routes: authed invite-mint at `(protected)/app/invite`;
public `/sign-up` running pre-check → `signUp` → redeem RPC → session-branch
redirect.

**Key fix-cycle redesign — `consumed_at` is the authoritative single-use
signal, NOT `consumed_by`.** Review surfaced one blocking + one major + one
minor finding. The blocking issue: the original schema coupled the two consumed
columns with a bidirectional CHECK and `on delete set null` on `consumed_by`,
which (a) blocked deleting any user who had ever redeemed an invite, and (b)
worse — would have let a spent token become **re-redeemable** once its redeemer
was deleted. The fix decoupled them: the redeem guard now keys on `consumed_at
is null`, `consumed_by` keeps `on delete set null` purely for audit, and a
**one-directional** CHECK `(consumed_by is null or consumed_at is not null)`
replaced the bidirectional one. Reusable lesson (now a [[CLAUDE]] gotcha):
**single-use guards must key on a column the FK never nulls.**

**Orphaned-account race handling.** Sign-up is `signUp` → `redeem`; on a
lost-race redeem failure _after_ a successful `signUp`, the action deletes the
orphaned auth user via `getServiceClient().auth.admin.deleteUser` so the email
stays reusable. This is the **first real consumer of the `getServiceClient` M0
foundational seam** — the accepted M0 orphan is now partially realized
(server-side privileged op live).

Metrics: 139 tests passing; `pnpm check` and `pnpm lint` green; `supabase db
reset` clean. **1 fix cycle** (blocking + major + minor all resolved, then
APPROVE on re-review).

### ~~TASK-004: Keep-alive workflow secrets + verify~~ [`complete`]

**Completed:** 2026-06-08 · **Ops task (no PR)** · keep-alive run [#27162466166] → HTTP 200
**Acceptance Criteria:**

- [x] Workflow queries an existing table (`profiles`) and returns 200 (verified in run log)
- [x] Repo secrets `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` documented in README (Deployment guide, PR #10)
- [x] `workflow_dispatch` manual run succeeds
- [x] Keep-alive workflow re-enabled (`gh workflow enable`) after secrets set; run green

**Notes:** Pure **ops task — no PR / no code change**. The director set the two
GitHub repo secrets (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`), re-enabled the
previously-disabled "Supabase keep-alive" workflow (`gh workflow enable`), and
triggered a manual `workflow_dispatch` run that returned **HTTP 200** against the
hosted `profiles` table (run [#27162466166]) — a genuine DB hit that resets the
hosted project's 7-day auto-pause timer. The two secrets are documented in the
README Deployment guide (landed PR #10). 0 fix cycles.

**This closes Milestone M0 — Scaffold & Infra** (TASK-001 SSR auth, TASK-002
storage module, TASK-003 RLS baseline + buckets, TASK-004 keep-alive, TASK-005
storage guard). The hosted Supabase project is live with the schema pushed and
keep-alive verified green; the project is ready to begin M1 (vertical slice).

### ~~TASK-005: Global storage guard~~ [`complete`]

**Completed:** 2026-06-08 · **PR:** #7 (squash `d95eafc`) · **Reviewer:** APPROVE
**Acceptance Criteria:**

- [x] Pure function: given used bytes, returns `ok` / `warn` (≥800MB) / `block` (≥950MB)
- [ ] Upload path checks the guard before accepting new uploads (TDD) — _`evaluateUpload` decision helper built + TDD'd; live wiring into the upload route deferred to TASK-013 (no upload path until M1)_
- [ ] Friendly UI message when blocked — _blocked message authored + returned by `evaluateUpload`; UI rendering deferred to TASK-013 (no upload UI until M1)_

**Notes:** Landed the global storage guard (decision #11, adversarial finding D)
as a PURE module, `src/lib/storage/guard.ts`, with co-located `guard.test.ts` —
zero Supabase/SvelteKit imports so the threshold logic is fully unit-testable in
isolation.

`storageGuardStatus(usedBytes)` classifies raw byte usage into `ok` / `warn`
(≥800 MiB) / `block` (≥950 MiB). Thresholds are **binary MiB** (`1024 * 1024`),
deliberately chosen so both sit under Supabase's ~1 GiB (1024 MiB) hard free-tier
cap with headroom — the block boundary leaves ~74 MiB of slack so an in-flight
upload can never push the project past the cap and trigger a pause. Boundary
validation: a negative or non-finite `usedBytes` is an upstream programming error
(not a quota state), so the function throws `TypeError` (`Number.isFinite` guard)
rather than silently misclassifying it.

`evaluateUpload(usedBytes)` is the contract the future upload boundary calls
before accepting an upload: it returns `{ allowed, status, message? }`, with
`allowed === false` only when the status is `block`. The blocked path carries a
friendly, actionable user-facing message: _"The kennel's full! There's no room
for new hot dogs right now. Delete one of your older dogs to make space, then try
again."_ — which points the user at decision #10's "delete one to add another"
remedy.

Built **TDD** — 22 tests written red-first (threshold boundaries incl. the exact
799/800/949/950 MiB edges, the `evaluateUpload` allowed/blocked contract, and the
negative/`NaN`/`Infinity` `TypeError` cases), then implemented to green, then
TDD-verified. Clean review on the first pass (0 fix cycles; reviewer APPROVE).

**Deferred wiring (AC #2/#3):** the live upload boundary does not exist until M1,
so only the pure guard + decision helper + message are delivered here. Calling
`evaluateUpload` in the upload path, rendering the blocked message in the UI, and
re-exporting the guard from the `$lib/storage` barrel (`index.ts`) are deferred to
**TASK-013** (now carried as TASK-013 ACs + a TASK-005 → TASK-013 dependency). The
reviewer accepted the guard's exports as orphaned-by-design until TASK-013 wires
them in.

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
- **Automated RLS / DB integration-test harness:** there is currently no DB/RLS
  test harness — the project uses Vitest (unit/logic) + Playwright (E2E) only, and
  the TASK-003 RLS policies were verified manually / by reviewer. Consider a
  lightweight RLS integration-test harness (e.g., Vitest connecting to the local
  Supabase stack as different roles) so future migrations get automated
  access-control coverage. **Reinforced by the TASK-010 reviewer (2026-06-09):**
  invite single-use atomicity, RLS enforcement, and anon-executable
  SECURITY DEFINER RPC behavior are currently only **mock-tested** — there is no
  live-DB coverage of the `consumed_at` single-use guard or the redeem/pre-check
  RPCs. Given how central single-use correctness is to an invite-only app, the
  reviewer recommends treating this as a **real near-term follow-up**, not a
  someday-maybe item — the harness should land before more consuming-write RPCs
  (the M2 vote RPC) accumulate without integration coverage.
- **`compressToWebp` bitmap cleanup on the null-context path (M1, fold into
  TASK-013):** `compressToWebp` (`src/lib/image/compress.ts`) calls
  `bitmap.close()` only after a successful `getContext('2d')`; on the rare path
  where `getContext('2d')` returns `null` it throws without releasing the decoded
  bitmap (a negligible leak on an essentially-never path). Suggested fix: wrap the
  draw + encode in `try/finally` so `bitmap.close?.()` always runs. Not a defect —
  a tidy to fold into TASK-013 when compression is wired into the upload path, or
  a standalone nit. Surfaced by the TASK-012 reviewer (2026-06-09, non-blocking).
