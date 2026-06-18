# Handoff 015 — 2026-06-18

> **CLEAN SESSION END.** No PR is open — every PR this session merged. Milestone
> **M7 — Safety & Polish is CLOSED and tagged** (`milestone-07-safety-polish`,
> close commit `80f861a`). With M7 done, **all pre-specified plenary milestones
> M0–M7 are complete** — there is **no active milestone**. The stale-task audit is
> clean (no `[in_progress]` tasks); the M7 wiring audit came back **clean**. The one
> open action in the whole project is **two outstanding hosted `supabase db push`es**
> (`burger_alarms` + `burger_verdicts`, user's hand) — **no keep-alive / auto-pause
> risk**. Next: a NEW milestone (planner-exploded on user activation) drawing from the
> [[tasks/discovered]] backlog.

## Session Summary

Closed **Milestone M7 — Safety & Polish in its entirety, and tagged it**
([[tasks/milestone-07-safety-polish]]) — completing the last of the eight
pre-specified plenary milestones, so **M0–M7 are now all complete**. The session
resumed with M7 partially done (TASK-070 + TASK-071 already merged, but TASK-071's
close bookkeeping had been left incomplete by the prior session) and finished the
milestone end to end. Branch: `main`. **No PR is open.** All reviewer verdicts this
session were **APPROVE, 0 fix cycles**.

What landed (merged PRs, in order):

- **PR #79 `docs`** — **TASK-071 close bookkeeping**. The prior session had merged the
  TASK-071 feature PR (#78) but never closed the task; this pass completed the per-task
  Notes, checkbox/status finalization, and index rollup.
- **PR #80 `feat`** — **TASK-073**, the **moderation half of the 🍔 Hamburger Court**.
  The **current Top Dog** adjudicates a flagged dog via a new `render_burger_verdict`
  SECURITY DEFINER RPC (Top-Dog-gated, the sole write path) and renders a per-dog
  verdict with a consequence on each branch: a `not_a_hamburger` verdict brands every
  **reporter** with a render-time **HAMBURGER LIAR** profile banner (decays ~7 days), a
  `confirmed_hamburger` verdict brands the **uploader** with a persistent **HERETIC**
  banner (derived, no separate table) and converts the dog's decaying HAMBURGER ALARM
  into a persistent CONFIRMED HAMBURGER stamp. Two new stores (`burger_verdicts`,
  `hamburger_liars`) take the **votes-style no-client-write lockdown** (SELECT-only for
  `authenticated`, decision #28 grants); the `/app/court` adjudication surface is
  double-gated (UI crown gate + DB-authoritative RPC gate). Reviewer **APPROVE**;
  `@security` → **94**. Migration `20260618120000_burger_verdicts.sql`.
- **PR #81 `docs`** — **TASK-073 close bookkeeping**.
- **PR #82 `feat`** — **TASK-074**, the **crown-gated Top Dog privileges in-app notice**.
  When a member holds the crown, the app home shows a dismissible "👑 Top Dog
  privileges" notice listing their powers (adjudicate 🍔 reports → `/app/court`; spray
  mustard). Gated at the parent on the live server-derived `is_current_top_dog` flag
  (decision #25); per-browser `localStorage` dismissal — **no schema, no migration, no
  `profiles` column**. Reviewer **APPROVE**.
- **PR #83 `docs`** — **TASK-074 close bookkeeping**.
- **PR #84 `feat`** — **TASK-075**, the static `/app/help` "How Top Dog works" page.
  An everyone-facing route (`(protected)/app/help/+page.svelte`) — **no `load`, no
  per-user data** — explaining the mechanics with the vote system emphasized. Every
  mechanic-bearing line was **cross-checked against source** (`voting/ranking.ts`,
  `mustard/decay.ts`, `reports/verdict.ts`); the reviewer independently re-verified each
  and found all accurate. Reviewer **APPROVE**.
- **PR #85 `docs`** — **TASK-075 close bookkeeping**.
- **PR #86 `feat`** — **TASK-072**, the **M7 polish pass** (empty / loading / responsive
  — new neutral `src/app.css` — no redesign), folding in four discovered-work fixes:
  **DW-018** (bounded DM reads), **DW-021** (friendly oversized-avatar `fail(400)`),
  **DW-022** (render-only report-control gate on adjudicated dogs), and **DW-024**
  (`expect.poll` stabilization of the flaky `@smoke` reaction-count assertion). No
  migration, no new deps, no new architecture-decision row. Reviewer **APPROVE** (two
  minor non-blocking notes — a `listThread` head-limit returns the oldest 50 not the
  latest → logged **DW-025**; an unstyled `.adjudicated-note` hook, harmless).
- **PR #87 `docs`** — **TASK-072 + Milestone M7 close bookkeeping**.

**Milestone M7 closed + tagged** `milestone-07-safety-polish` (close commit `80f861a`):
all six tasks (TASK-070/071/073/074/075/072) complete; M7 moved to Completed Milestones
in the [[TASKS]] index; [[tasks/milestone-07-safety-polish]] is now its frozen archive.
**With M7 done, all pre-specified plenary milestones M0–M7 are complete and there is no
active milestone.**

**Final gate state** (director-run on a fresh `supabase db reset`): `pnpm check` **0**,
`pnpm test` **783**, `pnpm lint` clean, `@smoke` **4/4** (incl. the stabilized reaction
test), `@security` **94/94**. The **M7 wiring audit was clean**.

## Key Decisions

- **No new numbered architecture-decision row this milestone.** Every M7 task composed
  existing decisions (#10/#11/#12/#13/#15/#24/#25/#28) — the canonical decision table in
  [[PROJECT]] is unchanged at **#28** (the most recent, from M5's Data API grant
  remediation). TASK-070 composed #10/#11/#24; TASK-071 composed #12/#15/#27(#6);
  TASK-073 composed #12/#13/#15/#25; TASK-074/075/072 added no schema, no new invariant.
- **TASK-073 introduced a reusable composition pattern: the server-imposed cosmetic
  consequence.** A consequence table (`hamburger_liars`, plus the `burger_verdicts`
  store) is **decision #12** cosmetic / ranking-inert (no denormalized counter) BUT is
  written **RPC-only (decision #13)** with the RPC's authorization gating on the
  **non-client-writable crown column (decision #25)**, and its brand decaying/persisting
  at **render time (decision #15)**. This is the deliberate **inverse** of the
  established [[CLAUDE]] "cosmetic tables are plain owner-scoped RLS" gotcha: a LIAR/
  HERETIC brand is a server-imposed privileged consequence, not a member toggle, so it
  must NOT be self-service-writable. Recorded as an M7 composition note in [[PROJECT]]
  and as a new [[CLAUDE]] gotcha this session — **not** a new decision row (it composes
  existing decisions).
- **The report → ALARM → verdict → LIAR/HERETIC loop is now closed** end to end across
  TASK-071 (report half) and TASK-073 (moderation half), with reporter anonymity
  preserved throughout (decision #27 — owner-scoped SELECT + service-client aggregate
  after the auth gate; ids never reach the client).

## Files Changed

This session's full feature diff (excluding bookkeeping markdown):

- `src/lib/features/reports/verdict.ts` (+ `verdict.test.ts`) — **NEW** (TASK-073): pure
  render-time verdict resolution + LIAR (~7-day) decay / HERETIC (derived, persistent)
  banner derivation.
- `supabase/migrations/20260618120000_burger_verdicts.sql` — **NEW** (TASK-073):
  `burger_verdicts` + `hamburger_liars` tables (no-client-write lockdown, decision #28
  grants) + the `render_burger_verdict` SECURITY DEFINER RPC (Top-Dog-gated). **Not yet
  pushed to hosted** — see Blockers.
- `src/routes/(protected)/app/court/+page.svelte` + `+page.server.ts` — **NEW**
  (TASK-073): the double-gated adjudication surface (UI crown gate + RPC gate; flagged
  list is an anonymous service-client aggregate after the auth gate).
- Verdict/LIAR/HERETIC banner render wired into the feed / dog-detail / owner-gallery /
  profile surfaces (TASK-073).
- `src/routes/(protected)/app/+page.svelte` (app home) + Top-Dog-privileges notice
  component — MODIFIED/NEW (TASK-074): crown-gated dismissible notice, `localStorage`
  dismissal helper (+ unit cases). No schema.
- `src/routes/(protected)/app/help/+page.svelte` — **NEW** (TASK-075): static
  "How Top Dog works" page (no `load`, no per-user data), linked from the app-home nav.
- `src/app.css` — **NEW** (TASK-072): neutral empty/loading/responsive polish baseline.
- `src/lib/features/dms/dms.ts` — MODIFIED (TASK-072): bounded DM reads (DW-018 `.limit`).
- `src/routes/(protected)/app/onboarding/+page.server.ts` — MODIFIED (TASK-072): friendly
  oversized-avatar `fail(400)` (DW-021).
- `tests/feed-detail.e2e.ts` — MODIFIED (TASK-072): `expect.poll` retried assertions on
  the reaction increment/decrement (DW-024 flaky-`@smoke` stabilization).
- Report-control render gate on adjudicated dogs — MODIFIED (TASK-072, DW-022).
- `CLAUDE.md` — MODIFIED (across the session): a new **server-imposed cosmetic
  consequence** gotcha (the TASK-073 composition); and (**this handoff**) the Project Map
  latest-handoff pointer → `[[Handoffs/handoff-015]]`.
- `PROJECT.md`, `TASKS.md`, `tasks/milestone-07-safety-polish.md`,
  `tasks/discovered.md` — MODIFIED across the session (M7 progress + close notes,
  milestones table, M7 row; per-task Notes; task moves + index rollup + tag; DW-024
  resolved, DW-025 logged). _Orchestration-state edits owned by the director; narrative
  Notes / log rows by the documenter. All finalized this session — untouched by this
  handoff._
- `Handoffs/handoff-015.md` — **NEW** (this file).

## Blockers & Open Questions

**One open action across the whole project** — and it is in the user's hand, not blocking
anything local:

- **Two hosted pushes outstanding.** `20260617205453_burger_alarms.sql` (TASK-071) and
  `20260618120000_burger_verdicts.sql` (TASK-073) must be `supabase db push`ed to hosted
  — **push them together**. **No keep-alive / auto-pause risk:** no scheduled job
  (`ping` / `tally` / `prune`) touches these tables, so the daily workflow stays green
  regardless. The consequence of not pushing is narrow but real: the **🍔 report →
  verdict (Hamburger Court) flow does not work on hosted** until the migrations land.
  Everything else is local-green and merged. (TASK-070's `upload_limits` migration was
  already pushed to hosted on 2026-06-17; TASK-074/075/072 added no migrations.)

No other blockers. `main` is clean and in sync with origin, no open PRs, no in-progress
tasks, hosted is healthy.

Two **process notes** worth carrying forward (neither blocking, both recurring):

- **Documenter does not run prettier in-sandbox.** As in the last several sessions, the
  documenter's sandbox often **denies** `prettier`, so bookkeeping markdown must be
  formatted **by construction** and the director runs the final `prettier --write` pass
  on the main thread before landing. (See [[memory/MEMORY]].)
- **Main-commit / push hook boundary.** The pre-tool-safety hook blocks the director from
  committing/pushing directly to `main` and from moving/deleting tags, so every
  bookkeeping commit and the milestone tag push needs the **user's hand** (the known
  `chore/*`-branch constraint in [[memory/MEMORY]]).

## Discovered Work

**Four items resolved this session by TASK-072** (DW-018/021/022/024) and one **new
open** item (DW-025) — all in [[tasks/discovered]]:

- **DW-018 — resolved (TASK-072, PR #86).** `listConversations` / `listThread`
  (`src/lib/features/dms/dms.ts`) now apply a default `.limit(50)`, reaching parity with
  `listWallMessages` — no more unbounded DM reads.
- **DW-021 — resolved (TASK-072, PR #86).** The onboarding avatar path
  (`src/routes/(protected)/app/onboarding/+page.server.ts`) now returns an early friendly
  `fail(400)` on `photo.size > MAX_UPLOAD_BYTES`, mirroring the hot-dog action instead of
  surfacing the generic upload-failed message.
- **DW-022 — resolved (TASK-072, PR #86).** Render-only gate: the own-report control is
  hidden / shows a "Court has ruled" note once a dog carries a verdict, so the toggle no
  longer persists on a verdict-suppressed dog. Security-sensitive loads untouched.
- **DW-024 — resolved (TASK-072, PR #86).** The flaky `@smoke` reaction-count assertion in
  `tests/feed-detail.e2e.ts` was stabilized with `expect.poll` retried assertions on
  both the increment and the decrement, so the count is read after the optimistic/server
  update settles rather than in a one-shot assertion.
- [ ] **DW-025 — open (TASK-072).** `listThread` (`src/lib/features/dms/dms.ts`) bounds
      reads with `.limit(50)` but orders **ascending**, so it returns the **OLDEST** 50,
      not the latest — while the comment says "latest". Low priority: the DW-018
      bounded-read goal (no unbounded DM reads) is already met; this is a
      correctness/wording nit on **which** 50 are returned, inert at invite-only scale.

**Open backlog still standing** (per [[tasks/discovered]] — candidates for a future
cleanup/hardening milestone): **DW-002** (generic RLS/DB integration-test harness),
**DW-004** (shared profile layout/page data-key footgun), **DW-005** (accepted v1
residual — `byte_size` understatement; substantially mitigated by TASK-070, kept
tracked), **DW-007** (`isValidHandle` test-only export tidy), **DW-012** (interim
reaction emoji set → swap to the M6 emoji library), **DW-014** (`@security` fixture-id
collision on a dirty DB), **DW-015** (`isUuid` unit coverage), **DW-016** (extract shared
service-role E2E helpers), **DW-017** (`spray` action missing-coordinate `0,0` default),
**DW-020** (render-DOM E2E for the emoji filter), **DW-023** (`toEpochMs`/`tryEpochMs`
duplication tidy), **DW-025** (`listThread` oldest-vs-latest, new this session).

## Next Steps

Prioritized — see [[TASKS]] for full queue context:

1. **[user] Run the two hosted `supabase db push`es** (`burger_alarms` +
   `burger_verdicts`, together), then confirm a keep-alive run stays green. This is the
   only open action in the project; once done, the 🍔 Hamburger Court flow works on
   hosted.
2. **[planning] No active milestone — all M0–M7 done.** Future work opens a **NEW
   milestone**, planner-exploded on user activation, drawing from the
   [[tasks/discovered]] backlog. A **"DM / thread + cleanup hardening"** milestone is a
   natural candidate, bundling the open DW tidies (DW-018/DW-025 DM bounds, DW-016 E2E
   helper extraction, DW-014 fixture-id robustness, DW-020 render-DOM E2E, DW-002 generic
   RLS harness, plus the small DW-004/007/012/015/017/023 nits).
3. **[session boundary] The local Supabase stack is up** — stop it with `supabase stop`
   if done for the day.

Nothing is urgent or blocking. Hosted is healthy (keep-alive green, no auto-pause risk);
no open PRs; no in-progress tasks.

## Files to Read on Resume

- [[PROJECT]] — Status (M0–M7 all complete), the M7 progress + close notes, the M7
  composition note (the server-imposed cosmetic consequence), and the Milestones table
  (M7 row); the Process notes recording the two outstanding hosted pushes.
- [[TASKS]] — index: **no active milestone**, M7 in Completed Milestones; the open ops
  callout for the two hosted pushes.
- [[tasks/milestone-07-safety-polish]] — the frozen M7 archive (per-task detail for
  TASK-070/071/073/074/075/072).
- [[tasks/discovered]] — the standing open backlog (the source set for any post-M7
  milestone) and DW-025, the new item this session.
- `src/lib/features/reports/` (`verdict.ts`, `alarm.ts`) — the pure render-time verdict /
  alarm / LIAR / HERETIC seam (the whole Hamburger Court render layer).
- `src/routes/(protected)/app/court/` — the double-gated adjudication surface.
- [[CLAUDE]] — the new **server-imposed cosmetic consequence** gotcha (TASK-073) and the
  recurring format-ownership / `chore/*`-branch bookkeeping constraints.

## Library Candidates

_None extractable._ The session's new code is **hot-dog-domain-specific** by design: the
report / verdict / LIAR / HERETIC banner logic (`reports/verdict.ts`, the
`render_burger_verdict` RPC, the `/app/court` surface) encodes the Hamburger Court
mechanic and its decision-#12/#13/#15/#25 composition — not reusable outside Top Dog. The
only general-purpose primitives it embeds are the **seeded-PRNG / time-decay helpers**
(`toEpochMs` / `tryEpochMs` and the seeded banner-angle math), which are **trivial inline
utilities** (a handful of lines each, copy-paste-cheaper-than-a-dependency) and already
flagged for an in-project tidy if a third consumer appears (DW-023) — not worth
extracting to the [[component-library]]. Consistent with the prior handoffs' calls on the
emoji and mustard seams. Assessed and declined.

See [[Handoffs/handoff-014]] for prior session context.
