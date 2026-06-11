# Handoff 005 — 2026-06-10

## Session Summary

Resumed from [[Handoffs/handoff-004]] via `/resume-project-handoff` (Milestone
**M2 — Voting & Top Dog Engine** in progress, TASK-020 done). This session
executed **TASK-021 (Vote RPC: move-vote + counter + crown)** in **standard mode
(implementer-first)** — the pure crown logic it mirrors (`selectTopDog`) already
existed from TASK-020, and the new work is DB/integration (migration + RPC +
RLS), so test-after wiring rather than TDD-first. Stopped at a logical break per
user request: **code + tests done, PR #28 OPEN**, awaiting reviewer dispatch +
user-gated merge.

- **Branch:** `feat/task-021-vote-rpc` (this session's work). Handoff authored on
  `docs/handoff-005`.
- **PR status:** **PR #28 OPEN — NOT merged, NOT complete.** TASK-021 stays
  `[in_progress]` on its feature branch; review + user-gated merge happen next
  session.
- **Stale-task audit:** TASK-021 is the only `[in_progress]` task — it is this
  session's active work, intentionally left open at PR #28, not stale.
- **Quality gate at close:** `pnpm test` **312 passed** (20 files), `pnpm check`
  0 errors, `pnpm lint` clean, `pnpm test:e2e --grep @security` **10 passed**
  (8 new vote specs + 2 existing db-guards), `pnpm test:e2e --grep @smoke` green
  (no regression), `supabase db reset` exit 0. **0 fix cycles** — the tester
  found no production bugs.

## Key Decisions

No new [[PROJECT]] architecture-decision row this session — TASK-021 **realizes**
existing decisions (#13 Top Dog, #23 SECURITY DEFINER single-transaction RPC,
#24 non-client-writable counters) as code. The durable, forward-facing points:

1. **Live-DB test harness — folded into TASK-021, no new dependency, no separate
   task.** The carried "RLS/DB integration-test harness" Discovered Work item was
   addressed for this task by folding live-DB coverage directly into TASK-021's
   test step — reusing the **existing `@security` Playwright pattern**
   (`tests/db-guards.e2e.ts` + `tests/helpers/local-stack.ts` + the service-role
   fixture setup) with the already-installed `@supabase/supabase-js`. The generic
   **standalone** harness remains in Discovered Work for later, but consuming-write
   RPCs now have a live-DB coverage path established.
2. **Voter identity is RPC-derived, never client-supplied.** The voter is read
   from `(select auth.uid())` INSIDE the RPC (anti-vote-forgery). The client never
   passes a voter id.
3. **Crown recompute provably mirrors `selectTopDog` (the lockstep constraint from
   the TASK-020 review).** The SQL crown logic follows the same strict total order:
   `vote_count` DESC → earliest non-null `top_dog_since` (NULL sorts LAST, sticky)
   → ascending `hot_dogs.id`. It reads the CURRENT `top_dog_since` to pick (as the
   pure fn does), sets a fresh `now()` only on a NEW reign, leaves an incumbent's
   `top_dog_since` untouched (stickiness), and never clears the crown when an
   eligible dog exists. The migration carries a comment block documenting this
   mirror so future edits keep lockstep.

## Files Changed

All on `feat/task-021-vote-rpc` / **PR #28 — NOT on `main` yet.** Full per-file
detail will go in the TASK-021 Notes block after merge (next session).

- `supabase/migrations/20260610181704_votes_and_vote_rpc.sql` — **new.** `votes`
  table (`UNIQUE(voter_id)`, default-deny RLS, SELECT-only for authenticated, no
  client write path); `cast_vote(target_dog uuid)` + `remove_vote()` SECURITY
  DEFINER RPCs (`search_path=''`, schema-qualified, EXECUTE granted to
  authenticated only); private `recompute_vote_count` / `recompute_top_dog`
  helpers; a `BEFORE INSERT/UPDATE` self-vote-rejecting trigger.
- `src/lib/features/voting/votes.ts` — **new.** Typed `VoteResult` wrapper
  (`castVote` / `removeVote`, dependency-injected `SupabaseClient`), with
  SQLSTATE-keyed sentinels: `28000 → VOTE_UNAUTHENTICATED`, `23514 → VOTE_SELF`,
  `P0002 → VOTE_NO_SUCH_DOG`.
- `src/lib/features/voting/votes.test.ts` — **new.** 18 mock-unit tests for the
  wrapper.
- `tests/votes.e2e.ts` — **new.** 8 live-DB `@security` Playwright tests.
- `TASKS.md` — TASK-021 marked `[in_progress]` (on the feature branch).
  _(director-owned orchestration edit)_

## Key Technical Points (durable)

- **`vote_count` recomputed authoritatively from `COUNT(votes)` in-transaction**
  (drift-free under concurrency); `peak_votes` bumped via `greatest()`. Counters
  stay non-client-writable via decision #24's column grants; the SECURITY DEFINER
  RPC is the sole writer.
- **Crown recompute lockstep** (see Key Decisions #3): `vote_count` DESC →
  earliest non-null `top_dog_since` (NULL last, sticky) → ascending `hot_dogs.id`;
  reads current `top_dog_since`, sets fresh `now()` only on a new reign,
  incumbent keeps its timestamp, no eligible dog clears the crown.
- Follows **decision #23** (SECURITY DEFINER single-transaction RPC; here
  authenticated-only rather than anon) and the `extensions.`-schema-qualify
  migration lesson.

## Blockers & Open Questions

None blocking. The one open item is **PR #28 (TASK-021)** — it needs reviewer
dispatch + user-gated merge next session.

Caveats to record so they aren't mistaken for bugs:

- **T-SQL false-positive diagnostics on the migration.** The editor flagged the
  migration with dozens of "Incorrect syntax" errors — these come from a
  SQL-Server/T-SQL parser mis-applied to a PostgreSQL file (they reference
  T-SQL-only constructs like `CONVERSATION`/`CURSOR` options and choke on valid
  Postgres `CREATE POLICY`, `BEFORE INSERT` triggers, `NULLS LAST`, `language
plpgsql`). The migration is verified good: `supabase db reset` exit 0 + 10
  passing live-Postgres tests. **NOT a real defect.**
- **Tester notes.** A transient `@smoke` flake (sign-up → onboarding navigation
  timeout, unrelated to votes, passed on retry). `resetCrownField()` in
  `votes.e2e.ts` clears the crown **globally** before each crown test — correct,
  since the Top Dog crown is a global singleton — and fine under the current
  worker config, but revisit cross-file crown isolation if `fullyParallel` is
  ever enabled.

## Discovered Work

Carried forward (these already live in [[TASKS]] Discovered Work; the standalone
harness item is now partially addressed for votes):

- [ ] **Generic standalone RLS / DB integration-test harness** — the live-DB
      coverage path is now established for consuming-write RPCs (folded into
      TASK-021's `@security` specs), but a generic standalone harness is still
      worth landing for broader reuse. Downgraded from "before/alongside TASK-021"
      to a general follow-up.
- [ ] **`byte_size` client-supplied soft storage-guard residual** — accepted v1
      residual (TASK-013). Revisit if the trust model changes.
- [ ] **`isValidHandle` tidy candidate** — non-blocking (M1 wiring audit).
- [ ] **Shared `profile` layout/page data-key footgun** (TASK-011, non-blocking).

## Next Steps

1. **Review + merge PR #28 (TASK-021).** Dispatch the reviewer with the TASK-021
   acceptance criteria + PR #28; present the verdict; user-gated squash merge.
   Then bookkeeping: tick the TASK-021 ACs, mark `[complete]`, move it to
   Completed Tasks, and the documenter writes its Notes block + the
   [[PROJECT]] update.
2. **TASK-022 (daily Top Dog tally job)** [P1, M] — depends on TASK-021; wire into
   the keep-alive workflow; pure tally logic TDD'd (`top_dog_days` UNIQUE(profile_id,
   day)).
3. **TASK-023 (Top Dog badge UI)** [P2, S] — depends on TASK-021.

Reference [[TASKS]] for full queue context.

## Files to Read on Resume

- **PR #28** — the four new files: the migration, `votes.ts`, `votes.test.ts`,
  `tests/votes.e2e.ts`.
- `src/lib/features/voting/ranking.ts` — the `selectTopDog` lockstep contract the
  RPC crown logic mirrors.
- `src/lib/features/voting/votes.ts` + `supabase/migrations/20260610181704_votes_and_vote_rpc.sql`
  — the wrapper and the RPC/RLS it wraps.
- [[TASKS]] — TASK-021 `in_progress` (→ then TASK-022 / TASK-023) + Discovered
  Work.
- [[PROJECT]] — decisions, data model.

## Library Candidates

None — the vote RPC + wrapper are domain-specific to the Top Dog crown model.
