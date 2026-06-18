# Milestone M7: Safety & Polish

> **Status:** `active`
> Index: [[TASKS]] · Architecture: [[PROJECT]] · Conventions: [[CLAUDE]]
> **Goal:** upload limits, report button, polish.

## Active Tasks

### TASK-075: In-app help / "How Top Dog works" page [`pending`] [`P3`] [`M`]

**Owner:** unassigned
**Dependencies:** none hard (references mechanics from M2–M7); best built after TASK-071
**Scope note (2026-06-17, user-themed):** an everyone-facing **static** in-app how-it-works
page explaining what members can do, with emphasis on the **vote system**. Distinct from
TASK-074 (the crown-holder-only privileges nudge). Static content only — no dynamic
per-user status.

**Acceptance Criteria:**

- [ ] A static in-app route (e.g. `/app/help`) linked from the app nav.
- [ ] **Vote system explained** (emphasis): one vote per member, **movable** anytime,
      **cannot vote for your own** dog; most votes wins the crown; sticky tie-break; **days
      as Top Dog** tally.
- [ ] **What you can do** sections: voting + the Top Dog crown + Top-Dog powers (spray
      mustard, adjudicate 🍔 hamburger reports), reactions, mustard, walls & DMs, and the 🍔
      Hamburger Court (report → HAMBURGER ALARM → Top-Dog verdict → HAMBURGER LIAR /
      HERETIC).
- [ ] Static content only — no migration, no new deps, no dynamic per-user status. Svelte 5
      runes; XSS-safe.
- [ ] All gates green: `pnpm test`, `pnpm check`, `pnpm lint`, `@smoke`.

> No migration → no hosted-push gate.

### TASK-072: Polish pass [`pending`] [`P3`] [`M`]

**Owner:** unassigned
**Dependencies:** all prior milestones
**Acceptance Criteria:**

- [ ] Responsive layout, empty states, loading states
- [ ] `pnpm lint`, `pnpm check`, `pnpm test`, `@smoke` all green

## Completed Tasks (this milestone)

### TASK-074: Top Dog privileges in-app notice [`complete`] [`P3`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-073 (advertises adjudication), M4 mustard, M2 crown engine
**Merged:** PR #82 (`20adc9a`, squash) · Reviewer: APPROVE · Fix cycles: 0 (2 trivial
notes — a bookkeeping test-count miscount, since corrected to 8; an exported
`DISMISSED_KEY` consumed by the test + internally, kept by design)
**Scope note (2026-06-17, user-themed):** when a member holds the crown, tell them what
they can do — an **in-app notice** (chosen over a system DM to avoid inventing a system
sender; the DM author-pin privacy model stays intact).

**Acceptance Criteria:**

- [x] In-app "👑 Top Dog privileges" notice shown to the crown-holder, gated on the live
      `is_current_top_dog` crown state (decision #25), listing their powers: adjudicate
      🍔 hamburger reports (link to `/app/court`) + spray mustard (guidance to a member
      profile).
- [x] Live-crown gated (server-derived each load via `+layout.server.ts` → appears on
      gaining the crown, gone on losing it). Dismissible via client-side `localStorage`
      (SSR-guarded; **no fake DM, no schema, no migration**).
- [x] Non-Top-Dog members never see it (gate at the parent page; the component holds no
      crown logic).
- [x] All gates green: `pnpm test` 778, `pnpm check` 0, `pnpm lint` clean, `@smoke` 4/4.

> No migration → no hosted-push gate.

**Notes:**

- **A small crown-holder nudge — when you hold the crown, tell you what you can
  do.** Shown on the app home (`(protected)/app/+page.svelte`) inside the
  existing `{#if data.profile?.is_current_top_dog}` server-derived crown gate, the
  notice lists the Top Dog's two powers: adjudicate 🍔 hamburger reports (link to
  `/app/court`) and spray mustard (guidance to a member profile). Chosen over a
  system DM (per the scope note) so no system sender had to be invented — the DM
  author-pin privacy model stays intact.
- **Crown gate at the parent, presentation in the component.** The live
  `is_current_top_dog` gate lives at the page (`+page.svelte`), not inside the
  component: `TopDogPrivilegesNotice.svelte` holds **no crown logic** at all and
  is purely presentational + a client-only dismiss toggle. Because the gate is
  the same server-derived crown flag re-derived each load (decision #25, never
  cached), the notice appears on gaining the crown and disappears on losing it,
  and a non-Top-Dog member can never reach the render path. This mirrors the
  sibling 🍔 Hamburger Court nav link added in TASK-073 (same gate, same parent).
