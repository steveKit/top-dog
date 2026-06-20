# Handoff 017 — 2026-06-19

> **CLEAN SESSION END.** No PR is open — every PR this session merged (#99 through #113).
> Branch: `main`, clean. handoff-016 ended with **Milestone M8 scoped but the BUILD not
> started** (execution-blocked on the user's "go"). THIS session is the entire **M8 build
> kickoff**: the milestone was **activated**, **re-scoped mid-session** to a
> rebuild-from-design + cult-slug-rename model (PR #111), and **5/16 tasks landed** — the
> whole auth/gate surface is now built and unified under the cult brand. **No migration, no
> new dependency, no new architecture-decision row all session** (the [[PROJECT]] decision
> table stays at **#28**).

## Session Summary

This session took **M8 — Snacktum Snacktorum rebrand** from "scoped but not started" to
**`active — BUILDING (5/16)`**, with the entire auth/gate cluster functional end-to-end
and the first rebuild-from-design page landed. Branch: `main`. **No PR is open** — all
merges were clean.

What landed (merged PRs, in order):

- **TASK-087 — base cult theme/token layer** (PR #99 `dcce8c3`). The M8 foundation: a
  tokenized dark-temple CSS layer (`src/lib/styles/tokens.css`, imported by
  `src/app.css`) consumed by every downstream M8 task via `var(--…)` tokens, self-hosted
  SIL OFL Cinzel + Cormorant Garamond `.woff2` (no CDN, **no npm package**) under
  `static/fonts/`, and a `data-accent` theme switch. 1 fix cycle; DW-028 logged (keep
  `--color-text-faint` ≥ AA on real content; `--color-text-fainter` is placeholders-only).
- **TASK-080 — global app shell + persistent nav** (PR #101 `544b7be`). A persistent
  `(protected)/app/+layout.svelte` renders the header/nav across every `/app` route
  (🌭 home → The Procession; feed / Your Litter / Epistles / The Catechism; ＋ Upload; a
  crown-gated ☩ Tribunal link reading the server-derived `is_current_top_dog` flag,
  decision #25); `/` repointed `/app` → `/app/feed`; the bare `/app` "kennel" hub retired
  (`redirect(307,'/app/feed')`). **`TopDogPrivilegesNotice` (TASK-074) intentionally
  RETIRED** — its helper + tests deleted (`pnpm test` 783 → 775); Top Dog powers now live
  in The Catechism + the crown-gated Tribunal link. 1 fix cycle.
- **TASK-083 — password recovery cluster** (PR #103 `3e236be`). `/forgot-password`
  (`resetPasswordForEmail`, neutral non-enumerating) + `/reset-password` (a **6-digit
  OTP code**, not a magic link → `verifyOtp(type:'recovery')` → `updateUser`). 1 fix cycle
  added the load-bearing piece: a code-emitting recovery email template
  (`supabase/templates/recovery.html` `{{ .Token }}` + `[auth.email.template.recovery]` /
  `otp_length = 6` in `config.toml`) — Supabase's default sends a LINK, so the template is
  required both locally AND on hosted. Director-verified by a live Mailpit round-trip.
- **TASK-082 — real `/sign-in`** (PR #105 `5445002`). The non-functional sign-in stub
  became a real themed form → `signInWithPassword` on `event.locals.supabase` → on success
  `redirect(303, '/app')` through the auth cascade. Non-enumerating posture (one generic
  error, password never echoed) matching TASK-083, so **the auth cluster now reads as one
  consistent boundary and is functional end-to-end** — a member can log in through the UI
  for the first time. New `tests/sign-in.e2e.ts` `@smoke` (live suite → 5/5).
- **Gate-page visual polish + brand-asset relocation + favicon** (PR #107 `4fcc3c7`,
  ad-hoc). Iterative visual pass on the four gate pages; relocated brand marks →
  `src/lib/assets/brand/`, 5 avatar sigils → `src/lib/assets/sigils/`, favicons →
  `static/` (wired via `<link>`s in `src/routes/+layout.svelte`); settled gate-page copy
  conventions (Password → **Seal**, Email → **Mustard Address**). DW-031 logged.
- **Themed inline form-validation CANON** (PR #109 `6c00c1c`, ad-hoc). A themed,
  accessible, inline client-side validation layer replaced the native HTML5 bubble:
  `src/lib/features/forms/` (`validationMessage.ts` pure + `createFormValidation()` rune)
  - `src/lib/motion/reducedMotion.ts` (`errorSlideFade`). Recorded as an **app-wide binding
    convention** (the [[CLAUDE]] "Forms & validation" subsection) — themed inline validation
    is the standard for EVERY form with required / empty-able fields; the native bubble is
    never used. Rollout to remaining in-app forms tracked as **DW-032**.
- **M8 RE-SCOPE — rebuild-from-design + re-slug** (PR #111 `0991846`, planner,
  user-directed). The remaining pages stop being incremental restyles and are instead
  **rebuilt from their `design/pages/*.dc.html` mockups** (a per-page presentational
  rebuild of `+page.svelte`, preserving each `+page.server.ts` load + actions) **and the
  in-app routes are re-slugged to cult names** (`app` → `snacktum-snacktorum`; per-leaf
  cult slugs). The **four auth slugs are KEPT descriptive**; the onboarding rite lives at
  `/sign-up`. Re-scoped to 4 complete + 12 pending at the time. (See § Key Decisions.)
- **TASK-092 — the Snacktum Onboarding RITE at `/sign-up`** (PR #112 `a5fd084`, the
  centerpiece and the first rebuild-from-design page). `/sign-up` rebuilt as a single
  multi-step **rite** (Summoned → Inscribe → Choose Thy Sigil → Renounce → Received) that
  **absorbs and deletes** `(protected)/app/onboarding/`. Reviewer APPROVE; `pnpm check` 0,
  `pnpm lint` clean, `pnpm test` **830**, `@smoke` 5/5, `@security` 94/94. (Full
  control-flow detail in § Key Decisions.)
- **Bookkeeping PRs** (#100 / #102 / #104 / #106 / #108 / #110 / #113) closed each task /
  ad-hoc landing with its Notes block + PROJECT/CLAUDE/discovered updates.

**Current milestone state:** M8 is `active`, **5/16 complete** — TASK-087 (theme),
TASK-080 (shell), TASK-083 (recovery), TASK-082 (sign-in), TASK-092 (onboarding rite).
The auth/gate surface is fully built and unified under the cult brand. Remaining 11
pending: **TASK-090** (foundational slug refactor — lands first) then per-page rebuilds
TASK-091 / 093 / 094 / 094-R / 095 / 096 / 097 / 098 / 099 / 100 / 101.

## Key Decisions

No new **numbered** architecture-decision row this session — the [[PROJECT]] decision
table stays at **#28** (no migration, no new dependency all session). The lasting
decisions are operating-model and control-flow choices:

- **The rebuild-from-design + re-slug pivot (PR #111) is the operating model for the rest
  of M8.** Each remaining page is rebuilt from its `design/pages/*.dc.html` mockup
  (presentational rebuild of `+page.svelte`, preserving the `+page.server.ts` load +
  actions and re-wiring all data/feature plumbing), and the in-app routes re-slug
  `app` → `snacktum-snacktorum` with per-leaf cult slugs (feed→`procession`,
  dogs→`litter`(+`litter/[id]`), profile/[handle]→`shrine/[handle]`,
  messages→`epistles`(+`epistles/[handle]`), invite→`summon`, court→`tribunal`,
  help→`catechism`). The four **auth slugs are KEPT descriptive** (`/sign-in`, `/sign-up`,
  `/forgot-password`, `/reset-password`); the onboarding rite lives at `/sign-up`. This
  **deviates from the original "URL paths UNCHANGED" plan** — in-app URLs now DO change —
  recorded as a **scope decision, NOT a numbered decision row**. Still skin-not-skeleton at
  the code level (no table/RPC/TS-symbol rename, no infra rename; decisions #1–#28 + L2
  preserved). Pre-launch (invite-only, not deployed) → **no old→new redirects.** The slug
  map is FINALIZED by the user; see
  [[tasks/milestone-08-snacktum-snacktorum-rebrand]] § Slug Map.
- **The onboarding-rite control flow (TASK-092).** Two non-obvious choices worth keeping in
  mind: (a) the profile is forged at the **Choose Thy Sigil** step and **Renounce is a
  pure-UI oath** gated only on the sworn state (no session check there); (b) `createProfile`
  **returns `{ created, handle }` instead of redirecting**, so the client advances
  Sigil → Renounce → Received **without re-running `load`** — re-running `load` would
  `throw redirect` on the now-existing profile and skip the oath/Received. The chosen sigil
  is stored as `sigil:<id>` in the existing `avatar_path` (no upload, no migration; new
  `src/lib/components/Sigil.svelte` inline-SVG + `src/lib/features/profiles/sigils.ts`). An
  authenticated-but-profile-less **resumer** picks the rite up at a handle-only Inscribe
  (handle carried forward via client `$state`). The standalone `(protected)/app/onboarding/`
  route is removed/absorbed; the profile-funnel guard (`ONBOARDING_PATH`) now points at
  `/sign-up`. Documented as a [[CLAUDE]] gotcha already.
- **Themed inline validation is now app-wide CANON** (PR #109) — the native HTML5 bubble is
  never used; every form with required / empty-able fields adopts `createFormValidation()`.
  See the [[CLAUDE]] "Forms & validation" subsection. Rollout tracked DW-032.
- **Auth/gate brand unified** (TASK-092) — the Ordo Sancti Tubi **seal** (15rem) +
  **wordmark header** (24rem, top-anchored) are shared across all four auth/gate pages via
  `.gate-mark` / `.gate-header` in `app.css`.

## Files Changed

This is a derived, narrative summary; the source of truth is the merged PRs (#99–#113).
Per-task Notes blocks live in [[tasks/milestone-08-snacktum-snacktorum-rebrand]].

- `src/lib/styles/tokens.css`, `src/app.css`, `static/fonts/*` — **NEW/MODIFIED**
  (TASK-087): the dark-temple token layer + self-hosted Cinzel/Cormorant `.woff2` + OFL
  licenses + `@font-face`.
- `src/routes/(protected)/app/+layout.svelte`, `+layout.server.ts` — **MODIFIED**
  (TASK-080): persistent shell + nav (crown-gated Tribunal link).
- `src/routes/+page.server.ts` — **MODIFIED** (TASK-080): `/` → `/app/feed`.
- `TopDogPrivilegesNotice` component + `topDogPrivilegesNotice.ts` helper + tests —
  **DELETED** (TASK-080): the TASK-074 crown nudge retired.
- `src/routes/forgot-password/`, `src/routes/reset-password/` — **NEW** (TASK-083): the
  6-digit-OTP recovery cluster.
- `supabase/templates/recovery.html`, `supabase/config.toml` — **NEW/MODIFIED**
  (TASK-083): code-emitting recovery email template + `otp_length = 6`.
- `src/routes/sign-in/+page.svelte`, `+page.server.ts` — **REBUILT** (TASK-082): real
  `signInWithPassword` form + action. `tests/sign-in.e2e.ts` — **NEW** (`@smoke`).
- `src/lib/assets/brand/*`, `src/lib/assets/sigils/*`, `static/favicon*` — **NEW/MOVED**
  (PR #107): brand-asset relocation + favicons.
- `src/lib/features/forms/validationMessage.ts`, `formValidation.svelte.ts`,
  `src/lib/motion/reducedMotion.ts` — **NEW** (PR #109): themed inline validation layer.
- `src/routes/sign-up/+page.svelte`, `+page.server.ts` — **REBUILT** (TASK-092): the
  multi-step onboarding rite. `src/lib/components/Sigil.svelte`,
  `src/lib/features/profiles/sigils.ts` — **NEW**. `(protected)/app/onboarding/` —
  **DELETED** (absorbed). `.gate-mark` / `.gate-header` added to `app.css`.
- `tasks/milestone-08-snacktum-snacktorum-rebrand.md` — **MODIFIED** (PR #111 re-scope +
  per-task Notes + § Slug Map + task renumbering). _(orchestration-state edits are the
  director's; the documenter wrote only the Notes/narrative portions.)_
- `PROJECT.md` — **MODIFIED** (this handoff): Last Updated → 2026-06-19; the Milestones
  table M8 row refreshed to `active — BUILDING (5/16)` + the re-scope; M8 progress notes
  extended with the PR #109 validation canon, the PR #111 re-scope, and TASK-092.
- `CLAUDE.md` — **MODIFIED** (this handoff): Project Map "Latest handoff" pointer →
  `[[Handoffs/handoff-017]]`. (Convention/gotcha edits — the rite control flow, the
  validation canon, WSL/sign-in/recovery dev notes, autofill theming — landed in their
  per-task bookkeeping PRs this session, not here.)
- `Handoffs/handoff-017.md` — **NEW** (this file).

## Blockers & Open Questions

**No blocker is local-blocking** — `main` is clean, no open PRs, hosted is healthy
(the daily keep-alive `ping` keeps the hosted DB alive). The standing items:

- **Standing hosted op (NOT blocking local), user's hand.** Three carried items batch onto
  one hosted `supabase db push` / config push: the two M7 migrations
  (`20260617205453_burger_alarms.sql`, `20260618120000_burger_verdicts.sql`) + the hosted
  **recovery email template** config (set the code-emitting `{{ .Token }}` template via the
  dashboard or `supabase config push`, or production sends a recovery LINK not a CODE and
  `/reset-password` breaks). **TASK-094 (Anoint) will add one more migration** (prune
  retirement) to this same gate when it lands. No auto-pause risk; the 🍔 Hamburger Court +
  hosted password reset are non-functional on hosted until pushed.
- **DW-033 (open):** a session-less hit at the rite's **Sigil** step dead-ends with
  `fail(401)` and no in-rite recovery. Recommended hardening: redirect a session-less
  `createProfile` to `/sign-in` (or restart the rite). Non-blocking — only the
  resumer-with-expired-session path hits it; a fresh sign-up always has a live session
  there.
- **DW-031 (updated):** `the-holy-tube.svg` is now orphaned in app code (the gates switched
  to the seal + wordmark header); the 5 sigil SVGs may be effectively unreferenced
  (`Sigil.svelte` inlines the art rather than importing the files). Verify and wire-or-prune
  the still-orphaned brand-logo / sigil SVGs.

Two **process notes** (recurring, from prior sessions; both already in [[memory/MEMORY]]):

- **This repo's agents can't run the live gates.** Subagent sandboxes here deny `git`,
  `supabase`, `docker`, Playwright (`pnpm test:e2e`), and `prettier` — the **director runs
  all DB-dependent verification, the final `prettier --write`/format pass, and all
  git/commits on the main thread**; agent self-reports of those gates are not trustworthy.
- **`main` is hook-protected.** All commits — feature, bookkeeping, AND handoffs — go
  through a `chore/*`/`feat/*` branch + squash self-merge (`gh pr merge --squash
--delete-branch`), never `git commit`/`git push` to `main` directly.

## Discovered Work

No NEW discovered-work item needs logging here — the session's discoveries were captured
in [[tasks/discovered]] by their per-task bookkeeping as they landed. The fresh / updated
items from this session:

- [ ] **DW-033** — session-less hit at the onboarding rite's Sigil step dead-ends with
      `fail(401)` and no in-rite recovery — found during TASK-092. _open._
- [ ] **DW-032** — roll out the canonical themed form validation to the remaining in-app
      forms (upload, wall composer, DM composer, Tribunal, Summon) as each is rebuilt —
      found during PR #109. _open._
- [ ] **DW-031** (updated) — orphaned brand/sigil SVGs: `the-holy-tube.svg` newly orphaned,
      sigil SVGs possibly unreferenced (`Sigil.svelte` inlines them); wire-or-prune — found
      during PR #107, updated PR #112. _open._
- [ ] **DW-030** — the `form` prop is untyped across the auth pages; annotate with
      `ActionData` — found during TASK-082. _open._
- [ ] **DW-029** — `MIN_PASSWORD_LENGTH` + email pattern duplicated across the auth pages;
      extract a shared `$lib/features/auth` validation module — found during TASK-083.
      _open._
- [ ] **DW-028** — keep `--color-text-faint` ≥ AA on real content; never use
      `--color-text-fainter` (placeholders-only, sub-AA) on readable copy — found during
      TASK-087. _open._

The older standing backlog (DW-002/004/005/007/012/014/015/016/017/023/025/026/027) is
unchanged; M8's per-page rebuilds may naturally absorb a few (e.g. DW-004's profile
data-key footgun when The Shrine is rebuilt, DW-012's interim reaction emoji set).

## Next Steps

Prioritized — see [[TASKS]] and [[tasks/milestone-08-snacktum-snacktorum-rebrand]] for
full context:

1. **TASK-090 — foundational slug refactor (`app` → `snacktum-snacktorum`).** Lands first;
   a **RISKY cross-cutting rename** — it must update the `hooks.server.ts` auth-guard
   **prefix** `/app` → `/snacktum-snacktorum`, the root redirect, the shell links, every
   per-page reference, and the E2E + unit `/app/...` path assertions. **Propose a
   checkpoint tag before starting** (per [[git]] Tier 3). The `/sign-in` redirect targets
   and the recovery email template are KEPT; the profile-funnel guard retargets to the
   `/sign-up` rite. The completed gate-page folders (`/sign-in`, `/sign-up`,
   `/forgot-password`, `/reset-password`) are NOT re-slugged.
2. **Per-page rebuilds from the mockups** (after TASK-090 sets the final base paths):
   TASK-091 (The Procession / feed), TASK-093 (The Shrine / profile — composes with
   TASK-094 Anoint + TASK-094-R Reliquary), TASK-094 (Anoint re-theme — **carries the
   milestone's one migration**: prune retirement + a likely decision row #29), then
   TASK-095/096/097/098/099/100/101 (The Lost Pilgrim error page).
3. **[user, standing, async] The hosted push/config op** — the two M7 migrations
   (`burger_alarms` + `burger_verdicts`) + the hosted recovery email template config, to
   batch with TASK-094's prune migration when it lands. No urgency, no auto-pause risk.
4. **[session boundary]** The local Supabase stack + the `pnpm dev` background task may need
   restarting on resume (the dev server was stopped during the merge). A `supabase db reset`
   wipes any seeded dev login (`dev@topdog.test`) — re-seed or run `pnpm test:e2e --grep
@smoke`.

## Files to Read on Resume

- [[tasks/milestone-08-snacktum-snacktorum-rebrand]] — the re-scoped M8 spec: the HARD
  SCOPE CONSTRAINT (skin not skeleton), the **§ Slug Map** (FINALIZED), the form-validation
  CANON, the page inventory + per-page disposition, and the Active Tasks (TASK-090 first,
  then the per-page rebuilds). The source of truth for the remaining work.
- `src/routes/sign-up/+page.svelte` (+ `+page.server.ts`) — **the rite**: the multi-step
  onboarding control flow (profile forged at Sigil, pure-UI Renounce oath, `createProfile`
  returns-not-redirects), the reference for how a rebuild-from-design page is wired.
- [[PROJECT]] — Status (M0–M7 complete; **M8 `active — BUILDING (5/16)`**, re-scoped), the
  Milestones table M8 row, the M8 progress notes, and the Process notes (the standing
  hosted push/config gate).
- [[CLAUDE]] — the M8 conventions added this session: the **Forms & validation** CANON, the
  **onboarding-rite control-flow** gotcha, the **autofill-theming** gotcha, the **app shell
  / retired TopDogPrivilegesNotice** notes, and the **Local dev (WSL)** + sign-in + recovery
  notes.
- [[TASKS]] — index: M8 `active`; M0–M7 in Completed Milestones.

## Library Candidates

_None extractable (assessed)._ Everything this session is **project-specific**: `Sigil` /
`sigils.ts` are domain-specific cult art; `createFormValidation()` + `validationMessage.ts`

- `errorSlideFade` are themed/cult-copy-specific to Snacktum Snacktorum; the onboarding
  rite, the slug renames, the brand assets, and the theme tokens are all bespoke to the
  rebrand. Consistent with prior handoffs' calls (the generic-CSS-token / self-hosted-font
  pattern noted as a future candidate in handoff-016 remains entangled with the cult
  vocabulary, not yet a clean extraction). Assessed and declined.

See [[Handoffs/handoff-016]] for prior session context (the M8 scope + design phase).
