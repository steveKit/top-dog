# Handoff 020 — 2026-06-23

> **CLEAN SESSION END — MILESTONE CLOSED.** No PR is open — every PR this session merged
> (#134 through #140, plus the close PR). Branch: `main`, clean. This session advanced
> **M8 — Snacktum Snacktorum rebrand** from `BUILDING (12/16)` to **`COMPLETE (16/16)` and
> CLOSED the milestone** (2026-06-23, tag `milestone-08-snacktum-snacktorum-rebrand`). **Four
> tasks merged** — **TASK-098 Summon a Frank** (PR #134), **TASK-099 The Tribunal** (PR #136),
> **TASK-100 The Catechism** (PR #138), and **TASK-101 The Lost Pilgrim** (PR #140), which
> closed the milestone. **No new dependency, no new migration, and NO new architecture-decision
> row all session** ([[PROJECT]] decision table stays at **#29**). All four were
> skin-not-skeleton — servers preserved (three byte-identical / R100 renames; one brand-new
> page with no server), only the route slugs + presentation changed.

## Session Summary

This session took **M8** from `BUILDING (12/16)` to **`COMPLETE (16/16)` — CLOSED**. Branch:
`main`. **No PR is open** — all merges were clean direct-to-`main` (via branch + squash
self-merge). Session base: handoff-019 (M8 12/16, the Shrine cluster + Litter pair + DM cluster
done). With the four tasks this session, **all in-app leaves are now renamed** (procession /
shrine / litter / epistles / summon / tribunal / catechism — no pre-rename leaves remain), and
the milestone's one brand-new page (the error boundary) landed and closed M8.

What landed (merged PRs, in order):

- **TASK-098 — Summon a Frank** (PR #134 `dc7a229`, the sixth rebuild-from-design in-app page).
  The invite `+page.svelte` rebuilt from `design/pages/Summon a Frank.dc.html` as Summon a Frank
  (main content only — header/nav chrome stays in the app shell); the DSL `<sc-if>` states
  ported to **Svelte 5 runes** bound to the REAL `?/create` form contract (idle → minting →
  minted → error), with a **copy-to-clipboard affordance** added (net-new over the original
  page, which had none). The whole `invite` folder was `git mv`'d → `summon`, so the
  `+page.server.ts` is **byte-identical / R100 rename** — the invite-mint action (decisions
  #17/#22/#23) untouched; the test was renamed `invite-action.test.ts` → `summon-action.test.ts`
  (label + comment only). No migration / dep / decision row / code-identifier rename. Reviewer
  APPROVE, **0 fix cycles** (two minor optional a11y findings deferred to the tweak session).
  `pnpm check` 0/0, `pnpm lint` clean, `pnpm test` 946/946, `@smoke` 5/5, `@security` 93/93.
  Discovered **DW-039** — the Summon page has **no inbound nav link**, and the shell's
  "＋ Summon a Frank" header button actually targets **upload** (`/snacktum-snacktorum/litter`),
  not this invite page — a label/reachability clash for the visual-tweak session.
- **TASK-099 — The Tribunal** (PR #136 `94de595`, the seventh rebuild-from-design in-app page —
  the most authorization-sensitive). The court `+page.svelte` rebuilt from
  `design/pages/The Tribunal.dc.html` as The Tribunal of the Holy Tube (main content only); the
  mock's per-case visual states mapped onto the **REAL `dog.verdict`** (`null` → ⚠ ACCUSED
  police-tape plus both ruling buttons; `confirmed_hamburger` → the reused
  `ConfirmedHamburgerStamp` plus a Hamburger Heretic treatment; `not_a_hamburger` → a False
  Witnesses treatment). The whole `court` folder was `git mv`'d → `tribunal`, so the
  **`+page.server.ts` is byte-identical / R100 rename** — every load-bearing security invariant
  moved without a diff: the **double gate** (the UI crown redirect AND the
  `render_burger_verdict` SECURITY DEFINER RPC's authoritative re-check on the non-client-writable
  `is_current_top_dog`, decision #25), the **anonymous flagged-dog aggregate**
  (service-client-after-gate with the decision #27/#33 signed-URL handling), and the `rule`
  verdict action all verbatim; **reporter anonymity intact by construction.** No migration / dep /
  decision row / code-identifier rename. Reviewer APPROVE, **0 fix cycles**. `pnpm check` 0/0,
  `pnpm lint` clean, `pnpm test` 946/946, `@smoke` 5/5, `@security` 93/93 (the burger-court
  double-gate / anonymity / RPC-only-write guards all green). Discovered **DW-040** — the
  presentational CSS class `shell-nav-court` in `+layout.svelte` was left as-is (a styling hook,
  not a route or code symbol) — a candidate to normalize to `shell-nav-tribunal` in the tweak
  session.
- **TASK-100 — The Catechism** (PR #138 `e42087a`, the eighth and FINAL rebuild-from-design
  in-app page, and the lightest — a **static** page). The help `+page.svelte` rebuilt from
  `design/pages/The Catechism.dc.html` as The Catechism — six illuminated "Article" sections in
  the cult voice (Of the Vote and the Crown / Powers of The Anointed Wiener / Of Reactions / Of
  the Anointing / Of Walls and Epistles / The Tribunal of the Holy Tube) closing on a doxology.
  The whole `help` folder was `git mv`'d → `catechism`; the page is **static** (no `load`, no
  `actions`), so there is **no `+page.server.ts`** — the move is the markup rebuild plus the slug
  change. **‼️ The headline was accuracy, not skin:** the mockup itself had drifted, describing
  the Anoint mustard as fading "over about a day"; the implementer **corrected it to ~six hours**
  to match `MUSTARD_LIFESPAN_MS = 6h` (the single source of truth, shortened from 24h by TASK-094
  / decision #29). Every other mechanic-bearing line was cross-checked against source —
  FALSE WITNESS fades over **7 days** (`LIAR_BRAND_WINDOW_MS`), HERETIC is permanent (both vs
  `reports/verdict.ts`); the vote/crown rules + the report → ALARM → verdict flow vs
  `voting/ranking.ts` + `reports/verdict.ts`; reactions' ranking-inertness restated verbatim —
  with cult display labels as copy only. The dangling "← Back to your kennel" link to the retired
  hub was dropped entirely (**DW-038 closed**). With this rename **every in-app leaf is renamed —
  no pre-rename leaves remain.** No migration / dep / decision row / code-identifier rename.
  Reviewer APPROVE, **0 fix cycles** (one minor README path-drift finding folded into
  bookkeeping). `pnpm check` 0/0, `pnpm lint` clean, `pnpm test` 946/946, `@smoke` 5/5,
  `@security` 93/93.
- **TASK-101 — The Lost Pilgrim** (PR #140 `0d6a63d`, the milestone's one brand-new page —
  **CLOSES M8**). A root error / 404 boundary at `src/routes/+error.svelte`, rebuilt from
  `design/pages/The Lost Pilgrim.dc.html`. Unlike every other M8 page this is not a re-slug or a
  markup swap — there was no error boundary before, so it is **net-new markup with no
  `+page.server.ts`, no migration, no new dependency, no new decision row**. Driven entirely by
  `page.status` + `page.error` from `$app/state`: a **404** renders the designed "Thou Hast
  Strayed" treatment, **any other status** renders "A Disturbance in the Tube" with the actual
  status numeral; the CTA home and the brand mark route via `resolve('/')`. **‼️ The security
  crux is what is NOT rendered:** the boundary shows **only friendly cult copy + the numeric
  status** — `page.error.message` is **never** put on screen, and there is no `{@html}` — making
  the L2 no-internal-detail-leak posture **structural** (a server `error(...)` message cannot
  leak through a page that has no code path reading it). The director's one fix was a lint fix,
  not a logic change (bare `href="/"` → `resolve('/')` for `svelte/no-navigation-without-resolve`).
  **The single fix cycle was a `@smoke`-caught interaction resolved by strengthening the test,
  not the page:** `feed-detail.e2e.ts` had asserted on the literal `'No such hot dog.'` — the
  message the `litter/[id]` load throws via `error(404, …)`. Now that this boundary exists, that
  404 renders this page, which by design suppresses the message, so the old assertion broke; the
  tester updated it to the stronger expectation — the designed page is shown ("Thou Hast Strayed"
  visible) **plus a positive no-leak guard** (the suppressed message has a DOM count of 0). An
  optional nested in-app `+error.svelte` was deliberately skipped as a future enhancement (the
  root boundary covers every route). Reviewer APPROVE, **1 fix cycle**. `pnpm check` 0/0,
  `pnpm lint` clean, `pnpm test` 946/946, `@smoke` 5/5, `@security` 93/93.

**🏁 Milestone close.** TASK-101 was the final M8 task. The **M8-close wiring audit passed** —
every new M8 export/component (`computeBadges`, `loadShrineStats`, `getCurrentChampion`,
`listAnointmentsForProfile`, `createFormValidation`, `errorSlideFade`, `Reliquary`, `Sigil`,
`parseSigilId`; the `+error.svelte` boundary is the sole error boundary) has a non-test consumer,
with **no code orphans** (the known orphaned brand/sigil **assets** are tracked as DW-031,
non-blocking). M8 moved to § Completed Milestones; the director cuts the
`milestone-08-snacktum-snacktorum-rebrand` tag. The whole rebrand added exactly **one migration**
(TASK-094's prune retirement, the source of the one new decision row #29) and **zero new
dependencies**.

## Key Decisions

**No new numbered architecture-decision row this session** — the [[PROJECT]] decision table stays
at **#29**. All four tasks were skin-not-skeleton with no schema/RPC/dep change. The lasting
patterns reinforced (not new):

1. **The byte-identical / R100-rename server-preservation pattern** (TASK-098, TASK-099, and
   already TASK-095/096/097). When a leaf re-slug needs no server change, `git mv` the whole
   route folder so the `+page.server.ts` moves as an R100 rename with **zero diff** — the
   load-bearing wiring (the invite-mint action; the Tribunal double gate + anonymous aggregate +
   `rule` action) is provably untouched, not merely "preserved by hand". The tightest possible
   skin-not-skeleton pass; reach for it whenever the rebuild is presentation-only and the slug
   moves with the folder.
2. **The L2 no-leak boundary is structural, not policed** (TASK-101). The root `+error.svelte`
   renders only friendly copy + the numeric `page.status`; it has **no code path that reads
   `page.error.message`** and no `{@html}`, so a server `error(...)` message physically cannot
   leak through it. The accompanying test pins both halves — the designed page renders **and** a
   positive no-leak guard (the suppressed message has a DOM count of 0). Build error boundaries
   this way: suppress by construction, then assert the suppression.
3. **Accuracy-check static copy against source, not the mock** (TASK-100). A how-it-works page is
   only as good as it is true; the mockup had drifted (Anoint "about a day" vs the real ~6h
   `MUSTARD_LIFESPAN_MS`). Cross-check every mechanic-bearing line against the source modules
   (`voting/ranking.ts`, `reports/verdict.ts`, `mustard/decay.ts`) and trust the code, not the
   mock.

## Files Changed

This is a derived, narrative summary; the source of truth is the merged PRs (#134–#140).
Per-task Notes blocks live in [[tasks/milestone-08-snacktum-snacktorum-rebrand]].

- `src/routes/(protected)/snacktum-snacktorum/summon/` — **MOVED** (TASK-098, whole `invite`
  folder `git mv` → `summon`); `summon/+page.svelte` **REBUILT** from `Summon a Frank.dc.html`
  (+ copy-to-clipboard); `+page.server.ts` byte-identical (R100); test renamed
  `summon-action.test.ts`.
- `src/routes/(protected)/snacktum-snacktorum/tribunal/` — **MOVED** (TASK-099, whole `court`
  folder `git mv` → `tribunal`); `tribunal/+page.svelte` **REBUILT** from `The Tribunal.dc.html`;
  `+page.server.ts` byte-identical (R100, double gate + anonymous aggregate + `rule` action
  preserved); action test rescoped `tribunal-action.test.ts` (labels only).
- `src/routes/(protected)/snacktum-snacktorum/catechism/` — **MOVED** (TASK-100, whole `help`
  folder `git mv` → `catechism`); `catechism/+page.svelte` **REBUILT** from
  `The Catechism.dc.html` (static — no `+page.server.ts`); Anoint copy corrected ~24h → ~6h;
  dangling kennel link dropped (DW-038 closed).
- `src/routes/+error.svelte` — **NEW** (TASK-101): the root error/404 boundary, rebuilt from
  `The Lost Pilgrim.dc.html`; renders only friendly copy + numeric status, never
  `page.error.message`; CTA via `resolve('/')`.
- `src/routes/(protected)/snacktum-snacktorum/+layout.svelte` — **MODIFIED** per-task: shell nav
  href + active-check + link updated `invite`→`summon`, `court`→`tribunal`, `help`→`catechism`
  (the `shell-nav-court` styling-hook class deliberately left as-is — DW-040).
- `tests/feed-detail.e2e.ts` — **MODIFIED** (TASK-101): the `litter/[id]` 404 assertion changed
  from `getByText('No such hot dog.')` to assert the designed "Thou Hast Strayed" page + a
  positive no-leak guard (`'No such hot dog.'` DOM count 0).
- `tests/*` — **MODIFIED** per-task: path/copy assertions swept for each leaf rename.
- `PROJECT.md`, `CLAUDE.md`, `README.md`, `tasks/discovered.md` (DW-039/040 logged; DW-038
  closed), `tasks/milestone-08-snacktum-snacktorum-rebrand.md` — **MODIFIED** per-PR this session
  (not duplicated in this handoff).
- `TASKS.md` — **MODIFIED** (this handoff): § Active Milestones collapsed to "None" (M8 closed →
  § Completed Milestones); M8 row already added to § Completed Milestones by the director.
- `PROJECT.md`, `tasks/milestone-08-snacktum-snacktorum-rebrand.md` — **MODIFIED** (this handoff):
  M8 marked COMPLETE (16/16, closed 2026-06-23, tag), TASK-101 Notes + milestone-close narrative,
  milestone-status table row → complete.
- `CLAUDE.md` — **MODIFIED** (this handoff): Project Map "Latest handoff" pointer →
  `[[Handoffs/handoff-020]]`.
- `Handoffs/handoff-020.md` — **NEW** (this file).

## Blockers & Open Questions

**No blocker is local-blocking** — `main` is clean, no open PRs, hosted is healthy (the daily
keep-alive `ping` keeps the hosted DB alive). The standing items:

- **Standing hosted bring-up gate (NOT blocking local), user's hand, async.** One hosted
  `supabase db push` / config push batches all outstanding items: the two M7 migrations
  (`20260617205453_burger_alarms.sql`, `20260618120000_burger_verdicts.sql`), the **TASK-094
  prune-retirement migration** (`20260622120000_retire_mustard_prune.sql`, decision #29 — the
  DROP of `prune_mustard_sprays()`; the keep-alive prune step is already removed in the merged
  code), **and** the **TASK-083 hosted recovery email template** config (set the code-emitting
  `{{ .Token }}` template via the dashboard or `supabase config push`, or production sends a
  recovery LINK not a CODE and `/reset-password` breaks). No auto-pause risk; the 🍔 Tribunal
  verdict flow + hosted password reset are non-functional **on hosted** until pushed.
- **DW-039 (open, tweak session):** the Summon page has no inbound nav link, and the shell's
  "＋ Summon a Frank" header button targets **upload** (`/snacktum-snacktorum/litter`), not this
  invite page — a label/reachability clash. Non-blocking; the invite-mint flow works when the
  page is reached directly.
- **DW-040 (open, tweak session):** the presentational CSS class `shell-nav-court` in
  `+layout.svelte` was left after the `court` → `tribunal` rename — a cosmetic naming-consistency
  nit (normalize to `shell-nav-tribunal`). Non-blocking; no behavior change.
- **DW-031 (open):** orphaned brand/sigil **assets** committed but unreferenced (the brand-logo
  SVGs, `the-holy-tube.svg`, and the now-inlined sigil SVGs). The M8-close wiring audit flagged
  no **code** orphans — this is assets only, non-blocking. Wire or prune in the tweak session.
- **DW-033 (open):** a session-less hit at the onboarding rite's Sigil step dead-ends with
  `fail(401)` and no in-rite recovery — found during TASK-092. Non-blocking; only the
  resumer-with-expired-session path hits it.
- **Dev stack / data wiped.** A `supabase db reset` during the last gate pass wiped any seeded
  data + champion session. Before the user's visual smoke test, **re-seed** (or run
  `pnpm test:e2e --grep @smoke`, which mints `smoke-inviter@topdog.test`) and **re-establish a
  champion** if the champion sub-bar / Tribunal crown gate is being reviewed. **If fully done,
  `supabase stop`;** leave it up if resuming soon.

Two **process notes** (recurring, both already in [[memory/MEMORY]]):

- **This repo's agents can't run the live gates.** Subagent sandboxes here deny `git`,
  `supabase`, `docker`, Playwright (`pnpm test:e2e`), and `prettier` — the **director runs all
  DB-dependent verification, the final `prettier --write`/format pass, and all git/commits on the
  main thread**; agent self-reports of those gates are not trustworthy.
- **`main` is hook-protected.** All commits — feature, bookkeeping, AND handoffs — go through a
  `chore/*`/`feat/*`/`docs/*` branch + squash self-merge (`gh pr merge --squash --delete-branch`),
  never `git commit`/`git push` to `main` directly.

## Discovered Work

Two NEW items logged this session (both captured in [[tasks/discovered]] as they landed), and one
closed. The session's items and carried-open backlog:

- [ ] **DW-040** — the `shell-nav-court` CSS class left as-is after the `court` → `tribunal`
      rename. Cosmetic naming nit. Surfaced in the TASK-099 review. _open — tweak session._
- [ ] **DW-039** — the Summon page has no inbound nav link, and the shell's "＋ Summon a Frank"
      button targets upload, not the invite page. Surfaced in the TASK-098 review. _open — tweak
      session._
- [x] **DW-038** — the dangling "← Back to your kennel" link to the retired hub. _resolved by
      TASK-100 (PR #138 dropped the link entirely)._
- [ ] **DW-031** — orphaned brand/sigil assets (brand-logo SVGs, `the-holy-tube.svg`, the
      now-inlined sigil SVGs). _open — tweak session (wire or prune)._
- [ ] **DW-037 / DW-036 / DW-035 / DW-034 / DW-033 / DW-032 / DW-030 / DW-029 / DW-028** —
      carried _open_ (out-of-v1 derived honors; stale historical-migration comments; no jsdom
      vitest project; App Chrome rebuild traceability DONE/merged; Sigil-step session-less
      dead-end; form-validation rollout; auth `form`-prop typing; shared auth validation module;
      faint-text AA guidance).

The older standing backlog (DW-002/004/005/007/012/014/015/016/017/023/025/026/027) is unchanged.
With every M8 leaf now renamed and rebuilt, the form-validation CANON rollout (DW-032) reached the
Summon / Tribunal forms this session as each was rebuilt.

## Next Steps

Prioritized — see [[TASKS]] and [[tasks/milestone-08-snacktum-snacktorum-rebrand]] for full
context:

1. **[user] The end-of-build visual smoke test + M8 visual-tweak session.** Re-seed +
   re-establish a champion first (the last `db reset` wiped data). Walk the rebuilt cult surface
   on the dev server (`pnpm dev --host`, open `http://localhost:5173` from Windows). Tweak
   candidates surfaced this milestone: **DW-039** (Summon reachability / "＋ Summon a Frank" label
   vs. upload-target clash), **DW-040** (`shell-nav-court` class normalization), **DW-031**
   (orphaned brand/sigil assets — wire or prune), and the two minor Summon copy-button a11y items
   (an `aria-live`/`role="status"` confirmation region for "Copied ✓", and focus restore on the
   legacy `execCommand` fallback).
2. **[user, standing, async] The hosted push/config op.** One `supabase db push` batches the two
   M7 migrations (`burger_alarms` + `burger_verdicts`) + the TASK-094 prune-retirement migration +
   the TASK-083 recovery-template config. No urgency, no auto-pause risk.
3. **[user] Activate M9 — Operator / Admin Dashboard.** The next milestone stub (an operator-only
   `/admin` area of read-only aggregates over existing data; the key activation decision is admin
   authorization — a server-side operator-id allowlist is recommended over a non-client-writable
   `is_admin` column). Net-new feature work, post-M8. Dispatch the **planner** to explode the stub
   when ready.

## Files to Read on Resume

- [[tasks/milestone-08-snacktum-snacktorum-rebrand]] — now the **frozen M8 archive** (the full
  per-task record, the FINALIZED § Slug Map, and every Notes block). The source of truth for what
  the rebrand delivered.
- `src/routes/(protected)/snacktum-snacktorum/+layout.svelte` (+ `+layout.server.ts`) — the App
  Chrome: the **full-bleed self-cap invariant** (every page must self-cap its content or it
  sprawls to the viewport edge), `getCurrentChampion`, and the now-complete cult nav (DW-040's
  `shell-nav-court` class still un-normalized).
- A recent rebuilt page as the reference pattern — e.g.
  `src/routes/(protected)/snacktum-snacktorum/tribunal/+page.svelte` (preserve `+page.server.ts`;
  rebuild only `+page.svelte`; adopt the form-validation CANON with the field nested inside its
  `<label>`) or `src/routes/+error.svelte` (the no-leak boundary pattern).
- [[PROJECT]] — Status (now **M8 COMPLETE, 16/16, closed 2026-06-23**), the Milestones table, the
  Architecture Decisions table (at **#29**), and the standing hosted push/config gate.
- [[CLAUDE]] — the gotchas (full-bleed self-cap invariant, `getCurrentChampion`, the shell-image
  E2E locator gotcha, `--measure-shell`, the leaf-rename gotcha — now noting all leaves renamed)
  plus the Forms-&-validation CANON.

## Library Candidates

_None extractable (assessed)._ The four leaf rebuilds this session (Summon / Tribunal / Catechism
/ Lost Pilgrim) are all project/theme-specific — the cult vocabulary, the byte-identical
server-preservation moves, and the no-leak error boundary are conventions/patterns, not standalone
components — consistent with handoff-016/017/018/019's assessment that the theme-token /
self-hosted-font / cult-flair patterns remain entangled with the project, not yet a clean
extraction. Assessed and declined.

See [[Handoffs/handoff-019]] for prior session context (the Shrine cluster + the Litter pair + the
DM cluster).
