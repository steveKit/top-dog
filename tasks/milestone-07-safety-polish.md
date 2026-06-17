# Milestone M7: Safety & Polish

> **Status:** `active`
> Index: [[TASKS]] · Architecture: [[PROJECT]] · Conventions: [[CLAUDE]]
> **Goal:** upload limits, report button, polish.

## Active Tasks

### TASK-071: Report-hamburger button + HAMBURGER ALARM banner [`in_progress`] [`P2`] [`L`]

**Owner:** unassigned
**Dependencies:** TASK-013, TASK-011
**Scope note (2026-06-17, user-themed):** the generic "report button" is reshaped into
a for-fun **🍔 report-hamburger** mechanic: a member flags a hot dog as "that's a
hamburger, not a hot dog," which trips a render-time **HAMBURGER ALARM** banner —
styled like yellow/black **police tape** stretched across the offending dog's image —
shown **wherever that image renders across all feeds** (global feed, dog detail, owner
gallery, profile dog tiles). Composes decision #12 (cosmetic / many-allowed, no
denormalized counter → structurally ranking-inert) and decision #15 (render-time
decay, like mustard). **Reporter is anonymous** (original AC preserved): the reported
user sees the alarm, never who tripped it.

**Acceptance Criteria:**

- [ ] **Data:** new `burger_alarms` table (migration) — `id`, `reporter_id` →
      `profiles`, `hot_dog_id` → `hot_dogs` (both `on delete cascade`), `created_at`;
      `UNIQUE(reporter_id, hot_dog_id)` (one report per reporter per dog). **No
      denormalized counter** (decision #12). Base grants per decision #28
      (`authenticated` SELECT/INSERT/DELETE; `service_role` full; `anon` nothing).
- [ ] **Anonymity via RLS + server-side aggregate:** RLS SELECT/INSERT/DELETE are
      owner-scoped to the reporter (`reporter_id = (select auth.uid())`) so a member can
      read/toggle only their OWN report rows — others' reporter ids are never readable
      via PostgREST. The **public alarm count is aggregated server-side** (service
      client, constructed AFTER the `safeGetSession()` gate) and only the aggregate
      (count / active / intensity) reaches the client — reporter ids never leave the
      server. No UPDATE policy (reports are immutable).
- [ ] **No self-report:** INSERT `WITH CHECK` pins `reporter_id = (select auth.uid())`
      AND blocks reporting a dog you own (an EXISTS check against `hot_dogs.owner_id`) —
      enforced at the DB, not just the UI.
- [ ] **Pure alarm logic (co-located, dependency-free seam, like `mustard/decay.ts`):**
      a `summarizeBurgerAlarm(reportTimestamps, now)` (or equiv) computing alarm state
      from report rows — **active** iff ≥1 report within the last 24h (auto-quiets after
      24h of no new reports), `reporterCount` = unique reporters in-window, and an
      **intensity** that scales with count (more reporters → louder banner). No
      SvelteKit/Supabase imports.
- [ ] **Report / retract:** typed server wrappers (`reportBurger` / `unreportBurger`)
      idempotent (23505 → benign add; missing-row delete → no-op), reporter id derived
      from `auth.uid()` (never client-supplied). Wired to a 🍔 report/retract control on
      the feed (and dog detail) tile; press again to retract; an owner sees no control on
      their own dog.
- [ ] **Two police-tape banners (seeded-random angles):** render-time component styled
      as yellow/black police tape overlaid across the dog image — **two** strips,
      "HAMBURGER ALARM" (🍔) and "TOP DOG IS THE ADJUDICATOR" — shown when the dog's
      alarm is **active**, on EVERY surface a hot-dog image renders (global feed, dog
      detail, owner gallery, profile dog tiles). Each strip is rotated at a
      **seeded-random angle** so it looks haphazardly slapped on but is **stable across
      re-renders** (deterministic, seeded on dog id + banner label via a small pure
      helper — the same seeded-PRNG approach as the emoji sprinkle's
      `stringToSeed`/`mulberry32`, decision #16; NOT re-rolled per render → no jitter).
      Banner prominence scales with reporter count. Render is XSS-safe (Svelte
      text/markup, no `{@html}` of user content).
- [ ] **Marked for review:** a dog with an active alarm is implicitly "pending review"
      (awaiting the Top Dog's verdict — TASK-073). 071 ships the reported/alarmed state +
      the "TOP DOG IS THE ADJUDICATOR" banner; the actual verdict + resolution is TASK-073.
- [ ] **Ranking-inert (structural):** no write path touches `vote_count`/`peak_votes`/
      crown — guaranteed by the no-counter table shape (decision #12), not code
      discipline.
- [ ] **Tests:** unit (pure alarm logic, table-driven decay + intensity; wrapper
      sentinel mapping; the load output shape EXCLUDES reporter ids — anonymity pinned).
      `@security` live-DB: a member cannot forge another's report (RLS), cannot report
      their own dog (`WITH CHECK` rejects), cannot read others' report rows
      (own-only SELECT → anonymity), and report+unreport leaves `vote_count`/`peak_votes`
      unchanged (ranking-inert).
- [ ] All gates green: `pnpm test`, `pnpm check`, `pnpm lint`, `@smoke`, `@security`.

> **Post-merge ops gate:** adds a migration → the per-milestone hosted-push gate applies
> (`supabase db push` to hosted after merge).
> **Likely a new architecture-decision row** (documenter/reviewer to confirm at close):
> "anonymous cosmetic surface — RLS exposes only the actor's own rows; the public
> aggregate is computed server-side so actor identity never reaches the client" — a new
> shape vs. the non-anonymous reactions table.

### TASK-073: Top-Dog verdict + HAMBURGER LIES banner [`pending`] [`P2`] [`L`]

**Owner:** unassigned
**Dependencies:** TASK-071, TASK-013, TASK-011, M2 crown engine (`recompute_top_dog`)
**Scope note (2026-06-17, user-themed):** the moderation half of the Hamburger Court.
The **current Top Dog adjudicates** flagged dogs and renders a per-dog verdict; a "not a
hamburger" verdict brands every reporter of that dog with a render-time **HAMBURGER
LIES** banner on their profile. Reuses the Top-Dog-gated privilege model (decisions
#25/#15) and the consuming-writes-via-RPC convention.

**Acceptance Criteria:**

- [ ] **Verdict RPC (Top-Dog-gated, sole write path):** a SECURITY DEFINER RPC renders a
      per-dog verdict (`confirmed_hamburger` | `not_a_hamburger`) in one transaction,
      resolving all pending reports on that dog. Gated via EXISTS on the
      non-client-writable `is_current_top_dog` crown column (decision #25 — trustworthy
      because the crown column is not client-writable). `search_path=''`,
      schema-qualified, `revoke execute … from public, anon, authenticated`.
- [ ] **Verdict store:** a per-dog review state (`none`/`pending`/`confirmed`/`cleared`)
      or a `burger_verdicts` table, server-maintained (non-client-writable, decision
      #24/#25 style) — written only by the verdict RPC.
- [ ] **HAMBURGER LIES consequence:** a `not_a_hamburger` verdict mints HAMBURGER LIES
      rows for every reporter of that dog (transactionally in the RPC) — cosmetic /
      many-allowed surface (decision #12, no denormalized counter, ranking-inert).
- [ ] **HAMBURGER LIES banner:** render-time police-tape banner on the offending
      reporter's PROFILE, **decaying over ~7 days** (render-time, like mustard decay);
      seeded-random angle (same helper as TASK-071).
- [ ] **Adjudication surface:** a Top-Dog-only control to view flagged dogs and rule
      (`confirmed` / `not a hamburger`). Non-Top-Dog members never see it; the gate is
      also enforced at the DB (the RPC), not just the UI.
- [ ] **Confirmed branch:** a `confirmed_hamburger` verdict resolves the review (alarm
      justified) — document whether the alarm then persists or clears.
- [ ] **Tests:** unit (pure LIES-decay logic; verdict→state mapping). `@security`
      live-DB: a non-Top-Dog cannot call the verdict RPC (gate rejects); the verdict
      cannot be forged client-side (RPC is the sole write path); LIES rows are
      ranking-inert; a verdict resolves the correct reports.
- [ ] All gates green: `pnpm test`, `pnpm check`, `pnpm lint`, `@smoke`, `@security`.

> **Post-merge ops gate:** adds a migration → the per-milestone hosted-push gate applies.

### TASK-074: Top Dog privileges in-app notice [`pending`] [`P3`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-073 (advertises adjudication), M4 mustard, M2 crown engine
**Scope note (2026-06-17, user-themed):** when a member holds the crown, tell them what
they can do — an **in-app notice** (chosen over a system DM to avoid inventing a system
sender; the DM author-pin privacy model stays intact).

**Acceptance Criteria:**

- [ ] In-app "👑 Top Dog privileges" notice shown to the crown-holder (gated on the live
      `is_current_top_dog` crown state, decision #25), listing their powers: adjudicate
      🍔 hamburger reports (TASK-073) + spray mustard (M4).
- [ ] Live-crown gated — appears on gaining the crown, gone on losing it. Dismissible
      (optional one-time `seen` flag; no fake DM, minimal/no schema).
- [ ] Non-Top-Dog members never see it.
- [ ] All gates green: `pnpm test`, `pnpm check`, `pnpm lint`, `@smoke`.

### TASK-072: Polish pass [`pending`] [`P3`] [`M`]

**Owner:** unassigned
**Dependencies:** all prior milestones
**Acceptance Criteria:**

- [ ] Responsive layout, empty states, loading states
- [ ] `pnpm lint`, `pnpm check`, `pnpm test`, `@smoke` all green

## Completed Tasks (this milestone)

### TASK-070: Upload limits enforcement [`complete`] [`P1`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-013
**Merged:** PR #74 (`864b8e2`, squash) · Reviewer: APPROVE · Fix cycles: 0
**Scope note (2026-06-17, activation):** "hard server-side" interpreted per the
project's L2 defense-at-the-DB posture — enforced at the authoritative boundary
(DB + Storage API), so a direct PostgREST insert cannot bypass the limits, not only
in the SvelteKit form action. Folds in **DW-005** (client-supplied `byte_size`
soft-guard residual). `MAX_UPLOAD_BYTES = 2 MiB`.
**Acceptance Criteria:**

- [x] Per-file max size hard-capped at the Storage API via the `hotdogs` bucket
      `file_size_limit` (rejects oversized ACTUAL bytes regardless of client) — also
      applied to `avatars` for consistency
- [x] DB CHECK `byte_size <= MAX_UPLOAD_BYTES` on `hot_dogs` as the authoritative
      declared-size backstop feeding the global storage-sum guard
      (`hot_dogs_byte_size_max`)
- [x] Per-user count cap (100) enforced at the DB via a BEFORE INSERT trigger
      (`hot_dogs_enforce_per_user_cap`); the existing form-action count check stays as
      the friendly UX layer
- [x] Form action enforces the server-side max-size check and returns clear,
      friendly errors on every violation (size, count, global guard)
- [x] `@security` live-DB E2E asserts the DB trigger + CHECK reject over-cap and
      oversized-`byte_size` direct inserts; unit coverage for the size constant (5 new
      `@security` cases + the constant unit test)
- [x] All gates green: `pnpm test` 626, `pnpm check` 0, `pnpm lint` clean, `@smoke` 4,
      `@security` 73

> **Post-merge ops gate — DONE (2026-06-17):** the migration
> (`20260617195233_upload_limits.sql`) was `supabase db push`ed to hosted by the user,
> so the DB CHECK/trigger + Storage-API caps are live on the hosted project.

**Notes:**

- **Three-layer, hard, server-side enforcement.** "Hard server-side" was
  realized at the authoritative boundary so a direct PostgREST insert (browser
  publishable key, bypassing the SvelteKit form action) cannot bypass any of the
  three limits:
  1. **Storage API `file_size_limit = 2 MiB`** on the `hotdogs` AND `avatars`
     buckets (migration `20260617195233_upload_limits.sql`) — the only layer that
     bounds the **actual uploaded bytes**, rejecting an oversized object at the
     Storage API regardless of what the client claims.
  2. **DB CHECK `hot_dogs_byte_size_max` (`byte_size <= 2097152`)** — bounds the
     **declared** size column that feeds the decision #11 global storage-sum
     guard. This bounds the value, not the bytes.
  3. **`hot_dogs_enforce_per_user_cap()` BEFORE INSERT trigger** — enforces the
     100-per-dog-per-user cap (decision #10) at the DB; the existing form-action
     count check stays as the friendly UX layer.
- **Why a trigger, not an RPC, for the count cap.** The per-user cap is a
  per-row admission invariant on the **plain owner-scoped INSERT path** (hot dog
  upload writes through RLS, not through a consuming-writes RPC — there is no
  denormalized counter to maintain transactionally). A SECURITY DEFINER RPC would
  have meant rerouting the whole upload write path through an RPC just to gate a
  count; a BEFORE INSERT trigger enforces the admission rule in place without
  changing the write path. The trigger function is SECURITY DEFINER,
  `search_path=''`, schema-qualified, with `revoke execute … from public, anon,
authenticated` (the standard private-helper lockdown — a trigger function is
  never meant to be called directly).
- **Single-source-of-truth across the SQL/TS boundary.** `MAX_UPLOAD_BYTES =
2097152` (2 MiB) lives as a TS constant in
  `src/lib/features/hotdogs/hotdogs.ts` (single source on the TS side). SQL
  cannot import a TS constant, so the migration carries the `2097152` literal
  directly, with cross-reference comments in **both** directions (SQL ↔ TS) and a
  unit test pinning the constant's value to catch drift if either side changes.
  The `upload` form action rejects `photo.size > MAX_UPLOAD_BYTES` early with a
  friendly `fail(400)`.
- **DW-005 residual — substantially MITIGATED, not fully closed.** DW-005's
  original concern had two directions. The **real-bytes / oversized** direction is
  now **closed** by the hard Storage-API `file_size_limit`. The
  **understatement** direction remains: a client can still upload a real ~2 MiB
  object and declare `byte_size = 1`, understating the global storage-sum guard.
  The 2 MiB per-file cap shrinks the abuse ceiling but does not eliminate it.
  This stays an **accepted v1 residual** under the invite-only trust model — kept
  TRACKED in [[tasks/discovered]] (DW-005 re-scoped), not marked fully resolved.
  Closing it would require reconciling `byte_size` against real `storage.objects`
  metadata server-side post-upload.
- **No new architecture-decision row.** This task **composes** decision #11
  (global storage guard), decision #10 (per-user cap), and decision #24's
  column-grant lockdown — which it **preserves and does NOT touch** — under the
  L2 defense-at-the-DB posture. Recorded as a hardening of those, not new
  architecture. (See [[PROJECT]] Architecture-Decisions note.)
- **Avatar-symmetry follow-up.** Avatar uploads now also hit the hard 2 MiB
  Storage-API cap, but the friendly form-action "too big" pre-check was scoped to
  hot-dog uploads only — an oversized avatar surfaces a generic "We couldn't
  upload your avatar." rather than a friendly size message. Within AC and
  unreachable in practice (avatars compress to ~100–200 KB); logged as a
  low-priority DW item for optional future symmetry.
- **Reviewer outcome:** APPROVE, **0 fix cycles**. Gates: `pnpm test` 626,
  `pnpm check` 0, lint clean, `@smoke` 4, `@security` 73 (5 new `@security`
  live-DB cases in `tests/db-guards.e2e.ts` — CHECK rejects oversized
  `byte_size`, trigger rejects the 101st row, Storage API rejects a >2 MiB
  object, boundary cases at exactly 2 MiB accepted — plus unit cases for the
  action size check and the constant).
- **Hosted-push gate — DONE (2026-06-17):** migration
  `20260617195233_upload_limits.sql` was `supabase db push`ed to hosted by the user,
  so the DB CHECK/trigger + Storage-API caps are now live on the hosted project (see
  the Post-merge ops gate callout above and [[PROJECT]] Process notes).

---

> **No caps.** Acceptance criteria, subtasks, and integration points are
> unbounded. Give each task as much specificity as it needs to be completed to
> spec — never trim detail to hit a count.
