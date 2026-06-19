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

**Milestone M8 — Snacktum Snacktorum: Rebrand & Redesign** `active` — [[tasks/milestone-08-snacktum-snacktorum-rebrand]]
(planner-exploded 2026-06-18; **BUILD activated 2026-06-19**). A **user-facing rebrand +
UI/UX redesign**: "Top Dog" → the hot-dog **cult** app "Snacktum Snacktorum"; champion
title "Top Dog" → **"The Anointed Wiener"** (copy swap only — code identifiers unchanged);
a global app shell + nav, the auth cluster (real `/sign-in` form, forgot/reset password,
ritual sign-up), a profile redesign + display-name surfacing, an error/404 page, the
"Anoint" mustard re-theme, and a base cult visual/theme layer. **Reuses the locked
PROJECT.md stack/architecture/paradigm and all decisions #1–#28 + L2 — no re-plenary, no
new infra, no new deps expected.** 10 tasks (TASK-080…TASK-089; TASK-089 = the derived
badge "Reliquary", a purely-derived read-only addition — no schema/migration/dependency,
un-forgeable by construction).

> **🔨 BUILDING — activated 2026-06-19. TASK-087 complete (1/10); next: TASK-080.**
> TASK-087 (base cult visual / theme layer, PR #99 `dcce8c3`) landed the M8 FOUNDATION:
> a tokenized dark-temple CSS layer (`src/lib/styles/tokens.css`, imported by
> `src/app.css`) every downstream task consumes via `var(--…)` tokens (accents switch via
> `data-accent`), self-hosted SIL OFL Cinzel + Cormorant Garamond `.woff2` fonts under
> `static/fonts/` (no CDN, no npm package), and themed flair-component styling — **no
> migration, no new dependency, no new architecture-decision row** (decision table stays
> #28). 1 fix cycle (a WCAG 2.4.7 focus-ring regression on the wall textarea). Next up is
> **TASK-080 (global app shell + nav)**, then the copy + per-page redesign passes.
>
> **Designs are mostly in:** almost every page is mocked — the app shell, the auth cluster
> (Log In, Reset Password, Onboarding), The Procession, The Shrine (profile), Your Litter,
> the Tribunal, Epistles (DM inbox), Whispers (DM thread), Summon a Frank (invite), The
> Catechism (help), and The Lost Pilgrim (error/404) — **only the dog-detail page remains
> to be mocked.** **Open items still to resolve as their tasks come up:** **OQ-2** (the
> Anoint specifics — sub-decisions OQ-2a–e, including the derived "anoint → wall notice"
> OQ-2e) and the **dog-detail page name** (the last open part of OQ-5; The Shrine /
> Epistles / Whispers / the "Enter the Snacktum" sign-in heading are confirmed). Dispatch
> M8 tasks **only on explicit user instruction**, in the milestone file's sequence — do
> not auto-chain. See the milestone file's Open Questions + Dependencies & Sequencing
> sections.

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
