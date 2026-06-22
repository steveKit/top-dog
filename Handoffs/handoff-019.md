# Handoff 019 — 2026-06-22

> **CLEAN SESSION END.** No PR is open — every PR this session merged (#121 through #132).
> Branch: `main`, clean. This session advanced **M8 — Snacktum Snacktorum rebrand** from
> `BUILDING (7/16)` to **`BUILDING (12/16)`** with **six tasks merged**: **TASK-093 The
> Shrine** (PR #122), **TASK-094 Anoint** (PR #124 — the milestone's ONE migration +
> **architecture decision #29**), **TASK-094-R The Reliquary** (PR #126 — derived sub-module,
> not counted in the `/16`, closes the Shrine cluster), **TASK-095 Your Litter** (PR #128),
> **TASK-096 The Relic** (PR #130), and **TASK-097 Epistles + Whispers** (PR #132). **One new
> migration + one new architecture-decision row** all session ([[PROJECT]] decision table now
> at **#29**, TASK-094's append-only `mustard_sprays`); no new dependency.

## Session Summary

This session took **M8** from `active — BUILDING (7/16)` to **`BUILDING (12/16)`** — the
**Shrine cluster, the Litter pair, and the DM cluster are all complete.** Branch: `main`.
**No PR is open** — all merges were clean direct-to-`main`. Session base: handoff-018
(M8 7/16, after the App Chrome rebuild).

What landed (merged PRs, in order):

- **TASK-093 — The Shrine** (PR #122 `851fa0e`, the second rebuild-from-design IN-APP page).
  The profile `+page.svelte` rebuilt from `design/pages/The Shrine.dc.html`; the
  `+page.server.ts` load **and all 3 actions** (`spray` / `post` / `deleteMessage`) preserved
  and re-wired. Leaf renamed **`profile` → `shrine`** (now `/snacktum-snacktorum/shrine/[handle]`,
  param preserved; only the `profile` leaf moved). Added a **derived stat ledger** — new
  read-only `src/lib/features/profiles/stats.ts` (`loadShrineStats` → `ShrineStats`,
  `EMPTY_SHRINE_STATS` degradation baseline) computing aggregates over existing tables with no
  schema/write path. Seven counts stay RLS-scoped; the eighth — "Disciples Summoned" (redeemed
  invites) — runs on the **service client** as a `head:true` count **after** `safeGetSession()`,
  because `invites` is owner-scoped-RLS (`invites_select_own`) so an RLS count returns 0
  cross-member — **generalizing the decision #27 service-client-after-gate pattern to a
  cross-member aggregate** (a head count ships no rows → no exposure widening). **2 fix cycles:**
  (1) a tester-caught P0 — the wall composer `<textarea name="word upon the shrine">` didn't
  match the `post` action's `formData.get('body')` → silent empty posts (fixed to `name="body"`);
  (2) reviewer two majors — "Disciples Summoned" RLS undercount → the service-client head count
  above, and the wall textarea's themed validation never fired because its `<label>` was a
  **sibling** not a **wrapper** (fixed by nesting the textarea inside the `<label>` — the
  gate-form pattern; the validation module was widened to validate `<textarea>` and
  `validationMessage.ts` gained the "Word upon the Shrine" themed label). Reviewer APPROVE (after
  1 REQUEST_CHANGES round). `pnpm check` 0/0, `pnpm lint` clean, `pnpm test` 861/861, `@smoke`
  5/5, `@security` 94/94. Discovered **DW-035** (no jsdom vitest project → DOM-touching
  `.svelte.ts` validation logic is unit-untested — the exact gap that let the Issue-2 bug pass
  green unit tests).
- **TASK-094 — "Anoint" mustard re-theme** (PR #124 `645373a`, **the ONLY M8 migration**). The
  Top-Dog mustard mechanic on The Shrine re-skinned as **"Anoint"**: the splat re-themed to the
  design visual and the render-time decay window shortened **24h → 6h** (`MUSTARD_LIFESPAN_MS` in
  `src/lib/features/mustard/decay.ts`, overlay-only — `mustardOpacity` still computes full → 0
  linearly from the raw `sprayed_at`, never persisted, decision #15 unchanged). A **persisting
  wall-notice** was added, **render-derived from the FULL spray history** via a new
  `listAnointmentsForProfile` (cap 200 rows) — distinct from the live ≤6h overlay window
  (`listSpraysForProfile`) — so the notice outlives the splat's fade (OQ-2 Option A). **The daily
  prune was RETIRED:** `supabase/migrations/20260622120000_retire_mustard_prune.sql` is a
  function-only DROP of `prune_mustard_sprays()` (table shape / grants / RLS / `WITH CHECK`
  untouched), and the `.github/workflows/keepalive.yml` mustard-prune step was removed **in
  lockstep** (workflow now drives only `ping` + the Top Dog `tally`) — so `mustard_sprays` is now
  **effectively append-only**. **This introduces architecture decision #29** (`mustard_sprays`
  retention — append-only), composing #12/#15/#25/#28 with no other schema/RLS/grant change. **2
  reviewer fix cycles:** (1) the persisting notice was first derived from the 6h overlay query so
  it vanished with the splat — fixed to the full-history `listAnointmentsForProfile`; (2) a stale
  24h/prune-era comment + a couple of Anoint copy lines re-voiced. Reviewer APPROVE. `pnpm check`
  0/0, `pnpm lint` clean, `pnpm test` 878/878, `@smoke` 5/5, `@security` 93/93 (new retention
  guard asserts the append-only posture). Discovered **DW-036** (the historical base migration
  `20260616163055_mustard_sprays.sql` now carries stale 24h/prune comments — comment-accuracy
  nit only; historical migrations are normally not rewritten).
- **TASK-094-R — The Reliquary** (PR #126 `870e401`, **closes the Shrine cluster**). A purely
  DERIVED, read-only honors feature filling the badge placeholder TASK-093 left: new pure module
  `src/lib/features/badges/badges.ts` (`computeBadges(BadgeInputs)`, self-contained, co-located
  unit tests — same shape as `voting/ranking.ts`, `mustard/decay.ts`, `reports/verdict.ts`) +
  `src/lib/components/Reliquary.svelte` shelf. Every badge is computed at render time from facts
  the app already keeps — **no migration / schema / RPC / dependency / write path / second
  service-client read** — so the honors are un-forgeable by construction. The Shrine load
  assembles `BadgeInputs` once from already-loaded facts (REUSING the `loadShrineStats`
  aggregates, including the service-client redeemed-invites count, + the existing
  `isHeretic`/liar-brand reads) and adds exactly **one new RLS-client `inquisitor` head-count**
  (`burger_verdicts` where `decided_by` = the member). **Decision #27 reporter anonymity preserved
  BY CONSTRUCTION** — no input keys on the reporter side of a report. Composes #12/#13/#15/#27,
  **no new decision row**. Reviewer APPROVE, **0 fix cycles**. `pnpm check` 0/0, `pnpm lint`
  clean, `pnpm test` 938/938, `@smoke` 5/5, `@security` 93/93. **Derived sub-module — not counted
  in the `/16`** (M8 stayed 9/16). Discovered **DW-037** (two honors out of v1 — total-votes-ever
  and reign-streak — both need new persisted tracking the app does not keep; consolidates the
  earlier DW-026/DW-027 planning notes).
- **TASK-095 — Your Litter** (PR #128 `4cab7df`, the third rebuild-from-design in-app page). The
  own-dogs gallery + upload `+page.svelte` rebuilt from `design/pages/Your Litter.dc.html`;
  `+page.server.ts` preserved (its `load` + `upload`/`delete` actions). The own-gallery query stays
  **entirely on the RLS-scoped client — no service client**: this is the member's OWN litter, so
  decision #27's service-client-after-gate signing isn't needed here (the deliberate inverse of the
  cross-member feed/Relic loads). The leaf renamed **`dogs` → `litter`** via a single atomic
  `git mv` of the **whole `dogs` folder**, so the `[id]` detail subfolder rode along **rename-only**
  — leaving The Relic for TASK-096. Themed-validation CANON on the `photo` field (file input nested
  in its `<label>`; new "Relic Image" themed-label special-case). Reviewer APPROVE, **0 fix cycles**
  (two minor doc-staleness notes folded into bookkeeping). `pnpm check` 0/0, `pnpm lint` clean,
  `pnpm test` 940/940, `@smoke` 5/5, `@security` 93/93.
- **TASK-096 — The Relic** (PR #130 `d07315f`, the fourth rebuild-from-design in-app page and the
  cleanest of the milestone — a **markup-only** rebuild). The dog-detail `+page.svelte` rebuilt in
  place at `litter/[id]` from `design/pages/The Relic.dc.html` (the leaf was already at `litter/[id]`
  from TASK-095's whole-folder move, so no slug move this task). **The `+page.server.ts` is
  byte-identical** — not merely "preserved" but literally untouched: the load-bearing **decision #27
  service-client signed-URL pattern** (RLS-scoped client for queries; **only** the private-bucket
  `image_path` signing minted with `getServiceClient()` **after** `safeGetSession()`, signing only
  rows the member's own RLS query already returned) and **DW-022's adjudicated-state gating** preserved
  verbatim. Reactions stay read-only (decision #12). One additive-copy note folded in (an owner sees a
  passive "Thy relic stands accused" notice on their own alarmed dog — display-only). Reviewer
  APPROVE, **0 fix cycles**. `pnpm check` 0/0, `pnpm lint` clean, `pnpm test` 940/940, `@smoke` 5/5
  (incl. the dog-detail render test), `@security` 93/93.
- **TASK-097 — Epistles + Whispers** (PR #132 `8764287`, the fifth rebuild-from-design page and the
  DM cluster's single task — both DM pages rebuilt at once). The inbox `+page.svelte` rebuilt from
  `Epistles.dc.html` as Epistles and the thread `+page.svelte` from `Whispers.dc.html` as Whispers;
  **both `+page.server.ts` files preserved** — the inbox a **pure rename**, the thread's ONLY change
  the self-thread redirect literal `/messages` → `/epistles` (the path moved). All load-bearing
  wiring verbatim: the **conversation-scoped privacy SELECT**, the **`read_at`-only mark-read write
  boundary** (decision #24), the **bounded reads** (DW-018/DW-025's `.limit(50)`), and the
  **sender-pinned send** (`sender_id = auth.uid()`). The whole `messages` folder `git mv`'d →
  `epistles` (+ `epistles/[handle]`), so the leaf renamed **`messages` → `epistles`**; only the
  `messages` leaf moved (`invite`/`court`/`help` remain pre-rename). Themed-validation CANON on the
  compose box (textarea label-nested; a NEW prefix-matched "Whisper unto …" themed message with
  over-match guards). Reviewer APPROVE, **0 fix cycles**. `pnpm check` 0/0, `pnpm lint` clean,
  `pnpm test` 946/946, `@smoke` 5/5, `@security` 93/93 (DM guards green). Discovered **DW-038** (a
  pre-existing dangling link — The Catechism's "← Back to your kennel" points at the retired
  `/snacktum-snacktorum` hub; will be fixed naturally by TASK-100).

**Current milestone state:** M8 is `active`, **12/16 complete** — TASK-087 (theme), TASK-080
(shell), TASK-083 (recovery), TASK-082 (sign-in), TASK-092 (onboarding rite), TASK-090 (slug
refactor), TASK-091 (The Procession), TASK-093 (The Shrine), TASK-094 (Anoint), TASK-095 (Your
Litter), TASK-096 (The Relic), TASK-097 (Epistles + Whispers) — plus the derived TASK-094-R
(Reliquary, not counted in the `/16`) and the ad-hoc App Chrome rebuild (PR #119). **The Shrine
cluster (093 / 094 / 094-R), the Litter pair (095 / 096), and the DM cluster (097) are all
complete.** Remaining 4 pending leaf-page rebuilds: **TASK-098** (Summon / invite) / **099**
(Tribunal / court) / **100** (Catechism / help) / **101** (The Lost Pilgrim / `+error.svelte`).

## Key Decisions

One new **numbered** architecture-decision row this session — the [[PROJECT]] decision table is
now at **#29**. The lasting decisions and patterns:

1. **Architecture decision #29 — `mustard_sprays` retention (append-only)** (TASK-094). The daily
   `prune_mustard_sprays()` job is RETIRED (function-only DROP migration; the keep-alive prune step
   dropped in lockstep). With no client DELETE policy AND no prune, `mustard_sprays` is now
   effectively **append-only** — which is what lets the persisting Anoint wall-notice keep its
   source rows (OQ-2 Option A). The Anoint overlay still decays at RENDER over **6h**
   (`MUSTARD_LIFESPAN_MS`, shortened from 24h); the persisting notice render-derives from the FULL
   history (`listAnointmentsForProfile`, cap 200), distinct from the 6h overlay window
   (`listSpraysForProfile`). Composes #12/#15/#25/#28 — table grants/RLS/`WITH CHECK` unchanged.
   Append-only growth accepted at invite-only scale; revisit a bounded retention if volume warrants.
2. **The service-client-after-gate HEAD-COUNT pattern for cross-member counts over owner-scoped-RLS
   tables** (TASK-093, reused by TASK-094-R). An RLS-scoped count over an owner-scoped table (e.g.
   `invites` with `invites_select_own`) returns **0** on any cross-member view. The fix generalizes
   decision #27: run the count on the **service client** as a `head:true` count **AFTER** the
   `safeGetSession()` gate — a head count ships **no rows**, so there is no exposure widening and no
   new decision row. Reach for this whenever a derived stat needs to count rows a member can't SELECT
   under RLS. (Not a substitute for decision #27's signed-URL rule for actual content.)
3. **The form-validation CANON label-nesting requirement** (TASK-093 fix-cycle, reused TASK-095/097).
   `fieldLabel()` resolves the visible label via `closest('label')` and falls back to the field
   `name` only when no wrapping label exists. A **sibling** `<label>` therefore silently breaks the
   themed message (it falls back to `name`). The canon now requires the field be **nested inside its
   `<label>`** (the gate-form pattern). The validation module was widened to validate `<textarea>`
   (was input-only; backward compatible); new themed labels are added as special-cases in
   `validationMessage.ts` (e.g. "Word upon the Shrine", "Relic Image", the prefix-matched "Whisper
   unto …") rather than hand-written at the call site.
4. **The derived-honors pattern** (TASK-094-R). A purely DERIVED feature computes every value at
   render time from facts the app already keeps — no schema, no write path, no second aggregation
   pass (REUSE already-loaded values). The honors are un-forgeable by construction (nothing on the
   shelf is client-settable), and reporter anonymity (#27) is preserved BY CONSTRUCTION when no input
   keys on the reporter side. Follow the self-contained-pure-module convention (no SvelteKit/Supabase
   imports, co-located unit tests).

These four are reflected in the [[CLAUDE]] gotchas / Forms-&-validation convention and the
[[PROJECT]] decision table (#29).

## Files Changed

This is a derived, narrative summary; the source of truth is the merged PRs (#121–#132).
Per-task Notes blocks live in [[tasks/milestone-08-snacktum-snacktorum-rebrand]].

- `src/routes/(protected)/snacktum-snacktorum/shrine/[handle]/+page.svelte` — **REBUILT** (TASK-093)
  from `The Shrine.dc.html`; leaf `profile` → `shrine`; `+page.server.ts` (load + 3 actions)
  preserved.
- `src/lib/features/profiles/stats.ts` (+ test) — **NEW** (TASK-093): `loadShrineStats` derived
  stat ledger (the service-client-after-gate head-count for "Disciples Summoned").
- `src/lib/features/forms/formValidation.svelte.ts` + `validationMessage.ts` (+ tests) — **MODIFIED**
  (TASK-093/095/097): widened to validate `<textarea>`; new "Word upon the Shrine" / "Relic Image" /
  prefix-matched "Whisper unto …" themed labels.
- `src/lib/features/mustard/decay.ts` (+ test) — **MODIFIED** (TASK-094): `MUSTARD_LIFESPAN_MS`
  24h → 6h; `mustardOpacity` overlay-only.
- `src/lib/features/mustard/*` (`listAnointmentsForProfile`) + the Shrine load/markup — **MODIFIED**
  (TASK-094): persisting wall-notice render-derived from full history.
- `supabase/migrations/20260622120000_retire_mustard_prune.sql` — **NEW** (TASK-094): function-only
  DROP of `prune_mustard_sprays()` (decision #29).
- `.github/workflows/keepalive.yml` — **MODIFIED** (TASK-094): mustard-prune step removed in
  lockstep (now `ping` + `tally` only).
- `src/lib/features/badges/badges.ts` (+ test) — **NEW** (TASK-094-R): pure `computeBadges`.
- `src/lib/components/Reliquary.svelte` — **NEW** (TASK-094-R): the honors shelf on the Shrine.
- `src/routes/(protected)/snacktum-snacktorum/litter/` — **MOVED** (TASK-095, whole `dogs` folder
  `git mv` → `litter`, carrying `[id]`); `litter/+page.svelte` **REBUILT** from `Your Litter.dc.html`.
- `src/routes/(protected)/snacktum-snacktorum/litter/[id]/+page.svelte` — **REBUILT** (TASK-096) from
  `The Relic.dc.html`; its `+page.server.ts` left **byte-identical** (decision-#27 signing preserved).
- `src/routes/(protected)/snacktum-snacktorum/epistles/` — **MOVED** (TASK-097, whole `messages`
  folder `git mv` → `epistles`, carrying `[handle]`); both `+page.svelte` **REBUILT** from
  `Epistles.dc.html` + `Whispers.dc.html`; both `+page.server.ts` preserved (thread: only the
  self-thread redirect literal `/messages` → `/epistles`).
- `tests/*` — **MODIFIED** per-task: path/copy assertions swept for each leaf rename; the
  mustard-retention `@security` guard rewritten for the append-only posture.
- `PROJECT.md`, `CLAUDE.md`, `README.md`, `tasks/discovered.md` (DW-035/036/037/038),
  `tasks/milestone-08-snacktum-snacktorum-rebrand.md` — **MODIFIED** per-PR this session (not
  duplicated in this handoff).
- `CLAUDE.md` — **MODIFIED** (this handoff): Project Map "Latest handoff" pointer →
  `[[Handoffs/handoff-019]]`.
- `Handoffs/handoff-019.md` — **NEW** (this file).

## Blockers & Open Questions

**No blocker is local-blocking** — `main` is clean, no open PRs, hosted is healthy (the daily
keep-alive `ping` keeps the hosted DB alive). The standing items:

- **Standing hosted bring-up gate (NOT blocking local), user's hand, async.** One hosted
  `supabase db push` / config push batches all three outstanding items: the two M7 migrations
  (`20260617205453_burger_alarms.sql`, `20260618120000_burger_verdicts.sql`), **the TASK-094
  prune-retirement migration** (`20260622120000_retire_mustard_prune.sql`, decision #29 — the DROP
  of `prune_mustard_sprays()`; the keep-alive prune step is already removed in the merged code, so
  no hosted workflow edit is pending), **and** the TASK-083 hosted **recovery email template** config
  (set the code-emitting `{{ .Token }}` template via the dashboard or `supabase config push`, or
  production sends a recovery LINK not a CODE and `/reset-password` breaks). No auto-pause risk; the
  🍔 Hamburger Court + hosted password reset are non-functional on hosted until pushed.
- **DW-038 (open):** a pre-existing dangling link — The Catechism's "← Back to your kennel" points at
  the retired `/snacktum-snacktorum` hub (307-redirects to `/procession`). Non-blocking; will be
  fixed naturally when **TASK-100** rebuilds The Catechism (which also updates the stale "~24h" → "~6h"
  mustard copy, OQ-2d / decision #29).
- **DW-033 (open):** a session-less hit at the onboarding rite's Sigil step dead-ends with `fail(401)`
  and no in-rite recovery — found during TASK-092. Non-blocking; only the resumer-with-expired-session
  path hits it.
- **Dev stack still running.** The local Supabase stack and a backgrounded `pnpm dev` (pointed at
  local) were up at session resume; a **`supabase db reset` during the last gate pass wiped any seeded
  data + champion session**. On resume, re-seed (or run `pnpm test:e2e --grep @smoke`) and re-establish
  a champion if a visual review of the champion sub-bar is needed. **If fully done, `supabase stop`;**
  leave it up if resuming soon.

Two **process notes** (recurring, both already in [[memory/MEMORY]]):

- **This repo's agents can't run the live gates.** Subagent sandboxes here deny `git`, `supabase`,
  `docker`, Playwright (`pnpm test:e2e`), and `prettier` — the **director runs all DB-dependent
  verification, the final `prettier --write`/format pass, and all git/commits on the main thread**;
  agent self-reports of those gates are not trustworthy.
- **`main` is hook-protected.** All commits — feature, bookkeeping, AND handoffs — go through a
  `chore/*`/`feat/*` branch + squash self-merge (`gh pr merge --squash --delete-branch`), never
  `git commit`/`git push` to `main` directly.

## Discovered Work

Four NEW items were logged this session (all captured in [[tasks/discovered]] as they landed). The
session's items and carried-open backlog:

- [ ] **DW-038** — pre-existing dangling link: The Catechism's "← Back to your kennel" points at the
      retired `/snacktum-snacktorum` hub. Surfaced in the TASK-097 review. _open — fixed by TASK-100._
- [ ] **DW-037** — two derived honors (total-votes-ever, reign-streak) are out of v1 — both need NEW
      persisted tracking the app does not keep. Logged during TASK-094-R; consolidates DW-026/DW-027.
      _open (proposed — future milestone)._
- [ ] **DW-036** — the historical base migration `20260616163055_mustard_sprays.sql` carries stale
      24h/prune comments post-decision #29. Comment-accuracy nit; historical migrations normally not
      rewritten. Logged during TASK-094. _open (proposed)._
- [ ] **DW-035** — no jsdom/client vitest project, so DOM-touching `.svelte.ts` validation logic has
      no unit coverage (the gap that let the TASK-093 Issue-2 bug pass green). Logged during TASK-093.
      _open (proposed)._
- [ ] **DW-034 / DW-033 / DW-032 / DW-031 / DW-030 / DW-029 / DW-028** — carried _open_ (App Chrome
      rebuild traceability done/merged; Sigil-step session-less dead-end; form-validation rollout to
      remaining forms; orphaned brand/sigil assets; auth `form`-prop typing; shared auth validation
      module; faint-text AA guidance).

The older standing backlog (DW-002/004/005/007/012/014/015/016/017/023/025/026/027) is unchanged; the
remaining M8 leaf rebuilds may naturally absorb a few (e.g. DW-032 form-validation rollout reaches
Summon's and the Tribunal's forms; DW-038 closes with The Catechism rebuild).

## Next Steps

Prioritized — see [[TASKS]] and [[tasks/milestone-08-snacktum-snacktorum-rebrand]] for full context:

1. **TASK-098 — Summon a Frank** (invite rebuild, leaf `invite` → `summon`). Recommended next of the
   four remaining leaf-page rebuilds. Preserves the invite-mint `+page.server.ts`; verify the shell's
   ＋Summon nav target after the rename.
2. **TASK-099 — The Tribunal** (court → tribunal) — the most authorization-sensitive page: preserve
   the double gate (UI crown gate + the `render_burger_verdict` RPC's DB gate on the non-client-writable
   `is_current_top_dog`, decision #25) and the anonymous flagged-dog aggregate (service-client after the
   gate, decision #27) exactly.
3. **TASK-100 — The Catechism** (help → catechism) — static but **accuracy-critical**; re-verify every
   mechanic against source. **Also fixes DW-038** (the kennel link) **and the stale mustard "~24h" → "~6h"
   copy** (OQ-2d / decision #29).
4. **TASK-101 — The Lost Pilgrim** (NEW root `+error.svelte`) — a near-direct port; never render raw
   stack traces (L2).
5. Then the user's **end-of-build visual smoke test** on the dev server (re-seed + re-establish a
   champion first, since the last gate `db reset` wiped the data).
6. **[user, standing, async] The hosted push/config op** — batch the two M7 migrations
   (`burger_alarms` + `burger_verdicts`) + the TASK-094 prune-retirement migration + the TASK-083
   recovery-template config in one push. No urgency, no auto-pause risk.

## Files to Read on Resume

- [[tasks/milestone-08-snacktum-snacktorum-rebrand]] — the re-scoped M8 spec: the **§ Slug Map**
  (FINALIZED), the per-page disposition, and the remaining tasks (**TASK-098 next**). Source of truth.
- `src/routes/(protected)/snacktum-snacktorum/+layout.svelte` (+ `+layout.server.ts`) — the App Chrome:
  the full-bleed pattern + the **self-cap invariant** (every not-yet-rebuilt page must self-cap its
  content or it sprawls to the viewport edge) + `getCurrentChampion`.
- `src/routes/(protected)/snacktum-snacktorum/epistles/+page.svelte` (or `shrine`/`litter`) — a recent
  rebuilt page as the reference pattern (preserve `+page.server.ts`; rebuild only `+page.svelte`; adopt
  the form-validation CANON with the field nested inside its `<label>`).
- [[PROJECT]] — Status (M0–M7 complete; **M8 `BUILDING (12/16)`**), the Milestones table, the
  Architecture Decisions table (now **#29**), and the standing hosted push/config gate.
- [[CLAUDE]] — the gotchas from prior sessions (full-bleed self-cap invariant, `getCurrentChampion`,
  the shell-image E2E locator gotcha, `--measure-shell`) plus the Forms-&-validation CANON.

## Library Candidates

_None extractable (assessed)._ The Shrine stat ledger, the Anoint re-theme, the derived badge
Reliquary, and the per-page rebuilds are all project/theme-specific — consistent with
handoff-016/017/018's assessment that the generic theme-token / self-hosted-font pattern remains
entangled with the cult vocabulary, not yet a clean extraction. The service-client-after-gate
head-count and the form-validation label-nesting are conventions, not standalone components.
Assessed and declined.

See [[Handoffs/handoff-018]] for prior session context (the slug refactor + The Procession + the
App Chrome rebuild).
