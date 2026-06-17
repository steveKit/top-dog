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

**Milestone M5 — Walls & DMs** is `active` (2/5 tasks complete). **TASK-050
(message walls)** (PR #60, `d3c7a4d`) and **TASK-051 (direct messages)** (PR #62,
`4ac8ff8`) are both complete. A **project-wide grants regression** surfaced at the
M5 integration checkpoint (Supabase CLI `auto_expose_new_tables` flipped to `false`
on 2026-05-30 → fresh `supabase db reset` strips implicit base table grants;
`@smoke`/`@security` RED, invite path broken). Architect-scoped fix added as
**TASK-052 (`P0`, restore grants — active)**, **TASK-053 (grant-invariant
verification)**, and **TASK-054 (hosted push, user-gated ops)**. **M5 cannot close
until TASK-052/053 land and `@smoke` + `@security` are green.** See
[[tasks/milestone-05-walls-dms]]. **Milestone M4 — Mustard Mechanic completed**
2026-06-16 (TASK-040/041/042) — see § Completed Milestones.

## Planned Milestones

These milestones were pre-specified by the project's initial plenary, so they
carry **full task files now** rather than header-only stubs. (The new-model
default is a one-line stub the planner explodes on activation; here the detail
was already written, so it is preserved.) Depends-on is kept coarse.

| #   | Milestone       | Scope (one line)                                            | Depends on           | File                                 |
| --- | --------------- | ----------------------------------------------------------- | -------------------- | ------------------------------------ |
| 06  | Emoji Library   | hot-dog emoji set + render-time filter + random sprinkle    | M5 (TASK-050/051)    | [[tasks/milestone-06-emoji-library]] |
| 07  | Safety & Polish | server-side upload limits, report button, final polish pass | all prior milestones | [[tasks/milestone-07-safety-polish]] |

## Deferred Milestones

None.

## Completed Milestones

| Milestone                               | Completed  | Tag                                    | File                                           |
| --------------------------------------- | ---------- | -------------------------------------- | ---------------------------------------------- |
| Milestone 00: Scaffold & Infra          | 2026-06-08 | `milestone-00-scaffold-infra`          | [[TASKS-ARCHIVE]] (§ Milestone M0)             |
| Milestone 01: Vertical Slice            | 2026-06-09 | `milestone-01-vertical-slice`          | [[TASKS-ARCHIVE]] (§ Milestone M1)             |
| Milestone 02: Voting & Top Dog Engine   | 2026-06-12 | `milestone-02-voting-top-dog-engine`   | [[tasks/milestone-02-voting-top-dog-engine]]   |
| Milestone 03: Reactions & Per-Dog Stats | 2026-06-12 | `milestone-03-reactions-per-dog-stats` | [[tasks/milestone-03-reactions-per-dog-stats]] |
| Milestone 04: Mustard Mechanic          | 2026-06-16 | `milestone-04-mustard-mechanic`        | [[tasks/milestone-04-mustard-mechanic]]        |

## Logs

- [[tasks/deferred]] — task-level deferred / descoped work, with disposition
  (whole-milestone deferral lives in § Deferred Milestones above)
- [[tasks/discovered]] — discovered-work log (feeds future milestone stubs)
