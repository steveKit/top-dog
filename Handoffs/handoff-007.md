# Handoff 007 — 2026-06-11

## Session Summary

Resumed from [[Handoffs/handoff-006]] (Milestone **M2 — Voting & Top Dog Engine**
in progress; only TASK-023, the badge UI, remained). This session **shipped
TASK-023** — the 4th and last _listed_ M2 task — and ran the M2-close wiring
audit, which surfaced a milestone-blocking orphan. **All work is merged to
`main` — there are NO open PRs. M2 is NOT closed: it is held open pending a
vote-casting UI task (DW-009).**

- **Branch context:** `main` (all session work merged).
- **Merged PRs this session:**
  - **#37 `6d1b206`** — TASK-023: Top Dog badge UI. Reviewer **APPROVE**, **0 fix
    cycles**, 2 minor non-blocking notes.
  - **#38 `06494a8`** — TASK-023 bookkeeping (Notes block + DW-009 +
    [[PROJECT]] M2 progress/held-open note).
- **Stale-task audit:** **clean** — no `[in_progress]` tasks in the active
  milestone (TASK-023 is properly `[complete]` and moved). Nothing to surface in
  Blockers on that front.
- **Milestone M2 status:** 4 of 4 _listed_ tasks done (TASK-020/021/022/023), but
  **held open** — the close-out wiring audit found `castVote`/`removeVote` have no
  production consumer (no vote-casting UI exists). No tag created.

## Key Decisions

No new [[PROJECT]] architecture-decision rows this session. The one lasting
carry-forward is an orchestration decision, not an architecture one:

1. **M2 held open pending a vote-casting UI task (DW-009).** TASK-023 was the last
   _listed_ M2 task, so completing it triggered the M2-close wiring audit. The
   audit found that `castVote` / `removeVote` (`src/lib/features/voting/votes.ts`,
   landed in TASK-021) have **no production (non-test) consumer** — there is no
   vote-casting UI anywhere in the app, so a member cannot actually cast a vote.
   TASK-021 repeatedly deferred this wiring to "a later M2 task" that was never
   created. Per protocol this is a genuine uncaptured gap, not dead code, so **M2
   does not close** (no tag) until a vote-casting UI task lands and the wiring
   audit re-passes. This is the central carry-forward for the next session.
2. **Badge reuses the pure `selectTopDog` comparator (already recorded).** The
   `/app/dogs` badge resolves the Top Dog's winning dog by reusing the
   single-source-of-truth `selectTopDog` seam rather than a parallel ordering, so
   it stays in lockstep with `recompute_top_dog()` (decision #13). Detail lives in
   the TASK-023 Notes block in [[tasks/milestone-02-voting-top-dog-engine]] and the
   [[PROJECT]] M2 progress notes — not re-derived here.

## Files Changed

(Name-status vs the session base `4b85d8d`. Per-file rationale lives in the
TASK-023 Notes block; summarized here.)

- `src/lib/components/TopDogBadge.svelte` — **new.** Shared 👑 badge component
  (`role="status"`, optional `label` prop).
- `src/routes/(protected)/app/dogs/+page.server.ts` — **modified.** Load now
  fetches the signed-in user's own profile and reuses `selectTopDog` to resolve
  the winning-dog id; returns `isCurrentTopDog` / `topDogId`.
- `src/routes/(protected)/app/dogs/+page.svelte` — **modified.** Badge on the
  winning-dog tile.
- `src/routes/(protected)/app/profile/[handle]/+page.svelte` — **modified.**
  Inline badge refactored to `<TopDogBadge>`.
- `src/routes/(protected)/app/dogs/dogs-action.test.ts` — **modified.** +8 unit
  cases for the winning-dog load wiring (real `selectTopDog` left unmocked).
- `PROJECT.md`, `tasks/discovered.md`,
  `tasks/milestone-02-voting-top-dog-engine.md` — **modified** (TASK-023
  bookkeeping; merged in #38 — Notes block, DW-009, M2 progress/held-open note).
- `CLAUDE.md` — **modified** (this handoff: Project Map latest-handoff pointer →
  handoff-007).
- `memory/MEMORY.md` — **modified** (this handoff: orphan-by-design wiring-audit
  pattern).
- `Handoffs/handoff-007.md` — **new** (this file).

## Blockers & Open Questions

- **M2 close is gated on a user decision** about the vote-casting UI. Three paths:
  (a) the director drafts **TASK-024** (vote-casting UI) into the M2 file for
  selection, (b) hand to the planner, or (c) explicitly **accept the orphan and
  close M2** — deferring the vote UI to a later milestone with a recorded
  disposition, mirroring the M0/M1 accepted-orphan precedent. **No code can be
  selected until the user decides.** See DW-009 in [[tasks/discovered]] and the
  held-open note in [[tasks/milestone-02-voting-top-dog-engine]].
- **Local DB note:** `supabase db reset` was run this session to clear a
  _pre-existing_ stale-DB `@security` flake (leftover pinned-id rows in
  `tests/votes.e2e.ts`, unrelated to TASK-023). Local DB is fresh; if the flake
  recurs, a reset clears it.
- **Cross-project (user-owned, NOT this repo):** the core-architect should add the
  priority/size keys to the shared `~/.claude/templates/` task templates — carried
  from [[Handoffs/handoff-006]], still pending.

## Discovered Work

One **new** item was logged this session (full text in [[tasks/discovered]]):

- [ ] **DW-009** — No vote-casting UI: `castVote` / `removeVote`
      (`src/lib/features/voting/votes.ts`) have no production consumer, so a member
      cannot actually cast a vote. **Blocks the M2 close.** Found during TASK-023
      (M2 wiring audit).

Existing items still `open` for user triage (unchanged this session): **DW-002**
(standalone RLS/DB integration-test harness), **DW-004** (shared `profile`
layout/page data-key footgun), **DW-005** (`byte_size` client-supplied soft
storage-guard residual), **DW-007** (`isValidHandle` test-only export tidy).

## Next Steps

Prioritized for the next session:

1. **Decide the vote-casting UI path to close M2** [`P1`] — draft TASK-024
   (vote-casting UI), hand to the planner, or accept-the-orphan-and-close M2. This
   is the gate on everything else in M2. See DW-009 in [[tasks/discovered]] and the
   held-open note in [[tasks/milestone-02-voting-top-dog-engine]].
2. **After M2 closes: M3 — Reactions & Per-Dog Stats** [`P2`] — cosmetic emoji
   reactions + peak votes. See [[tasks/milestone-03-reactions-per-dog-stats]].
3. **(Cross-project)** the shared-template priority/size-key fix (user-owned,
   carried from handoff-006).

Reference [[TASKS]] (the index/dashboard) for the full queue context.

## Files to Read on Resume

- [[PROJECT]] — M2 progress notes (incl. the held-open finding), decisions, data
  model.
- [[TASKS]] — index/dashboard; the M2 row now reads "4/4 listed · held open".
- [[tasks/milestone-02-voting-top-dog-engine]] — Active Tasks held-open note +
  completed TASK-023.
- `src/lib/features/voting/votes.ts` — the orphaned `castVote` / `removeVote`
  wrapper that the vote-casting UI must consume.
- `src/lib/features/voting/ranking.ts` (`selectTopDog`) — the crown comparator the
  badge + any vote UI read against.

## Library Candidates

None — `TopDogBadge` is domain-specific 👑 crown markup, trivial and
presentational, not general-purpose enough to extract.
