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

**None.** Milestone **M8 — Snacktum Snacktorum: Rebrand & Redesign** closed **2026-06-23**
(16/16, tag `milestone-08-snacktum-snacktorum-rebrand`) — see § Completed Milestones below and
its frozen archive [[tasks/milestone-08-snacktum-snacktorum-rebrand]] for the full per-task
record. **The next milestone is the stub M9 — Operator / Admin Dashboard in § Planned
Milestones; activate it via the planner when ready** (no task auto-chains — wait for explicit
user instruction).

> **Standing hosted bring-up op (user's hand, async — NOT a milestone blocker).** One hosted
> `supabase db push` / config push batches all outstanding hosted items: the two M7 migrations
> (`20260617205453_burger_alarms.sql`, `20260618120000_burger_verdicts.sql`), the TASK-094
> prune-retirement migration (`20260622120000_retire_mustard_prune.sql`, decision #29 — the DROP
> of `prune_mustard_sprays()`; the keep-alive prune step is already removed in the merged code),
> and the TASK-083 hosted **recovery email template** config (the code-emitting `{{ .Token }}`
> template — or production sends a recovery LINK not a CODE and `/reset-password` breaks). Until
> pushed, the 🍔 Tribunal verdict flow + hosted password reset are non-functional **on hosted**;
> there is **no auto-pause risk** (the daily keep-alive `ping` keeps the hosted DB alive).

## Planned Milestones

These milestones were pre-specified by the project's initial plenary, so they
carry **full task files now** rather than header-only stubs. (The new-model
default is a one-line stub the planner explodes on activation; here the detail
was already written, so it is preserved.) Depends-on is kept coarse.

The pre-specified set (M0–M7) is complete and M8 is the first post-plenary milestone
(exploded above). New future milestones now appear here as one-line **stubs** until you
activate one — the **planner** explodes a stub into its milestone file on activation.

- **Milestone M9 — Operator / Admin Dashboard** `pending` (stub — not yet exploded).
  **Net-new feature work, post-M8** (not part of the M8 skin-only rebrand). An
  operator-only `/admin` area to monitor the platform: member / frank / vote / reaction /
  anointing / report+verdict counts, the **invite funnel** (sent / redeemed / conversion),
  **storage used** (`app_storage_bytes()` already exists), the current champion, and growth
  over `created_at`. Mostly **read-only aggregates over existing data** — little/no new
  tracking. **Key decision at activation — admin authorization:** recommended a
  **server-side allowlist** of operator ids (no schema, non-forgeable) over a
  non-client-writable `is_admin` column; this is distinct from the in-game "Anointed
  Wiener" role. Read-only monitoring for v1.

Other future work is tracked in [[tasks/discovered]].

## Deferred Milestones

None.

## Completed Milestones

| Milestone                                              | Completed  | Tag                                        | File                                               |
| ------------------------------------------------------ | ---------- | ------------------------------------------ | -------------------------------------------------- |
| Milestone 00: Scaffold & Infra                         | 2026-06-08 | `milestone-00-scaffold-infra`              | [[TASKS-ARCHIVE]] (§ Milestone M0)                 |
| Milestone 01: Vertical Slice                           | 2026-06-09 | `milestone-01-vertical-slice`              | [[TASKS-ARCHIVE]] (§ Milestone M1)                 |
| Milestone 02: Voting & Top Dog Engine                  | 2026-06-12 | `milestone-02-voting-top-dog-engine`       | [[tasks/milestone-02-voting-top-dog-engine]]       |
| Milestone 03: Reactions & Per-Dog Stats                | 2026-06-12 | `milestone-03-reactions-per-dog-stats`     | [[tasks/milestone-03-reactions-per-dog-stats]]     |
| Milestone 04: Mustard Mechanic                         | 2026-06-16 | `milestone-04-mustard-mechanic`            | [[tasks/milestone-04-mustard-mechanic]]            |
| Milestone 05: Walls & DMs                              | 2026-06-17 | `milestone-05-walls-dms`                   | [[tasks/milestone-05-walls-dms]]                   |
| Milestone 06: Emoji Library                            | 2026-06-17 | `milestone-06-emoji-library`               | [[tasks/milestone-06-emoji-library]]               |
| Milestone 07: Safety & Polish                          | 2026-06-18 | `milestone-07-safety-polish`               | [[tasks/milestone-07-safety-polish]]               |
| Milestone 08: Snacktum Snacktorum — Rebrand & Redesign | 2026-06-23 | `milestone-08-snacktum-snacktorum-rebrand` | [[tasks/milestone-08-snacktum-snacktorum-rebrand]] |

## Logs

- [[tasks/deferred]] — task-level deferred / descoped work, with disposition
  (whole-milestone deferral lives in § Deferred Milestones above)
- [[tasks/discovered]] — discovered-work log (feeds future milestone stubs)
