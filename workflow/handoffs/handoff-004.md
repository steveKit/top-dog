# Handoff 004 — 2026-06-10

## Session Summary

A short, focused segment **after** the M1-close finalization captured in
[[workflow/handoffs/handoff-003]] (do not re-read the full M1 arc there). This session
**opened Milestone M2 — Voting & Top Dog Engine** by executing and closing its
entry point, **TASK-020 (ranking + sticky tie-break logic)**, TDD-first per the
adaptive paradigm. A pre-existing markdown prettier-drift that had been breaking
`pnpm lint` was also fixed. All work is merged to `main` — **no PRs open**.

- **Branch:** `main` (all work merged).
- **PR status:** none open. **2 PRs merged this segment:**
  - **TASK-020** — ranking + sticky tie-break logic: the new pure
    `selectTopDog` module plus 17 TDD Vitest tests — **PR #25** (squash
    `835c2f0`). Reviewer `REQUEST_CHANGES` → resolved in **1 docs-only fix
    cycle** (stale red-phase "STUB" comment corrected to a live-wiring note;
    the lexical timestamp-compare precondition documented). **No test-failure
    cycles.**
  - **Bookkeeping** — TASK-020 Notes + M2 marked in progress + a prettier-fix
    of pre-existing markdown drift (PROJECT.md and handoff-003.md) that had
    been breaking `pnpm lint` — **PR #26** (squash `2a78b5e`).
- **Stale-task audit:** none — no `[in_progress]` tasks remain (TASK-020 was
  closed and moved to Completed this session).
- **Quality gate at close:** `pnpm lint` exit 0, `pnpm check` 0 errors,
  `pnpm test` **298 passed** (19 files).

## Key Decisions

No new architecture-decision row was added — **decision #13 (Top Dog)** already
existed in [[PROJECT]]. This session **realized** that contract as code. The
load-bearing, forward-facing points:

1. **The crown-selection contract is now a pure seam, `selectTopDog`.** The
   dog-level modeling and the strict total-order comparator are the durable
   shape TASK-021 must consume. Modeled at the DOG level so "single
   highest-voted dog" falls out naturally — the winning dog's `ownerId` is the
   Top Dog user, a single-value seam TASK-021 writes `top_dog_since` /
   `is_current_top_dog` from. Accepted orphan by design (no non-test consumer
   until TASK-021), same TDD-first pattern as `src/lib/storage/guard.ts`.
2. **Lockstep constraint (most important).** TASK-021's crown-recompute MUST
   stay in lockstep with `selectTopDog` — either call it directly, or the SQL
   crown logic must provably mirror its rules: **votes desc → earliest
   `topDogSince` (sticky, `null` sorts LAST) → ascending `id` tie-break**, with
   `voteCount >= 1` eligibility. The risk is **silent divergence**, especially
   the null-last stickiness and the id tie-break. Already recorded as a
   Discovered Work item in [[TASKS]]; surfaced in Next Steps below.

## Files Changed

This segment only — full per-file detail is in the [[TASKS]] TASK-020 Notes and
the PR diffs.

- `src/lib/features/voting/ranking.ts` — **new** pure crown-selection module.
  `selectTopDog(dogs: readonly RankableDog[]): RankableDog | null` realizing
  decision #13: strict total-order comparator (voteCount desc → earliest
  non-null `topDogSince`, null-last sticky → ascending `id`), `voteCount >= 1`
  eligibility, `null` when none eligible, `TypeError` on negative / non-finite
  `voteCount`. No SvelteKit/Supabase imports.
- `src/lib/features/voting/ranking.test.ts` — **new** 17 Vitest tests (TDD,
  written first).
- `TASKS.md` — TASK-020 → Completed with Notes; M2 section now starts at
  TASK-021; new Discovered Work item (the crown-lockstep constraint).
  _(director-owned orchestration edits)_
