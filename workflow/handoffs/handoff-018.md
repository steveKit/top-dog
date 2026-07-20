# Handoff 018 — 2026-06-20

> **CLEAN SESSION END.** No PR is open — every PR this session merged (#115 through #120).
> Branch: `main`, clean. This session advanced **M8 — Snacktum Snacktorum rebrand** from
> `BUILDING (5/16)` to **`BUILDING (7/16)`**: the **foundational slug refactor** (TASK-090)
> moved the whole in-app route tree under `/snacktum-snacktorum`, **The Procession**
> (TASK-091) landed the first rebuild-from-design IN-APP page, and an **ad-hoc App Chrome
> rebuild** (PR #119 — NOT one of the 16 tasks; rollup stays 7/16) gave the persistent shell
> full-bleed chrome + a champion sub-bar. **No migration, no new dependency, no new
> architecture-decision row all session** (the [[PROJECT]] decision table stays at **#28**).

## Session Summary

This session took **M8** from `active — BUILDING (5/16)` to **`BUILDING (7/16)`** — the
in-app route prefix is now the cult slug, the feed is rebuilt as The Procession at its cult
leaf, and the persistent app shell got its full-bleed chrome rebuild. Branch: `main`. **No
PR is open** — all merges were clean direct-to-`main`. Session base: `c9c5f65` (handoff-017).

What landed (merged PRs, in order):

- **TASK-090 — the foundational slug refactor** (PR #115 `38c8844` + bookkeeping PR #116
  `7e0b473`). Only the in-app route **PREFIX** changed: `/app` → `/snacktum-snacktorum`, with
  the directory moved `src/routes/(protected)/app/` → `(protected)/snacktum-snacktorum/`. The
  **load-bearing change is the `hooks.server.ts` auth-guard prefix**
  (`startsWith('/app')` → `'/snacktum-snacktorum'`) — the protected area stays guarded in
  lockstep, so no route went unguarded. **Leaf names UNCHANGED** here (deferred to the
  per-page rebuilds); the **four gate slugs are unchanged** (`/sign-in`, `/sign-up`,
  `/forgot-password`, `/reset-password`), `/sign-in` redirect targets preserved, and the
  profile-funnel `ONBOARDING_PATH` still points at `/sign-up`. The CLAUDE.md + README.md
  `/app/*` doc references were swept to `/snacktum-snacktorum/*`. Checkpoint tag
  `checkpoint-2026-06-20-pre-slug-refactor` was created before the rename. Reviewer APPROVE,
  **0 fix cycles**; `pnpm check` 0/0, `pnpm lint` clean, `pnpm test` 830/830, `@smoke` 5/5,
  `@security` 94/94.
- **TASK-091 — The Procession** (PR #117 `dffaee5` + bookkeeping PR #118 `01fc162`), the
  first rebuild-from-design IN-APP page. The feed `+page.svelte` was **rebuilt from
  `design/pages/The Procession.dc.html`** — a skin-not-skeleton pass that **preserved the
  `+page.server.ts` load AND all 6 actions**, the only server change being a derived
  `championDogId`. The champion title copy is **"The Anointed Wiener"** (copy only). A
  mid-task escalation resolved by director decision (no fix cycle): the designed champion
  ribbon had no data source, so `listVotableDogs`' embedded `profiles(...)` join was
  **widened to carry `is_current_top_dog`** (following the `detail.ts` pattern) and the load
  derives `championDogId` = the highest-ranked crowned owner's dog. That champion read is a
  **read-only read of the non-client-writable crown column** (decision #25), kept
  **RLS-scoped** on `event.locals.supabase` (no service-client widening; public info, no
  decision #27 concern). The leaf-slug renamed **`feed` → `procession`** — the **feed is now
  at `/snacktum-snacktorum/procession`** — and **only the feed leaf moved**. README +
  CLAUDE.md current-state references swept `feed` → `procession`. Reviewer APPROVE, **0 fix
  cycles**; `pnpm check` 0/0, `pnpm lint` clean, `pnpm test` 834/834, `@smoke` 5/5,
  `@security` 94/94, `feed-detail` 3/3.
- **App Chrome rebuild** (PR #119 `7598365` + bookkeeping PR #120 `0a4fc7d`, ad-hoc — **NOT
  one of the 16 M8 tasks; rollup stays 7/16**, logged as DW-034). User-directed during a
  live visual review, this rebuilt the persistent app shell
  (`(protected)/snacktum-snacktorum/+layout.svelte`) to match `design/pages/App Chrome.dc.html`
  — the App Chrome equivalent of the per-page rebuilds (TASK-080 had built the shell
  `design-light`). See § Key Decisions for the three lasting pieces.

**Current milestone state:** M8 is `active`, **7/16 complete** — TASK-087 (theme), TASK-080
(shell), TASK-083 (recovery), TASK-082 (sign-in), TASK-092 (onboarding rite), TASK-090 (slug
refactor), TASK-091 (The Procession) — plus the ad-hoc App Chrome rebuild. Remaining 9
pending per-page rebuilds: **TASK-093** (The Shrine — next) / 094 (Anoint — the milestone's
ONE migration + likely decision #29) / 094-R (Reliquary) / 095 / 096 / 097 / 098 / 099 /
100 / 101.

## Key Decisions

No new **numbered** architecture-decision row this session — the [[PROJECT]] decision table
stays at **#28** (no migration, no new dependency all session). The lasting decisions are
slug-model and chrome-architecture choices:

1. **In-app routes re-slugged `/app` → `/snacktum-snacktorum`** (TASK-090). The
   `hooks.server.ts` `startsWith` auth-guard prefix moved in lockstep; the gate slugs
   (`/sign-in` etc.) are KEPT descriptive; **per-leaf renames land with each page's rebuild**
   (feed→procession done in TASK-091; dogs→litter, profile→shrine, messages→epistles,
   invite→summon, court→tribunal, help→catechism still pending their rebuilds). Pre-launch
   (invite-only, not deployed) → **no old→new redirects.** Recorded as a **scope decision,
   NOT a numbered decision row.**
2. **App Chrome architecture** (ad-hoc rebuild, PR #119). Three lasting pieces:
   - **Full-bleed chrome:** the nav header AND a new "The Anointed Wiener" champion sub-bar
     span the viewport edge-to-edge, with content centered at a new **`--measure-shell: 100rem`
     (1600px)** token in `tokens.css`. Implemented via `app.css`
     `.page-container:has(.shell-header) { max-width: none; padding: 0 0 var(--space-3xl) }` —
     **scoped to the app area** (gate pages untouched: they key off `:has(> .gate-center)`),
     page content still capped at `--measure-content`, no `100vw` (relies on
     `scrollbar-gutter: stable` on `html`, which also fixed a navigation layout-shift).
   - **The self-cap structural invariant:** because the app container is now full-width with
     zero horizontal padding, **each child band re-supplies its own horizontal gutter AND caps
     its own width** (`.shell-inner` / `.shell-champion-inner` → `--measure-shell`;
     `.shell-content` page content → `--measure-content`; mobile `.shell-scroll` →
     `--measure-shell`). So **any future not-yet-rebuilt `/snacktum-snacktorum` page must
     self-cap its content (or wrap in `.shell-content`) or it sprawls to the viewport edge.**
   - **New read-only `getCurrentChampion(supabase)`** in
     `src/lib/features/profiles/profiles.ts` (an RLS-scoped `profiles` SELECT for
     `is_current_top_dog = true`, `maybeSingle()`), surfaced by `+layout.server.ts` as
     `champion` (the layout load now returns `{ user, profile, champion }`). It **degrades to
     `champion: null` on an empty throne / error, AFTER the profile-funnel guard**, so a
     champion failure never breaks the `!profile → /sign-up` funnel; `is_current_top_dog` is
     non-client-writable (decision #25) and public, so no service client, no write path, no
     decision #27 anonymity concern. The brand was kept as the **wordmark image**
     (`snacktum-snacktorum-header.svg`, a user override of the mockup's holy-tube-icon+text
     lockup) — so the wordmark is now used in BOTH the auth gates AND the app shell, and
     `the-holy-tube.svg` remains orphaned (tracked DW-031). No new decision row — table stays
     **#28**.
3. **No migration, no new dependency this session.** The only planned future row remains
   TASK-094's #29 (prune retirement) when Anoint lands.

## Files Changed

This is a derived, narrative summary; the source of truth is the merged PRs (#115–#120).
Per-task Notes blocks live in [[workflow/tasks/milestone-08-snacktum-snacktorum-rebrand]].

- `src/routes/(protected)/app/` → `src/routes/(protected)/snacktum-snacktorum/` — **MOVED**
  (TASK-090): the whole in-app route tree renamed (R09x).
- `src/hooks.server.ts` (+ its test) — **MODIFIED** (TASK-090): auth-guard prefix
  `startsWith('/app')` → `'/snacktum-snacktorum'`.
- `src/routes/+page.server.ts` — **MODIFIED** (TASK-090): root redirect retargeted; later
  (TASK-091) repointed to the live `procession` leaf.
- Auth `+page.server.ts` redirect targets, per-page `/app/...` literals, doc comments
  (`detail.ts`, `votes.ts`), and unit + E2E path assertions — **MODIFIED** (TASK-090).
  Gate slugs unchanged.
- `src/routes/(protected)/snacktum-snacktorum/procession/+page.svelte` — **REBUILT**
  (TASK-091) from `design/pages/The Procession.dc.html`; leaf `feed` → `procession`.
- `src/lib/features/voting/feed.ts` (+ `feed.test.ts`, `feed-action.test.ts`) — **MODIFIED**
  (TASK-091): `listVotableDogs` select widened (`is_current_top_dog` → `championDogId`);
  `+page.server.ts` load + 6 actions preserved.
- `src/routes/(protected)/snacktum-snacktorum/+layout.svelte` — **REBUILT** (PR #119) full-bleed
  (header + champion sub-bar); centered nav links, active-link underline, viewer sigil avatar
  (crown when champion), richer mobile scroll, wordmark-image brand.
- `src/lib/styles/tokens.css` — **MODIFIED** (PR #119): `--measure-shell: 100rem` (1600px).
- `src/app.css` — **MODIFIED** (PR #119): `.page-container:has(.shell-header){max-width:none}`
  (gate pages untouched); `scrollbar-gutter:stable` on `html`.
- `src/lib/features/profiles/profiles.ts` (+ `profiles.test.ts`) — **MODIFIED** (PR #119):
  new `getCurrentChampion()`.
- `src/routes/(protected)/snacktum-snacktorum/+layout.server.ts` (+ `layout-guard.test.ts`) —
  **MODIFIED** (PR #119): load returns `{ user, profile, champion }`, degrades-after-guard.
- `tests/feed-detail.e2e.ts` — **MODIFIED** (PR #119): dog-image locator scoped to
  `.dog-image img` (the shell now renders `<img>`s preceding page content in the DOM).
- `PROJECT.md`, `CLAUDE.md`, `README.md`, `workflow/tasks/discovered.md` (DW-034 + DW-031 context),
  `workflow/tasks/milestone-08-snacktum-snacktorum-rebrand.md` — **MODIFIED** per-PR this session
  (not duplicated in this handoff).
- `CLAUDE.md` — **MODIFIED** (this handoff): Project Map "Latest handoff" pointer →
  `[[workflow/handoffs/handoff-018]]`.
- `workflow/handoffs/handoff-018.md` — **NEW** (this file).

## Blockers & Open Questions

**No blocker is local-blocking** — `main` is clean, no open PRs, hosted is healthy (the daily
keep-alive `ping` keeps the hosted DB alive). The standing items:

- **Standing hosted op (NOT blocking local), user's hand, async.** One hosted
  `supabase db push` / config push batches: the two M7 migrations
  (`20260617205453_burger_alarms.sql`, `20260618120000_burger_verdicts.sql`) + the hosted
  **recovery email template** config (set the code-emitting `{{ .Token }}` template via the
  dashboard or `supabase config push`, or production sends a recovery LINK not a CODE and
  `/reset-password` breaks). **TASK-094 (Anoint) will add one more migration** (prune
  retirement) to this same gate when it lands. No auto-pause risk; the 🍔 Hamburger Court +
  hosted password reset are non-functional on hosted until pushed.
- **DW-033 (open):** a session-less hit at the onboarding rite's **Sigil** step dead-ends with
  `fail(401)` and no in-rite recovery — found during TASK-092. Non-blocking; only the
  resumer-with-expired-session path hits it.
- **Dev stack still running.** The local Supabase stack and a backgrounded `pnpm dev --host`
  (pointed at local) were started at session resume + the visual test; the `supabase db reset`
  during the gate run **wiped the populated visual-test data + the champion session**. On
  resume, re-seed (or run `pnpm test:e2e --grep @smoke`) and re-establish a champion if a
  visual review of the champion sub-bar is needed.

Two **process notes** (recurring, both already in [[workflow/memory/MEMORY]]):

- **This repo's agents can't run the live gates.** Subagent sandboxes here deny `git`,
  `supabase`, `docker`, Playwright (`pnpm test:e2e`), and `prettier` — the **director runs
  all DB-dependent verification, the final `prettier --write`/format pass, and all
  git/commits on the main thread**; agent self-reports of those gates are not trustworthy.
- **`main` is hook-protected.** All commits — feature, bookkeeping, AND handoffs — go through
  a `chore/*`/`feat/*` branch + squash self-merge (`gh pr merge --squash --delete-branch`),
  never `git commit`/`git push` to `main` directly.

## Discovered Work

No NEW discovered-work item needs logging here — the session's one new item (DW-034, the
App Chrome rebuild) was captured in [[workflow/tasks/discovered]] by its bookkeeping PR #120 as it
landed. The carried open items:

- [ ] **DW-034** — the App Chrome rebuild (full-bleed shell + champion sub-bar) landed
      ad-hoc, not as a queued task — recorded for traceability. Logged during PR #119. _open._
- [ ] **DW-033** — session-less hit at the onboarding rite's Sigil step dead-ends with
      `fail(401)` and no in-rite recovery — found during TASK-092. _open._
- [ ] **DW-032** — roll out the canonical themed form validation to the remaining in-app
      forms (upload, wall composer, DM composer, Tribunal, Summon) as each is rebuilt —
      found during PR #109. _open._
- [ ] **DW-031** (updated) — orphaned brand/sigil SVGs: `the-holy-tube.svg` orphaned (the
      shell + gates use the seal + wordmark header), the 5 sigil SVGs effectively
      unreferenced (`Sigil.svelte` inlines the art); wire-or-prune. _open._
- [ ] **DW-030 / DW-029 / DW-028** — auth-page `form`-prop typing, shared auth validation
      module, and the `--color-text-faint`/`-fainter` AA guidance — all carried _open._

The older standing backlog (DW-002/004/005/007/012/014/015/016/017/023/025/026/027) is
unchanged; M8's per-page rebuilds may naturally absorb a few (e.g. DW-004's profile data-key
footgun when The Shrine is rebuilt next).

## Next Steps

Prioritized — see [[TASKS]] and [[workflow/tasks/milestone-08-snacktum-snacktorum-rebrand]] for full
context:

1. **TASK-093 — The Shrine (profile rebuild).** Recommended next; starts the Shrine cluster.
   **TASK-093 + TASK-094 (Anoint — the milestone's ONE migration + likely decision #29) +
   TASK-094-R (Reliquary)** all touch the Shrine page + its load, so they need a
   parallel-dispatch pre-flight and will most likely be **sequenced**. TASK-094 carries the
   prune-retirement migration that batches onto the standing hosted-push gate.
2. **Or an independent per-page rebuild** (no shared file with the Shrine cluster):
   TASK-095 (Your Litter / dogs→litter), TASK-096 (The Relic / dog detail), TASK-097
   (Epistles + Whispers / messages→epistles), TASK-098 (Summon / invite), TASK-099 (Tribunal
   / court), TASK-100 (The Catechism / help), TASK-101 (The Lost Pilgrim / 404). Each carries
   its own leaf-slug rename and **must self-cap its content** per the App Chrome invariant.
3. **[user, standing, async] The hosted push/config op** — the two M7 migrations
   (`burger_alarms` + `burger_verdicts`) + the hosted recovery email template config, to
   batch with TASK-094's prune migration when it lands. No urgency, no auto-pause risk.

## Files to Read on Resume

- [[workflow/tasks/milestone-08-snacktum-snacktorum-rebrand]] — the re-scoped M8 spec: the **§ Slug
  Map** (FINALIZED), the per-page disposition, and the pending tasks (TASK-093 next). Source
  of truth for the remaining work.
- `src/routes/(protected)/snacktum-snacktorum/+layout.svelte` (+ `+layout.server.ts`) — **the
  rebuilt App Chrome:** the full-bleed pattern, `getCurrentChampion`, the **self-cap
  invariant** — the reference for how the chrome wraps the per-page rebuilds.
- `src/routes/(protected)/snacktum-snacktorum/procession/+page.svelte` — the reference
  rebuild-from-design IN-APP page (preserve the `+page.server.ts` load + actions; rebuild only
  `+page.svelte`).
- [[PROJECT]] — Status (M0–M7 complete; **M8 `BUILDING (7/16)`** + the ad-hoc chrome), the
  Milestones table, and the standing hosted push/config gate.
- [[CLAUDE]] — the new gotchas added this session (full-bleed self-cap invariant,
  `getCurrentChampion`, the shell-image E2E locator gotcha, `--measure-shell`).

## Library Candidates

_None extractable (assessed)._ The slug refactor, the Procession rebuild, `getCurrentChampion`,
and the full-bleed cult chrome are all project/theme-specific — consistent with
handoff-016/017's assessment that the generic theme-token / self-hosted-font pattern remains
entangled with the cult vocabulary, not yet a clean extraction. Assessed and declined.

See [[workflow/handoffs/handoff-017]] for prior session context (the M8 build kickoff — auth surface +
onboarding rite).
