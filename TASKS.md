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

## Milestone M1 — Vertical Slice [`complete`]

_All tasks complete. Details in Completed Tasks section below._

**Tag:** milestone-01-vertical-slice

---

## Milestone M2 — Voting & Top Dog Engine [`pending`]

Goal: vote rules, ranking, sticky tie-break, daily tally, badge. TDD-first.

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

### ~~TASK-021: Vote RPC (move-vote + counter + crown)~~ [`complete`]

**Completed:** 2026-06-11 · **PR:** #28 (squash `a170676`) · **Reviewer:** REQUEST_CHANGES → APPROVE (1 review fix cycle — security: crown-column client-writability + helper-RPC EXECUTE surface; 0 test-failure cycles)
**Acceptance Criteria:**

- [x] `votes` migration: UNIQUE(voter_id), RLS forbids voting own dog
- [x] Postgres RPC: cast/move vote, update `vote_count`, recompute crown, set `top_dog_since` — one transaction
- [x] `vote_count` never client-writable; no drift under concurrent votes
- [x] Tests: cast, move, remove, self-vote rejected, counter consistency

**Notes:** Landed the Vote RPC as the **second M2 task** — the consuming-write
half of the voting engine and the live consumer the TASK-020 `selectTopDog` seam
was built for. Migration `20260610181704_votes_and_vote_rpc.sql` adds the `votes`
table (`UNIQUE(voter_id)` — one active vote per user, decision #12) under the
project's **default-deny + explicit-grant** RLS: SELECT-only for `authenticated`,
**no client write path at all** — voting is mediated entirely by RPC. A BEFORE
INSERT/UPDATE trigger rejects self-votes at the DB. Zero new dependencies.

Two **SECURITY DEFINER** RPCs (`search_path=''`, fully schema-qualified, EXECUTE
granted to `authenticated` only) own all writes: `cast_vote(target_dog uuid)`
casts-or-moves a vote, and `remove_vote()` retracts it — each a single
transaction. **Voter identity is RPC-derived from `(select auth.uid())` inside
the function, never client-supplied** (anti-vote-forgery). Two private helpers,
`recompute_vote_count(uuid)` and `recompute_top_dog()`, have EXECUTE revoked from
`public`, `anon`, **and** `authenticated` — see the fix-cycle lesson below on why
`revoke ... from public` alone is insufficient on Supabase.

**`vote_count` recomputed authoritatively from `COUNT(votes)` in-transaction
(drift-free).** Rather than incrementing a counter, the RPC recomputes
`vote_count` from the live `COUNT(votes)` inside the same transaction, so it can
never drift under concurrent votes (closes adversarial finding B); `peak_votes`
is bumped via `greatest()`. The SECURITY DEFINER RPC is the **sole writer** of
both columns — the column-level write lockdown (decision #24) backs this at the
DB layer.

**Crown recompute provably mirrors `selectTopDog` (the TASK-020 lockstep
constraint, discharged).** `recompute_top_dog()` reproduces the TS comparator's
strict total order in SQL: `vote_count` DESC → earliest non-null `top_dog_since`
(NULL sorts **LAST**, sticky) → ascending `hot_dogs.id`. It reads the current
`top_dog_since` and sets a fresh `now()` **only on a NEW reign** — an incumbent
keeps its original timestamp — and never clears the crown while an eligible dog
(`vote_count >= 1`) exists. The reviewer **empirically confirmed** the SQL stays
in lockstep with `selectTopDog`, including the null-last stickiness and the `id`
tie-break. This **resolves the "TASK-021 crown-recompute must stay in lockstep
with `selectTopDog`" Discovered Work item** (struck below).

`src/lib/features/voting/votes.ts` is the typed wrapper (`castVote` / `removeVote`,
dependency-injected `SupabaseClient`) returning a discriminated `VoteResult`, with
sentinels keyed on **SQLSTATE, never error text**: `28000 → VOTE_UNAUTHENTICATED`,
`23514 → VOTE_SELF`, `P0002 → VOTE_NO_SUCH_DOG`. It carries an accepted
**orphan-by-design** signpost — route wiring is a later M2 task — the same
TDD-first pure-logic-before-consumer pattern as the rest of the codebase. 18
mock-unit tests cover the wrapper (`votes.test.ts`).

**Review: 1 fix cycle — two L2 security findings, both DB-integrity (0
test-failure cycles).** REQUEST_CHANGES → APPROVE:

1. **Crown columns on `profiles` were client-forgeable.** `profiles` had no
   column-level write grants, so an authenticated user could forge
   `is_current_top_dog` / `top_dog_since` / `days_as_top_dog` via a plain
   PostgREST UPDATE (and seed them on INSERT). Fixed by applying the **same
   decision #24 insert+update column-grant pattern** used for `hot_dogs`: `revoke
   insert/update on profiles from authenticated`, then `grant insert (id, handle,
   display_name, avatar_path)` + `grant update (handle, display_name,
   avatar_path)`. The crown columns fall to DEFAULTs / are non-updatable;
   `recompute_top_dog()` (SECURITY DEFINER, runs as owner) still maintains them.
2. **`revoke execute ... from public` is insufficient on Supabase.** Supabase
   grants EXECUTE on new `public.*` functions to `anon` and `authenticated`
   explicitly, so `revoke ... from public` (the PUBLIC pseudo-role only) leaves
   those grants intact — the "private" helpers were still callable. Fixed by
   `revoke execute ... from public, anon, authenticated`. Reusable lesson for
   every future SECURITY DEFINER helper (captured as a [[CLAUDE]] gotcha).

Live-DB `@security` Playwright coverage: `tests/votes.e2e.ts` + `tests/db-guards.e2e.ts`
(8 original vote specs + 10 added in the fix cycle) exercise the cast/move/remove
RPC behavior, the crown lockstep, and the two write-lockdowns against a real
Postgres. **M2 stays in progress** — TASK-022 (daily tally) and TASK-023 (badge UI)
remain.

### ~~TASK-020: Ranking + sticky tie-break logic~~ [`complete`]

**Completed:** 2026-06-10 · **PR:** #25 (squash `835c2f0`) · **Reviewer:** REQUEST_CHANGES → resolved (1 review fix cycle — docs only: stale STUB comment + timestamp-compare precondition; fast-track re-confirm)
**Acceptance Criteria:**

- [x] Pure module: given dogs with (vote_count, top_dog_since), returns the Top Dog
- [x] Highest vote_count wins; ties -> earliest `top_dog_since` (sticky)
- [x] Tests cover: clear winner, tie, crown handoff, no-votes edge case

**Notes:** Landed the ranking + sticky tie-break logic as the **first M2 task** —
the entry point of Milestone M2 (Voting & Top Dog Engine). New **PURE** module
`src/lib/features/voting/ranking.ts` (co-located `ranking.test.ts`) under the
`voting/` feature folder, with **no SvelteKit/Supabase imports** so the crown
math is fully unit-testable in isolation — the same pure/IO seam discipline as
`src/lib/storage/guard.ts` and `src/lib/image/compress.ts`.

`selectTopDog(dogs: readonly RankableDog[]): RankableDog | null` realizes
**decision #13** (Top Dog = the user whose single highest-voted dog leads; sticky
tie-break = earliest to hold the crown). It is deliberately modeled at the **dog
level** — each dog is one entry and the winning dog's `ownerId` is the Top Dog
user. This gives the queued TASK-021 (Vote RPC) a single-value seam to write
`top_dog_since` / `is_current_top_dog` from, rather than re-deriving the crown
across a per-user aggregation.

**The contract is a strict total-order comparator**, so the result is
**input-order independent**: `voteCount` descending → earliest non-null
`topDogSince` (sticky; `null` sorts **LAST**, so a previously-crowned dog keeps
the crown against a never-crowned challenger) → ascending `id` for final
determinism. **Eligibility:** `voteCount >= 1` is required; `selectTopDog`
returns `null` when no dog is eligible (the no-votes edge case). **Boundary
validation:** a negative or non-finite `voteCount` is an upstream programming
error, so the function throws `TypeError` (validating the whole input) — matching
the `storage/guard.ts` / `image/compress.ts` house style.

Built **TDD throughout** — 17 tests written **red-first** (clear winner, tie →
sticky earliest-`topDogSince`, crown handoff, null-last stickiness, `id`
tie-break determinism, no-votes → `null`, and the negative/non-finite
`TypeError` cases), implemented to **green**, then verified. The reviewer
**empirically verified total-order soundness** — ran the comparator against an
independent reference sort across **all permutations** of a mixed pool with
**0 order-dependent mismatches**.

**Accepted orphan by design.** `selectTopDog` / `RankableDog` have no non-test
consumer yet — this is the established **TDD-first pure-logic-before-consumer**
pattern (identical to `src/lib/storage/guard.ts` and the M1 compression seam).
The queued consumer is **TASK-021 (Vote RPC)**, which has a hard dependency on
TASK-020. The reviewer did **not** block on the orphan.

**Review: 1 fix cycle, DOCS ONLY — no logic change.** REQUEST_CHANGES →
resolved: a stale red-phase `STUB` header comment was corrected to a live-wiring
note (it now documents the accepted-orphan situation honestly), and the lexical
timestamp-compare precondition was documented in the `selectTopDog` JSDoc. **No
test-failure fix cycles.** **Zero new dependencies.**

Metrics: full suite **298 passed** (19 files); `pnpm check` **0 errors**; the
ranking source files are prettier + eslint clean.

### ~~TASK-014: Vertical-slice smoke test~~ [`complete`]

**Completed:** 2026-06-09 · **PR:** #22 (squash `aed7e90`) · **Reviewer:** APPROVE (0 fix cycles) · **Closes Milestone M1**
**Acceptance Criteria:**

- [x] `@smoke`: redeem invite -> set handle -> upload one dog -> see it rendered
- [x] Runs against the local Supabase stack
- [x] `pnpm test:e2e --grep @smoke` passes

**Notes:** Landed the Playwright `@smoke` vertical-slice E2E as the **fifth and
final M1 task**, **closing Milestone M1 — Vertical Slice**. `tests/smoke.e2e.ts`
drives the **real UI end-to-end** against the **local Supabase stack**: redeem an
invite (`/sign-up?token=`) → onboarding sets an `@handle` → `/app/dogs` uploads a
PNG (real-browser `compressToWebp` → private `hotdogs` bucket) → asserts the dog
renders via a **real signed URL** (`naturalWidth > 0`). This is the regression
backstop the whole project leans on: every later milestone must keep `@smoke`
green.

**Test infra — the chicken-and-egg invite + local-only creds.** Invite-only
sign-up needs an unconsumed invite to exist before the first user can register,
so `tests/global-setup.ts` bootstraps it: a **local service-role client** creates
an inviter and mints a fresh, unconsumed invite, handing the token to the spec.
`tests/helpers/local-stack.ts` resolves the **LOCAL** Supabase creds from
`supabase status -o env` (**never** the gitignored hosted `.env`) behind a
**non-localhost guardrail** that aborts if the resolved URL isn't local — so the
harness can never accidentally point at the hosted project. The secret key stays
confined to the Node/server side; it never reaches the browser context.

**`@security` E2E discharges the TASK-013 deferred DB-guard obligation.**
`tests/db-guards.e2e.ts` exercises the migration-level write guards that are
**only testable against a live Postgres** (recorded as deferred obligations in the
TASK-013 unit-test header): a direct PostgREST insert (authenticated role) is
**rejected** for a forged `vote_count` / `peak_votes` (the column-level INSERT
grant) and for a >280-char caption (the DB CHECK). This **resolves the
"TASK-014 @smoke must assert the DB-level write guards" Discovered Work item.**

**No production wiring gaps.** Building the smoke test exercised the slice as a
user would and found it **navigable end to end** — no missing wiring between
invite redemption, onboarding, upload, and signed-URL render. **Zero new deps**
(Playwright was already in the stack from scaffolding).

Metrics: `pnpm test:e2e --grep @smoke` passes (the director ran it
independently); `@security` 2 passed; unit suite **281**; `pnpm check` 0 errors;
`pnpm lint` clean. **0 fix cycles** — reviewer APPROVE on the first pass.

**This closes Milestone M1 — Vertical Slice** (TASK-010 invite redemption,
TASK-012 client WebP compression, TASK-011 profile creation + onboarding,
TASK-013 hot dog upload + display, TASK-014 `@smoke`). The full invite → profile
→ compress → upload → see-it slice is navigable and guarded by `@smoke` +
`@security`; the project is ready to begin M2 (voting & Top Dog engine, TDD-first).

### ~~TASK-013: Hot dog upload + display~~ [`complete`]

**Completed:** 2026-06-09 · **PR:** #20 (squash `c552be5`) · **Reviewer:** APPROVE (1 fix cycle)
**Acceptance Criteria:**

- [x] `hot_dogs` table migration + RLS (owner CRUD; vote_count not client-writable)
- [x] Upload flow: compress -> storage.upload(hotdogs/) -> insert row with image_path
- [x] Hot dog renders via signed URL
- [x] Per-user 100 cap enforced ("delete one to add another")
- [x] Delete removes BOTH the row AND the storage object (no orphans)
- [x] Upload path calls the storage guard (`evaluateUpload`) before accepting uploads; over-cap uploads rejected with the friendly blocked message (deferred from TASK-005)
- [x] Re-export the guard from the `$lib/storage` barrel (`index.ts`) so consumers import from one surface (reviewer note, TASK-005)

**Notes:** Landed hot dog upload + display as the **fourth M1 task** (after
TASK-010 invite redemption, TASK-012 compression, and TASK-011 profile creation) —
the photo-posting half of the vertical slice. Migration
`20260609181013_hot_dogs.sql` adds the `hot_dogs` table per the [[PROJECT]] Data
Model (with an added `byte_size` column and a caption-length CHECK ≤280) and
schema-qualifies `extensions.gen_random_uuid()`, applying the M0 hosted-parity
lesson. RLS follows the project's **default-deny + explicit-grant** shape: SELECT
for `authenticated` (image **bytes** are protected by the private `hotdogs` bucket

- signed URLs, NOT row RLS — the row is just a path ref), and owner-scoped
  insert/update/delete via the `(select auth.uid())` initplan idiom. An
  `app_storage_bytes()` SECURITY DEFINER RPC sums global usage for the storage guard.

**Counters made non-client-writable via COLUMN-LEVEL privileges on BOTH write
paths (L2 hardening, the key fix-cycle catch).** `vote_count` / `peak_votes` /
`created_at` must never be client-seeded. Enforcement revokes table-wide write,
then re-grants only the safe columns: `grant update (caption)` and `grant insert
(id, owner_id, image_path, caption, byte_size)`. The omitted columns fall to their
DEFAULTs, so a direct PostgREST insert **cannot forge** an opening `vote_count` or
`peak_votes`. The reviewer's two major DB-integrity findings drove this: the
original PR restricted only UPDATE, leaving the INSERT path open to seed counters —
the column-level INSERT grant closes that. This is the column-privilege complement
to the existing "denormalized `vote_count` maintained server-side" gotcha.

**Orphan-safe upload/display/delete ordering.** Upload (`/app/dogs`): client-side
`compressToWebp` (TASK-012) → per-user **100 cap** ("delete one to add another",
decision #10) → `evaluateUpload` storage guard (returns the friendly blocked
message when over threshold) → `upload(hotdogs/{uid}/{id}.webp)` → row insert. The
owner prefix is built from the **trusted `owner_id`** (never client-supplied), so
the storage RLS `{owner_id}/` prefix policy holds, and the server re-checks the
caption cap (≤280) **before any side effect**. The upload **fails closed both
ways**: an insert failure triggers a **compensating storage delete** so no object
is orphaned, and the caption-cap check runs before the upload. Display: the load
lists the owner's dogs plus a **per-row signed URL** (private bucket, 1h TTL); a
failed signing degrades that single row gracefully rather than failing the page.
Delete removes the **row first, then the storage object** (orphan-free; a
storage-removal failure is logged, not fatal).

**Closes the last M0 foundational orphans.** The `$lib/storage` barrel now
re-exports `evaluateUpload` / `storageGuardStatus`, giving the storage guard its
first live consumer. M0 closed with three accepted orphans (`getServiceClient`,
the storage module, `evaluateUpload`); TASK-010 wired `getServiceClient`, TASK-011
wired the storage module for avatars, and TASK-013 now wires the storage module for
hot dogs **plus** the guard — so **all M0 foundational orphans are resolved**.

**Accepted v1 residual — `byte_size` is a client-supplied soft guard input.** A
direct PostgREST insert can understate `byte_size`, so `app_storage_bytes()` / the
global guard is **best-effort, not a hard quota**. Accepted for v1 under the
invite-only trust model; it cannot be closed at the DB (a trigger can't see the
real storage-object size). Carried as Discovered Work below.

Metrics: `pnpm test` 281 passed (+55); `pnpm check` 0 errors; `pnpm lint` clean;
`supabase db reset` exit 0. **1 fix cycle** (2 major DB-integrity findings + 1
minor, all resolved, then reviewer APPROVE on re-review).

### ~~TASK-011: Profile creation~~ [`complete`]

**Completed:** 2026-06-09 · **PR:** #18 (squash `38db5d9`) · **Reviewer:** APPROVE (0 fix cycles, 3 minor notes)
**Acceptance Criteria:**

- [x] On first sign-in, prompt to set unique @handle (validated, case-insensitive unique)
- [x] Optional avatar upload to `avatars` bucket via storage module
- [x] Profile page shows handle, join date, stats (zeros initially)
- [x] Integration: profile row created post-redemption

**Notes:** Landed profile creation as the **third M1 task** (after TASK-010
invite redemption and TASK-012 compression) — the onboarding step that turns a
freshly-redeemed auth user into a named member, and the first route to put the
M0/M1 foundational seams under live load. Feature module
`src/lib/features/profiles/` follows the established `invites/` shape: a pure
validator plus typed server wrappers.

**Handle validation splits along the same pure/IO seam as the rest of the
codebase.** `handle.ts` is the **PURE** validator — it enforces the charset
`^[A-Za-z0-9_]{2,32}$` at the **app boundary**, which is the layer the DB CHECK
deliberately does not cover (the migration's CHECK is length-only, 2–32). This
**closes the TASK-003 Discovered Work item** "Handle character-set validation
(M1, TASK-011)": whitespace and control characters can no longer reach the
`profiles.handle` column. Casing is **preserved** on write — display fidelity is
kept while DB uniqueness stays case-insensitive via the `citext` column from
TASK-003 (validate-for-shape app-side, enforce-uniqueness DB-side).

`profiles.ts` holds the server wrappers — `getProfileById` / `getProfileByHandle`,
`isHandleAvailable`, and `createProfile`. `createProfile` maps a Postgres `23505`
unique-violation to a `HANDLE_TAKEN` sentinel **keyed on the SQLSTATE, never on
constraint text** (so the error message can't leak schema internals) and surfaces
the friendly "handle taken" to the user. This mirrors TASK-010's invite pattern: a
best-effort `isHandleAvailable` pre-check for UX, backed by the authoritative DB
UNIQUE constraint as the real race guard — the pre-check is advisory, the
constraint is law.

**First live consumer of BOTH the image and storage seams.** The onboarding route
`(protected)/app/onboarding/` validates the handle, defaults `display_name` to the
handle when left blank, and (optionally) compresses an avatar **client-side** via
`compressToWebp` (TASK-012) before uploading it to `{uid}/avatar.webp` through
`$lib/storage` (TASK-002). This realizes two of the M0/M1 "accepted foundational
orphans" at once — the image module and the storage module now have a real
non-test caller. The owner prefix is built from the **trusted `user.id`**, never a
client-supplied value (so the storage RLS `{owner_id}/` prefix policy holds), and
the upload **fails closed**: a storage failure aborts before any profile insert,
so a profile row never references an avatar that didn't land.

The profile view route `(protected)/app/profile/[handle]/` renders handle, join
date, zeroed stats, and the avatar via its public URL, 404ing on a missing handle.
The **integration funnel** lives in `(protected)/app/+layout.server.ts`: an
authenticated user with no profile row is routed to `/app/onboarding` (no redirect
loop; the unauthenticated → `/sign-in` guard is preserved), which satisfies
"profile row created post-redemption."

**Bundled fix — `compressToWebp` bitmap leak.** This PR hardened `compressToWebp`
(`src/lib/image/compress.ts`) with a `try/finally` so the decoded `ImageBitmap` is
released on **all** exit paths (the null-context throw, an encode reject, and the
success path). This **resolves the bitmap-close nit** raised in TASK-012
bookkeeping — addressed here because avatar upload is its first live consumer, so
the leak path became reachable.

Metrics: `pnpm test` 226 passed (+12); `pnpm check` 0 errors; `pnpm lint` clean.
**0 fix cycles** — reviewer APPROVE on the first pass with 3 minor non-blocking
notes (one folded into Discovered Work below; two informational).

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

- ~~**Handle character-set validation (M1, TASK-011):** the DB CHECK on
  `profiles.handle` enforces length 2–32 but **not** character set — whitespace
  and control characters are currently possible. Enforce an allowed handle
  character set at the application boundary in the M1 profile form action
  (TASK-011). Surfaced by the TASK-003 reviewer; not a defect in TASK-003,
  flagged so it isn't forgotten.~~ **RESOLVED by TASK-011 (PR #18):** charset
  `^[A-Za-z0-9_]{2,32}$` is now enforced at the app boundary in
  `src/lib/features/profiles/handle.ts`.
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
- ~~**`compressToWebp` bitmap cleanup on the null-context path (M1, fold into
  TASK-013):** `compressToWebp` (`src/lib/image/compress.ts`) calls
  `bitmap.close()` only after a successful `getContext('2d')`; on the rare path
  where `getContext('2d')` returns `null` it throws without releasing the decoded
  bitmap (a negligible leak on an essentially-never path). Suggested fix: wrap the
  draw + encode in `try/finally` so `bitmap.close?.()` always runs. Not a defect —
  a tidy to fold into TASK-013 when compression is wired into the upload path, or
  a standalone nit. Surfaced by the TASK-012 reviewer (2026-06-09, non-blocking).~~
  **RESOLVED by TASK-011 (PR #18):** wrapped the draw + encode in `try/finally` so
  the decoded `ImageBitmap` is released on all exit paths. Fixed here because
  avatar upload (TASK-011) is the module's first live consumer, making the path
  reachable.
- **Shared `profile` layout/page data key is a footgun (M1, TASK-011):**
  `(protected)/app/+layout.server.ts` returns `{ user, profile }` where `profile`
  is the **viewer's own** profile, while `profile/[handle]/+page.server.ts` returns
  `{ profile }` for the **target** profile. SvelteKit's data merge resolves this
  correctly today (the page's `profile` shadows the layout's on that route), so it
  is not a current defect. But the shared `profile` key is a latent footgun: a
  future consumer reading `profile` from layout context on the profile route would
  silently get the target profile, not the viewer's. Suggested remedy: rename the
  layout key (e.g. `viewerProfile`) when it gains a consumer. Surfaced by the
  TASK-011 reviewer (2026-06-09, non-blocking, not actionable now).
- **`byte_size` is a client-supplied soft storage-guard input (accepted v1
  residual, TASK-013):** the `hot_dogs.byte_size` column feeds `app_storage_bytes()`
  and the global storage guard, but a direct PostgREST insert could **understate**
  it, so the guard is best-effort, not a hard quota. Accepted for v1 under the
  invite-only trust model. It **cannot** be closed at the DB — a trigger can't see
  the real storage-object size. Revisit if the trust model changes: recompute usage
  from storage object metadata, or run a periodic reconciliation job that reconciles
  `byte_size` against actual stored bytes. Surfaced by the TASK-013 reviewer
  (2026-06-09).
- ~~**TASK-014 @smoke must assert the DB-level write guards (TASK-013):** the
  column-level INSERT grant (forged `vote_count` / `peak_votes` rejected) and the
  caption-length CHECK (oversized caption rejected) are **migration-level guarantees
  only testable against a live Postgres** — the TASK-013 unit tests recorded these
  as deferred obligations (see the `dogs-action.test.ts` header). The TASK-014
  Playwright `@smoke` should add a direct-PostgREST **forged-counter insert** and an
  **oversized-caption insert**, asserting both are rejected by the DB.~~ **RESOLVED
  by TASK-014 (PR #22):** `tests/db-guards.e2e.ts` (`@security`) does direct
  authenticated PostgREST inserts asserting both the forged-counter and
  oversized-caption inserts are rejected by the DB.
- **`isValidHandle` is an accepted test-only export (tidy candidate, M1 wiring
  audit / TASK-014):** the M1 wiring audit flagged `isValidHandle`
  (`src/lib/features/profiles/handle.ts`) as `export`ed with **no production
  consumer** — it is not called inside `handle.ts`, not referenced by any route
  or `.svelte` component, and is exercised only by its own unit tests. The wired,
  production-used validator is `validateHandle` (onboarding route);
  `isValidHandle` is a redundant one-line sibling predicate
  (`HANDLE_PATTERN.test(normalizeHandle(raw))`). Benign test-only export, **not**
  unwired functionality — accepted and documented at M1 close (see [[PROJECT]] M1
  close notes). **Non-blocking** tidy: drop the `export` or remove the redundant
  predicate so it isn't forgotten. Surfaced by the M1 wiring audit (2026-06-10).
- ~~**TASK-021 crown-recompute must stay in lockstep with `selectTopDog` (M2,
  TASK-021):** when building the Vote RPC, the crown-recompute path must either
  call `selectTopDog` (`src/lib/features/voting/ranking.ts`) directly **or** the
  SQL crown logic must **provably mirror** this comparator's rules — `voteCount`
  descending → earliest non-null `topDogSince` (sticky, **null sorts last**) →
  ascending `id` tie-break. **The risk:** TASK-021 recomputes the crown in SQL
  and silently **diverges** from the TS comparator — especially the **null-last
  stickiness** (a never-crowned challenger must not displace a previously-crowned
  dog on a vote tie) and the **`id` tie-break**. Keep the two implementations in
  lockstep and **verify the equivalence at TASK-021**. Surfaced by the TASK-020 /
  PR #25 review (2026-06-10, forward-looking).~~ **RESOLVED by TASK-021 (PR #28):**
  `recompute_top_dog()` reproduces the `selectTopDog` total order in SQL
  (`vote_count` DESC → earliest non-null `top_dog_since`, NULL last, sticky →
  ascending `hot_dogs.id`), sets a fresh `now()` only on a new reign, and never
  clears the crown while an eligible dog exists. The reviewer empirically
  confirmed the SQL stays in lockstep with the TS comparator (null-last stickiness
  and `id` tie-break included).
