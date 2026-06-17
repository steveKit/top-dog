# Milestone M5: Walls & DMs

> **Status:** `active`
> Index: [[TASKS]] · Architecture: [[PROJECT]] · Conventions: [[CLAUDE]]
> **Goal:** message walls + direct messages.

## Active Tasks

> **Grants hotfix (TASK-052/053/054).** A project-wide regression surfaced during
> the M5 integration checkpoint: the Supabase CLI's `auto_expose_new_tables` default
> flipped to `false` (2026-05-30), so a fresh `supabase db reset` no longer issues the
> implicit base table grants the schema relied on (RLS policies alone are insufficient
> for PostgREST). `@smoke`/`@security` are RED and the real app invite path is broken.
> Root-caused + scoped by an architect dispatch (read-only). **M5 cannot close until
> TASK-052/053 land and `@smoke` + `@security` are green again.** Not caused by
> TASK-051.

### TASK-052: Restore Data API base grants (auto-expose remediation) [`pending`] [`P0`] [`M`]

**Owner:** unassigned
**Dependencies:** none (unblocks `@smoke` / `@security`)
**Acceptance Criteria:**

- [ ] New idempotent, schema-qualified migration `supabase/migrations/<ts>_restore_data_api_grants.sql`
      (`supabase migration new restore_data_api_grants`) restoring exactly what
      auto-expose used to issue:
  - [ ] `authenticated`: `SELECT` on all 9 public tables (`invites`, `profiles`,
        `hot_dogs`, `votes`, `top_dog_days`, `hotdog_reactions`, `mustard_sprays`,
        `wall_messages`, `dms`)
  - [ ] `authenticated`: `INSERT` on `invites`; `INSERT, DELETE` on `hotdog_reactions`;
        `INSERT` on `mustard_sprays`; `INSERT, DELETE` on `wall_messages`; `DELETE` on
        `hot_dogs`
  - [ ] `authenticated`: **NO** table-wide INSERT/UPDATE on `profiles`/`hot_dogs`/`dms`
        (preserve the decision #24/#25 column-grant lockdown); **NO** write on
        `votes`/`top_dog_days` (decision #12 — RPC-only write path)
  - [ ] `service_role`: explicit per-table `SELECT, INSERT, UPDATE, DELETE` on all 9
        tables (mirrors pre-flip auto-expose; backs the E2E harness + privileged ops)
  - [ ] `anon`: **NO** table grants (its only paths are RPC EXECUTE — already granted —
        and the keep-alive ping, which reads zero rows under the authenticated-only policy)
- [ ] Uncomment `auto_expose_new_tables = false` in `supabase/config.toml` (line 24) so
      local matches cloud and the permanent post-2026-10-30 behavior
- [ ] After `supabase db reset`: `pnpm test:e2e --grep @smoke` green AND
      `pnpm test:e2e --grep @security` green
- [ ] `pnpm test`, `pnpm check`, `pnpm lint` all clean

### TASK-053: Grant-invariant verification [`pending`] [`P1`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-052
**Acceptance Criteria:**

- [ ] Checked-in verification (a `@security` Playwright spec `tests/grants.e2e.ts` or a
      documented `psql` script) asserting the full required **AND forbidden** grant
      matrix from the architect audit, including the negatives: `anon` has no table DML;
      `authenticated` has no INSERT/UPDATE on `profiles`/`hot_dogs`/`dms` beyond the
      locked columns; `authenticated` has no write on `votes`/`top_dog_days`; the column
      lockdowns survive
- [ ] Fails before TASK-052's migration, passes after (regression guard so the next
      `supabase db reset` can't silently re-drift)

### TASK-054: Push grant migration to hosted + verify keep-alive [`pending`] [`P1`] [`L`]

**Owner:** user (hosted creds — ops task)
**Dependencies:** TASK-052 (ideally TASK-053)
**Acceptance Criteria:**

- [ ] Confirm hosted prerequisites: which migrations are already pushed; whether tables
      pushed before vs after 2026-05-30 retained their auto-exposed grants on hosted
- [ ] Include the grant migration in the **same** `supabase db push` as the still-unpushed
      M5 migrations (`wall_messages`, `dms`) so they don't land grant-less on hosted
- [ ] `supabase db push` (user-run / user-approved)
- [ ] Manually trigger the keep-alive workflow; confirm ping + tally + prune all return
      2xx (protects the 7-day auto-pause guarantee). Idempotent migration → safe to push
      regardless of hosted's current grant state

## Completed Tasks (this milestone)

### TASK-051: Direct messages [`complete`] [`P2`] [`M`]

**Owner:** implementer + tester
**Dependencies:** TASK-011 (complete)
**PR:** #62 (squash `4ac8ff8`) · **Reviewer:** APPROVE · **Fix cycles:** 0
**Acceptance Criteria:**

- [x] `dms` migration + RLS (only sender/recipient read; sender inserts)
- [x] Send/receive DMs; mark read_at

**Notes:** _(pending — written at M5 close by the documenter, together with the M5 close
notes; held because the milestone close is blocked on the TASK-052/053 grants hotfix.)_

---

### TASK-050: Message walls [`complete`] [`P2`] [`M`]

**Owner:** implementer + tester
**Dependencies:** TASK-011 (complete)
**PR:** #60 (squash `d3c7a4d`) · **Reviewer:** APPROVE · **Fix cycles:** 0
**Acceptance Criteria:**

- [x] `wall_messages` migration + RLS (store ORIGINAL body; author/owner may delete)
- [x] Post to and render a profile's wall

**Notes:** Message walls land as another **cosmetic / many-allowed table with no
denormalized counter**, so `wall_messages` writes through **plain owner-scoped RLS,
the deliberate inverse of the consuming-writes-via-RPC convention** — reusing the
`hotdog_reactions` / `mustard_sprays` precedent (decision #12), **not a new
architecture decision**. Migration `20260616184139_wall_messages.sql`: `body` stores
the **ORIGINAL** message verbatim (`char_length(body) <= 1000` CHECK), keeping the M6
emoji render-time filter free to apply later (never persist filtered text); RLS via
the `(select auth.uid())` initplan idiom — SELECT for all `authenticated` (any member
reads any wall, like the feed), INSERT `with check (author_id = (select auth.uid()))`
(author un-forgeable), DELETE scoped to **message author OR wall owner**
(`author_id = … OR profile_id = …`), and **no UPDATE** (messages immutable). Decision
#24/#25's column-grant lockdown deliberately does **not** apply — there is no
server-maintained column to forge, so client-insertable `created_at`/`id` are inert.
New feature module `src/lib/features/walls/walls.ts` (`postWallMessage` /
`listWallMessages` (latest 50, `created_at` desc, normalized author embed) /
`deleteWallMessage`, discriminated `WallResult<T>`, SQLSTATE-keyed sentinels, raw
errors logged server-side only), wired into the existing
`(protected)/app/profile/[handle]/` route (post box + delete affordance shown only to
author or wall owner; existing mustard spray UI preserved). **Security (L2), verified
at review:** author-pin un-forgeable (forge → 42501, pinned by live E2E), DELETE
scoped to the stored row (no client-widenable path), body verbatim + Svelte
auto-escaped (no `{@html}` → no XSS). Tests: `walls.test.ts`, `wall-action.test.ts`,
live-DB `@security` `tests/walls.e2e.ts` (7 RLS specs), plus a `profile-load.test.ts`
stale-test fix. No new dependencies, no new discovered work. Metrics at merge:
`pnpm test` 514 pass, `pnpm check` 0 errors, lint clean, `@smoke` 4, `@security` 47.
**PR #60** (squash `d3c7a4d`) · Reviewer APPROVE · 0 fix cycles.

---

> **No caps.** Acceptance criteria, subtasks, and integration points are
> unbounded. Give each task as much specificity as it needs to be completed to
> spec — never trim detail to hit a count.
