# Handoff 006 — 2026-06-11

## Session Summary

Resumed from [[workflow/handoffs/handoff-005]] (Milestone **M2 — Voting & Top Dog Engine**
in progress; TASK-021 implemented but PR #28 still open, awaiting review). This
session cleared the open PR, landed the next M2 task, and restructured the task
queue. **All work is merged to `main` — there are NO open PRs.**

- **Branch context:** `main` (all session work merged).
- **Merged PRs this session:**
  - **#28 `a170676`** — TASK-021: Vote RPC (move-vote + counter + crown). Reviewed
    `REQUEST_CHANGES → APPROVE` after **1 security fix cycle** (0 test-failure
    cycles).
  - **#29 `29a6a69`** — handoff-005 doc (carried over from the prior session).
  - **#30 `2f2ee4a`** — TASK-021 bookkeeping (Notes + [[PROJECT]] decision #25 +
    [[CLAUDE]] gotchas).
  - **#31 `4351aa9`** — TASK-022: Daily Top Dog tally job. Reviewer `APPROVE`,
    **0 fix cycles**.
  - **#32 `af40143`** — TASK-022 bookkeeping (Notes + [[PROJECT]] decision #26 +
    [[CLAUDE]] gotchas).
  - **#33 `d9771ea`** — task-system migration to the indexed per-milestone layout.
  - **#34 `764947e`** — restored the priority/size key to the [[TASKS]] index
    legend.
- **Stale-task audit:** **clean** — no `[in_progress]` tasks in any milestone
  file. Nothing to surface in Blockers.
- **Milestone M2 status:** 3 of 4 tasks done (TASK-020/021/022). Only **TASK-023
  (badge UI)** remains; completing it **closes M2**.

## Key Decisions

Two formal [[PROJECT]] architecture-decision rows were recorded this session (full
text in the [[PROJECT]] Architecture Decisions table):

1. **#25 — Non-client-writable crown columns.** The `profiles` crown columns
   (`is_current_top_dog` / `top_dog_since` / `days_as_top_dog`) were
   client-forgeable: `profiles` had no column-level write grants, so a plain
   PostgREST INSERT/UPDATE could seed or overwrite crown state. Fixed in the
   TASK-021 security fix cycle by extending **decision #24's** insert+update
   column-grant pattern (previously only on `hot_dogs` counters) to the `profiles`
   crown columns. `recompute_top_dog()` (SECURITY DEFINER) is the sole maintainer.
2. **#26 — Daily-tally auth model (A1).** A privileged-but-input-free scheduled job
   is an **anon-callable, idempotent SECURITY DEFINER RPC**. `tally_top_dog_day()`
   takes **no caller input** (`pronargs = 0`) and only ever records the actual
   current Top Dog's `current_date`, so it is EXECUTE-granted to `anon` +
   `authenticated` and the keep-alive workflow calls it via PostgREST with the
   **existing publishable key** — deliberately avoiding a new repo secret. The
   reviewer empirically confirmed it is not forgeable and is self-limiting (worst
   case: an anon caller triggers today's idempotent tally early — exactly what the
   cron does). **This sets the auth pattern for the M4 mustard-prune job
   (TASK-042),** which wires into the same workflow.

## Files Changed

(Name-status vs the session base `39c8ae3`. Per-file rationale lives in the
TASK-021/022 Notes blocks; summarized here.)

- `supabase/migrations/20260610181704_votes_and_vote_rpc.sql` — **new.** `votes`
  table (`UNIQUE(voter_id)`, default-deny RLS, SELECT-only for `authenticated`, no
  client write path); `cast_vote` / `remove_vote` SECURITY DEFINER RPCs (sole write
  path); drift-free `vote_count` recompute from `COUNT(votes)` in-transaction; crown
  recompute mirroring `selectTopDog`. The fix cycle added the decision #25 crown-
  column grants and revoked the private `recompute_*` helpers from
  `public, anon, authenticated`.
