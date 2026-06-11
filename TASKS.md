# Task Index — Top Dog

> **Milestone status:** `pending` (stub — not yet exploded) | `active` (exploded, in progress) | `deferred` (parked — body preserved) | `complete`
> **Task status (inside milestone files):** `pending` | `in_progress` | `blocked` | `complete`
> **Priority key:** `P0` (critical) | `P1` (high) | `P2` (medium) | `P3` (low)
> **Size key:** `S` (< 1 hour) | `M` (1-4 hours) | `L` (4+ hours)
> See [[PROJECT]] for architecture decisions and [[CLAUDE]] for conventions.

## How this works

- Each milestone has its own file under `tasks/` holding its tasks in full detail.
- Future milestones live here as **one-line stubs** until activated. Only the
  **planner** explodes a stub into its milestone file (never the director or
  other agents).
- Completed tasks stay in their milestone file. When a milestone closes, that
  frozen file is the milestone's permanent archive — there is no separate archive
  for new milestones. The pre-migration milestones (M0, M1) are grandfathered in
  [[TASKS-ARCHIVE]].
- Two cross-milestone logs: [[tasks/deferred]] and [[tasks/discovered]].

## Active Milestones

| Milestone                             | Status   | Progress               | File                                         |
| ------------------------------------- | -------- | ---------------------- | -------------------------------------------- |
| Milestone 02: Voting & Top Dog Engine | `active` | 4/4 listed · held open | [[tasks/milestone-02-voting-top-dog-engine]] |

_The milestone file is the source of truth for per-task status. The Progress
column is a coarse rollup the director updates at task/milestone events — keep it
loose to avoid index drift. (TASK-020/021/022/023 all done; M2 **held open** — the
wiring audit found no vote-casting UI consuming `castVote`/`removeVote`, logged as
DW-009. A vote-casting UI task must land before M2 can close.)_

## Planned Milestones

These milestones were pre-specified by the project's initial plenary, so they
carry **full task files now** rather than header-only stubs. (The new-model
default is a one-line stub the planner explodes on activation; here the detail
was already written, so it is preserved.) Depends-on is kept coarse.

| #   | Milestone                 | Scope (one line)                                               | Depends on              | File                                           |
| --- | ------------------------- | -------------------------------------------------------------- | ----------------------- | ---------------------------------------------- |
| 03  | Reactions & Per-Dog Stats | cosmetic emoji reactions (no ranking effect), peak votes       | M2 (TASK-021), TASK-013 | [[tasks/milestone-03-reactions-per-dog-stats]] |
| 04  | Mustard Mechanic          | Top Dog sprays mustard; render-time decay over 24h; >24h prune | M2 (TASK-021)           | [[tasks/milestone-04-mustard-mechanic]]        |
| 05  | Walls & DMs               | profile message walls + direct messages (store original body)  | TASK-011                | [[tasks/milestone-05-walls-dms]]               |
| 06  | Emoji Library             | hot-dog emoji set + render-time filter + random sprinkle       | M5 (TASK-050/051)       | [[tasks/milestone-06-emoji-library]]           |
| 07  | Safety & Polish           | server-side upload limits, report button, final polish pass    | all prior milestones    | [[tasks/milestone-07-safety-polish]]           |

## Deferred Milestones

None.

## Completed Milestones

| Milestone                      | Completed  | Tag                           | File                               |
| ------------------------------ | ---------- | ----------------------------- | ---------------------------------- |
| Milestone 00: Scaffold & Infra | 2026-06-08 | `milestone-00-scaffold-infra` | [[TASKS-ARCHIVE]] (§ Milestone M0) |
| Milestone 01: Vertical Slice   | 2026-06-09 | `milestone-01-vertical-slice` | [[TASKS-ARCHIVE]] (§ Milestone M1) |

## Logs

- [[tasks/deferred]] — task-level deferred / descoped work, with disposition
  (whole-milestone deferral lives in § Deferred Milestones above)
- [[tasks/discovered]] — discovered-work log (feeds future milestone stubs)