- `PROJECT.md` — M2 marked in progress; status prose; `Last Updated`
  2026-06-10. Prettier-fixed pre-existing markdown drift.
- `workflow/handoffs/handoff-003.md` — prettier-fix only (no content change).
- `CLAUDE.md` — Project Map latest-handoff pointer → handoff-004 (this
  bookkeeping).
- `workflow/memory/MEMORY.md` — appended the "prettier-format markdown before it lands"
  pattern (this bookkeeping).

## Blockers & Open Questions

None. No PRs open, no `[in_progress]` tasks, quality gate green.

## Discovered Work

Open items worth triaging during M2 (full text in [[TASKS]] Discovered Work):

- [ ] **Crown-recompute must stay in lockstep with `selectTopDog`** — found
      during TASK-020. TASK-021's SQL crown logic must call or provably mirror
      `selectTopDog`'s rules (votes desc → earliest `topDogSince` null-last
      sticky → `id` tie-break). The risk is silent divergence. **Treat as a
      hard constraint on TASK-021, not someday-maybe.**
- [ ] **Automated RLS / DB integration-test harness** — found during TASK-003,
      **reinforced by the TASK-010 reviewer**. The SECURITY DEFINER RPCs are
      mock-tested only with no live-DB coverage. **Recommended before or
      alongside TASK-021** so the vote RPC's consuming-write logic gets live-DB
      coverage instead of mock-only. A real near-term follow-up.
- [ ] **`byte_size` client-supplied soft storage-guard residual** — accepted v1
      residual (TASK-013). Revisit if the trust model changes.
- [ ] **`isValidHandle` tidy candidate** — non-blocking (M1 wiring audit).
- [ ] **Shared `profile` layout/page data key footgun** (TASK-011,
      non-blocking).

## Next Steps

Milestone **M2 — Voting & Top Dog Engine** continues (TDD-first, decision #2):

1. **P0 — TASK-021 (Vote RPC: move-vote + counter + crown)** [L].
   **Unblocked** — dep TASK-020 ✅ now satisfied. **Inherits established
   patterns:**
   - **decision #23** — anon-executable SECURITY DEFINER single-transaction RPC
     (`search_path=''`, schema-qualified); the `invites` redeem RPC is the
     template.
   - **decision #24** — non-client-writable counters via column-level GRANTs on
     **BOTH insert + update**; replicate for `vote_count`.
   - **decision #4 / the `extensions.`-schema-qualify migration lesson.**
   - **the crown-lockstep constraint above** — call or provably mirror
     `selectTopDog`.
   - The `votes` migration needs `UNIQUE(voter_id)` + RLS forbidding self-vote.
2. **Consider landing the RLS / DB integration-test harness** (carried
   Discovered Work, reinforced by the TASK-010 reviewer) **before or alongside
   TASK-021**, so the vote RPC's consuming-write logic gets live-DB coverage
   instead of mock-only. Flagged as a real near-term follow-up.
3. **Then TASK-022 (daily Top Dog tally) and TASK-023 (badge UI)** — both depend
   on TASK-021.

Reference [[TASKS]] for full queue context.

## Files to Read on Resume

- [[PROJECT]] — M2 now in progress, decisions, data model (`votes` /
  `top_dog_days` / counter columns).
- [[TASKS]] — work queue (start at **TASK-021**) + Discovered Work.
- `src/lib/features/voting/ranking.ts` — the `selectTopDog` seam TASK-021 must
  consume / mirror (the lockstep contract).
- `src/lib/features/invites/` (+ its migration) — the SECURITY DEFINER
  single-transaction RPC template the vote RPC should follow.
- `supabase/migrations/20260609181013_hot_dogs.sql` — the column-level
  counter-GRANT pattern the vote RPC replicates for `vote_count`.

## Library Candidates

None. `ranking.ts` is domain-specific to the Top Dog crown model (decision #13
dog-level selection + sticky tie-break), not a reusable utility.
