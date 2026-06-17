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

**Milestone M7 — Safety & Polish is `active`** (activated 2026-06-17) — server-side
upload limits, the 🍔 **Hamburger Court** (report → HAMBURGER ALARM → Top-Dog verdict →
HAMBURGER LIES) + a Top-Dog-privileges notice, and a final polish pass. Full task
detail: [[tasks/milestone-07-safety-polish]]. **Progress: 1/5** — TASK-070 (upload
limits, P1) `complete` (PR #74, hosted-push done); TASK-071 (🍔 report + alarm banners,
P2) `in_progress`; TASK-073 (Top-Dog verdict + HAMBURGER LIES, P2), TASK-074 (Top-Dog
privileges notice, P3), and TASK-072 (polish pass, P3) `pending`.

Prior: **Milestone M6 — Emoji Library completed** 2026-06-17 (TASK-060/061; tag
`milestone-06-emoji-library`). The deferred M5 hosted-push follow-up (TASK-054) is
**done** — walls & DMs now work on hosted. See § Completed Milestones for the full
history.

## Planned Milestones

These milestones were pre-specified by the project's initial plenary, so they
carry **full task files now** rather than header-only stubs. (The new-model
default is a one-line stub the planner explodes on activation; here the detail
was already written, so it is preserved.) Depends-on is kept coarse.

None — M7 (the last pre-specified milestone) is now `active`. Future work is tracked
in [[tasks/discovered]] and feeds any post-M7 milestone stubs.

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
| Milestone 05: Walls & DMs               | 2026-06-17 | `milestone-05-walls-dms`               | [[tasks/milestone-05-walls-dms]]               |
| Milestone 06: Emoji Library             | 2026-06-17 | `milestone-06-emoji-library`           | [[tasks/milestone-06-emoji-library]]           |

## Logs

- [[tasks/deferred]] — task-level deferred / descoped work, with disposition
  (whole-milestone deferral lives in § Deferred Milestones above)
- [[tasks/discovered]] — discovered-work log (feeds future milestone stubs)
