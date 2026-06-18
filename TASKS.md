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

**Milestone M8 — Snacktum Snacktorum: Rebrand & Redesign** — [[tasks/milestone-08-snacktum-snacktorum-rebrand]]
(planner-exploded 2026-06-18 on user activation). A **user-facing rebrand + UI/UX
redesign**: "Top Dog" → the hot-dog **cult** app "Snacktum Snacktorum"; champion title
"Top Dog" → **"The Anointed Wiener"** (copy swap only — code identifiers unchanged); a
global app shell + nav, the auth cluster (real `/sign-in` form, forgot/reset password,
ritual sign-up), a profile redesign + display-name surfacing, an error/404 page, the
"Anoint" mustard re-theme, and a base cult visual/theme layer. **Reuses the locked
PROJECT.md stack/architecture/paradigm and all decisions #1–#28 + L2 — no re-plenary, no
new infra, no new deps expected.** 9 tasks (TASK-080…TASK-088).

> **⛔ EXECUTION BLOCKED PENDING FINAL PAGE DESIGNS.** The milestone is exploded with full
> task detail, but **every task is `blocked`** on the shared `DESIGNS` dependency (final
> page designs from the user) — and **seven Open Questions** (ritual-signup scope OQ-1;
> the four Anoint sub-decisions OQ-2a–d; the overall visual theme OQ-3; a possible
> ceremonial font OQ-4) must be resolved **with** the designs. **Do not dispatch any M8
> task until the user delivers designs and activates.** A `design-light` trio (TASK-080
> app shell, TASK-082 sign-in, TASK-083 password reset) is the most design-independent and
> could be unblocked early **at the user's discretion** — not on agent initiative. See the
> milestone file's ⛔ Execution Block + Open Questions sections.

> **Open ops action (user) — unrelated to M8:** the two M7 migrations
> (`20260617205453_burger_alarms.sql`, `20260618120000_burger_verdicts.sql`) still need a
> hosted `supabase db push` before the report→verdict flow works on hosted. No
> keep-alive / auto-pause risk (no scheduled job touches these tables). M8 adds no
> migration under its recommended scope, so it does not extend this gate.

## Planned Milestones

These milestones were pre-specified by the project's initial plenary, so they
carry **full task files now** rather than header-only stubs. (The new-model
default is a one-line stub the planner explodes on activation; here the detail
was already written, so it is preserved.) Depends-on is kept coarse.

None — M7 (the last pre-specified milestone) is now **complete**. Future work is tracked
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
| Milestone 07: Safety & Polish           | 2026-06-18 | `milestone-07-safety-polish`           | [[tasks/milestone-07-safety-polish]]           |

## Logs

- [[tasks/deferred]] — task-level deferred / descoped work, with disposition
  (whole-milestone deferral lives in § Deferred Milestones above)
- [[tasks/discovered]] — discovered-work log (feeds future milestone stubs)
