# Milestone M5: Walls & DMs

> **Status:** `active`
> Index: [[TASKS]] · Architecture: [[PROJECT]] · Conventions: [[CLAUDE]]
> **Goal:** message walls + direct messages.

## Active Tasks

### TASK-051: Direct messages [`in_progress`] [`P2`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-011
**Acceptance Criteria:**

- [ ] `dms` migration + RLS (only sender/recipient read; sender inserts)
- [ ] Send/receive DMs; mark read_at

## Completed Tasks (this milestone)

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