- `supabase/migrations/20260611174243_top_dog_days_and_tally.sql` — **new.**
  `top_dog_days` table (`UNIQUE(profile_id, day)`, default-deny RLS) +
  `tally_top_dog_day()` idempotent anon-callable RPC (decision #26).
- `src/lib/features/voting/votes.ts` + `votes.test.ts` — **new.** Typed `VoteResult`
  wrapper (SQLSTATE-keyed sentinels) + 18 mock-unit tests.
- `tests/votes.e2e.ts` — **new.** 10 live-DB `@security` Playwright specs covering
  the vote RPC and the crown-column write guards.
- `tests/tally.e2e.ts` — **new.** 7 live-DB `@security` specs (tally idempotency +
  write guards).
- `.github/workflows/keepalive.yml` — **modified.** Added the daily
  `tally_top_dog_day()` call (publishable-key PostgREST POST); the step fails the
  workflow on non-2xx.
- `playwright.config.ts` — **modified.** Pinned `workers: 1` to serialize the
  single-shared-DB `@security` suite (pre-existing global-crown-singleton race).
- `tests/db-guards.e2e.ts` — **modified.** Minor harness adjustments for the
  serialized-worker config.
- `TASKS.md` — **migrated.** Now the index/dashboard for the per-milestone layout
  (see below). _(orchestration edits director-owned; narrative legend restored
  this session.)_
- `workflow/tasks/*` — **new (6 milestone files + `discovered.md` + `deferred.md`).** The
  exploded per-milestone queue.
- `workflow/tasks/TASKS-ARCHIVE.md` — **new.** Grandfathered M0 + M1 completed-task archive.
- `CLAUDE.md` — **modified.** TASK-021/022 gotchas; Project Map updated for the new
  task layout and (this handoff) the latest-handoff pointer.
- `PROJECT.md` — **modified.** M2 progress notes, decisions #25/#26, milestone-table
  status, plus the task-migration process note (this handoff).
- `.gitignore` — **modified.** Ignores `.task-migration-backup/`.
- `workflow/handoffs/handoff-005.md` — **new** (merged this session).

## Blockers & Open Questions

None blocking. Two open threads worth carrying:

- **Pending (user-owned, outside this project):** the core-architect should add the
  priority/size keys to the shared `~/.claude/templates/` (`tasks-md.md` +
  `tasks-milestone.md`) and into task-creation + migration — the systemic fix for
  the gap the migration surfaced (the key was missing from the migration template
  and had to be hand-restored in PR #34).
- **Housekeeping:** `.task-migration-backup/` is still on disk (gitignored),
  awaiting the user's review then deletion.

## Discovered Work

No **new** Discovered Work items were logged this session. The existing log
([[workflow/tasks/discovered]], DW-001..008) is unchanged save for dispositions already
recorded: DW-008 (crown lockstep) was discharged by TASK-021. Items still `open`
for user triage:

- [ ] **DW-002** — generic standalone RLS / DB integration-test harness (live-DB
      coverage now exists for consuming-write RPCs via the `@security` pattern, but
      a standalone harness is still wanted).
- [ ] **DW-004** — shared `profile` layout/page data-key footgun (rename the layout
      key when it gains a consumer).
- [ ] **DW-005** — `byte_size` client-supplied soft storage-guard residual (accepted
      v1; revisit if the trust model changes).
- [ ] **DW-007** — `isValidHandle` test-only export tidy candidate (non-blocking).

## Next Steps

Prioritized for the next session:

1. **TASK-023 — Top Dog badge UI** [`P2`, `S`] — the **LAST** task in M2. Renders
   the hot dog badge on the current Top Dog's profile + their dog, updating after a
   crown handoff (reads `profiles.is_current_top_dog`). Depends on TASK-021 (done).
   Lives in [[workflow/tasks/milestone-02-voting-top-dog-engine]]. **Completing it CLOSES
   Milestone M2** — triggers the milestone wiring audit, the
   `milestone-02-voting-top-dog-engine` tag, and milestone-close bookkeeping.
2. **After M2 closes: M3 — Reactions & Per-Dog Stats** (TASK-030/031), or per user
   selection. See [[workflow/tasks/milestone-03-reactions-per-dog-stats]].
3. **Delete `.task-migration-backup/`** after the user reviews it.

Reference [[TASKS]] (now the index/dashboard) for the full queue context.

## Files to Read on Resume

- [[PROJECT]] — decisions (#25/#26), data model, milestone status.
- [[TASKS]] — **now the index/dashboard**; note the new layout
  ([[TASKS-ARCHIVE]] for completed M0/M1, [[workflow/tasks/discovered]], [[workflow/tasks/deferred]]).
- [[workflow/tasks/milestone-02-voting-top-dog-engine]] — the active milestone; **TASK-023
  is next** and closes M2.
- `src/lib/features/voting/ranking.ts` (`selectTopDog`) — the crown-selection
  contract the badge UI reads against.
- `supabase/migrations/20260610181704_votes_and_vote_rpc.sql` +
  `supabase/migrations/20260611174243_top_dog_days_and_tally.sql` — the crown/tally
  context behind `profiles.is_current_top_dog`.

## Library Candidates

None — all session work is domain-specific (vote/crown/tally SQL + Supabase
wrappers) or doc/task-system restructuring; nothing self-contained and
general-purpose enough to extract.
