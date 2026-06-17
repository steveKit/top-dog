# Milestone M7: Safety & Polish

> **Status:** `active`
> Index: [[TASKS]] · Architecture: [[PROJECT]] · Conventions: [[CLAUDE]]
> **Goal:** upload limits, report button, polish.

## Active Tasks

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