- **No-schema `localStorage` dismissal — and why.** The AC mandated a minimal,
  schema-free notice (**no fake DM, no `profiles` column, no migration**), so
  dismissal is persisted **per-browser in `localStorage`**, not server-side. The
  pure helpers (`topDogPrivilegesNotice.ts`: `DISMISSED_KEY`, `isNoticeDismissed`,
  `persistNoticeDismissed`) take the `Storage` instance explicitly and are
  SSR-safe — `null` on the server (the component passes `browser ? localStorage :
null` from a mount `$effect`), and they swallow storage read/write errors
  (private mode / quota / disabled) so a dismiss click never throws and a thrown
  read never blanks render. Consequence: **no migration → no hosted-push gate**
  (the still-open TASK-071/073 two-migration hosted-push gate is unchanged —
  TASK-074 added nothing to push). The exported `DISMISSED_KEY` is consumed both
  internally and by the unit test; kept by design (a reviewer note, no change).
- **XSS-safe, Svelte 5 runes.** All copy is fixed strings, links use `resolve`,
  no `{@html}`, no user-supplied content; dismiss state via `$state` + a mount
  `$effect`.
- **No new architecture-decision row.** This is pure UI composition of the
  existing live-crown gate (decision #25) — a presentational surface over a
  server-maintained flag, no schema, no new invariant — so nothing to record in
  the Architecture Decisions table (following the TASK-070/071/073 composition
  precedents).
- **Reviewer outcome:** APPROVE, **0 fix cycles**. Two trivial non-blocking notes,
  no code change: a bookkeeping test-count miscount (said "9", actually **8** new
  dismissal-helper cases — 5 `isNoticeDismissed` + 3 `persistNoticeDismissed`,
  consistent with the suite moving `770 → 778`); and the exported `DISMISSED_KEY`
  (consumed by the test + internally, kept by design). Gates (director-run):
  `pnpm test` 778 (8 new cases), `pnpm check` 0, `pnpm lint` clean, `@smoke` 4/4
  on a clean run. No migration, no new deps, no schema → no hosted-push gate.
- **Verification flake (logged DW-024).** On the clean-run verification, the
  `@smoke` spec `tests/feed-detail.e2e.ts:329` ("react increments and un-react
  decrements the reaction count") **flaked once then passed on re-run** — a
  pre-existing intermittent timing/race in the feed reaction-count UI assertion,
  **unrelated to TASK-074** (which doesn't touch the feed). Logged as DW-024, a
  TASK-072 / E2E-stabilization candidate.

### TASK-073: Top-Dog verdict + HAMBURGER LIAR / HERETIC banners [`complete`] [`P2`] [`L`]

**Owner:** unassigned
**Dependencies:** TASK-071, TASK-013, TASK-011, M2 crown engine (`recompute_top_dog`)
**Merged:** PR #80 (`cdd17ff`, squash) · Reviewer: APPROVE · Fix cycles: 0 (2 minor
non-blocking notes — a lingering own-report toggle after a verdict → TASK-072 polish
candidate; a 5-line time-helper duplication → optional tidy)
**Scope note (2026-06-17, user-themed):** the moderation half of the Hamburger Court.
The **current Top Dog adjudicates** flagged dogs and renders a per-dog verdict, with a
consequence on each branch: a **"not a hamburger"** verdict brands every reporter of that
dog with a render-time **HAMBURGER LIAR** banner on their profile (decays ~7 days); a
**"confirmed hamburger"** verdict brands the **uploader** with a **HAMBURGER HERETIC**
banner on their profile (persistent). Reuses the Top-Dog-gated privilege model (decisions
#25/#15) and the consuming-writes-via-RPC convention (decision #13).

**Acceptance Criteria:**

- [x] **Verdict RPC (Top-Dog-gated, sole write path):** `render_burger_verdict(target_dog,
the_verdict)` SECURITY DEFINER RPC, one transaction; gated via `EXISTS` on the
      non-client-writable `is_current_top_dog` (decision #25), `search_path=''`, fully
      schema-qualified, `revoke execute … from public, anon, authenticated` then grant to
      `authenticated`; actor derived from `auth.uid()` inside the RPC.
- [x] **Verdict store:** `burger_verdicts` table (`UNIQUE(hot_dog_id)`), server-maintained,
      **no client write policy** (votes-style lockdown), SELECT-only for `authenticated`,
      decision #28 grants — written only by the RPC.
- [x] **HAMBURGER LIAR consequence:** `hamburger_liars` rows minted transactionally for
      every reporter on a `not_a_hamburger` verdict (idempotent `ON CONFLICT`) — cosmetic /
      many-allowed, no counter, ranking-inert.
- [x] **HAMBURGER LIAR banner:** render-time profile police-tape banner, ~7-day decay
      (`summarizeLiarBrand`), seeded angle (reused `bannerAngle`).
- [x] **HAMBURGER HERETIC consequence + banner:** persistent render-time profile banner,
      **derived** from a `confirmed_hamburger` verdict (no separate consequence table).
- [x] **Adjudication surface:** Top-Dog-only `/app/court` route — crown-gated load
      (non-Top-Dog redirected) plus the DB-authoritative RPC gate; the `rule` action passes
      only `(dogId, verdict)` (adjudicator id never client-supplied).
- [x] **Confirmed branch resolution:** documented — a verdict resolves the render-time
      alarm: `not_a_hamburger` suppresses it (reporters branded LIARs); `confirmed_hamburger`
      converts it to a persistent CONFIRMED HAMBURGER stamp. `burger_alarms` rows preserved
      (audit trail; render layer decides).
- [x] **Tests:** unit `verdict.test.ts` (decay/persist + verdict→state) + `@security`
      `tests/burger-court.e2e.ts` (non-Top-Dog rejected; verdict not forgeable via direct
      INSERT/UPDATE/DELETE; LIAR/HERETIC ranking-inert; a clear mints LIARs, a confirm makes
      the owner a HERETIC and clears stale LIARs).
- [x] All gates green: `pnpm test` 770, `pnpm check` 0, `pnpm lint` clean, `@smoke` 4,
      `@security` 94.

> **Post-merge ops gate — OUTSTANDING:** the migration `20260618120000_burger_verdicts.sql`
> must be `supabase db push`ed to hosted before the report→verdict flow works on hosted
> (batch with the still-pending TASK-071 `burger_alarms` push). No keep-alive/auto-pause
> risk (no scheduled job touches these tables).

**Notes:**

- **The moderation half of the 🍔 Hamburger Court.** TASK-071 shipped the report
  half (a member flags another member's dog → render-time HAMBURGER ALARM); this
  task adds the verdict. The **current Top Dog** adjudicates a flagged dog and
  renders a per-dog verdict, with a consequence on each branch: a
  `not_a_hamburger` verdict brands every **reporter** of that dog with a
  render-time **HAMBURGER LIAR** profile banner (decays ~7 days); a
  `confirmed_hamburger` verdict brands the **uploader** with a persistent
  **HAMBURGER HERETIC** profile banner. The full report → ALARM → verdict →
  LIAR/HERETIC loop is now closed.
- **The verdict RPC is the sole write path, Top-Dog-gated.**
  `render_burger_verdict(target_dog, the_verdict)` (migration
  `20260618120000_burger_verdicts.sql`) is a SECURITY DEFINER RPC that does
  everything in one transaction: upserts the per-dog verdict (UNIQUE
  `hot_dog_id` → a re-rule re-points the existing row), and on `not_a_hamburger`
  mints a LIAR row for every current reporter (idempotent `ON CONFLICT`), or on
  `confirmed_hamburger` clears any stale LIAR rows (a re-rule from "not a
  hamburger" must not leave vindicated reporters branded). The adjudicator is
  derived from `(select auth.uid())` **inside** the RPC — never client-supplied —
  and the gate is an `EXISTS` on the non-client-writable `is_current_top_dog`
  crown column (decision #25), so a member cannot self-grant the crown to forge a
  verdict. Standard private-RPC lockdown: `search_path=''`, fully
  schema-qualified, `revoke execute … from public, anon, authenticated` then
  grant to `authenticated` only. SQLSTATE error contract — `28000`
  (unauthenticated), `42501` (not the Top Dog), `22023` (bad verdict value),
  `P0002` (no such dog) — mapped to typed sentinels in `verdictStore.ts`, keyed on
  the SQLSTATE, never message text.
- **Two non-client-writable tables (votes-style lockdown), NOT plain-RLS cosmetic
  tables.** `burger_verdicts` (`UNIQUE(hot_dog_id)`, verdict CHECK, `decided_by`,
  `decided_at`) and `hamburger_liars` (`UNIQUE(reporter_id, hot_dog_id)`) are both
  **SELECT-only for `authenticated`, with NO client INSERT/UPDATE/DELETE policy** —
  default-deny covers all writes, exactly like `votes` / `top_dog_days`. This is
  the deliberate **inverse** of the self-service cosmetic tables
  (`hotdog_reactions` / `mustard_sprays` / `wall_messages`, which write through
  plain owner-scoped RLS): those are member toggles, but a LIAR brand is a
  **server-imposed privileged consequence**, so the write must route through the
  RPC and the tables take the no-client-write lockdown. Both still carry **no
  denormalized counter** and never touch `vote_count` / `peak_votes` / the crown,
  so they are decision #12 ranking-inert; decision #28 base grants apply
  (`authenticated` SELECT; `service_role` full DML; `anon` nothing).
- **The HERETIC brand is derived (table-less), the LIAR brand is stored.** There
  is no `hamburger_heretics` table — `isHamburgerHeretic` (pure, in `verdict.ts`)
  derives the persistent HERETIC state from whether ANY of an owner's dogs carries
  a `confirmed_hamburger` verdict (`getDogVerdictsForOwner` joins
  `burger_verdicts → hot_dogs` on `owner_id`). The LIAR brand, by contrast, needs
  a per-(reporter, dog) row in `hamburger_liars` because it decays per-brand from
  its own `created_at`.
- **Render-time decay-or-persist seam (decision #15).** `verdict.ts` is a pure
  dependency-free module (no SvelteKit/Supabase imports, fully unit-testable):
  `summarizeLiarBrand` computes the ~7-day linear LIAR fade from the raw
  `created_at` timestamps (clock-skew clamped, unparseable rows skipped
  defensively — one bad row can't blank or fake a brand); `isHamburgerHeretic` is
  persistent (no clock); and `dogAlarmState(verdict)` maps a verdict to the dog's
  alarm display state. The DB stores only the raw verdict + raw timestamps; the
  decayed/derived display state is computed entirely at render.
- **Confirmed-branch resolution — a verdict resolves the alarm.**
  `dogAlarmState` switches the feed/detail/dogs/profile render surfaces:
  `not_a_hamburger` → `cleared` (the TASK-071 HAMBURGER ALARM is suppressed and
  the reporters are branded LIARs); `confirmed_hamburger` → `confirmed` (the
  decaying alarm is converted to a persistent CONFIRMED HAMBURGER stamp,
  `ConfirmedHamburgerStamp.svelte`, driven by the verdict store, not the decaying
  report timestamps); no verdict → `alarm` (falls through to the decaying
  `summarizeBurgerAlarm`). The `burger_alarms` rows are **preserved** on a verdict
  (audit trail; the render layer decides) rather than deleted.
- **Surfaces.** `ProfilePoliceBanner.svelte` (the LIAR/HERETIC profile strip) and
  `ConfirmedHamburgerStamp.svelte` (the dog-image stamp) render through Svelte
  auto-escaped text (no `{@html}` → XSS-safe). The Top-Dog-only `/app/court`
  adjudication route is **double-gated**: the load reads the viewer's own
  (non-client-writable) crown and redirects a non-Top-Dog to `/app/feed`, AND the
  RPC re-checks the crown at the DB, so the gate holds even if the UI is bypassed.
  The `rule` action passes only `(dogId, verdict)` — the adjudicator id is never
  client-supplied. The flagged-dog list (`listFlaggedDogs`) is an **anonymous**
  aggregate read on the service client AFTER the gate (reporter ids never leave
  the server, preserving the TASK-071 anonymity), and dog images come from the
  private `hotdogs` bucket signed server-side (the TASK-033 cross-owner signed-URL
  pattern, decision #27).
- **Architecture-decision call — a composition note, NOT a new numbered row.**
  Recorded in [[PROJECT]] (M7 progress note + a Process note), following the
  TASK-070/071 composition-note precedents. The genuinely novel _combination_: a
  **server-imposed cosmetic consequence** table is decision #12 ranking-inert (no
  counter) BUT — unlike the self-service cosmetic tables, which write through
  plain owner-scoped RLS — it is written **only by an RPC**, so it takes the
  votes-style **no-client-write lockdown** (decision #13), with the RPC's
  authorization reading the **non-client-writable crown column** (decision #25).
  This is the deliberate _inverse_ of the existing "cosmetic tables are plain-RLS,
  NOT an RPC" gotcha: a cosmetic table legitimately IS RPC-only here because the
  write is a _privileged consequence_, not a self-service toggle. The reviewer
  independently agreed with this framing. Reusable for any future "the Top Dog
  brands you X" surface. **A one-paragraph [[CLAUDE]] gotcha was added** (extending
  the "Cosmetic / many-allowed tables" gotcha with the server-imposed-consequence
  exception) so a future agent doesn't mis-apply the plain-RLS shape to this case.
- **Two minor reviewer notes (non-blocking) logged as Discovered Work.** (1) A
  reporter's own "reported ✓" toggle still shows on a dog whose alarm has been
  verdict-suppressed — cosmetic, consistent with the store-raw / resolve-at-render
  model — **DW-022**, a TASK-072 polish candidate. (2) `toEpochMs` / `tryEpochMs`
  (~5 lines) are duplicated between `verdict.ts` and `alarm.ts` — an optional tidy
  matching the deliberate self-contained-pure-module convention — **DW-023**.
- **Outstanding hosted-push gate.** The migration
  `20260618120000_burger_verdicts.sql` has **NOT** been `supabase db push`ed to
  hosted — batch it with the still-pending TASK-071
  `20260617205453_burger_alarms.sql` (both in one push). No keep-alive /
  auto-pause risk (no scheduled job touches these tables; the daily `ping` still
  reads `profiles`); the report → verdict flow is simply non-functional on hosted
  until pushed. See [[PROJECT]] Process notes.
- **Reviewer outcome:** APPROVE, **0 fix cycles**, two minor non-blocking notes
  (above, logged as DW-022 / DW-023). Gates (director-run on a fresh
  `supabase db reset`): `pnpm test` 770, `pnpm check` 0, `pnpm lint` clean,
  `@smoke` 4, `@security` 94 (incl. the new `tests/burger-court.e2e.ts`:
  non-Top-Dog rejected; verdict not forgeable via direct INSERT/UPDATE/DELETE;
  LIAR/HERETIC ranking-inert; a clear mints LIARs, a confirm makes the owner a
  HERETIC and clears stale LIARs).

### TASK-071: 🍔 report-hamburger + HAMBURGER ALARM banners [`complete`] [`P2`] [`L`]

**Owner:** unassigned
**Dependencies:** TASK-013, TASK-011
**Merged:** PR #78 (`0089eb2`, squash) · Reviewer: APPROVE · Fix cycles: 0 (one minor
review finding — missing report/unreport route-action tests — addressed pre-merge)
**Scope note (2026-06-17, user-themed):** the report half of the 🍔 Hamburger Court — a
member flags another member's hot dog as a hamburger, tripping two render-time police-tape
banners ("HAMBURGER ALARM" 🍔 + "TOP DOG IS THE ADJUDICATOR") at seeded-random angles
across the offending image on the feed, dog detail, and owner gallery. Composes decision
#12 (cosmetic / many-allowed, no counter → structurally ranking-inert) and decision #15
(render-time 24h decay). Reporter is anonymous.
**Acceptance Criteria:**

- [x] `burger_alarms` table (migration `20260617205453_burger_alarms.sql`): `reporter_id` →
      profiles, `hot_dog_id` → hot_dogs, `UNIQUE(reporter_id, hot_dog_id)`, no counter;
      decision #28 grants.
- [x] Anonymity via owner-scoped RLS (a reporter reads only their own rows) + a server-side
      service-client aggregate after the auth gate — reporter ids never reach the client
      (pinned by unit tests + the `@security` anonymity spec).
- [x] No self-report: INSERT `WITH CHECK` pins reporter = `auth.uid()` AND blocks reporting
      your own dog.
- [x] Pure `summarizeBurgerAlarm` (24h decay + intensity) and `bannerAngle` (seeded ±8°,
      stable per dog), dependency-free.
- [x] `reportBurger`/`unreportBurger` idempotent, reporter from `auth.uid()`; 🍔
      report/retract control on feed + detail (hidden on own dogs).
- [x] Two seeded-angle police-tape banners on feed, detail, and owner gallery (the profile
      route renders no dog images, so no banner there).
- [x] Marked-for-review state shipped (an alarmed dog is implicitly pending review; the
      verdict + resolution is TASK-073).
- [x] Ranking-inert (structural — no counter, no write path to `vote_count`/`peak_votes`/
      crown).
- [x] Tests: unit (pure modules + anonymity pin + report/unreport route actions) +
      `@security` live-DB (forge/own-dog rejected, anonymity, ranking-inert,
      toggle/immutability/anon-read).
- [x] All gates green: `pnpm test` 710, `pnpm check` 0, `pnpm lint` clean, `@smoke` 4,
      `@security` 81.

> **Post-merge ops gate — OUTSTANDING:** the migration `20260617205453_burger_alarms.sql`
> must be `supabase db push`ed to hosted before the next keep-alive run.

**Notes:**

- **The report half of the 🍔 Hamburger Court.** A member taps a 🍔 control on
  ANOTHER member's hot dog to flag it as a hamburger; enough fresh reports trip a
  render-time HAMBURGER ALARM — two diagonal police-tape strips ("🍔 HAMBURGER
  ALARM" + "TOP DOG IS THE ADJUDICATOR") slapped across the offending image on the
  feed, dog detail, and owner gallery. This is the report + alarm-display half only;
  the Top-Dog verdict + consequence is TASK-073.
- **Anonymity via owner-scoped RLS + a server-side aggregate — the one twist vs.
  `hotdog_reactions`.** `hotdog_reactions` (decision #12) reads SELECT-all, so any
  member can see who reacted. `burger_alarms` deliberately narrows that: the SELECT
  policy is **owner-scoped to the reporter** (`(select auth.uid()) = reporter_id`),
  so a member can read only their OWN report rows and can NEVER read who else
  reported a dog. The viewer's report/retract toggle state therefore comes from an
  RLS-scoped read (`getMyReportedDogIds`, anonymity-safe by construction — it can
  only ever return the viewer's own rows). The public per-dog aggregate (how many
  fresh reports → alarm intensity) is read **server-side with the service client**
  (`getBurgerAlarmCounts`), constructed AFTER the `safeGetSession()` gate, selecting
  **only `hot_dog_id, created_at` — deliberately never `reporter_id`** — so a
  reporter's identity never enters the server's working set, let alone the page
  payload. This is the decision #27 / decision #6 service-client-after-auth-gate
  pattern (the same shape TASK-033 used to mint cross-member signed URLs) reused for
  an anonymous count read rather than for signing.
- **No new architecture-decision row — recorded as a composition note in
  [[PROJECT]].** The spec flagged a _likely_ new decision row ("anonymous cosmetic
  surface: owner-scoped RLS + server-computed public aggregate so actor identity
  never reaches the client"). On inspection it introduces no new invariant: it is
  **decision #12** (cosmetic / many-allowed, no denormalized counter →
  structurally ranking-inert) with the SELECT narrowed from select-all to
  owner-scoped, **composed with decision #27/#6** (privileged service-client read
  after the auth gate) for the public aggregate, and **decision #15** for the
  render-time alarm decay. Following the TASK-070 and M3-reactions precedent
  (compositions recorded as a progress note, not a new row), it lives as an M7
  composition note in PROJECT.md rather than a new Architecture Decisions row.
- **Structural ranking-inert guarantee.** Like `hotdog_reactions`, `burger_alarms`
  has **no denormalized counter** — no `vote_count` / `peak_votes` / crown column,
  no trigger, nothing that touches ranking. The alarm count is computed at RENDER
  time by the pure `summarizeBurgerAlarm`. So decision #12's "no ranking effect"
  holds **structurally** — there is no write path that could touch ranking state,
  not by code discipline. Corollary: decision #24/#25's column-grant lockdown does
  **not** apply (id/created_at being client-insertable is inert — no server-maintained
  column to forge); the table follows the decision #28 grant model
  (`authenticated` SELECT + column-scoped INSERT `(reporter_id, hot_dog_id)` + DELETE;
  `service_role` full DML; `anon` nothing).
- **No self-report, no forged reporter.** The INSERT `WITH CHECK` has two conjuncts:
  it pins `reporter_id = (select auth.uid())` (a client cannot report as another
  member) AND a `NOT EXISTS` blocks reporting a dog you own. A `42501` RLS denial maps
  to the friendly `CANNOT_REPORT_OWN` message, never a raw error leak.
- **Render-time alarm + seeded-angle banners.** `summarizeBurgerAlarm` (pure,
  dependency-free, in `src/lib/features/reports/alarm.ts`) auto-quiets the alarm 24h
  after the last report (`BURGER_ALARM_WINDOW_MS`), counts in-window reporters, and
  derives `none/low/medium/high` intensity — defensive (skips unparseable rows, never
  throws). Each police-tape strip is tilted by `bannerAngle` (`angle.ts`,
  ±8°, FNV-1a + mulberry32 mirroring the emoji module's PRNG) seeded on
  `${dogId}:${label}`, so the tilt is **stable per (dog, label)** and never jitters
  between re-renders. The `HamburgerAlarmBanner` overlay is XSS-safe (fixed label
  strings, dynamic values bound as text / inline-style numbers, no `{@html}`); the
  profile route renders no dog images, so it carries no banner.
- **Report/unreport idempotency.** `reportBurger` maps a `23505` unique-violation
  (already reported) to a benign success (re-reporting is a no-op toggle-on);
  `unreportBurger` deletes the `(reporter_id, hot_dog_id)` row scoped to the viewer
  and succeeds on zero rows (retracting a non-existent report is a no-op). Both take
  the `SupabaseClient` passed in and derive the reporter from the trusted session uid,
  never a client-supplied id.
- **DW-021 (avatar-symmetry) already logged — no new DW.** The TASK-070
  avatar-symmetry follow-up is tracked in [[tasks/discovered]] as DW-021; nothing in
  TASK-071 reopens or adds to it, and no new Discovered Work surfaced here.
- **Outstanding hosted-push gate.** The migration
  `20260617205453_burger_alarms.sql` has **NOT** yet been `supabase db push`ed to
  hosted; the per-milestone hosted-push gate is **open** for it. No scheduled job
  calls `burger_alarms`, so there is no keep-alive 404 / auto-pause risk if the push
  lags (the gate is hosted enforcement/parity, not workflow health) — but the report
  surface is not functional on hosted until it is pushed. See [[PROJECT]] Process
  notes.
- **Reviewer outcome:** APPROVE, **0 fix cycles**. One minor review finding —
  missing report/unreport route-action tests — was addressed pre-merge. Gates at
  merge: `pnpm test` 710, `pnpm check` 0, `pnpm lint` clean, `@smoke` 4,
  `@security` 81.

### TASK-070: Upload limits enforcement [`complete`] [`P1`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-013
**Merged:** PR #74 (`864b8e2`, squash) · Reviewer: APPROVE · Fix cycles: 0
**Scope note (2026-06-17, activation):** "hard server-side" interpreted per the
project's L2 defense-at-the-DB posture — enforced at the authoritative boundary
(DB + Storage API), so a direct PostgREST insert cannot bypass the limits, not only
in the SvelteKit form action. Folds in **DW-005** (client-supplied `byte_size`
soft-guard residual). `MAX_UPLOAD_BYTES = 2 MiB`.
**Acceptance Criteria:**

- [x] Per-file max size hard-capped at the Storage API via the `hotdogs` bucket
      `file_size_limit` (rejects oversized ACTUAL bytes regardless of client) — also
      applied to `avatars` for consistency
- [x] DB CHECK `byte_size <= MAX_UPLOAD_BYTES` on `hot_dogs` as the authoritative
      declared-size backstop feeding the global storage-sum guard
      (`hot_dogs_byte_size_max`)
- [x] Per-user count cap (100) enforced at the DB via a BEFORE INSERT trigger
      (`hot_dogs_enforce_per_user_cap`); the existing form-action count check stays as
      the friendly UX layer
- [x] Form action enforces the server-side max-size check and returns clear,
      friendly errors on every violation (size, count, global guard)
- [x] `@security` live-DB E2E asserts the DB trigger + CHECK reject over-cap and
      oversized-`byte_size` direct inserts; unit coverage for the size constant (5 new
      `@security` cases + the constant unit test)
- [x] All gates green: `pnpm test` 626, `pnpm check` 0, `pnpm lint` clean, `@smoke` 4,
      `@security` 73

> **Post-merge ops gate — DONE (2026-06-17):** the migration
> (`20260617195233_upload_limits.sql`) was `supabase db push`ed to hosted by the user,
> so the DB CHECK/trigger + Storage-API caps are live on the hosted project.

**Notes:**

- **Three-layer, hard, server-side enforcement.** "Hard server-side" was
  realized at the authoritative boundary so a direct PostgREST insert (browser
  publishable key, bypassing the SvelteKit form action) cannot bypass any of the
  three limits:
  1. **Storage API `file_size_limit = 2 MiB`** on the `hotdogs` AND `avatars`
     buckets (migration `20260617195233_upload_limits.sql`) — the only layer that
     bounds the **actual uploaded bytes**, rejecting an oversized object at the
     Storage API regardless of what the client claims.
  2. **DB CHECK `hot_dogs_byte_size_max` (`byte_size <= 2097152`)** — bounds the
     **declared** size column that feeds the decision #11 global storage-sum
     guard. This bounds the value, not the bytes.
  3. **`hot_dogs_enforce_per_user_cap()` BEFORE INSERT trigger** — enforces the
     100-per-dog-per-user cap (decision #10) at the DB; the existing form-action
     count check stays as the friendly UX layer.
- **Why a trigger, not an RPC, for the count cap.** The per-user cap is a
  per-row admission invariant on the **plain owner-scoped INSERT path** (hot dog
  upload writes through RLS, not through a consuming-writes RPC — there is no
  denormalized counter to maintain transactionally). A SECURITY DEFINER RPC would
  have meant rerouting the whole upload write path through an RPC just to gate a
  count; a BEFORE INSERT trigger enforces the admission rule in place without
  changing the write path. The trigger function is SECURITY DEFINER,
  `search_path=''`, schema-qualified, with `revoke execute … from public, anon,
authenticated` (the standard private-helper lockdown — a trigger function is
  never meant to be called directly).
- **Single-source-of-truth across the SQL/TS boundary.** `MAX_UPLOAD_BYTES =
2097152` (2 MiB) lives as a TS constant in
  `src/lib/features/hotdogs/hotdogs.ts` (single source on the TS side). SQL
  cannot import a TS constant, so the migration carries the `2097152` literal
  directly, with cross-reference comments in **both** directions (SQL ↔ TS) and a
  unit test pinning the constant's value to catch drift if either side changes.
  The `upload` form action rejects `photo.size > MAX_UPLOAD_BYTES` early with a
  friendly `fail(400)`.
- **DW-005 residual — substantially MITIGATED, not fully closed.** DW-005's
  original concern had two directions. The **real-bytes / oversized** direction is
  now **closed** by the hard Storage-API `file_size_limit`. The
  **understatement** direction remains: a client can still upload a real ~2 MiB
  object and declare `byte_size = 1`, understating the global storage-sum guard.
  The 2 MiB per-file cap shrinks the abuse ceiling but does not eliminate it.
  This stays an **accepted v1 residual** under the invite-only trust model — kept
  TRACKED in [[tasks/discovered]] (DW-005 re-scoped), not marked fully resolved.
  Closing it would require reconciling `byte_size` against real `storage.objects`
  metadata server-side post-upload.
- **No new architecture-decision row.** This task **composes** decision #11
  (global storage guard), decision #10 (per-user cap), and decision #24's
  column-grant lockdown — which it **preserves and does NOT touch** — under the
  L2 defense-at-the-DB posture. Recorded as a hardening of those, not new
  architecture. (See [[PROJECT]] Architecture-Decisions note.)
- **Avatar-symmetry follow-up.** Avatar uploads now also hit the hard 2 MiB
  Storage-API cap, but the friendly form-action "too big" pre-check was scoped to
  hot-dog uploads only — an oversized avatar surfaces a generic "We couldn't
  upload your avatar." rather than a friendly size message. Within AC and
  unreachable in practice (avatars compress to ~100–200 KB); logged as a
  low-priority DW item for optional future symmetry.
- **Reviewer outcome:** APPROVE, **0 fix cycles**. Gates: `pnpm test` 626,
  `pnpm check` 0, lint clean, `@smoke` 4, `@security` 73 (5 new `@security`
  live-DB cases in `tests/db-guards.e2e.ts` — CHECK rejects oversized
  `byte_size`, trigger rejects the 101st row, Storage API rejects a >2 MiB
  object, boundary cases at exactly 2 MiB accepted — plus unit cases for the
  action size check and the constant).
- **Hosted-push gate — DONE (2026-06-17):** migration
  `20260617195233_upload_limits.sql` was `supabase db push`ed to hosted by the user,
  so the DB CHECK/trigger + Storage-API caps are now live on the hosted project (see
  the Post-merge ops gate callout above and [[PROJECT]] Process notes).

---

> **No caps.** Acceptance criteria, subtasks, and integration points are
> unbounded. Give each task as much specificity as it needs to be completed to
> spec — never trim detail to hit a count.
