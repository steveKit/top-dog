# Top Dog — Project Overview

## Status

**Phase:** M0–M7 complete · **M8 (Snacktum Snacktorum rebrand) — BUILDING + RE-SCOPED** (activated 2026-06-19; **re-scoped 2026-06-19**; TASK-087 theme + TASK-080 app shell + the **auth cluster** TASK-083 password recovery + TASK-082 sign-in + TASK-092 the Snacktum Onboarding rite at `/sign-up` + TASK-090 the foundational slug refactor + TASK-091 The Procession + TASK-093 The Shrine + TASK-094 the "Anoint" mustard re-theme + TASK-095 Your Litter complete, 10/16 — auth is functional end-to-end, three rebuild-from-design in-app pages have landed (the feed is now at `/snacktum-snacktorum/procession`; the profile is now The Shrine at `/snacktum-snacktorum/shrine/[handle]` with a derived stat ledger; the own-dogs gallery is now Your Litter at `/snacktum-snacktorum/litter`, with the `[id]` detail folder moved along rename-only — TASK-096 rebuilds The Relic at `/snacktum-snacktorum/litter/[id]`), the in-app route prefix is `/snacktum-snacktorum`, and the mustard mechanic is re-skinned as "Anoint" (6h-decay splat + a persisting wall-notice + the one M8 migration retiring the prune → `mustard_sprays` is now append-only, **architecture decision #29**); the **Shrine cluster is closed** — TASK-094-R The Reliquary (a purely DERIVED badge/honors module + shelf, wired into the Shrine, **not counted in the `/16`**, so the headline stays 10/16) fills the badge placeholder TASK-093 left; plus an **ad-hoc App Chrome rebuild** (PR #119, NOT one of the 16 tasks — rollup stays 10/16) that gave the persistent shell full-bleed chrome + a champion sub-bar; the remaining work is the per-page rebuilds from the delivered mockups)
**Last Updated:** 2026-06-22

> **‼️ M8 RE-SCOPE (2026-06-19, user-directed) — rebuild-from-design + re-slug.** The
> remaining M8 pages are now **REBUILT FROM their design mockups** (`design/pages/*.dc.html`
> — a per-page presentational rebuild of `+page.svelte`, not an incremental restyle) **and
> the IN-APP routes are RE-SLUGGED to cult names** (the `app` URL segment → `snacktum-snacktorum`;
> each `/app/*` leaf → a cult slug, e.g. feed→`procession`, dogs→`litter`(+`litter/[id]`),
> profile/[handle]→`shrine/[handle]`, messages→`epistles`(+`epistles/[handle]`),
> invite→`summon`, court→`tribunal`, help→`catechism`). **The four auth slugs are KEPT
> descriptive (user-finalized): `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`
> — the three complete gate pages are NOT re-slugged**, and the **onboarding rite lives at
> `/sign-up`** (the standalone `/app/onboarding` route is removed/absorbed — no
> `/snacktum-snacktorum/onboarding` leaf). This is a **deviation from the original "URL paths
> UNCHANGED" plan** — in-app URLs now DO change — recorded as a **scope decision, NOT a numbered
> architecture-decision row**. (The slug re-scope itself adds no decision row; the **one** new
> numbered row of the milestone is TASK-094's **#29** — `mustard_sprays` retention / prune
> retirement — which has now LANDED, taking the table to **#29**.) It stays
> **skin-not-skeleton at the code level:** each rebuild **preserves its `+page.server.ts`
> (load + actions)** and re-wires all data/feature plumbing (RLS-scoped queries, the
> decision-#27 server-side signed-URL handling, votes / reactions / walls / DMs /
> mustard(Anoint) / crown / badge / report+verdict wiring); **no table/RPC/TS-symbol rename,
> no infra rename, decisions #1–#29 + L2 preserved.** The task
> set is re-numbered: **4 complete** (TASK-087/080/083/082) **+ 12 pending** — TASK-090
> (foundational slug refactor, lands first; a RISKY cross-cutting rename that must update the
> `hooks.server.ts` auth-guard **prefix** `/app` → `/snacktum-snacktorum`, the root redirect,
> the shell links, and the E2E+unit `/app/...` path assertions — checkpoint tag at execution.
> **The `/sign-in` redirect targets are KEPT and the recovery email template is unchanged**;
> the profile-funnel guard retargets to the `/sign-up` rite) then per-page rebuilds
> TASK-091/092/093/094/094-R/095/096/097/098/099/100/101. The old pending tasks
> TASK-081/084/085/086/088/089 are **superseded/folded** (081 copy → carried by the rebuilds;
> 084→092 onboarding rite, 085→093 Shrine, 086→094 Anoint, 088→101 error page, 089→094-R
> Reliquary). **Pre-launch (invite-only, not deployed) → no old→new redirects.** The slug map
> is **FINALIZED by the user** (auth slugs unchanged; in-app prefix → `snacktum-snacktorum`;
> onboarding rite at `/sign-up`). See [[tasks/milestone-08-snacktum-snacktorum-rebrand]] § Slug Map.

Invite-only social app for showing off homemade hot dogs. Users upload photos,
cast a single movable vote for the best hot dog (not their own), and compete for
"Top Dog" status. The Top Dog earns a badge and can spray decaying mustard on
other profiles.

**All pre-specified plenary milestones M0–M7 are complete (2026-06-18).** The final
task, TASK-072 (the M7 polish pass), closed M7 — Safety & Polish, the last of the
eight pre-specified milestones.

**The project then pivoted to a rebrand: Milestone M8 — "Snacktum Snacktorum" (the
hot-dog CULT app, the Order of the Holy Tube) — and the M8 BUILD has now STARTED
(activated 2026-06-19).** M8 is a **"skin not skeleton" pass** — it changes only what
users SEE (strings, copy, lore, components, styles, new user-facing pages/flows: a
global app shell + nav, real sign-in, password reset, a ritual sign-up, a profile
redesign, the "Anoint" mustard re-theme, an error/404 page) and **renames NO code
identifier or infrastructure name** (the Supabase project/DB/containers stay `top-dog`;
`is_current_top_dog` / `TopDogBadge` / `selectTopDog` / table + RPC names all stay;
champion title "Top Dog" → "The Anointed Wiener" is **copy only**). The **auth cluster +
the app shell are fully designed and committed** (`design/pages/` mockups: Log In, Reset
Password, the Snacktum Onboarding ritual, the App Chrome shell; `design/avatars/` 5 SVG
sigils; `design/assets/` brand marks + favicons; `design/page-design-prompts.md` 11
paste-ready prompts for the still-unbuilt in-app pages). **The first M8 task has landed:
TASK-087 — the base cult visual / theme layer (1/10).** It is the FOUNDATION/theme task:
a tokenized dark-temple CSS layer (`src/lib/styles/tokens.css`, imported by
`src/app.css`) that every downstream M8 task consumes via `var(--…)` tokens, plus
self-hosted SIL OFL Cinzel + Cormorant Garamond `.woff2` fonts under `static/fonts/`
(no CDN, **no npm package**) and themed flair-component styling. **The second M8 task
has now landed: TASK-080 — the global app shell + persistent nav (2/10).** A new
`(protected)/app/+layout.svelte` renders a persistent header/nav across every `/app`
route (🌭 home → The Procession; feed / Your Litter / Epistles / The Catechism; ＋
Upload; crown-gated ☩ Tribunal link), the `/` redirect was repointed `/app` →
`/app/feed`, and the bare `/app` "kennel" hub is retired (`redirect(307,'/app/feed')`).
**The `TopDogPrivilegesNotice` (TASK-074) was intentionally RETIRED** as part of this —
Top Dog powers are now documented in The Catechism (`/app/help`) and the crown-gated
Tribunal nav link covers adjudication (1 fix cycle; `pnpm test` 783 → 775 = the retired
helper's 8 cases). **The third M8 task has now landed: TASK-083 — the password-recovery
cluster (3/10),** the first half of the auth cluster: `/forgot-password`
(`resetPasswordForEmail`, neutral non-enumerating response) + `/reset-password` (a
**6-digit OTP code** + new password → `verifyOtp(type:'recovery')` → `updateUser`). The 1
fix cycle added the load-bearing piece: a code-emitting recovery email template
(`supabase/templates/recovery.html` emitting `{{ .Token }}` + `[auth.email.template.recovery]`
/ `otp_length = 6` in `config.toml`), since Supabase's default email sends a link not a
code — director-verified by a **live Mailpit round-trip** (a real 6-digit, code-only
email; `pnpm test` 793; no migration, no new dependency, decision table stays #28). The
user chose **6 digits over the design's 4-mark**. **The fourth M8 task has now landed:
TASK-082 — the real `/sign-in` (4/10), the second half of the auth cluster, which CLOSES
it.** `/sign-in` was a non-functional stub (the dead destination of every unauthenticated
bounce); it is now a real themed form ("Enter the Snacktum") with a default action calling
**`signInWithPassword` on `event.locals.supabase`** → on success `redirect(303, '/app')`
through the auth cascade (a profile-less member funnels on to `/app/onboarding`). The auth
design is **non-enumerating** (a single generic error never distinguishing "no account"
from "wrong password"; password never echoed; raw errors server-side only), matching the
posture TASK-083 set for forgot/reset — so the whole cluster now reads as one consistent
boundary. A new `tests/sign-in.e2e.ts` `@smoke` spec drives a **seeded user through the
real form** and asserts the profile-less → `/app/onboarding` funnel (reusing the seeded
inviter — no new fixture), growing the live suite to **5/5**. Reviewer APPROVE, **0 fix
cycles** (two minor non-blocking notes); `pnpm check` 0, `pnpm lint` clean, `pnpm test`
**801** (8 new sign-in action tests), `@smoke` 5/5 live on a fresh `supabase db reset`; **no
migration, no new dependency, no new architecture-decision row** (table stays #28). **With
this the M8 auth cluster is COMPLETE and functional end-to-end** — sign-in / forgot / reset
all live-tested; a member can now log in through the UI for the first time. **The fifth M8
task has now landed: TASK-092 — the Snacktum Onboarding rite at `/sign-up` (5/16), the first
of the rebuild-from-design pages.** `/sign-up` was rebuilt as a single multi-step **rite**
(Summoned → Inscribe → Choose Thy Sigil → Renounce → Received) that **absorbs and deletes**
the standalone `(protected)/app/onboarding/` route — the profile-funnel guard
(`ONBOARDING_PATH`) now points at `/sign-up`, and an authenticated-but-profile-less
**resumer** picks the rite up at a handle-only Inscribe (handle carried to `createProfile`
via client `$state`; forward-only). Two non-obvious **control-flow decisions** are worth
recording: (a) the profile is forged at the **Sigil** step and **Renounce is a pure-UI
oath** gated only on the sworn state (no session check there); (b) `createProfile`
**returns `{ created, handle }` instead of redirecting**, so the client advances
Sigil→Renounce→Received **without re-running `load`** — because re-running `load` would
`throw redirect` on the now-existing profile and skip the oath/Received (Received has an
explicit "Enter →" into the app; a `createProfile` failure recovers in place on the Sigil
step). The chosen sigil is stored as `sigil:<id>` in `avatar_path` (no upload, no
migration); new `src/lib/components/Sigil.svelte` (inline SVG, no `{@html}`) +
`src/lib/features/profiles/sigils.ts`. The Ordo Sancti Tubi **seal** + **wordmark header**
are unified across the four auth/gate pages via shared `.gate-mark`/`.gate-header` in
`app.css`. Reviewer APPROVE (heavy interactive UI iteration, no formal fix cycles); `pnpm
check` 0, `pnpm lint` clean, `pnpm test` **830**, `@smoke` 5/5, `@security` 94/94. **No
migration, no new dependency, no new architecture-decision row** (table stays #28).
Discovered: a session-less hit at the Sigil step dead-ends with `fail(401)`
and no in-rite recovery (DW-033); DW-031 brand-asset wiring updated
(`snacktum-snacktorum-header.svg` now wired; `the-holy-tube.svg` newly orphaned).

**The sixth M8 task has now landed: TASK-090 — the foundational slug refactor (6/16; PR
#115 `38c8844`, merged 2026-06-20; checkpoint tag `checkpoint-2026-06-20-pre-slug-refactor`).**
Only the in-app route **PREFIX** changed: `/app` → `/snacktum-snacktorum`, with the
directory moved `src/routes/(protected)/app/` → `src/routes/(protected)/snacktum-snacktorum/`.
**The load-bearing change is the `hooks.server.ts` auth-guard prefix**
(`startsWith('/app')` → `'/snacktum-snacktorum'`) — the protected area stays guarded in
lockstep, so no route went unguarded. **Leaf names are UNCHANGED** (deferred to the
per-page rebuilds): `feed`, `dogs`, `dogs/[id]`, `profile/[handle]`, `messages`,
`messages/[handle]`, `invite`, `court`, `help` — so every `/app/<leaf>` became
`/snacktum-snacktorum/<leaf>` with the same leaf (the post-rite path is now
`/snacktum-snacktorum/profile/<handle>`; the leaf renames feed→procession,
profile→shrine, etc. are TASK-091+). The **four gate slugs are unchanged** (`/sign-in`,
`/sign-up`, `/forgot-password`, `/reset-password`); the `/sign-in` redirect targets were
preserved and the profile-funnel `ONBOARDING_PATH` still points at `/sign-up`. Scope
decision: the root redirect points at `/snacktum-snacktorum/feed` (the live leaf), NOT
`/procession` — TASK-091 renames the leaf and retargets the redirect (since landed). The live-doc path
sweep (CLAUDE.md + README.md `/app/*` route references → `/snacktum-snacktorum/*`) was
done as part of this bookkeeping, resolving the reviewer's stale-doc finding. Reviewer
APPROVE, **0 fix cycles**; `pnpm check` 0/0, `pnpm lint` clean, `pnpm test` 830/830,
`@smoke` 5/5, `@security` 94/94, form-validation 2/2. **No migration, no new dependency, no
new architecture-decision row** (table stays #28).

**The seventh M8 task has now landed: TASK-091 — The Procession (7/16; PR #117 `dffaee5`,
merged 2026-06-20), the first rebuild-from-design IN-APP page.** The feed `+page.svelte` was
**rebuilt from `design/pages/The Procession.dc.html`** as The Procession — a
skin-not-skeleton pass that **preserved the `+page.server.ts` load AND all 6 actions** (~95%
rename), the only server change being a derived `championDogId`. The champion title copy is
**"The Anointed Wiener"** (copy only; `is_current_top_dog` / `TopDogBadge` / `selectTopDog`
and every other code identifier unchanged). A **mid-task escalation resolved by director
decision (no fix cycle):** the designed champion ribbon had no data source, so
`listVotableDogs`' embedded `profiles(...)` join was **widened to carry `is_current_top_dog`**
(following the `detail.ts` pattern) and the load derives `championDogId` = the highest-ranked
crowned owner's dog. That champion data path is a **read-only read of the
non-client-writable crown column** (decision #25), kept **RLS-scoped** on
`event.locals.supabase` (no service-client widening) and is public info (no decision #27
anonymity concern). The leaf-slug was renamed **`feed` → `procession`** — the **feed is now at
`/snacktum-snacktorum/procession`** — and **only the feed leaf moved** (`dogs`, `profile`,
`messages`, `invite`, `court`, `help` are unchanged; their renames ride their own rebuild
tasks). The README + CLAUDE.md current-state `/snacktum-snacktorum/feed` doc references were
swept to `/snacktum-snacktorum/procession` as part of this bookkeeping, resolving the
reviewer's stale-doc finding. Reviewer APPROVE, **0 fix cycles**; `pnpm check` 0/0, `pnpm
lint` clean, `pnpm test` 834/834, `@smoke` 5/5, `@security` 94/94, `feed-detail` 3/3. **No
migration, no new dependency, no new architecture-decision row** (table stays #28).

**The eighth M8 task has now landed: TASK-093 — The Shrine (8/16; PR #122 `851fa0e`, merged
2026-06-22), the second rebuild-from-design IN-APP page.** The profile `+page.svelte` was
**rebuilt from `design/pages/The Shrine.dc.html`** as The Shrine — a skin-not-skeleton pass
that **preserved the `+page.server.ts` load AND all 3 actions** (`spray` / `post` /
`deleteMessage`) and re-wired them into the new markup. The leaf-slug was renamed **`profile`
→ `shrine`** — the **profile page is now at `/snacktum-snacktorum/shrine/[handle]`** (param
preserved), and **only the `profile` leaf moved** (`dogs`, `messages`, `invite`, `court`,
`help` remain pre-rename, riding their own rebuilds). Champion title copy is **"The Anointed
Wiener"** (copy only; code identifiers unchanged). The page adds a **derived stat ledger** —
new read-only `src/lib/features/profiles/stats.ts` (`loadShrineStats(...)` → `ShrineStats`;
`EMPTY_SHRINE_STATS` degradation baseline) computing aggregates over existing tables with
**no schema and no write path**. Seven of the eight counts stay RLS-scoped; the eighth —
"Disciples Summoned" (redeemed invites) — runs on the **service client** as a `head:true`
count **after** `safeGetSession()`, because `invites` has only an owner-scoped SELECT policy
(`invites_select_own`) so an RLS-scoped count returns 0 on any cross-member view. This
**generalizes the decision #27 service-client-after-gate pattern to a cross-member aggregate**
(a head count ships no rows → no exposure widening; decision #27 anonymity preserved
structurally — the only widened read is a count of a self-derived stat surface, no
row-/reporter-level exposure). **Two fix cycles, both root-caused:** (1) a **tester-caught
P0** — the wall composer's `<textarea name="word upon the shrine">` didn't match the `post`
action's `formData.get('body')`, so wall posts silently submitted empty bodies (fixed to
`name="body"`); (2) **reviewer two majors** — (a) "Disciples Summoned" read 0 cross-member
(RLS undercount on owner-scoped `invites`; fixed to the service-client head count above), and
(b) the wall textarea's themed validation never fired because the `<label>` was a **sibling**
of the textarea instead of wrapping it, so `fieldLabel()`'s `closest('label')` couldn't
resolve the visible label (fixed by **nesting the textarea inside the `<label>`** — the
gate-form pattern). The validation module was widened to validate `<textarea>` (was
input-only; backward compatible) and `validationMessage.ts` gained the **"Word upon the
Shrine"** themed-label special-case. Reviewer APPROVE (after 1 REQUEST_CHANGES round); `pnpm
check` 0/0, `pnpm lint` clean, `pnpm test` 861/861, `@smoke` 5/5, `@security` 94/94. **No
migration, no new dependency, no new architecture-decision row** (table stays #28).
Discovered: there is no jsdom/client vitest project, so DOM-touching `.svelte.ts` validation
logic has no unit coverage — the exact gap that let fix-cycle Issue-2 pass green unit tests
(logged DW-035). **Next: another per-page rebuild.**

**The ninth M8 task has now landed: TASK-094 — the "Anoint" mustard re-theme (9/16; PR #124
`645373a`, merged 2026-06-22), and the ONLY M8 migration.** The Top-Dog mustard mechanic on
The Shrine is re-skinned as **"Anoint"** (champion = "The Anointed Wiener"): the splat was
re-themed to the design's Anoint visual and the render-time decay window was shortened
**24h → 6h** (`MUSTARD_LIFESPAN_MS` in `src/lib/features/mustard/decay.ts`, the single source
of truth). The shortening is **overlay-only** — `mustardOpacity` still computes full → 0
linearly from the raw `sprayed_at`, never persisted (decision #15's render-time posture
unchanged). A **persisting wall-notice** was added, **render-derived from the FULL spray
history**: two views now read the same raw rows — the decaying overlay reads only the live
(≤ 6h) window (`listSpraysForProfile`), while the persisting "recently anointed" notice
derives from the entire history via a new `listAnointmentsForProfile` (capped 200 rows), so
it outlives the splat's 6h fade (OQ-2 Option A). **The daily prune was retired** —
`20260622120000_retire_mustard_prune.sql` is a **function-only** DROP of
`prune_mustard_sprays()` (table shape / grants / RLS / `WITH CHECK` untouched), so with no
client DELETE policy and no prune `mustard_sprays` is now **append-only**; the
`.github/workflows/keepalive.yml` mustard-prune step was removed **in lockstep** (the
workflow now drives only `ping` + the Top Dog `tally`). This **introduces architecture
decision #29 (`mustard_sprays` retention — append-only)** — the milestone's one planned new
decision row, now realized; it composes #12/#15/#25/#28 with no other schema/RLS/grant
change. **Two reviewer fix cycles:** (1) the persisting notice was first derived from the 6h
overlay query so it vanished with the splat — fixed to the full-history `listAnointmentsForProfile`;
(2) a stale 24h/prune-era comment + a couple of Anoint copy lines were re-voiced. Code
identifiers (`mustard_sprays`, `sprayer_id`, `mustardOpacity`, `MUSTARD_LIFESPAN_MS`) are
unchanged per the HARD SCOPE CONSTRAINT. A rewritten mustard-retention `@security` guard
asserts the append-only posture. Reviewer APPROVE; `pnpm check` 0/0, `pnpm lint` clean,
`pnpm test` 878/878, `@smoke` 5/5, `@security` 93/93. **No new dependency.** **Hosted-push
gate:** the prune-retirement migration batches with the two outstanding M7 hosted pushes
(`burger_alarms` + `burger_verdicts`) and the TASK-083 recovery-template config — user's
hand, async, no auto-pause risk. Discovered: the historical base migration
`20260616163055_mustard_sprays.sql` now carries stale 24h/prune comments (DW-036 — candidate
only for a migration-comment-accuracy pass; historical migrations are normally not
rewritten). **Next: another per-page rebuild** (TASK-094-R Reliquary / Litter / Epistles /
Summon / Tribunal / Catechism / Lost Pilgrim).

**The Shrine cluster is now CLOSED: TASK-094-R — The Reliquary (PR #126 `870e401`, merged
2026-06-22), a purely DERIVED badge/honors module + shelf.** It fills the badge placeholder
TASK-093 left on the Shrine. New **pure** module `src/lib/features/badges/badges.ts`
(`computeBadges(BadgeInputs)`) — self-contained, no SvelteKit/Supabase imports, co-located
unit tests (same shape as `voting/ranking.ts`, `mustard/decay.ts`, `reports/verdict.ts`) —
plus a presentational `src/lib/components/Reliquary.svelte` shelf. Every badge is computed at
render time from facts the app already keeps: **no migration / schema / RPC / dependency / write
path / service-client read**, so the honors are **un-forgeable by construction** (nothing on the
shelf is client-settable). The v1 set (neutral code ids; cult labels in the component): a flat
`first_frank` (≥ 1 hot dog); four tiered relics — `crowned` 1/7/30 days as The Anointed Wiener,
`summoner` 1/5/25 redeemed invites, `drenched` 1/10/50 anointings received, `inquisitor` 1/5/25
verdicts rendered (each carries the current tier + `nextThreshold`); a flat `centurion` (a frank
that ever bore ≥ 100 votes, max `peak_votes`); an `elder` keyed on the founding-cohort cutoff
`ELDER_CUTOFF_ISO = 2026-09-01` (a single named constant); and two shame MARKS (`heretic`, `liar`
= display "False Witness", earned on EVER-branded) in a distinct disgrace register, excluded from
the earned-honors tally. The Shrine load assembles `BadgeInputs` **once from already-loaded facts**
— REUSING the `loadShrineStats` aggregates (TASK-093), including the service-client redeemed-invites
count for `summoner` (so **no second service-client read**) + the existing `isHeretic`/liar-brand
reads — adding exactly **one new RLS-client `inquisitor` head-count** (`burger_verdicts` where
`decided_by` = the member). **Decision #27 reporter anonymity is preserved BY CONSTRUCTION:** no
input keys on the reporter side of a report — `heretic`/`liar`/`inquisitor` key on the member's
OWN consequences/actions, and there is deliberately no "heresies you've called" badge. The feature
**composes decisions #12/#13/#15/#27 — no new architecture-decision row** (table stays #29).
Reviewer APPROVE, **0 fix cycles** (two minor no-action observations); `pnpm check` 0/0, `pnpm
lint` clean, `pnpm test` 938/938, `@smoke` 5/5, `@security` 93/93. As a **derived sub-module it is
not counted in the milestone `/16`** (M8 stays 9/16). Discovered: two honors are out of v1 because
they would need NEW persisted tracking the app does not keep — a **total-votes-ever** honor (the
`votes` table keeps only the current vote per voter, `UNIQUE(voter_id)`) and **reign-streak**
honors (`top_dog_days` records discrete days, not consecutive-run metadata) — logged DW-037 (the
v1 `crowned` relic tiers on cumulative `days_as_top_dog` instead). **Next: the remaining per-page
rebuilds** (Litter / Epistles / Summon / Tribunal / Catechism / Lost Pilgrim).

**The tenth M8 task has now landed: TASK-095 — Your Litter (10/16; PR #128 `4cab7df`, merged
2026-06-22), the third rebuild-from-design in-app page.** The own-dogs gallery + upload
`+page.svelte` was rebuilt from `design/pages/Your Litter.dc.html` as Your Litter — a
skin-not-skeleton pass that **preserved `+page.server.ts`** (its `load` plus the `upload`/`delete`
actions) and re-wired it into the new markup. The own-gallery query stays **entirely on the
RLS-scoped client — no service client**: this is the member's OWN litter, so decision #27's
service-client-after-gate signing isn't needed here (the deliberate inverse of the cross-member
feed/Relic loads). The leaf-slug was renamed **`dogs` → `litter`** via a single atomic `git mv` of
the **whole `dogs` folder**, so the `[id]` detail subfolder rode along **rename-only** — its markup
is untouched, leaving The Relic (`/snacktum-snacktorum/litter/[id]`) for TASK-096, which now shares
the already-renamed `litter` leaf parent. The own-gallery is now at `/snacktum-snacktorum/litter`;
only the `dogs` leaf moved (`messages`/`invite`/`court`/`help` are still pre-rename). The upload
form adopts the **themed-validation CANON** on its `photo` field (file input nested inside its
`<label>`; a new "Relic Image" themed-label special-case in `validationMessage.ts`). **No migration,
no new dependency, no new decision row** (decisions stay #1–#29, L2 preserved). Reviewer APPROVE,
**0 fix cycles** (two minor doc-staleness notes folded into bookkeeping); `pnpm check` 0/0, `pnpm
lint` clean, `pnpm test` 940/940, `@smoke` 5/5, `@security` 93/93. **Next: the remaining per-page
rebuilds** (TASK-096 The Relic / Epistles / Summon / Tribunal / Catechism / Lost Pilgrim).

**All design questions are now RESOLVED:** the ritual sign-up rite, the
5-sigil avatar mechanism, the dark-temple theme, the self-hosted Cinzel/Cormorant fonts,
the 6-digit-OTP reset flow, plus (2026-06-19) **OQ-5** — the dog-detail page is **"The
Relic"** — and **OQ-2** (all five Anoint sub-decisions: keep gated, re-theme the spray /
no merge, **splat** visual, decay shortened to **~6h**, and a
**persisting** wall notice). **The OQ-2 Option A posture change (user-approved) has now
SHIPPED in TASK-094:** `prune_mustard_sprays()` is RETIRED so the persisting wall-notice's
source rows survive — the milestone's one migration (prune retirement) + the keep-alive
workflow edit + the new **architecture-decision row #29 (`mustard_sprays` retention —
append-only)** all landed, taking the decision table to **#29** (see the TASK-094 note above
and the Architecture Decisions table). See
[[tasks/milestone-08-snacktum-snacktorum-rebrand]].

**Ad-hoc M8 follow-up (not a numbered task) — themed inline form validation landed
and is now an app-wide convention (PR #109, squash `6c00c1c`, 2026-06-19).** A themed,
accessible, **inline client-side validation layer** replaced the browser's native
HTML5 validation bubble on the auth-gate forms — new modules
`src/lib/features/forms/` (`validationMessage.ts` pure + `createFormValidation()`
rune) and `src/lib/motion/reducedMotion.ts` (`errorSlideFade`). It is recorded as a
**binding convention** (see the [[CLAUDE]] "Forms & validation" subsection): **themed
inline validation is the standard for EVERY form with required / empty-able fields;
the native bubble is never used**, applied as each form-bearing page is built /
reworked (rollout tracked as DW-032). **M8 stays 4/10** (not a queued task); **no
migration, no new dependency, no new architecture-decision row** (the decision table
stays at **#28**).

**Ad-hoc M8 chrome polish (NOT one of the 16 M8 tasks) — the App Chrome rebuild
landed (PR #119, squash `7598365`, merged 2026-06-20).** User-directed during a live
visual review, this rebuilt the persistent app shell
(`(protected)/snacktum-snacktorum/+layout.svelte`) to match `design/pages/App Chrome.dc.html`
— the App Chrome equivalent of the per-page rebuilds (TASK-080 had built the shell
`design-light`). Three things landed worth recording. (1) **Full-bleed chrome:** the nav
header AND a new "The Anointed Wiener" champion sub-bar now span the viewport edge-to-edge,
with content centered at a new **`--measure-shell: 100rem` (1600px)** token in `tokens.css`.
It is implemented via `app.css` `.page-container:has(.shell-header) { max-width: none;
padding: 0 0 var(--space-3xl) }` — **scoped to the app area** (gate pages are untouched: they
key off `:has(> .gate-center)`), with page content still capped at `--measure-content` and no
`100vw` (it relies on `scrollbar-gutter: stable` on `html`, which also fixed a navigation
layout-shift). **A structural self-cap invariant follows:** because the app container is now
full-width with zero horizontal padding, **each child band re-supplies its own horizontal
gutter AND caps its own width** (`.shell-inner` / `.shell-champion-inner` → `--measure-shell`;
`.shell-content` page content → `--measure-content`; mobile `.shell-scroll` → `--measure-shell`),
so **any future not-yet-rebuilt `/snacktum-snacktorum` page must self-cap its content (or wrap
in `.shell-content`) or it sprawls to the viewport edge.** (2) **New read-only
`getCurrentChampion`** — `getCurrentChampion(supabase)` in
`src/lib/features/profiles/profiles.ts` (an RLS-scoped `profiles` SELECT for
`is_current_top_dog = true`, `maybeSingle()`), surfaced by `+layout.server.ts` as `champion`
(the layout load now returns `{ user, profile, champion }`). It **degrades to `champion: null`
on an empty throne / error, AFTER the profile-funnel guard**, so a champion failure never
breaks the `!profile → /sign-up` funnel; `is_current_top_dog` is non-client-writable
(decision #25) and public, so there is no decision #27 anonymity concern, no service client,
and no write path. (3) The champion sub-bar (☩ The Anointed Wiener · sigil · `@handle` ·
reigning), the viewer's own sigil avatar (crown + glow ring when the viewer reigns), centered
nav links with a layout-neutral active-link underline + `aria-current`, and a richer mobile
"unrolled scroll". **The brand was kept as the wordmark image** (`snacktum-snacktorum-header.svg`,
a user override of the mockup's holy-tube-icon+text lockup) — so the wordmark is now used in
BOTH the auth gates AND the app shell, and `the-holy-tube.svg` remains orphaned (already
tracked as DW-031). One E2E locator gotcha surfaced (now a [[CLAUDE]] note): the shell renders
`<img>`s (the brand wordmark, and the champion avatar when non-sigil) that PRECEDE page content
in the DOM, so `feed-detail.e2e.ts` was changed from `page.locator('img').first()` to
`.dog-image img` (one mid-flight `@smoke` locator fix). Reviewer APPROVE, **0 fix cycles** (two
minor no-action observations); `pnpm check` 0/0, `pnpm lint` clean, `pnpm test` 843/843,
`@smoke` 5/5, `@security` 94/94. **No migration, no new dependency, no new architecture-decision
row** (the decision table stays at **#28**); **M8 rollup stays 7/16** (not a queued task).
Logged as DW-034.

The carried-over open follow-up is the standing hosted bring-up gate: the **two
outstanding M7 hosted pushes** (`burger_alarms` + `burger_verdicts`, user's hand — no
auto-pause risk; see Process notes), **plus a TASK-083 hosted CONFIG item — the hosted
recovery email template must be set to the code-emitting `{{ .Token }}` template (via the
dashboard or `supabase config push`) or production sends a recovery LINK instead of a
CODE, breaking the `/reset-password` page** (no migration), **plus the now-landed TASK-094
prune-retirement migration** (`20260622120000_retire_mustard_prune.sql`, decision #29 — the
DROP of `prune_mustard_sprays()`). All three batch onto the same gate (user's hand, async,
no auto-pause risk — the daily `ping` keeps the DB alive). The keep-alive workflow's
mustard-prune step was already dropped in the merged code (lockstep with the migration), so
no hosted workflow edit is pending — only the `db push` of the DROP migration.

**Milestone M0 — Scaffold & Infra is complete.** All five tasks landed: TASK-001
(SSR auth, PR #1 `3978cee`), TASK-002 (swappable storage seam, PR #5 `505f4a1`),
TASK-003 (RLS baseline + `hotdogs`/`avatars` buckets, PR #3 `cdf7bed`), TASK-005
(global storage guard, PR #7 `d95eafc`), and TASK-004 (keep-alive — ops task, no
PR). The **hosted Supabase project is now live**: the schema is pushed
(`supabase db push`), the two GitHub repo secrets (`SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`) are set, and the keep-alive workflow is enabled and
**verified green** (manual run returned HTTP 200 against `profiles`, resetting the
7-day auto-pause timer).

The auth-trust boundary is established by `safeGetSession()`, which validates
the JWT via `supabase.auth.getUser()` and refuses an unvalidated `getSession()`
(implements decision #4). Env presence is validated at the boundary via
`getPublicSupabaseConfig()` (the app reads `$env/dynamic/*`, not static).

### Milestone M0 close notes

Two items from the going-live session are recorded here for auditability:

1. **Hosted/local migration parity fix (PR #9).** `supabase db push` to the hosted
   DB failed with `type "citext" does not exist` because the migration referenced
   the extension-provided type unqualified. The local migration role has
   `extensions` in its `search_path`; the hosted role does not. Fixed by
   schema-qualifying as `extensions.citext`. **Reusable lesson:** all future
   migrations (invites, hot_dogs, vote RPC) must schema-qualify extension types.
   Captured as a [[CLAUDE]] gotcha and in the README migration guide.
2. **Accepted foundational orphans (M0 wiring audit).** The audit flagged three
   exports with no non-test consumers yet — `getServiceClient`
   (`$lib/server/supabase.ts`), the `$lib/storage` module
   (`upload`/`getSignedUrl`/`getPublicUrl`/`remove` + `hotdogPath`/`avatarPath`),
   and `evaluateUpload` (`$lib/storage/guard.ts`). These are **foundational seams,
   not dead code** — each has a dependency-declared M1 consumer: the storage module
   → TASK-011 (avatar upload) + TASK-013 (hot dog upload); `evaluateUpload` →
   TASK-013 (wiring carried as explicit ACs there); `getServiceClient` →
   privileged server ops in M1. All three were reviewer-accepted during their PRs,
   and the user explicitly approved closing M0 with this documented exception. The
   auth foundation (hooks, layouts, protected route, `getPublicSupabaseConfig`) is
   fully wired.

**Milestone M1 — Vertical Slice is complete.** All five M1 tasks have landed:
TASK-010 (invite generation + redemption, PR #13 `ef59aea`), TASK-012 (client-side
WebP compression, PR #16 `2828468`), TASK-011 (profile creation, PR #18 `38db5d9`),
TASK-013 (hot dog upload + display, PR #20 `c552be5`), and TASK-014 (the `@smoke`
vertical slice, PR #22 `aed7e90`). The invite-only growth path (decision #17) is
end-to-end — an authed user mints a unique invite link at `(protected)/app/invite`,
and the public `/sign-up` flow consumes it (pre-check → `signUp` → atomic redeem
RPC → session-branch redirect). Client compression (decisions #8/#9, the linchpin
that makes the 1 GB free-tier cap viable) is in place as a shared seam. The redeemed
user has an **onboarding funnel** that sets a validated unique `@handle` and
optionally an avatar; a member can **upload a compressed hot dog and see it rendered
via a signed URL**, guarded by the per-user 100 cap and the global storage guard,
with orphan-safe upload/delete ordering. **All M0 foundational orphans are now
wired.** The whole slice is locked in by a Playwright `@smoke` that later milestones
must keep green.

**Milestone M2 — Voting & Top Dog Engine is complete.** All five tasks have landed:
TASK-020 (ranking + sticky tie-break logic, PR #25 `835c2f0`), TASK-021 (Vote RPC,
PR #28 `a170676`), TASK-022 (daily Top Dog tally, PR #31 `4351aa9`), TASK-023 (badge
UI, PR #37 `6d1b206`), and TASK-024 (vote-casting feed, PR #40 `94d2e52`). The
crown-selection contract from decision #13 is realized as the **pure `selectTopDog`
seam** in `src/lib/features/voting/ranking.ts` — a strict total-order comparator
(vote count desc → earliest non-null `topDogSince` sticky, null-last → `id`
tie-break). TASK-021 consumes it: the `cast_vote` / `remove_vote` SECURITY DEFINER
RPCs are the **sole write path** for votes (no client write), recomputing
`vote_count` authoritatively from `COUNT(votes)` in-transaction (drift-free) and
recomputing the crown with SQL that provably **mirrors** `selectTopDog` —
discharging the forward-looking lockstep constraint raised at the TASK-020 review.
TASK-022 then counts reign-time into the `days_as_top_dog` stat: the
`tally_top_dog_day()` SECURITY DEFINER RPC is idempotent at two layers
(`UNIQUE(profile_id, day)` + `ON CONFLICT DO NOTHING`, plus `days_as_top_dog`
recomputed authoritatively from `COUNT` — never a blind `+1`) and is wired into the
daily keep-alive workflow as an anon-callable, no-caller-input job (decision #26).
TASK-023 (badge UI) added the read-only display layer — a shared `<TopDogBadge>` on
the Top Dog's profile and their winning-dog tile, with the winning dog resolved by
**reusing the pure `selectTopDog` comparator** so the badge stays in lockstep with
`recompute_top_dog()` (no parallel ordering). TASK-024 closed the loop: a **global
vote feed** at `/app/feed` that lists every _other_ member's dog sorted by
`vote_count` desc (so it doubles as the live leaderboard), each rendered via a
signed URL, wiring the previously-orphaned `castVote` / `removeVote` wrappers into
server-side form actions — a member can finally cast, move, and remove a vote.
**The M2-close wiring audit re-passed** (DW-009 resolved): `castVote` / `removeVote`
/ `listVotableDogs` / `getCurrentVote` all now have a production consumer in
`/app/feed`. **Voting is now end-to-end** (browse feed → cast / move / remove → Top
Dog crown + badge).

**Milestone M3 — Reactions & per-dog stats is complete** (4 tasks; tag
`milestone-03-reactions-per-dog-stats`): cosmetic hot-dog emoji reactions
(structurally inert to ranking), per-dog stats + a `/app/dogs/[id]` detail
view, and a live-stack feed/detail E2E that caught and fixed a non-owner
signed-URL P0 (decision #27). See the M3 close notes below.

**Milestone M4 — Mustard Mechanic is complete.** All three tasks have landed:
TASK-040 (mustard decay math, PR #53 `5afd0da`), TASK-041 (mustard spray +
render, PR #55 `e1eafb9`), and TASK-042 (mustard prune job, PR #57 `6452407`).
The **mustard mechanic is shipped end to end**: a pure render-time decay seam
(`mustardOpacity`, full → 0 over 24h) realizing decision #15, a Top-Dog-gated
spray that renders an opacity-decayed overlay on a target profile (a plain
owner-scoped RLS write whose `WITH CHECK` authorizes against the
non-client-writable crown column, decision #25), and a daily
`prune_mustard_sprays()` job — the table's sole DELETE path, mirroring
`tally_top_dog_day()` — wired into the keep-alive workflow as an anon-callable,
idempotent, no-input job (decision #26). Sprays are immutable + persistent
across crown changes; the drip is computed entirely at render from the stored
timestamp. **Hosted-push gate pending:** the two new migrations must be
`supabase db push`ed to hosted before the next scheduled keep-alive run (see
Process notes). Next: M5 — Walls & DMs.

**Milestone M5 — Walls & DMs is complete** (4 tasks; tag `milestone-05-walls-dms`).
Two new social surfaces landed — **profile message walls** (`wall_messages`,
TASK-050) and private **direct messages** (`dms`, TASK-051) — both as decision #12
**cosmetic / many-allowed tables with no denormalized counter**, writing through
plain owner-scoped RLS (the deliberate inverse of the consuming-writes-via-RPC
convention). Both store the **original message body verbatim** (so the M6 emoji
render-time filter stays free to apply later); DMs add a conversation-scoped privacy
SELECT and a `read_at`-only mutation boundary (decision #24's column-grant mechanism
applied to a privacy column), with a pure render-time `summarizeConversations` inbox
collapse. Mid-milestone, M5 also **absorbed and remediated a project-wide Data API
grant regression**: the Supabase CLI's `auto_expose_new_tables` default flipped to
`false` (2026-05-30), so a fresh `supabase db reset` stopped issuing the implicit base
table GRANTs PostgREST needs alongside RLS — turning `@smoke`/`@security` RED and
breaking the real invite path. TASK-052 restored the grants explicitly
(`restore_data_api_grants` migration) while preserving the decision #24/#25 column
lockdowns and decision #12 RPC-only write paths, pinned `auto_expose_new_tables =
false` in config so local matches cloud, and the model is now recorded as **decision
#28**; TASK-053 added the `tests/grants.e2e.ts` guard locking the matrix in against
future drift. **Hosted-push gate (TASK-054) — DONE 2026-06-17:** the three unpushed
migrations (`wall_messages`, `dms`, `restore_data_api_grants`) all reached hosted in one
`supabase db push`, and the post-push keep-alive run verified **green** (ping + tally +
prune all 2xx), so **walls & DMs are now functional on hosted**. See the M5 close notes
below. Next: M6 — Emoji library.

**Milestone M6 — Emoji library is complete** (2 tasks; tag `milestone-06-emoji-library`).
TASK-060 landed the **pure render-time emoji seam** — a new dependency-free feature folder
`src/lib/features/emoji/` (`emojiSet.ts` curated `HOTDOG_EMOJIS` + `isHotdogEmoji`;
`filter.ts` `filterToHotdog` grapheme-cluster-safe via `Intl.Segmenter` + `sprinkleHotdog`
deterministic via a hand-written `mulberry32` PRNG, zero deps) — and TASK-061 wired it into
the live render surfaces via a new pure composition layer
`src/lib/features/emoji/render.ts` (`renderWallBody` = filter + seeded sprinkle for walls;
`renderMessageBody` = filter only for DMs), realizing **decision #16** (hot-dog-only library;
filter at RENDER time; the ORIGINAL stored body is NEVER mutated). The filter is now live on
the profile wall, the DM thread, and the DM inbox preview, all through Svelte auto-escaped
text (no `{@html}` → XSS-safe), so decision #16's "store original" guarantee holds
**structurally** — there is no persist path that could mutate the stored body. **No new
architecture-decision row** (decision #16 already exists). DW-019 (VS16-decorated
library-emoji handling) is **resolved/accepted** in TASK-061; DW-020 (a render-DOM E2E gap)
is an accepted tracked gap. See the M6 progress notes and close notes below.

**Milestone M7 — Safety & Polish is complete (2026-06-18; 6 tasks — TASK-070 +
TASK-071 + TASK-073 + TASK-074 + TASK-075 + TASK-072).** TASK-072 (the polish pass,
PR #86 `8496d94`) was the final M7 task; with it merged, **all pre-specified plenary
milestones M0–M7 are now complete.** It is an empty/loading/responsive polish pass
plus four folded-in discovered-work fixes (DW-018 bounded DM reads, DW-021 friendly
oversized-avatar `fail(400)`, DW-022 render-only report-control gate on adjudicated
dogs, DW-024 stabilized the flaky `@smoke` reaction test with `expect.poll`) — no
migration, no new deps, no new architecture-decision row; the M7 wiring audit came
back **clean**. Reviewer APPROVE, 0 fix cycles (two minor non-blocking notes — a
`listThread` head-limit returns the oldest 50 not the latest → logged DW-025; an
unstyled `.adjudicated-note` hook, harmless); `pnpm check` 0, `pnpm test` 783,
`pnpm lint` clean, `@smoke` 4/4 (incl. the stabilized reaction test), `@security`
94/94, on a fresh `supabase db reset`. The milestone's only open follow-up is the
**two outstanding hosted pushes** (`20260617205453_burger_alarms.sql` from TASK-071 +
`20260618120000_burger_verdicts.sql` from TASK-073, to be `supabase db push`ed
together — user's hand, no keep-alive/auto-pause risk). See the M7 progress notes and
M7 close notes below.

Earlier in M7, TASK-075 (in-app "How Top Dog works" help page, PR #84 `f894112`) is a
small static-content close: a pure everyone-facing `/app/help` route
(`(protected)/app/help/+page.svelte`) — **no `load`, no per-user data** — explaining
what members can do, with the **vote system** emphasized (one movable vote, no
self-vote, most votes wins the crown, sticky tie-break, days-as-Top-Dog tally) plus
sections for Top Dog powers, reactions, mustard, walls & DMs, and the 🍔 Hamburger
Court, linked from the app home nav. Because the copy describes live mechanics, every
mechanic-bearing line was cross-checked against source (`voting/ranking.ts`,
`mustard/decay.ts`, `reports/verdict.ts`) — the reviewer independently re-verified
each and found all accurate (sticky tie-break, LIAR/HERETIC branch direction, mustard
~24h, LIAR ~7d, reactions ranking-inert). Static content, XSS-safe (fixed strings, no
`{@html}`), `aria-labelledby` sections, Svelte 5. **No migration / no deps / no schema
→ no hosted-push gate** (the still-open TASK-071/073 two-migration gate is unchanged),
and **no new architecture-decision row** (static content). Reviewer APPROVE, 0 fix
cycles (two trivial stylistic notes, no change); `pnpm test` 778 (no new tests — static
content), `pnpm check` 0, `pnpm lint` clean, `@smoke` 4/4. (See the M7 progress notes
below.)

Earlier in M7, TASK-074 (Top Dog
privileges in-app notice, PR #82 `20adc9a`) is a small crown-holder nudge: when a
member holds the crown, the app home shows a dismissible "👑 Top Dog privileges"
notice listing their powers — adjudicate 🍔 hamburger reports (→ `/app/court`) and
spray mustard (guidance to a member profile). It is gated at the parent page on the
live, server-derived `is_current_top_dog` crown flag (decision #25), so it appears on
gaining the crown and is gone on losing it; the component itself holds no crown logic
(presentational + a client-only dismiss). Dismissal is per-browser `localStorage`
with **no schema, no migration, no `profiles` column** (the AC mandated minimal /
no-schema — chosen over a system DM so no system sender had to be invented), so
**TASK-074 adds nothing to the still-open TASK-071/073 two-migration hosted-push gate**.
Pure UI composition of the existing crown gate — **no new architecture-decision row**.
Reviewer APPROVE, 0 fix cycles (two trivial non-blocking notes, no code change — a
test-count miscount corrected to **8** new dismissal-helper cases, `770 → 778`; an
exported `DISMISSED_KEY` consumed by the test + internally, kept by design); `pnpm
test` 778, `pnpm check` 0, `pnpm lint` clean, `@smoke` 4/4 on a clean run. (See the
M7 progress notes below; DW-024 logs an unrelated `@smoke` reaction-count flake noted
during verification.)

Earlier in M7, TASK-073 (Top-Dog verdict + HAMBURGER LIAR / HERETIC
banners, PR #80 `cdd17ff`) landed the **moderation half of the 🍔 Hamburger
Court**: the **current Top Dog** adjudicates a flagged dog via the
`render_burger_verdict` SECURITY DEFINER RPC and renders a per-dog verdict, with a
consequence on each branch — a `not_a_hamburger` verdict brands every **reporter**
with a render-time HAMBURGER LIAR profile banner (decays ~7 days), a
`confirmed_hamburger` verdict brands the **uploader** with a persistent HAMBURGER
HERETIC banner (derived, no separate table) and converts the dog's decaying
HAMBURGER ALARM into a persistent CONFIRMED HAMBURGER stamp. Unlike the
self-service cosmetic tables (`hotdog_reactions` / `mustard_sprays` /
`wall_messages`, plain owner-scoped RLS), the two new stores (`burger_verdicts`,
`hamburger_liars`) are written **only by the RPC** — they take the votes-style
**no-client-write lockdown** (SELECT-only for `authenticated`, decision #28 grants)
because a LIAR brand is a **server-imposed privileged consequence**, not a member
toggle; the RPC's authorization gates on the **non-client-writable**
`is_current_top_dog` crown column (decision #25), so a member cannot forge a
verdict. The `/app/court` adjudication route is double-gated (UI crown gate +
DB-authoritative RPC gate); the flagged-dog list is an anonymous service-client
aggregate after the gate (preserving TASK-071 reporter anonymity, decision #27).
The report → ALARM → verdict → LIAR/HERETIC loop is now closed. This **composes
existing decisions #12 / #13 / #15 / #25 with no new architecture-decision row**
(recorded as an M7 composition note below). Reviewer APPROVE, 0 fix cycles (two
minor non-blocking notes → DW-022 / DW-023); `pnpm test` 770, `pnpm check` 0,
`pnpm lint` clean, `@smoke` 4, `@security` 94. **Hosted-push gate OUTSTANDING** —
the migration `20260618120000_burger_verdicts.sql` has not been `supabase db
push`ed to hosted; batch it with the still-pending TASK-071 `burger_alarms`
migration (see Process notes). Remaining in M7: TASK-074 (Top Dog privileges
notice), TASK-075 (how-it-works help page), TASK-072 (polish pass). See the M7
progress notes below.

Earlier in M7, TASK-071 (🍔 report-hamburger + HAMBURGER ALARM banners, PR #78
`0089eb2`) landed the **report half of the 🍔 Hamburger Court**: a member taps a
🍔 control on another member's hot dog to flag it as a hamburger, and enough fresh
reports trip a render-time HAMBURGER ALARM (two diagonal police-tape strips, "🍔
HAMBURGER ALARM" + "TOP DOG IS THE ADJUDICATOR", at seeded ±8° angles) across the
offending image on the feed, dog detail, and owner gallery. The new `burger_alarms`
table is a **decision #12 cosmetic / many-allowed table with no denormalized
counter** — structurally ranking-inert (no write path to `vote_count`/`peak_votes`/
crown) — but with **one twist vs. `hotdog_reactions`: the reporter is anonymous.**
The SELECT policy is owner-scoped to the reporter (so a member reads only their own
report rows), and the public per-dog alarm aggregate is computed **server-side with
the service client after the `safeGetSession()` gate**, selecting only
`hot_dog_id, created_at` — reporter ids never reach the client. Reports are
idempotent toggles (report `23505` → benign; retract on zero rows → no-op), the
INSERT `WITH CHECK` pins `reporter_id = auth.uid()` AND blocks reporting your own
dog, and the alarm + banner tilt are computed entirely at render (pure
`summarizeBurgerAlarm` 24h decay + `bannerAngle`). This **composes existing
decisions #12 / #15 / #27(#6) with no new architecture-decision row** (recorded as
an M7 composition note below). Reviewer APPROVE, 0 fix cycles (one minor finding —
missing report/unreport route-action tests — addressed pre-merge); `pnpm test` 710,
`pnpm check` 0, `pnpm lint` clean, `@smoke` 4, `@security` 81. **Hosted-push gate
OUTSTANDING** — the migration `20260617205453_burger_alarms.sql` has not yet been
`supabase db push`ed to hosted (to be pushed together with the TASK-073
`burger_verdicts` migration; see Process notes). See the M7 progress notes below.

Earlier still in M7, **TASK-070** (upload limits enforcement, PR #74 `864b8e2`) landed: upload limits are now
**DB + Storage-API enforced**, not only checked in the SvelteKit form action, so
a direct PostgREST insert (browser publishable key, bypassing the form action)
cannot bypass them. Three hard server-side layers: a Storage API
`file_size_limit = 2 MiB` on both the `hotdogs` and `avatars` buckets (the only
layer that bounds **actual uploaded bytes**), a DB CHECK
(`hot_dogs_byte_size_max`, `byte_size <= 2097152`) bounding the **declared** size
that feeds the decision #11 global storage-sum guard, and a
`hot_dogs_enforce_per_user_cap()` BEFORE INSERT trigger enforcing the
100-per-user cap (decision #10) at the DB — with the existing form-action
size/count checks kept as the friendly UX layer (`MAX_UPLOAD_BYTES = 2097152` is
the TS-side single source of truth, the SQL literal carrying matching
cross-reference comments). This **composes existing decisions #10/#11/#24 with no
new architecture-decision row** (decision #24's column-grant lockdown is
preserved untouched). DW-005's original `byte_size` residual is **substantially
mitigated** (the real-bytes/oversized direction is closed; the global-sum
understatement direction remains an accepted v1 residual, kept tracked). Reviewer
APPROVE, 0 fix cycles; `pnpm test` 626, `pnpm check` 0, `@smoke` 4, `@security` 73.
**Hosted-push gate done (2026-06-17)** — migration `20260617195233_upload_limits.sql`
was `supabase db push`ed to hosted by the user, so the caps are live on hosted (see
Process notes). See the M7 progress notes below.

### Milestone M1 progress notes

1. **Single-use invariant keys on `consumed_at`, not `consumed_by` (TASK-010,
   PR #13).** The `invites` table tracks consumption with two columns; the redeem
   guard and the single-use CHECK key on `consumed_at` (which the FK never nulls),
   while `consumed_by` → `auth.users` uses `on delete set null` for audit only,
   guarded by a one-directional CHECK `(consumed_by is null or consumed_at is not
null)`. An earlier bidirectional CHECK + `on delete set null` pairing both
   blocked deleting any redeemer _and_ would have let a spent token become
   re-redeemable after its redeemer was deleted — caught and fixed in review.
   **Reusable lesson:** single-use guards must key on a column the FK never nulls
   (captured as a [[CLAUDE]] gotcha).
2. **Pre-auth redemption via anon-executable SECURITY DEFINER RPCs.** Redemption
   runs while unauthenticated, so it can't use the inviter's RLS; `redeem_invite`
   / `invite_is_redeemable` (both `search_path=''`, schema-qualified, granted
   `anon` + `authenticated`) are the controlled single-transaction write path —
   reinforcing the project convention that consuming writes go through RPC.
3. **`getServiceClient` M0 seam now partially realized.** The sign-up action's
   orphaned-account cleanup (`getServiceClient().auth.admin.deleteUser` on a
   lost-race redeem failure after a successful `signUp`, so the email stays
   reusable) is the **first real consumer** of the privileged service client —
   the M0 "accepted foundational orphan" is now server-side wired.
4. **New shared `src/lib/image/` seam for client compression (TASK-012, PR #16).**
   WebP compression (decisions #8/#9) landed as `src/lib/image/compress.ts` — a
   feature-agnostic utility placed **parallel to `src/lib/storage/`, deliberately
   NOT under a feature folder**, because both TASK-011 (avatar upload) and TASK-013
   (hot dog upload) consume it. It splits along a pure/canvas seam:
   `fitWithinMaxEdge` is the PURE aspect-preserving downscale (caps the longest
   edge, never upscales, throws on invalid dims), and `compressToWebp`
   type-validates input first, then decodes → resizes on canvas → encodes
   `image/webp` (defaults maxEdge 1280, quality 0.8) with zero new dependencies.
   Like the M0 storage guard, the module is an **accepted foundational orphan** —
   no non-test consumer until TASK-011/013 wire it into the upload paths. Real
   pixel-encoding fidelity (~100–200 KB target) is deferred to the TASK-014
   Playwright `@smoke` (the node Vitest env can't simulate a real canvas); the unit
   tests own the deterministic dimension math, type-rejection, and option flow.
5. **Profile creation + onboarding funnel (TASK-011, PR #18).** Feature module
   `src/lib/features/profiles/` follows the `invites/` shape: a pure `handle.ts`
   validator enforcing the charset `^[A-Za-z0-9_]{2,32}$` at the app boundary (the
   DB CHECK is length-only; casing preserved, uniqueness case-insensitive via
   `citext`), plus typed server wrappers in `profiles.ts`. `createProfile` maps a
   Postgres `23505` unique-violation to a `HANDLE_TAKEN` sentinel keyed on SQLSTATE
   (never constraint text) — best-effort pre-check backed by the authoritative DB
   UNIQUE constraint, mirroring TASK-010's invite pattern. The
   `(protected)/app/+layout.server.ts` load routes a profile-less authenticated
   user to `/app/onboarding` (no redirect loop; unauthenticated → `/sign-in`
   preserved), satisfying "profile row created post-redemption." Onboarding
   validates the handle, defaults `display_name` to the handle if blank, and
   optionally compresses an avatar client-side via `compressToWebp` then uploads it
   to `{uid}/avatar.webp` (owner prefix built from the trusted `user.id`) — the
   **first live consumer of both the image and storage seams**, realizing two of
   the accepted M0/M1 foundational orphans. Upload **fails closed**: a storage
   failure aborts before any profile insert. The PR also hardened `compressToWebp`
   with a `try/finally` so the decoded `ImageBitmap` is always released (resolving
   the TASK-012 bitmap-leak nit, now reachable via its first live consumer).
6. **Hot dog upload + display + delete (TASK-013, PR #20).** Migration
   `20260609181013_hot_dogs.sql` adds the `hot_dogs` table (with `byte_size` and a
   caption-length CHECK ≤280) plus an `app_storage_bytes()` SECURITY DEFINER RPC for
   the global guard. RLS: SELECT for `authenticated` (image **bytes** are protected
   by the private bucket + signed URLs, not row RLS), owner-scoped write via
   `(select auth.uid())`. Counters (`vote_count` / `peak_votes` / `created_at`) are
   made non-client-writable via **column-level privileges on BOTH write paths** —
   `grant update (caption)` and `grant insert (id, owner_id, image_path, caption,
byte_size)` after revoking table-wide write — so a direct PostgREST insert cannot
   forge an opening counter (decision #24). The reviewer caught that the original PR
   restricted only UPDATE, leaving the INSERT path open; the column-level INSERT
   grant closed it. The upload route (`/app/dogs`) compresses client-side, enforces
   the 100-per-user cap, runs `evaluateUpload` (the global guard), uploads to
   `hotdogs/{uid}/{id}.webp` under the trusted owner prefix, then inserts — failing
   closed with a **compensating storage delete** if the insert fails, so no object
   is orphaned. Display lists the owner's dogs with per-row signed URLs (1h TTL,
   per-row graceful degradation); delete removes the row first, then the object. This
   wires `evaluateUpload` / the `$lib/storage` barrel as the storage guard's first
   live consumer, **resolving the last M0 foundational orphan**. Accepted v1
   residual: `byte_size` is a client-supplied soft guard input (a direct insert could
   understate it), so the global guard is best-effort, not a hard quota — carried as
   Discovered Work in [[TASKS]].

### Milestone M1 close notes

M1 delivered the **full vertical slice** end to end: invite-only sign-up +
single-use redemption → profile onboarding (`@handle` + optional avatar) →
client-side WebP compression → hot dog upload to the **private** bucket (per-user
100 cap + global storage guard) → **signed-URL render** → orphan-free delete. The
entire path is gated by a Playwright `@smoke` (TASK-014) that all later milestones
must keep green.

1. **All M0 foundational orphans are now wired.** M0 closed with three exports that
   had no non-test consumer yet — each is now live: `getServiceClient` (TASK-010,
   sign-up orphan-account cleanup), the `$lib/storage` module (TASK-011 avatars +
   TASK-013 hot dogs), and `evaluateUpload` (TASK-013, re-exported from the
   `$lib/storage` barrel as the storage guard's first live consumer). No dead code
   remains from the M0 seam-first approach.
2. **L2 security posture realized at the DB.** The slice lands the project's
   defense-at-the-DB stance concretely: a single-use invite RPC (`consumed_at`
   guard, decisions #22/#23), owner-scoped RLS everywhere via the
   `(select auth.uid())` initplan idiom, **column-level privileges** keeping the
   denormalized counters (`vote_count` / `peak_votes` / `created_at`)
   non-client-writable on both INSERT and UPDATE (decision #24), and storage
   **owner-prefix** policies binding objects to `auth.uid()/...`.
3. **Accepted v1 residual + regression backstop.** One residual is carried into
   v1: `hot_dogs.byte_size` is a client-supplied **soft** storage-guard input (a
   direct insert could understate it), so the global guard is best-effort, not a
   hard quota — accepted under the invite-only trust model and tracked as Discovered
   Work in [[TASKS]]. As the regression backstop, `@smoke` now exercises the live UI
   slice and a sibling `@security` E2E (`tests/db-guards.e2e.ts`) asserts the
   migration-level write guards (forged-counter and oversized-caption inserts both
   rejected) against a live Postgres — guards that unit tests cannot reach.
4. **Accepted minor test-only export (M1 wiring audit).** The milestone wiring
   audit came back clean save for one benign finding: `isValidHandle`
   (`src/lib/features/profiles/handle.ts`) is exported but has **no production
   consumer** — it is exercised only by its own unit tests, while the wired,
   production-used validator is `validateHandle` (the onboarding route). It is a
   redundant one-line sibling predicate
   (`HANDLE_PATTERN.test(normalizeHandle(raw))`), not unwired functionality —
   far more trivial than, but analogous to, the M0 "accepted foundational
   orphans" precedent above. Accepted and documented at M1 close; the optional
   tidy (drop the `export` or remove the redundant predicate) is tracked as
   non-blocking Discovered Work in [[TASKS]].

### Milestone M2 progress notes

1. **Vote RPC — cast/move/remove + drift-free counter + crown (TASK-021, PR #28).**
   Migration `20260610181704_votes_and_vote_rpc.sql` adds the `votes` table
   (`UNIQUE(voter_id)`, one active vote per user — decision #12) with default-deny
   RLS: SELECT-only for `authenticated` and **no client write path** — voting is
   mediated entirely by RPC, and a BEFORE INSERT/UPDATE trigger rejects self-votes
   at the DB. Two SECURITY DEFINER RPCs (`search_path=''`, schema-qualified,
   EXECUTE to `authenticated` only) own all writes: `cast_vote(target_dog uuid)`
   casts-or-moves a vote and `remove_vote()` retracts it, each in one transaction;
   **voter identity is derived from `(select auth.uid())` inside the RPC**, never
   client-supplied. `vote_count` is recomputed authoritatively from the live
   `COUNT(votes)` **inside the transaction** (so it cannot drift under concurrent
   votes — closes adversarial finding B), and `peak_votes` bumped via
   `greatest()`. `recompute_top_dog()` reproduces `selectTopDog`'s total order in
   SQL (`vote_count` DESC → earliest non-null `top_dog_since`, NULL last, sticky →
   ascending `hot_dogs.id`), setting a fresh `now()` only on a new reign — the
   reviewer **empirically confirmed** the SQL stays in lockstep with the TS
   comparator, discharging the forward-looking lockstep constraint from the
   TASK-020 review. The typed wrapper `src/lib/features/voting/votes.ts`
   (`castVote` / `removeVote`) returns a discriminated `VoteResult` with sentinels
   keyed on SQLSTATE (`28000`/`23514`/`P0002`), and is an accepted orphan-by-design
   until route wiring (a later M2 task).
2. **Two L2 fix-cycle security findings closed (TASK-021 review).** (a) The crown
   columns on `profiles` (`is_current_top_dog` / `top_dog_since` /
   `days_as_top_dog`) were client-forgeable — `profiles` had no column-level write
   grants, so a plain PostgREST INSERT/UPDATE could seed or overwrite them. Fixed
   by applying **decision #24's insert+update column-grant pattern** (previously on
   `hot_dogs`) to the `profiles` crown columns — see decision #25. (b)
   `revoke execute ... from public` was insufficient to lock down the private
   `recompute_*` helpers: Supabase explicitly grants EXECUTE on new `public.*`
   functions to `anon` and `authenticated`, so the helpers stayed callable until
   the grant was revoked from `public, anon, authenticated`. Captured as a
   [[CLAUDE]] gotcha for all future SECURITY DEFINER helpers.
3. **Daily Top Dog tally — idempotent at two layers, anon-callable (TASK-022,
   PR #31).** Migration `20260611174243_top_dog_days_and_tally.sql` adds the
   `top_dog_days` table (`profile_id` → `profiles on delete cascade`, `day date`,
   `UNIQUE(profile_id, day)` per decision #14) under default-deny RLS — SELECT-only
   for `authenticated`, **no client write path**. The `tally_top_dog_day()` SECURITY
   DEFINER RPC (`search_path=''`, schema-qualified) finds the current Top Dog, does
   `insert (holder, current_date) on conflict (profile_id, day) do nothing`, then
   recomputes `days_as_top_dog = count(top_dog_days)` **authoritatively (never a
   blind `+1`)** — so re-runs and early triggers can't drift the count, the **same
   drift-free discipline as the TASK-021 vote RPC**. It is a no-op when no current
   Top Dog exists. **The auth model is decision #26 (A1):** the RPC takes **no
   caller input** (`pronargs = 0`) and only ever records the actual current Top Dog's
   `current_date`, so it is EXECUTE-granted to `anon` + `authenticated` and the daily
   keep-alive workflow calls it via PostgREST with the **existing publishable key** —
   deliberately avoiding a new repo secret. The reviewer empirically confirmed it is
   not forgeable and is self-limiting (worst case: an anon caller triggers today's
   idempotent tally early — exactly what the cron does); this sets the auth pattern
   for the M4 mustard-prune job (TASK-042), wired into the same workflow. The tally
   step **fails the workflow on non-2xx**, so a broken tally turns it red (also
   protecting the 7-day auto-pause guarantee). `days_as_top_dog` and `top_dog_days`
   stay non-client-writable (the RPC is the sole writer), verified by 7 live-DB
   `@security` specs (`tests/tally.e2e.ts`). Reviewer APPROVE, 0 fix cycles.
   Test-infra note: `playwright.config.ts` is pinned to `workers: 1` because the
   `@security` suite mutates the global singleton crown against one shared local
   Postgres — default multi-worker parallelism races across spec files (pre-existing
   latent fragility this third crown-mutating spec surfaced).
4. **Top Dog badge UI — read-only, `selectTopDog` lockstep (TASK-023, PR #37).**
   The display layer for the crown the engine maintains, landed with **zero SQL /
   RLS / RPC changes**. New shared component `src/lib/components/TopDogBadge.svelte`
   (👑, `role="status"`, optional `label`); the profile page refactored its inline
   badge to it against the same `profiles.is_current_top_dog` gate, and `/app/dogs`
   grew a badge on the winning-dog tile. The winning dog is resolved by **reusing
   the pure `selectTopDog` comparator** (`$lib/features/voting/ranking.ts`) — the
   load fetches the signed-in user's own profile, maps their dogs to `RankableDog`,
   and runs the same single-source-of-truth seam the vote RPC writes from, so there
   is **no parallel ordering** and the badge stays in lockstep with
   `recompute_top_dog()` (decision #13). Both surfaces derive from live server crown
   state on each load (never cached). +8 test-after unit cases for the load wiring
   (`dogs-action.test.ts`, real `selectTopDog` left unmocked); `pnpm test` 320/320,
   `pnpm check` 0 errors, lint clean, `@smoke` + `@security` (27/27) green. Reviewer
   APPROVE, 0 fix cycles, 2 minor non-blocking notes (unstyled `class="badge"`,
   consistent with the app-wide unstyled markup; a redundant `rankable.length > 0`
   guard before `selectTopDog`).
   **M2 is held open** by the wiring audit, not closed: the vote wrapper
   (`castVote` / `removeVote` in `src/lib/features/voting/votes.ts`) still has **no
   production consumer** — there is no vote-casting UI anywhere in the app, so a
   member cannot actually cast a vote. TASK-021 repeatedly deferred this to "a later
   M2 task" that was never created. A vote-casting UI task must land and re-pass the
   wiring audit before M2 can close (logged as DW-009 in [[TASKS]]).
5. **Vote-casting feed — the missing consumer, closing DW-009 (TASK-024, PR #40).**
   New global feed route `src/routes/(protected)/app/feed/` (`+page.server.ts` load
   - `vote` / `remove` form actions, `+page.svelte` leaderboard/feed UI) consuming
     the previously-orphaned `castVote` / `removeVote` wrappers, plus a new query
     module `src/lib/features/voting/feed.ts` (`listVotableDogs(supabase, viewerId)` —
     self-excluded, owner `profiles` embed, `vote_count` desc → `id` asc, discriminated
     `FeedResult`; and `getCurrentVote(supabase, viewerId)`). **Zero schema / RLS / RPC
     / migration changes and zero new dependencies** — pure consumption of the existing
     vote RPCs, the `selectTopDog`-maintained crown, and the `$lib/storage` signed-URL
     barrel. The **design choice** is that the vote-casting surface is a single global
     feed that **doubles as the live leaderboard** (chosen over a per-profile vote
     button because the app had no discovery path — nowhere to browse other members'
     dogs, so nowhere a vote could originate). It is a UI-surface choice with no new
     invariant, so it is recorded here rather than as an architecture-decision row; the
     authoritative crown remains `recompute_top_dog()`, and the feed ordering merely
     mirrors the leaderboard read. **Security posture (L2), verified at review:** both
     the load and the two actions gate on `safeGetSession()`; the **voter id is never
     client-supplied** (the actions pass only the target dog id and the RPC derives the
     voter from `auth.uid()` — pinned by a `feed-action.test.ts` test); all mutations
     go through the SECURITY-DEFINER RPCs on the RLS-scoped `event.locals.supabase` (no
     direct vote writes); and `VoteResult` sentinels map to friendly `fail()` copy with
     raw Supabase errors logged server-side only (no raw error leakage). The embed is
     normalized for supabase-js's array-vs-object to-one quirk, and the feed degrades
     per-row on a failed signed-URL mint (and to "no current vote" on a read failure)
     rather than blanking. Test-after coverage: `feed.test.ts` (16) + `feed-action.test.ts`
     (18); gates `pnpm test` 354/354, `pnpm check` 0 errors, lint clean, `@smoke` green.
     Reviewer APPROVE, 0 fix cycles, 2 minor non-blocking notes (DW-010 obsolete
     `votes.ts` module-doc comment; DW-011 no `/feed` E2E — accepted tracked gap).

### Milestone M2 close notes

M2 delivered the **complete Voting & Top Dog engine** end to end: a strict
total-order crown comparator (`selectTopDog`), the `cast_vote` / `remove_vote`
SECURITY-DEFINER RPCs as the sole drift-free write path, the idempotent daily
`tally_top_dog_day()` job feeding `days_as_top_dog`, the read-only `<TopDogBadge>`
display layer, and finally the global vote feed that lets a member browse, cast,
move, and remove a vote — so the crown the engine maintains is now driven by real
member votes, not just covered by tests.

1. **The M2-close wiring audit re-passed (DW-009 resolved).** The audit had held
   M2 open because the vote wrappers (`castVote` / `removeVote`) had no production
   consumer — there was no vote-casting surface, so a member could not actually
   cast a vote. TASK-024's `/app/feed` route is that consumer; `castVote` /
   `removeVote` / `listVotableDogs` / `getCurrentVote` are all now wired into a
   production load + form actions. No vote-engine orphan remains.
2. **L2 security held at every layer of the new surface.** The feed reuses the
   project's established posture rather than introducing new trust assumptions:
   `safeGetSession()`-gated load and actions, voter id derived from `auth.uid()`
   inside the RPC (never client-supplied — pinned by a test), all writes through the
   SECURITY-DEFINER RPCs on the RLS-scoped client, sentinel-mapped user messages
   with raw errors logged server-side only. No schema / RLS / RPC change was needed
   to land the consumer safely.
3. **Accepted tracked gap (DW-011).** No E2E exercises the `/feed` route end-to-end
   (cast → move → remove against the live local stack). This is an accepted gap, not
   unwired functionality: the action orchestration is unit-tested and the RLS/RPC
   guarantees are covered by the live-DB `@security` specs (`votes.e2e.ts` /
   `tally.e2e.ts`). A future M2/M3 E2E hardening task is the candidate home.

### Milestone M3 progress notes

1. **Cosmetic reactions — plain owner-scoped RLS, not an RPC (TASK-030, PR #43
   `b27dc63`).** Migration `20260612104439_hotdog_reactions.sql` adds the
   `hotdog_reactions` table (`id` uuid PK, `user_id` → `profiles on delete
cascade`, `hot_dog_id` → `hot_dogs on delete cascade`, `emoji` text,
   `created_at`) with `UNIQUE(user_id, hot_dog_id, emoji)` and a
   `char_length(emoji) <= 16` CHECK. The per-emoji UNIQUE realizes decision #12's
   "many allowed": a user may stack many DISTINCT emojis on one dog, each
   toggling once. RLS is SELECT for `authenticated` and owner-scoped
   INSERT/DELETE via the `(select auth.uid()) = user_id` initplan idiom. **The
   write path is a plain RLS insert/delete, deliberately NOT a SECURITY-DEFINER
   RPC — the inverse of the project's consuming-writes-via-RPC convention.** That
   convention exists to maintain a denormalized counter transactionally;
   reactions have **no counter, no trigger, and nothing that touches
   `vote_count` / `peak_votes` / crown** — counts are computed at read time by
   the pure `summarizeReactions(rows, viewerId)` aggregator. So AC #3 ("reactions
   explicitly do NOT change vote_count or ranking") holds **structurally**, not by
   code discipline: there is no write path that could touch ranking state. This is
   decision #12 implemented (no new decision row); it also means decision #24's
   column-grant lockdown correctly does **not** apply here (the reviewer verified
   `created_at` / `id` are client-insertable but inert — no denormalized column to
   forge). The reusable shape is a **cosmetic / many-allowed table pattern** for
   future flair surfaces (relevant to M6 emoji). New feature module
   `src/lib/features/reactions/` (`emojiSet.ts`, pure `summarize.ts`, server
   `reactions.ts` with a discriminated `ReactionResult`; idempotent
   add — 23505 → benign — and idempotent remove — missing row → no-op) plus
   `src/lib/components/ReactionBar.svelte` (Svelte 5 runes; the picker hides
   already-owned emojis since the owned chip is the un-react affordance), wired
   into `/app/feed`. **Security (L2):** viewer id from `safeGetSession()`, never
   client-supplied (pinned by a hostile-`user_id` test); emoji validated at the
   app boundary twice (action + wrapper, deliberate defense-in-depth); raw errors
   logged server-side only. The interim hardcoded `REACTION_EMOJIS` set is a
   placeholder to be sourced from the M6 emoji library — tracked as DW-012.
   Metrics: `pnpm test` 396 pass; new `@security` live-DB E2E
   `tests/reactions.e2e.ts` (4 cases) proves owner-scoped INSERT RLS rejects
   forging another user's reaction and that insert+delete leaves
   `vote_count` / `peak_votes` unchanged; `@smoke` green, `pnpm check` 0 errors,
   lint clean. Reviewer APPROVE, 0 fix cycles, 2 minor no-change notes.
2. **Per-dog stats — display/wiring only, zero schema change (TASK-031, PR #45
   `e1ffa0e`).** `peak_votes` / `vote_count` already live on `hot_dogs`,
   server-maintained by the M2 vote RPC, so this task surfaces them with **no
   migration, RLS, RPC, or write-path change**. New per-concern query module
   `src/lib/features/hotdogs/detail.ts` (`getDogDetail` → discriminated
   `DetailResult<DogDetail>`, normalized owner `profiles` embed, a
   `DOG_NOT_FOUND` sentinel kept distinct from a real read error) and a new
   route `/app/dogs/[id]`: a `safeGetSession`-gated load mapping not-found →
   `error(404)` and a read error → `error(500)` (raw SDK message logged
   server-side only), the image signed URL minted via `$lib/storage` with
   graceful null degradation, and a **read-only** reaction summary
   (`listReactionsForDogs` + the pure `summarizeReactions`). The page renders a
   larger image, caption, owner link, a **Stats** block (Peak / Current votes),
   and `<TopDogBadge>` when the owner holds the crown. Reactions on the detail
   view are display-only — no react/unreact actions, keeping interactive
   reactions on the feed (decision #12). `voting/feed.ts` gained `peak_votes` as
   an **additive** read-only select field, and the feed + `/app/dogs` tiles grew
   a per-tile `Peak: N` indicator and a "View details" link. **DW-010 folded in**
   (obsolete `votes.ts` module-doc comment corrected, comment-only). Metrics:
   `pnpm test` 420 pass; `@smoke` + `@security` (31) green; `pnpm check` 0
   errors, lint clean. Reviewer APPROVE, 0 fix cycles, 3 minor no-change notes
   (unused-but-parity `viewerId` param; a dead `|| owner.display_name` fallback
   since `handle` is NOT NULL; the missing detail-route E2E). **M3 stays open:**
   DW-011 (the `/app/feed` E2E gap) was promoted into M3 as a new **TASK-032
   (E2E hardening)** that also subsumes this PR's detail-route E2E gap (DW-013)
   and remains the active M3 task.

3. **E2E hardening — the test that surfaced a P0 (TASK-032, PR #47 `5cf5879`).**
   Pure test coverage (zero schema / RLS / RPC / app-code change) promoting DW-011
   (the `/app/feed` E2E gap) and subsuming DW-013 (the detail-route gap). New spec
   `tests/feed-detail.e2e.ts` (`@smoke`) drives a real browser against the **live
   LOCAL stack only** (non-localhost-guarded helper, service key Node-side, unique
   `crypto.randomUUID()` fixtures): a `/app/feed` cast → move → remove asserting
   the **authoritative** `vote_count` + global crown via service-role read-backs;
   the feed react / un-react toggle against authoritative reaction counts;
   `/app/dogs/[id]` non-owner image **render + decode** + signed-URL shape; and a
   **404 on both a non-existent and a malformed id**. Serialized under
   `workers: 1` with `describe.serial` + a per-test crown reset. Running it
   **surfaced a latent P0** — non-owner `hotdogs` images never rendered because
   the loads minted signed URLs with the viewer's owner-only RLS client; the
   `@smoke` suite had masked it by only ever viewing the user's OWN dog. The fix
   landed as TASK-033 in the same PR. The deferred E2E (DW-011) earned its keep.
   Reviewer APPROVE.
4. **P0 fix — non-owner signed-URL rendering + malformed-id 404 (TASK-033, PR #47
   `5cf5879`).** The feed and dog-detail loads minted `hotdogs` signed URLs with
   the **viewer's RLS-scoped client**, but the bucket's only SELECT policy is
   owner-only (`hotdogs_select_own`) and `createSignedUrl` is **RLS-gated at
   creation** — so a non-owner could not mint a URL for another member's dog and
   every non-owned image rendered "Image unavailable." Latent since TASK-024 (the
   feed exists to browse OTHERS' dogs). The storage-baseline migration comment
   ("signed URL bypasses RLS") was wrong about the **creation** side. **Fix
   (user-approved Option 1):** the feed + detail loads now mint `hotdogs` signed
   URLs via the privileged service client (`$lib/server` `getServiceClient()`)
   constructed **after** the `safeGetSession()` gate; the dog / owner / reaction
   **queries stay on the RLS-scoped client**, and the signer only signs
   `image_path` from rows the member's own RLS query already returned (no exposure
   widening). The `/app/dogs` own-dogs gallery correctly stays on the RLS client.
   **Decision #6's privacy model is preserved** (bucket stays private, URLs stay
   1h TTL signed, service client server-only via `$lib/server`); **no storage RLS
   / bucket change.** Also: `/app/dogs/[id]` with a malformed (non-uuid) id now
   returns **404** (was 500) via a new `isUuid()` guard in `$lib/storage/paths.ts`
   (reusing `UUID_RE`) before the DB read; genuine read errors still 500. Lock-in
   unit assertions (`detail-load.test.ts`, `feed-action.test.ts`) pin that the
   signer is the **service client** and NOT `event.locals.supabase` — the test
   that would have caught the original P0. Metrics (after `supabase db reset`):
   `pnpm test` 423/0, `pnpm check` 0 errors, lint clean, `@smoke` 4/0,
   `@security` 31/0. Reviewer APPROVE, 1 fix cycle. Two follow-ups logged as
   Discovered Work (DW-015 direct `isUuid` unit coverage; DW-016 extract the
   shared service-role E2E helpers).

### Milestone M3 close notes

M3 added the **cosmetic-flair and per-dog-stats surfaces** on top of the M2
voting engine, and hardened the feed/detail flows with a live-stack E2E that
immediately paid for itself by catching a P0:

1. **Cosmetic reactions, structurally inert to ranking.** Hot-dog emoji reactions
   (`hotdog_reactions`, many DISTINCT emojis per user, owner-scoped RLS
   insert/delete, render-time counts via the pure `summarizeReactions`) deliver
   decision #12's "many allowed, no ranking effect" — and because the table
   carries **no server-maintained denormalized column**, the "no ranking effect"
   guarantee holds **structurally** (there is no write path that could touch
   `vote_count` / `peak_votes` / crown), not by code discipline. Deliberately a
   plain RLS write, NOT an RPC — the inverse of the consuming-writes-via-RPC
   convention, which only exists to maintain counters transactionally. Captured as
   a reusable [[CLAUDE]] gotcha for future flair surfaces (M6 emoji).
2. **Per-dog stats + a dog detail view, display-only.** `peak_votes` /
   `vote_count` (already server-maintained by the M2 vote RPC) are surfaced on a
   new `/app/dogs/[id]` route (`getDogDetail` query, 404/500 mapping, Stats block,
   read-only reaction summary, `<TopDogBadge>`) and as a per-tile `Peak: N`
   indicator on the feed/`/app/dogs` tiles — **zero schema / RLS / RPC / write-path
   change.**
3. **E2E hardening caught a latent P0.** The promoted DW-011 E2E
   (`feed-detail.e2e.ts`) viewed another member's dog for the first time and
   exposed that non-owner `hotdogs` images never rendered — signed-URL **creation**
   is RLS-gated, so the viewer's owner-only client could not sign another member's
   object. The `@smoke` suite had masked it by only viewing the user's OWN dog. The
   fix (TASK-033, user-approved Option 1) mints those signed URLs server-side with
   the service client **after** the `safeGetSession()` gate, signing only
   already-authorized rows, with **decision #6's private-bucket + TTL model
   preserved** and no storage RLS change. A reusable [[CLAUDE]] gotcha now records
   that `createSignedUrl` is RLS-gated at creation and that cross-member views of
   private-bucket content must sign server-side. A malformed-id `isUuid()` 404
   guard and unit lock-in tests (signer must be the service client) round it out.

See [[Handoffs/handoff-008]] for session context.

### Milestone M4 progress notes

1. **Mustard decay math — pure render-time seam, TDD-first (TASK-040, PR #53
   `5afd0da`).** New pure module `src/lib/features/mustard/decay.ts` mirroring
   the `voting/ranking.ts` shape (**no SvelteKit/Supabase imports**, fully
   unit-testable): `MUSTARD_LIFESPAN_MS = 24h` (single source of truth) and
   `mustardOpacity(sprayedAt, now)` → opacity in `[0,1]` — `1.0` at age 0,
   linear decay to `0.0` across 24h, clamped to `0.0` once expired (never
   negative), with a future-timestamp clock-skew guard clamping to `1.0`. It
   accepts `Date | string | number` (ISO is how a Postgres `timestamptz`
   arrives) and throws on an invalid date. This **realizes decision #15**
   (mustard decays over 24h; opacity computed at **RENDER time** from the stored
   timestamp, no cron for rendering) — a direct implementation of an existing
   decision, so **no new architecture-decision row**. **Zero schema / RLS / RPC
   / migration / dependency change.** TDD-first per decision #2 (mustard decay
   is a named TDD-first spec): co-located `decay.test.ts` with 19 cases (fresh /
   quarter / half / three-quarter life / exact-24h / 48h over-life clamp /
   24h−1ms micro-boundary / clock-skew / `Date`-ISO-epoch input parity /
   invalid-input throws / `[0,1]` sweep). **Orphan-by-design** like
   `voting/ranking.ts` — TASK-041 (spray + render) is the named immediate
   consumer, so **no Discovered Work logged**. One post-approval comment-only
   tidy: a stale `// TDD STUB` header was replaced with a "no non-test caller by
   design" note mirroring `ranking.ts`. Metrics: `pnpm test` 442/442,
   `pnpm check` 0 errors, `pnpm lint` clean. Reviewer APPROVE, 0 fix cycles. M4
   stays open — TASK-041 (spray + render) and TASK-042 (>24h prune job) remain.
2. **Mustard spray + render — cosmetic flair with a Top-Dog `WITH CHECK` gate
   (TASK-041, PR #55 `e1eafb9`).** Migration
   `20260616163055_mustard_sprays.sql` adds the `mustard_sprays` table
   (`id`, `sprayer_id` → `profiles on delete cascade`, `target_profile_id` →
   `profiles on delete cascade`, `x`/`y` `real` in `[0,1]` with range CHECKs,
   `sprayed_at timestamptz`; index on `target_profile_id`;
   `extensions.gen_random_uuid()` schema-qualified per the M0 hosted-parity
   lesson). Like `hotdog_reactions` (decision #12 / TASK-030) it carries **no
   denormalized counter and nothing that touches `vote_count` / `peak_votes` /
   the crown**, so it is a **plain owner-scoped RLS write, the inverse of the
   consuming-writes-via-RPC convention** — the "no ranking effect" half of
   decision #15 holds **structurally**, not by discipline. **The one new wrinkle
   vs the reactions precedent is an authorization conjunct on INSERT:** the
   `mustard_sprays_insert_top_dog` policy is
   `sprayer_id = (select auth.uid()) AND EXISTS (… profiles p where p.id =
(select auth.uid()) and p.is_current_top_dog)` — so **only the current Top
   Dog may spray**, with the sprayer pinned to the caller. **The gate is
   trustworthy because the `is_current_top_dog` column it reads is
   server-maintained and non-client-writable (decision #25)** — a member cannot
   set their own crown to self-satisfy the check. There is **no UPDATE and no
   DELETE policy**: sprays are immutable + persistent across crown changes
   (decision #15), and faded rows are reaped only by the TASK-042 prune job,
   never by the sprayer or target. **Architecture-decision judgment call:** the
   "plain-RLS cosmetic write whose `WITH CHECK` authorizes against a
   server-maintained, non-client-writable column to gate a privileged-but-cosmetic
   write" is a **reusable technique layered on existing decisions #12/#15/#25**,
   not a new product/architecture invariant — so it is captured as a reusable
   [[CLAUDE]] **gotcha** (extending the existing "Cosmetic / many-allowed tables"
   gotcha) rather than a new decision row. Future privileged-flair surfaces (e.g.
   an M5 "only Top Dog can …" gate) reuse the same shape. **Render wiring**
   consumes the TASK-040 seam: `src/lib/features/mustard/sprays.ts` (`addSpray`
   / `listSpraysForProfile` on the RLS-scoped client, discriminated
   `SprayResult<T>`, `42501` → `NOT_TOP_DOG` / `23514` → position error, last-24h
   read filter via `MUSTARD_LIFESPAN_MS`) wires the previously-orphan-by-design
   `mustardOpacity` / `MUSTARD_LIFESPAN_MS`, and the profile page
   (`(protected)/app/profile/[handle]/`) renders an absolutely-positioned mustard
   overlay at `opacity = mustardOpacity(sprayed_at, now)` (render-time decay; the
   DB stores only the raw timestamp) with a click-to-spray affordance gated on the
   viewer's own `canSpray`. **Trust boundaries (L2, verified at review):** sprayer
   from `safeGetSession()`, target from the trusted `params.handle`, only `x`/`y`
   from the form (validated at the `addSpray` boundary + DB CHECK backstop); the
   Top-Dog gate is RLS-enforced and not bypassable (non-Top-Dog rejected, forged
   `sprayer_id` rejected, gate column not self-satisfiable), with cross-crown
   persistence proven by a byte-for-byte deep-equal E2E assertion. Standard
   implementer-first, test-after; coverage: `sprays.test.ts`,
   `spray-action.test.ts`, updated `profile-load.test.ts`, live-DB
   `tests/mustard.e2e.ts` (`@security`, 5 new RLS cases). One minor non-blocking
   finding logged as **DW-017** (a missing `x`/`y` coerces to `0` and sprays at
   `(0,0)` instead of returning 400 — cosmetic-only, Top-Dog-gated, pinned by a
   unit test). Metrics: `pnpm test` 481/481, `pnpm check` 0 errors,
   `pnpm lint` clean, `@security` 36, `@smoke` 4. Reviewer APPROVE, 0 fix cycles.
   **M4 stays open — TASK-042 (>24h prune job) remains;** its migration + prune
   RPC must be `supabase db push`ed to hosted before the prune step ships (the
   2026-06-16 hosted-drift lesson).
3. **Mustard prune job — the sole DELETE path, anon-callable + idempotent
   (TASK-042, PR #57 `6452407`).** Migration
   `20260616170706_mustard_prune.sql` adds `public.prune_mustard_sprays()`
   (`security definer`, `search_path=''`, schema-qualified) which deletes
   `mustard_sprays where sprayed_at < now() - interval '24 hours'` and returns
   the pruned count, plus a btree index on `sprayed_at` so the daily DELETE
   range-scans only the expired tail. **It is the only DELETE path the table
   has:** TASK-041 gave `mustard_sprays` no client UPDATE/DELETE policy (sprays
   are immutable + persistent — decision #15), so this SECURITY DEFINER function
   bypasses RLS to reap faded rows, **exactly as `tally_top_dog_day()` is the
   sole writer of `top_dog_days`** — a privileged scheduled RPC owning the one
   write the client cannot do. **Auth is decision #26 applied to a destructive
   job:** the RPC takes **no caller input** (`pronargs = 0`) and its predicate is
   fixed to rows provably >24h old — already opacity-0 / invisible per
   `mustardOpacity` — so it is idempotent (a re-run prunes 0), **not forgeable**
   (a caller cannot direct it at a specific or fresh spray; it deletes exactly
   the cron's expired set), and self-limiting (worst case deletes only
   already-invisible rows). That is why an **anon DELETE** is safe here where an
   arbitrary client DELETE would not be: granting `anon` EXECUTE widens no real
   capability, so the keep-alive workflow calls it with the **existing publishable
   key — no new repo secret** (after `revoke execute … from public` then grant to
   `anon, authenticated`, the same Supabase-grant gotcha as the tally/vote RPCs).
   This extends decision #26 from a recording job to a cleanup job — **no new
   decision row**. `.github/workflows/keepalive.yml` gains a third step
   ("Prune mustard sprays (>24h, idempotent)") after the tally, structurally
   identical to it — PostgREST RPC POST with **fail-on-non-2xx** so a broken
   prune turns the workflow red (preserving the auto-pause-guard + tally + prune
   three-job daily shape). Standard implementer-first, test-after; new live-DB
   spec `tests/mustard-prune.e2e.ts` (`@security`, 4 cases: deletes >24h / keeps
   fresh, anon-callable, idempotent, no-input/not-forgeable). Metrics:
   `pnpm test` 481/481, `pnpm check` 0 errors, `pnpm lint` clean, `@security` 40
   (incl. the 4 new prune cases), `@smoke` 4. Reviewer APPROVE, 0 fix cycles.
   **This closes M4.** Hosted-push gate: the `mustard_sprays` + `mustard_prune`
   migrations must be `supabase db push`ed to hosted before the next scheduled
   keep-alive run or the prune step 404s (the 2026-06-16 hosted-drift class — see
   Process notes).

### Milestone M4 close notes

M4 — Mustard Mechanic delivered the **full mustard mechanic end to end**: the
pure render-time decay seam, the Top-Dog-gated spray + render on profiles, and
the daily >24h prune job that bounds table growth — all built on existing
decisions (#12 cosmetic-write, #15 mustard, #25 non-client-writable crown
columns, #26 anon-callable idempotent jobs) with **no new
architecture-decision row** needed.

1. **A pure decay seam, then its consumer (decisions #15 + #2).** TASK-040
   landed `mustardOpacity` / `MUSTARD_LIFESPAN_MS` in
   `src/lib/features/mustard/decay.ts` as a pure, TDD-first render-time seam
   (full → 0 over 24h, clock-skew clamped) mirroring `voting/ranking.ts` — the
   single source of truth for how a spray fades, with **no schema/RLS/RPC
   change**. TASK-041 then wired it: the profile page renders each spray at
   `opacity = mustardOpacity(sprayed_at, now)`, so the DB stores only the raw
   timestamp and the drip is computed entirely at render (decision #15 — no cron
   for rendering).
2. **Cosmetic flair with a privileged authorization conjunct.** The
   `mustard_sprays` write is a **plain owner-scoped RLS insert, NOT an RPC** —
   the deliberate inverse of the consuming-writes-via-RPC convention, like
   `hotdog_reactions`, because the table carries no denormalized counter, so the
   "no ranking effect" half of decision #15 holds **structurally**. The one
   wrinkle is an INSERT `WITH CHECK` that gates spraying to the **current Top Dog**
   by reading `is_current_top_dog` — trustworthy precisely because that column is
   server-maintained and non-client-writable (decision #25), so a member cannot
   self-satisfy the gate. This "plain-RLS cosmetic write authorized against a
   non-client-writable column" was captured as a reusable [[CLAUDE]] gotcha
   (extending the cosmetic-table gotcha), not a new decision row — a technique
   layered on #12/#15/#25.
3. **The prune job completes the loop with a destructive twin of the tally.**
   Sprays are immutable + persistent (no client UPDATE/DELETE), so the daily
   `prune_mustard_sprays()` SECURITY DEFINER RPC is their **sole DELETE path**,
   structurally paralleling `tally_top_dog_day()` as the sole writer of
   `top_dog_days`. It applies decision #26 to a destructive op: no caller input,
   deletes only provably-expired (invisible) rows, so anon-callable / idempotent
   / not-forgeable — wired into the same keep-alive workflow with fail-on-non-2xx,
   no new secret.
4. **Hosted-push gate (PENDING at M4 close).** TASK-041/042 add two migrations
   (`mustard_sprays`, `mustard_prune`) and a new scheduled prune step. Per the
   2026-06-16 hosted-drift lesson, those migrations MUST be `supabase db push`ed
   to hosted **before the next scheduled keep-alive run**, or the prune step 404s
   exactly as the M2/M3 migrations did. As of this writing the push has not been
   done — the director surfaces it to the user as a post-merge ops step (see
   Process notes).

### Milestone M5 progress notes

1. **Message walls — another cosmetic / many-allowed table, plain owner-scoped RLS
   (TASK-050, PR #60 `d3c7a4d`).** Migration `20260616184139_wall_messages.sql` adds
   the `wall_messages` table (`id` uuid PK `extensions.gen_random_uuid()`
   schema-qualified per the M0 hosted-parity lesson; `profile_id` wall-owner FK and
   `author_id` poster FK both → `profiles on delete cascade`; `body` text storing the
   **ORIGINAL** message with a `char_length(body) <= 1000` CHECK; `created_at`; index
   on `profile_id`). Like `hotdog_reactions` (decision #12 / TASK-030) and
   `mustard_sprays` (TASK-041), it carries **no denormalized counter and nothing that
   touches `vote_count` / `peak_votes` / the crown**, so it is a **plain owner-scoped
   RLS write, the deliberate inverse of the consuming-writes-via-RPC convention** —
   decision #12 implemented, **not a new architecture-decision row**. Decision
   #24/#25's column-grant lockdown correctly does **not** apply (`created_at` / `id`
   are client-insertable but inert — there is no server-maintained column to forge).
   RLS via the `(select auth.uid())` initplan idiom: SELECT for all `authenticated`
   members (any member reads any wall, like the global feed); INSERT
   `with check (author_id = (select auth.uid()))` so the author is **un-forgeable**;
   DELETE `using (author_id = (select auth.uid()) OR profile_id = (select auth.uid()))`
   — **either the message author or the wall owner** may remove a message (a two-principal
   moderation path, the one twist vs. the single-owner reactions/sprays precedents);
   and **no UPDATE policy** (messages are immutable). The **store-ORIGINAL-body
   invariant** is deliberate: it keeps the **M6 emoji render-time filter** free to
   apply at render later (never persist the filtered text), mirroring the mustard /
   emoji render-time discipline. New feature module
   `src/lib/features/walls/walls.ts` — discriminated `WallResult<T>` wrappers:
   `postWallMessage` (boundary-validates non-empty + ≤1000, author derived from the
   session), `listWallMessages` (latest 50, `created_at` desc, normalizes the
   array-vs-object author embed), `deleteWallMessage`; SQLSTATE-keyed sentinels, raw
   errors logged server-side only. Wired into the **existing** profile route
   (`(protected)/app/profile/[handle]/+page.server.ts` wall load + `post` /
   `deleteMessage` actions, `safeGetSession()`-gated, author/wall-owner from the
   session / route param and never client input; `+page.svelte` wall render + post box
   - delete affordance shown only to the author or wall owner) — the **existing mustard
     spray UI is preserved**. **Security posture (L2), verified at review:** the INSERT
     author pin is un-forgeable (forge → `42501`, pinned by a live E2E); DELETE is scoped
     to the stored row (no client-widenable path); the body is stored verbatim and
     rendered through Svelte auto-escaping (no `{@html}` → no XSS). **Zero new
     dependencies and no new discovered work** surfaced by the reviewer. Coverage:
     `walls.test.ts`, `wall-action.test.ts`, live-DB `@security` `tests/walls.e2e.ts`
     (7 RLS specs), plus a stale-test fix to `profile-load.test.ts`. Metrics at merge:
     `pnpm test` 514 pass, `pnpm check` 0 errors, lint clean (modulo a pre-existing,
     director-owned `TASKS.md` Prettier warning), `@smoke` 4, `@security` 47. Reviewer
     APPROVE, 0 fix cycles. **M5 stays open — TASK-051 (direct messages) remains;** this
     migration must be `supabase db push`ed to hosted per the 2026-06-16 hosted-drift
     lesson.
2. **Direct messages — the same cosmetic-table shape with a privacy boundary (TASK-051,
   PR #62 `4ac8ff8`).** Migration `20260616191804_dms.sql` adds the `dms` table
   (`sender_id` / `recipient_id` → `profiles on delete cascade`, `body` ≤2000 CHECK,
   `created_at`, nullable `read_at`; conversation-lookup index). Like `wall_messages` it
   carries **no denormalized counter**, so the base write is a **plain owner-scoped RLS
   write** (decision #12) — **not a new decision**. The two wrinkles vs. the public wall
   are both **reuses, not new decisions**: (1) **privacy RLS** — SELECT scoped to a
   conversation participant (`sender_id = (select auth.uid()) OR recipient_id = (select
auth.uid())`), INSERT pins the sender un-forgeably, no DELETE (DMs immutable); (2) the
   **`read_at`-only mutation boundary applies the decision #24 column-grant mechanism** —
   the recipient-only UPDATE policy plus a column-level `grant update (read_at)` (after
   revoking table-wide UPDATE) means even the recipient cannot rewrite `body` / `sender_id`
   / `recipient_id` / `created_at`. Same mechanism as the denormalized-counter lockdown,
   applied to a privacy column. New `src/lib/features/dms/` module with the **pure
   `summarizeConversations`** aggregator (render-time inbox collapse — preview + unread
   count, no stored counter, mirroring `summarizeReactions`), wired into `/app/messages`
   (inbox) + `/app/messages/[handle]` (thread), plus a "Message @handle" button and nav
   link. **Security (L2):** sender pin un-forgeable, privacy SELECT scope and `read_at`-only
   column grant both proven by live E2E. Zero new deps, no new discovered work. Metrics:
   `pnpm test` 540, `@security` 54, `@smoke` 4, `pnpm check` 0 errors, lint clean. Reviewer
   APPROVE, 0 fix cycles.
3. **Data API grant regression — auto-expose flip remediated (TASK-052, PR #66
   `18f9baa`).** A **P0 mid-milestone hotfix** for a project-wide regression: on 2026-05-30
   the Supabase CLI's `auto_expose_new_tables` default flipped to `false`, so a fresh
   `supabase db reset` stopped issuing the **implicit base table GRANTs** the schema had
   silently relied on since M0. PostgREST authorizes in **two layers** — a passing RLS
   policy is necessary but not sufficient; the role also needs the base `GRANT` — so with
   the implicit grants gone, `@smoke`/`@security` went RED and the real `createInvite()`
   path returned `permission denied`, even though nothing in the diff had changed
   (root-caused + scoped by a read-only architect dispatch). Fix: new idempotent migration
   `20260617000000_restore_data_api_grants.sql` restoring **exactly what auto-expose used
   to provide** (authenticated SELECT on all 9 tables; INSERT/DELETE only on the
   counter-free cosmetic tables; DELETE on `hot_dogs`; service_role full DML; **anon
   nothing**) while **preserving every existing lockdown** — no table-wide write re-granted
   on `profiles` / `hot_dogs` / `dms` (decision #24/#25 intact), no write on `votes` /
   `top_dog_days` (decision #12 RPC-only). Plus `auto_expose_new_tables = false` is now
   **pinned in `supabase/config.toml`** so local matches cloud and the permanent
   post-2026-10-30 platform behavior. The grant model is now **explicit** — recorded as
   **decision #28**. 0 production fix cycles (2 stale `@security` assertions updated to the
   stronger grant-layer `42501` behavior). Metrics: `pnpm test` 573, `@security` 57,
   `@smoke` 4. Reviewer APPROVE.
4. **Grant-invariant verification guard (TASK-053, PR #68 `7603438`).** The regression
   backstop for TASK-052: a checked-in `@security` spec `tests/grants.e2e.ts` (11 cases)
   asserting the **required AND forbidden** grant matrix against the live local Postgres,
   so a future `supabase db reset` or stray `GRANT` edit can't silently re-drift and quietly
   re-break a path. Focused on the gaps the existing specs don't cover — **`anon` has
   nothing** (zero-row SELECT + `42501` INSERT on all 9 tables, **every table seeded** so
   the assertion is non-vacuous), **`authenticated` cannot write `votes` / `top_dog_days`**
   (`42501`), plus consolidated positive base-grant checks. Pure test coverage (zero
   schema / RLS / RPC / app-code change). 1 fix cycle (3 findings: dropped a duplicate
   `dms.read_at` case owned by `dms.e2e.ts`, de-vacuumed the anon-SELECT by seeding all 9
   tables, hardened crown cleanup to clear-first + `finally`). **Closes M5.** Metrics:
   `pnpm test` 573, `@security` 68, `@smoke` 4, `pnpm check` 0 errors, lint clean. Reviewer
   APPROVE.

### Milestone M5 close notes

M5 — Walls & DMs delivered **two new social surfaces** (profile message walls and
private direct messages) and, mid-stream, **absorbed and remediated a project-wide Data
API grant regression** that the auto-expose default flip exposed. The two features shipped
**entirely on existing decisions** — no new architecture-decision row for either; the
grants hotfix did warrant one (**decision #28**), because it converts an
implicit-platform-behavior dependency into an explicit, committed, tested invariant.

1. **Walls + DMs are both decision #12 cosmetic-table writes.** `wall_messages` (TASK-050)
   and `dms` (TASK-051) join `hotdog_reactions` and `mustard_sprays` as **plain
   owner-scoped RLS writes with no denormalized counter**, the deliberate inverse of the
   consuming-writes-via-RPC convention. Both **store the original body verbatim** (so the
   M6 emoji render-time filter stays free to apply later) and derive any aggregate at read
   time (the pure `summarizeConversations` inbox collapse mirrors `summarizeReactions`).
   The only new shapes — the wall's **two-principal delete** (author OR wall owner), the
   DM's **conversation-scoped privacy SELECT**, and the DM's **`read_at`-only column grant**
   (decision #24's mechanism applied to a privacy column rather than a counter) — are all
   **reuses of existing mechanisms**, captured in the per-task notes, not new decisions.
2. **A grant regression turned the suite red — and exposed an implicit dependency.** The
   2026-05-30 `auto_expose_new_tables` flip stopped a fresh `supabase db reset` from
   issuing the implicit base table GRANTs the schema had leaned on since M0. Because
   PostgREST needs the base `GRANT` **in addition to** a passing RLS policy, the real
   invite path broke with `permission denied` while every RLS policy was intact — a failure
   that looked like nothing had changed. Root-caused by a read-only architect dispatch and
   fixed by the `restore_data_api_grants` migration (TASK-052), which makes the grant model
   **explicit and committed** while preserving the decision #24/#25 column lockdowns and the
   decision #12 RPC-only write paths, and pins `auto_expose_new_tables = false` so local
   matches cloud. **Decision #28** records the new invariant; TASK-053's `tests/grants.e2e.ts`
   guard locks it in so a future reset can't silently re-drift.
3. **Hosted-push gate (DEFERRED to TASK-054, user-gated ops).** M5 adds **three** unpushed
   migrations — `20260616184139_wall_messages.sql`, `20260616191804_dms.sql`, and
   `20260617000000_restore_data_api_grants.sql` — that must reach hosted in a **single**
   `supabase db push` (the grant fix matters on hosted too: any table pushed after 2026-05-30
   may be ungranted). Unlike M2/M3/M4, **no keep-alive step depends on these RPCs/tables**, so
   the delay carries **no auto-pause risk** — which is why the push was deferred out of the
   milestone as a user-gated ops follow-up rather than a close blocker. Tracked as **TASK-054**
   in [[tasks/deferred]]; see Process notes.

### Milestone M6 progress notes

1. **Emoji filter + sprinkle — pure render-time seam, TDD-first (TASK-060, PR #71
   `a2e309d`).** New dependency-free feature folder `src/lib/features/emoji/` realizing
   **decision #16** (hot-dog-only library; filter at **RENDER** time; the ORIGINAL stored
   body is NEVER mutated) — a direct implementation of an existing decision, so **no new
   architecture-decision row**. `emojiSet.ts` exports the curated `HOTDOG_EMOJIS`
   (`🌭 🥖 🌮 🥨 🧂 🍟 🔥`, deliberately **single-codepoint / modifier-free** so each member
   is always exactly one grapheme cluster — the invariant both transforms rely on) plus
   `isHotdogEmoji(grapheme)`. `filter.ts` exports two pure functions: `filterToHotdog(text)`
   replaces every **non-library** emoji with a hot-dog emoji, iterating by grapheme
   **CLUSTER** via `Intl.Segmenter` so ZWJ sequences, skin-tone modifiers, and
   regional-indicator flags are matched as one unit and **never split mid-codepoint** (emoji
   detected via `\p{Extended_Pictographic}` OR `\p{Regional_Indicator}`, since flags are
   built from regional indicators that aren't themselves Extended_Pictographic); and
   `sprinkleHotdog(text, seed, opts?)` deterministically sprinkles library emoji using a
   **hand-written `mulberry32` PRNG — zero dependencies** (same `(text, seed)` → identical
   output), only ever **ADDING** library emoji and never removing/reordering existing
   tokens. Both return a new string and never mutate the input. **Zero schema / RLS / RPC /
   migration / dependency change.** **TDD-first** per decision #2 (emoji replacement +
   sprinkle is a named TDD-first spec): RED → GREEN → verify, covering mixed-emoji input,
   no-emoji passthrough, and sprinkle determinism. Like `voting/ranking.ts` and
   `mustard/decay.ts` it is **orphan-by-design** — **no production consumer yet**; the filter
   is wired into walls/DM render by **TASK-061**, so **no Discovered Work is logged for the
   missing consumer**. Two **non-behavioral pre-merge cleanups** (neither a bug): stale TDD
   "STUB" banner comments removed, and a dead `_SPRINKLE_SOURCE` export the reviewer flagged
   was dropped. One **non-blocking, forward-looking reviewer finding logged as DW-019**:
   exact-string membership in `isHotdogEmoji` means a VS16-decorated variant of a library
   emoji (e.g. `🔥` + U+FE0F) is replaced with `🌭` rather than preserved — benign against the
   AC, and the right place to DECIDE intended behavior is TASK-061 when real user content
   flows through the filter. Metrics: `pnpm test` 603/603, `pnpm check` 0 errors,
   `pnpm lint` clean. Reviewer APPROVE, 0 fix cycles. **M6 stays open — TASK-061 (apply the
   filter in walls/DM render) remains.**
2. **Apply the emoji filter in walls/DM render — the consumer, closing M6 (TASK-061, PR #72
   `3d85087`).** New pure composition layer `src/lib/features/emoji/render.ts` (no
   SvelteKit/Supabase imports, unit-testable in isolation) wires the previously
   orphan-by-design TASK-060 seam into the live render surfaces, realizing the consumer half
   of **decision #16** (filter at RENDER time; the ORIGINAL stored body is NEVER mutated) —
   **no new architecture-decision row**. It exposes two render functions encoding a deliberate
   **wall-vs-DM split**: `renderWallBody(body, id)` = `sprinkleHotdog(filterToHotdog(body),
stringToSeed(id))` (walls get **filter + seeded sprinkle**) and `renderMessageBody(body)` =
   `filterToHotdog(body)` (DM thread + inbox preview get **filter only** — the random hot-dog
   sprinkle is scoped to WALL messages by TASK-060's AC). The sprinkle seed is a hand-written
   **FNV-1a `stringToSeed`** (zero dependencies) over the message's **immutable uuid `id`**, so
   a given wall message sprinkles the **same** way on every re-render (no per-render jitter) —
   the stable counterpart to TASK-060's deterministic `mulberry32`. Wired into **three
   components**: the wall (`profile/[handle]/+page.svelte`), the DM thread
   (`messages/[handle]/+page.svelte`), and the DM inbox preview (`messages/+page.svelte`), all
   keeping the body inside Svelte **auto-escaped text** (no `{@html}` → rendering hot-dog emoji
   is **XSS-safe**). Because the filter/sprinkle output is only ever a render-time return value
   (never written back), decision #16's "store original" guarantee holds **structurally** —
   there is no persist path that could mutate the stored body. **Zero server / DB / RLS / RPC /
   migration / dependency change.** **DW-019 resolved (accepted):** the `render.ts` header
   comment documents the accepted decision that a VS16-decorated library emoji (e.g. `🔥` +
   U+FE0F) is replaced with `🌭` rather than preserved — benign, output is still a hot-dog
   emoji, so no grapheme-normalization pass is warranted. **One accepted tracked test gap
   logged as DW-020:** no E2E asserts the browser-rendered wall/DM DOM shows the FILTERED body
   (the store-original half is covered by `tests/walls.e2e.ts`'s verbatim-body test and the
   render wiring by `render.test.ts`), a sibling of DW-011/DW-013. Standard implementer-first,
   test-after: `render.test.ts` adds 19 unit cases. Metrics: `pnpm test` 622/622, `pnpm check`
   0 errors, `pnpm lint` clean, `@smoke` 4/4. Reviewer **APPROVE, 0 production fix cycles** (2
   minor non-blocking test-strength notes only). **This closes M6.**

### Milestone M6 close notes

M6 — Emoji library delivered the **hot-dog emoji rendering mechanic end to end**: a pure,
dependency-free render-time filter + deterministic sprinkle (TASK-060), then its wiring into
every user-text surface (TASK-061). Both tasks shipped **entirely on existing decision #16**
— **no new architecture-decision row** — extending the project's established pure-logic-first
seam pattern (`voting/ranking.ts`, `mustard/decay.ts`) one more time.

1. **A pure transform seam, then its render-time consumer (decisions #16 + #2).** TASK-060
   landed the curated hot-dog `HOTDOG_EMOJIS` library plus `filterToHotdog` (grapheme-cluster
   safe via `Intl.Segmenter`, so ZWJ / skin-tone / flag sequences are never split mid-codepoint)
   and `sprinkleHotdog` (deterministic via a hand-written `mulberry32` PRNG, zero deps) as a
   TDD-first **orphan-by-design** module. TASK-061's `render.ts` is the consumer: `renderWallBody`
   composes filter + a **seeded** sprinkle (FNV-1a over the message's immutable uuid, so renders
   are stable), `renderMessageBody` applies filter only — the **wall-vs-DM split** that scopes the
   random sprinkle to walls per TASK-060's AC. The filter now runs on the profile wall, the DM
   thread, and the DM inbox preview.
2. **Decision #16's "store original" holds structurally, and the render is XSS-safe.** Because the
   M5 social surfaces store the body **verbatim** (`wall_messages` / `dms`) and the emoji transform
   is a pure render-time return value that is never written back, there is **no persist path that
   could corrupt the stored text** — the "store original, filter at render" guarantee is structural,
   not a code-discipline promise. All three components render through Svelte **auto-escaped text**
   (no `{@html}`), so emitting hot-dog emoji introduces **no XSS surface**. Zero server / DB / RLS /
   RPC / migration / dependency change across the whole milestone.
3. **Two accepted, documented dispositions.** **DW-019** (VS16-decorated library emoji replaced with
   `🌭` rather than preserved) is **resolved/accepted** in TASK-061 — the output is still a hot-dog
   emoji, benign against decision #16, recorded in the `render.ts` header comment. **DW-020** (no E2E
   asserts the browser-rendered wall/DM DOM shows the filtered body) is an **accepted tracked gap**, a
   sibling of DW-011/DW-013 covered at the unit/store-original layers, a candidate for a future M6/M7
   E2E hardening task. Minor accepted observation: the `HotdogEmoji` type alias
   (`src/lib/features/emoji/emojiSet.ts`) is a zero-runtime, type-only export with no external
   consumer — kept for API symmetry, analogous to the M1 `isValidHandle` minor; not worth a DW item.

### Milestone M7 progress notes

1. **Upload limits hardened at the DB + Storage API (TASK-070, PR #74 `864b8e2`).**
   The upload limits were previously enforced only in the SvelteKit form action,
   so a direct PostgREST insert with the browser publishable key (bypassing the
   form action) could sidestep them. TASK-070 moves enforcement to the
   authoritative boundary in **three hard server-side layers**: (1) a Storage API
   `file_size_limit = 2 MiB` on **both** the `hotdogs` and `avatars` buckets
   (migration `20260617195233_upload_limits.sql`) — the **only** layer that bounds
   the **actual uploaded bytes**, rejecting an oversized object regardless of what
   the client declares; (2) a DB CHECK `hot_dogs_byte_size_max`
   (`byte_size <= 2097152`) bounding the **declared** size column that feeds the
   decision #11 global storage-sum guard; and (3) a
   `hot_dogs_enforce_per_user_cap()` **BEFORE INSERT trigger** enforcing the
   100-per-user cap (decision #10) at the DB. The form action keeps a friendly
   early `fail(400)` on `photo.size > MAX_UPLOAD_BYTES` and the existing count
   check as the **UX layer**, with the DB as the authoritative backstop.
   **Trigger over RPC for the count cap:** the cap is a per-row admission
   invariant on the plain owner-scoped INSERT path (hot-dog upload writes through
   RLS, not a consuming-writes RPC — no denormalized counter to maintain), so a
   BEFORE INSERT trigger enforces it in place rather than rerouting the upload
   write path through an RPC. The trigger function is SECURITY DEFINER,
   `search_path=''`, schema-qualified, locked down with
   `revoke execute … from public, anon, authenticated`.
   **Single source of truth across the SQL/TS boundary:** `MAX_UPLOAD_BYTES =
2097152` (2 MiB) is the TS-side constant in
   `src/lib/features/hotdogs/hotdogs.ts`; SQL can't import it, so the migration
   carries the literal with cross-reference comments in **both** directions and a
   unit test pins the value to catch drift. **No new architecture-decision row** —
   this **composes** decisions #10, #11, and #24 (whose column-grant lockdown it
   **preserves and does not touch**) under the L2 defense-at-the-DB posture.
   DW-005's `byte_size` residual is **substantially mitigated** (the
   real-bytes/oversized direction closed; the global-sum understatement direction
   remains an accepted v1 residual, kept tracked in [[tasks/discovered]]). An
   avatar-symmetry follow-up (no friendly form-action size pre-check on the avatar
   path; within AC, unreachable in practice) is logged as DW-021. Metrics:
   `pnpm test` 626, `pnpm check` 0, lint clean, `@smoke` 4, `@security` 73 (5 new
   live-DB cases in `tests/db-guards.e2e.ts`). Reviewer **APPROVE, 0 fix cycles**.
   **Hosted-push gate pending** (see Process notes).

2. **🍔 report-hamburger + HAMBURGER ALARM banners (TASK-071, PR #78 `0089eb2`).**
   The **report half of the 🍔 Hamburger Court**: a member taps a 🍔 control on
   ANOTHER member's hot dog to flag it as a hamburger, and enough fresh reports trip
   a render-time HAMBURGER ALARM — two diagonal police-tape strips ("🍔 HAMBURGER
   ALARM" + "TOP DOG IS THE ADJUDICATOR", seeded ±8° tilts) across the offending
   image on the feed, dog detail, and owner gallery. New table `burger_alarms`
   (migration `20260617205453_burger_alarms.sql`): `reporter_id` → profiles,
   `hot_dog_id` → hot_dogs, `UNIQUE(reporter_id, hot_dog_id)` (one report per member
   per dog; many DIFFERENT members may report the same dog — that "many" trips the
   alarm), **no denormalized counter**, decision #28 base grants. New
   dependency-free feature folder `src/lib/features/reports/`: pure
   `summarizeBurgerAlarm` (24h render-time decay + `none/low/medium/high` intensity,
   like `mustard/decay.ts`) and `bannerAngle` (seeded ±8° via FNV-1a + mulberry32,
   mirroring the emoji PRNG, stable per `(dog, label)` so banners never jitter), plus
   idempotent `reportBurger` / `unreportBurger` wrappers (reporter from `auth.uid()`)
   and the anonymity-preserving reads. The `HamburgerAlarmBanner` overlay is XSS-safe
   (fixed labels, no `{@html}`).
   **Anonymity — the one twist vs. `hotdog_reactions`:** where reactions read
   SELECT-all (anyone sees who reacted), `burger_alarms` narrows SELECT to
   **owner-scoped** (`(select auth.uid()) = reporter_id`), so a member reads only
   their own report rows and can never read who else reported. The viewer's toggle
   state comes from that RLS-scoped read (`getMyReportedDogIds`, anonymity-safe by
   construction); the **public per-dog alarm aggregate** is read **server-side with
   the service client AFTER the `safeGetSession()` gate** (`getBurgerAlarmCounts`),
   selecting only `hot_dog_id, created_at` — never `reporter_id` — so a reporter's
   identity never enters the server's working set, let alone the page payload.
   **Security (L2):** INSERT `WITH CHECK` pins `reporter_id = auth.uid()` AND a
   `NOT EXISTS` blocks reporting a dog you own; `42501` → friendly `CANNOT_REPORT_OWN`,
   `23505` → benign idempotent toggle-on, retract on zero rows → no-op; raw errors
   logged server-side only. Pinned by unit tests (pure modules + anonymity + the
   report/unreport route actions) and a live-DB `@security` suite (forge/own-dog
   rejected, anonymity, ranking-inert, toggle/immutability). **No new
   architecture-decision row** (composition note below). DW-021 (avatar-symmetry)
   already tracked; no new DW surfaced. Metrics: `pnpm test` 710, `pnpm check` 0,
   lint clean, `@smoke` 4, `@security` 81. Reviewer **APPROVE, 0 fix cycles** (one
   minor finding — missing route-action tests — addressed pre-merge).
   **Hosted-push gate OUTSTANDING** (see Process notes).

3. **Top-Dog verdict + HAMBURGER LIAR / HERETIC banners (TASK-073, PR #80
   `cdd17ff`).** The **moderation half of the 🍔 Hamburger Court**, closing the
   report → ALARM → verdict → LIAR/HERETIC loop TASK-071 opened. The **current Top
   Dog** adjudicates a flagged dog via the `render_burger_verdict(target_dog,
the_verdict)` SECURITY DEFINER RPC (migration `20260618120000_burger_verdicts.sql`)
   and renders a per-dog verdict in one transaction: a `not_a_hamburger` verdict
   brands every **reporter** a HAMBURGER LIAR (idempotent `ON CONFLICT`), a
   `confirmed_hamburger` verdict clears any stale LIAR rows and brands the
   **uploader** a HAMBURGER HERETIC. The adjudicator is derived from
   `(select auth.uid())` **inside** the RPC, and the gate is an `EXISTS` on the
   non-client-writable `is_current_top_dog` crown column (decision #25), so a
   verdict cannot be forged; standard private-RPC lockdown (`search_path=''`,
   schema-qualified, `revoke execute … from public, anon, authenticated` then grant
   to `authenticated`), with a `28000`/`42501`/`22023`/`P0002` SQLSTATE error
   contract mapped to typed sentinels in `verdictStore.ts`.
   **The two stores take the votes-style no-client-write lockdown, NOT the
   plain-RLS cosmetic shape.** `burger_verdicts` (`UNIQUE(hot_dog_id)`, verdict
   CHECK, `decided_by`, `decided_at`) and `hamburger_liars`
   (`UNIQUE(reporter_id, hot_dog_id)`) are both **SELECT-only for `authenticated`
   with NO client write policy** (default-deny on writes, like `votes` /
   `top_dog_days`) — the deliberate inverse of the self-service cosmetic tables,
   because a LIAR brand is a **server-imposed privileged consequence**, not a member
   toggle, so the write must route through the RPC. Both still carry **no
   denormalized counter** and never touch `vote_count` / `peak_votes` / the crown
   (decision #12 ranking-inert); decision #28 base grants apply (`authenticated`
   SELECT, `service_role` full DML, `anon` nothing).
   **The HERETIC brand is derived (table-less); the LIAR brand is stored + decays.**
   `verdict.ts` is a pure dependency-free module: `summarizeLiarBrand` computes the
   ~7-day linear LIAR fade from raw `created_at` (clock-skew clamped, unparseable
   rows skipped); `isHamburgerHeretic` derives the **persistent** HERETIC state from
   whether any of an owner's dogs has a `confirmed_hamburger` verdict (no table); and
   `dogAlarmState(verdict)` is the **confirmed-branch resolution** — it maps a verdict
   to the dog's render-time alarm state (`cleared` suppresses the TASK-071 alarm on
   `not_a_hamburger`; `confirmed` converts it to a persistent CONFIRMED HAMBURGER
   stamp; absent → falls through to the decaying `summarizeBurgerAlarm`). The
   `burger_alarms` rows are **preserved** on a verdict (audit trail; render layer
   decides), all decay/persist computed at render (decision #15). Surfaces:
   `ProfilePoliceBanner.svelte` (LIAR/HERETIC profile strip) +
   `ConfirmedHamburgerStamp.svelte` (dog-image stamp), both Svelte auto-escaped text
   (no `{@html}` → XSS-safe); the Top-Dog-only `/app/court` route is **double-gated**
   (UI crown gate redirects a non-Top-Dog, AND the RPC re-checks the crown at the DB),
   the `rule` action passes only `(dogId, verdict)`, and `listFlaggedDogs` is an
   **anonymous** service-client aggregate after the gate (reporter ids never leave the
   server — TASK-071 anonymity preserved, decision #27) with images signed
   server-side (the TASK-033 cross-owner pattern). **No new architecture-decision
   row** — a genuinely novel _combination_ of decisions #12 / #13 / #15 / #25
   (composition note below), captured as a reusable [[CLAUDE]] gotcha. Two minor
   non-blocking reviewer notes logged as **DW-022** (a lingering own-report toggle on
   a verdict-suppressed dog — TASK-072 polish candidate) and **DW-023**
   (`toEpochMs` / `tryEpochMs` ~5-line duplication between `verdict.ts` and
   `alarm.ts` — optional tidy). Metrics (director-run on a fresh `supabase db reset`):
   `pnpm test` 770, `pnpm check` 0, lint clean, `@smoke` 4, `@security` 94 (incl. the
   new `tests/burger-court.e2e.ts`). Reviewer **APPROVE, 0 fix cycles**.
   **Hosted-push gate OUTSTANDING** — batch the `burger_verdicts` migration with the
   TASK-071 `burger_alarms` migration in one `supabase db push` (see Process notes).

4. **Top Dog privileges in-app notice (TASK-074, PR #82 `20adc9a`).** A small
   crown-holder nudge: when a member holds the crown, the app home
   (`(protected)/app/+page.svelte`) shows a dismissible "👑 Top Dog privileges"
   notice listing their two powers — adjudicate 🍔 hamburger reports (link to
   `/app/court`) and spray mustard (guidance to a member profile). Chosen over a
   system DM so no system sender had to be invented (the DM author-pin privacy model
   stays intact). **Gate at the parent, presentation in the component:** the
   `{#if data.profile?.is_current_top_dog}` live-crown gate lives at the page (the
   same server-derived flag re-derived each load — decision #25, never cached — so
   the notice appears on gaining the crown and disappears on losing it), while
   `TopDogPrivilegesNotice.svelte` holds **no crown logic** and is purely
   presentational plus a client-only dismiss; a non-Top-Dog member can never reach the
   render path. This mirrors the sibling 🍔 Hamburger Court nav link from TASK-073.
   **No-schema `localStorage` dismissal:** the AC mandated a minimal, schema-free
   notice (no fake DM, no `profiles` column, no migration), so dismissal is persisted
   per-browser in `localStorage` via pure SSR-safe helpers
   (`topDogPrivilegesNotice.ts`: `DISMISSED_KEY` / `isNoticeDismissed` /
   `persistNoticeDismissed`, each taking the `Storage` instance explicitly — `null` on
   the server — and swallowing storage read/write errors so a dismiss click never
   throws and a thrown read never blanks render). Svelte 5 runes, XSS-safe (fixed copy,
   `resolve`d links, no `{@html}`). **No migration → TASK-074 adds nothing to the
   still-open TASK-071/073 two-migration hosted-push gate. No new
   architecture-decision row** — pure UI composition of the existing live-crown gate
   (decision #25), following the TASK-070/071/073 composition precedents. Metrics:
   `pnpm test` 778 (8 new dismissal-helper unit cases — 5 `isNoticeDismissed` + 3
   `persistNoticeDismissed`), `pnpm check` 0, lint clean, `@smoke` 4/4 on a clean run.
   Reviewer **APPROVE, 0 fix cycles** (two trivial non-blocking notes, no code change:
   a test-count miscount corrected to 8 / `770 → 778`; the exported `DISMISSED_KEY`,
   consumed by the test + internally, kept by design). An unrelated `@smoke`
   reaction-count flake observed during verification (`tests/feed-detail.e2e.ts:329`,
   passed on re-run) is logged as **DW-024** (a TASK-072 / E2E-stabilization
   candidate).

5. **In-app "How Top Dog works" help page (TASK-075, PR #84 `f894112`).** A static,
   everyone-facing route `/app/help` (`(protected)/app/help/+page.svelte`) — **no
   `load`, no per-user data, no server round-trip** — explaining what members can do,
   linked from the app home nav. The **vote system is emphasized**: one movable vote
   per member, no self-vote, most votes wins the crown, the **sticky tie-break** (an
   incumbent holds until a challenger pulls strictly ahead), and the days-as-Top-Dog
   tally; further sections cover Top Dog powers, reactions, mustard (~24h fade), walls
   & DMs, and the 🍔 Hamburger Court (report → ALARM → verdict → LIAR ~7d / HERETIC
   persistent). Distinct from TASK-074's crown-holder-only nudge — this page is for
   everyone. **Mechanics accuracy was the load-bearing concern:** every
   mechanic-bearing line was cross-checked against source — vote rules + sticky
   tie-break vs. `voting/ranking.ts`, mustard fade vs. `mustard/decay.ts`, the Court
   flow + LIAR/HERETIC branch direction vs. `reports/verdict.ts` — and the reviewer
   independently re-verified each line against source and found all accurate. Static
   content (XSS-safe fixed strings, no `{@html}`, `aria-labelledby` sections, Svelte 5)
   with no logic to unit-test, so the suite stays at 778. **No migration / no deps / no
   schema → no hosted-push gate** (the still-open TASK-071/073 two-migration gate is
   unchanged — TASK-075 adds nothing to push), and **no new architecture-decision row**
   (following the TASK-070/071/073/074 composition precedents). Metrics: `pnpm test`
   778 (no new tests), `pnpm check` 0, lint clean, `@smoke` 4/4. Reviewer **APPROVE,
   0 fix cycles** (two trivial stylistic notes, no change).

6. **Polish pass — empty/loading/responsive + four DW fixes, closing M7 (TASK-072,
   PR #86 `8496d94`).** The final M7 task: the user-approved scope (option 2) was
   the AC polish — friendly empty states, `use:enhance` loading affordances, basic
   responsive layout — with **no visual redesign**, plus four folded-in
   discovered-work items. **AC polish:** all six main routes (feed, dogs, profile
   wall, messages, thread, court) already had friendly empty states (only the
   cosmetic "no sprays" overlay was intentionally left); `use:enhance` submitting
   affordances were added on the court `rule`, the messages send, the profile-wall
   post, and the invite generate, plus a global nav indicator via `navigating`
   from `$app/state` in the root layout; and a new neutral `src/app.css` (~80 lines:
   box-sizing, base type, centered `.page-container`, wrapping `.app-nav`, `img`
   max-width) wired through the root layout for a basic responsive layout. **Four
   folded-in DW fixes:** **DW-022** — the 🍔 report control now renders only when
   `alarmState === 'alarm'` and shows a static "Court has ruled" note once a dog is
   adjudicated (render-only; the store-raw / resolve-at-render model and the
   security-sensitive loads are untouched — reviewer-verified); **DW-021** — the
   avatar path now mirrors the hot-dog action's early friendly
   `fail(400)` on `photo.size > MAX_UPLOAD_BYTES` (the hard Storage-API 2 MiB cap
   still backs it); **DW-018** — `listConversations` / `listThread`
   (`src/lib/features/dms/dms.ts`) now `.limit(50)`, parity with `listWallMessages`;
   **DW-024** — the flaky `@smoke` reaction-count test in `tests/feed-detail.e2e.ts`
   is stabilized with `expect.poll` (retried assertion) on both the increment and
   the decrement (DW-024 closed). **No migration / no new deps → no hosted-push gate**
   (the still-open TASK-071/073 two-migration gate is unchanged — TASK-072 adds
   nothing to push), and **no new architecture-decision row** (a pure polish/wiring
   pass — no schema, no invariant — following the TASK-070/071/073/074/075
   composition precedents). Two minor non-blocking reviewer notes: `listThread`'s
   `.limit(50)` returns the **oldest** 50 (it orders ascending) while the comment
   says "latest" → logged **DW-025** (low priority — the DW-018 bounded-read goal is
   already met); and an unstyled `.adjudicated-note` class → harmless, consistent
   with the near-unstyled posture, no action. Metrics (director-run on a fresh
   `supabase db reset`): `pnpm check` 0, `pnpm test` 783, `pnpm lint` clean,
   `@smoke` 4/4 (incl. the stabilized reaction test), `@security` 94/94. Reviewer
   **APPROVE, 0 fix cycles**. **This closes M7 — and with it all pre-specified
   plenary milestones M0–M7.**

### Milestone M7 close notes

M7 — Safety & Polish delivered the **moderation + safety surface and the v1 polish
pass**, and with it closes **every pre-specified plenary milestone (M0–M7)**. The
whole milestone shipped on **existing decisions — no new numbered Architecture
Decisions row** for any of its six tasks; each is a composition recorded in a
progress note.

1. **Hard upload-limit enforcement (TASK-070).** Upload limits moved from a
   form-action-only check to the **authoritative DB + Storage-API boundary** in three
   hard server-side layers — a Storage-API `file_size_limit = 2 MiB` on both buckets
   (the only layer that bounds **actual uploaded bytes**), a DB CHECK on the
   **declared** `byte_size` feeding the decision #11 global guard, and a
   `hot_dogs_enforce_per_user_cap()` BEFORE INSERT trigger for the 100-per-user cap —
   so a direct PostgREST insert can no longer bypass them. **Composes #10/#11/#24**
   (the column-grant lockdown preserved untouched); DW-005's `byte_size` residual is
   substantially mitigated.
2. **The full 🍔 Hamburger Court loop (TASK-071 + TASK-073).** The report half
   (TASK-071) lets a member flag another member's dog as a hamburger, tripping a
   render-time HAMBURGER ALARM — a **decision #12 cosmetic / no-counter table** whose
   **one twist is reporter anonymity** (owner-scoped SELECT + a service-client
   aggregate after the auth gate, decision #27, so reporter ids never reach the
   client). The moderation half (TASK-073) lets the **current Top Dog** adjudicate via
   the `render_burger_verdict` SECURITY DEFINER RPC, branding reporters HAMBURGER LIAR
   (stored, ~7-day render-time decay) on a `not_a_hamburger` verdict or the uploader
   HAMBURGER HERETIC (derived, persistent) on a `confirmed_hamburger` verdict, and
   converting the dog's decaying alarm into a CONFIRMED HAMBURGER stamp. The genuinely
   novel shape — a **server-imposed cosmetic consequence** table that is decision #12
   ranking-inert (no counter) yet, unlike the self-service cosmetic tables, written
   **only by an RPC** (votes-style no-client-write lockdown, decision #13) whose
   authorization reads the **non-client-writable crown column** (decision #25) and
   whose brand decays/persists at render (decision #15) — **composes #12/#13/#15/#25**
   and was captured as a reusable [[CLAUDE]] gotcha (the deliberate inverse of the
   "cosmetic tables are plain-RLS, NOT an RPC" rule). The report → ALARM → verdict →
   LIAR/HERETIC loop is now closed.
3. **Top Dog privileges notice (TASK-074).** A small crown-holder nudge on the app
   home — gated at the parent page on the live, server-derived `is_current_top_dog`
   flag (decision #25, re-derived each load), with a presentational component holding
   no crown logic and a client-only `localStorage` dismiss. **No schema, no migration,
   no new decision row** — pure UI composition of the existing crown gate (chosen over
   a system DM so no system sender had to be invented).
4. **In-app help page (TASK-075).** A static, everyone-facing `/app/help` route — no
   `load`, no per-user data — explaining what members can do with the **vote system
   emphasized**; every mechanic-bearing line was cross-checked against source
   (`voting/ranking.ts`, `mustard/decay.ts`, `reports/verdict.ts`) and the reviewer
   independently re-verified each. Static content, XSS-safe; no tests / no schema / no
   deps / no decision row.
5. **The polish pass (TASK-072).** Empty/loading/responsive AC polish — friendly empty
   states, `use:enhance` loading affordances, a global nav indicator, and a neutral
   `src/app.css` responsive layer — with no visual redesign, plus four folded-in DW
   fixes (DW-018 bounded DM reads, DW-021 friendly oversized-avatar `fail(400)`,
   DW-022 render-only report-control gate, DW-024 stabilized the flaky `@smoke`
   reaction test). No migration, no deps, no decision row. One minor follow-up logged
   as DW-025 (`listThread` returns the oldest 50, not the latest).
6. **Wiring audit — CLEAN.** The M7-close wiring audit (director-run) came back clean:
   every functional export from the new `src/lib/features/reports/` module and the new
   components (`HamburgerAlarmBanner`, `ProfilePoliceBanner`, `ConfirmedHamburgerStamp`,
   `TopDogPrivilegesNotice`) has a non-test consumer. The only `consumers=0` grep hits
   were **types** (e.g. `ReportResult`, `VerdictResult`, `DogAlarmState`, `FlaggedDog`),
   internal module constants, and test-boundary window constants
   (`BURGER_ALARM_WINDOW_MS`, `LIAR_BRAND_WINDOW_MS`, `DISMISSED_KEY`) backing wired
   functions — **not unwired functionality** (the per-task reviewers already accepted
   these). No Court/notice/help orphan remains.
   > **Forward note (M8 / TASK-080, 2026-06-19):** the `TopDogPrivilegesNotice`
   > component named above was **retired in M8** (TASK-080) when the bare `/app` hub it
   > rendered on was retired — Top Dog powers are now documented in The Catechism
   > (`/app/help`) and the crown-gated Tribunal nav link covers adjudication. The
   > component, its `topDogPrivilegesNotice.ts` helper (incl. `DISMISSED_KEY`), and its
   > 8 tests were deleted. The audit statement above is true **as of M7 close**; the
   > current tree no longer contains the component.
7. **Outstanding hosted pushes (the milestone's only open follow-up).** Two M7
   migrations remain unpushed to hosted — `20260617205453_burger_alarms.sql`
   (TASK-071) and `20260618120000_burger_verdicts.sql` (TASK-073) — to be
   `supabase db push`ed **together in one push** (the verdict migration depends on
   `burger_alarms` existing, so batching also keeps the dependency order correct).
   No scheduled job calls either table's objects, so there is **no keep-alive 404 /
   auto-pause risk** if the push lags (the daily `ping` still reads `profiles`) — the
   gate is hosted enforcement/parity, not workflow health. This is the user's hand;
   TASK-070's `20260617195233_upload_limits.sql` was the first M7 push, done
   2026-06-17. See Process notes.

### Milestone M8 progress notes

1. **Base cult visual / theme layer — the M8 foundation (TASK-087, PR #99
   `dcce8c3`).** The first M8 task and the FOUNDATION every other M8 task builds on.
   It introduces a tokenized **dark-temple** theme as a CSS-custom-property layer in
   a new `src/lib/styles/tokens.css` (imported by a rewritten `src/app.css`), plus
   self-hosted SIL OFL **Cinzel** + **Cormorant Garamond** `.woff2` fonts under
   `static/fonts/` (with bundled OFL license files — **no CDN, no npm package**, so
   M8's no-new-dependency posture holds; resolves OQ-4) and themed flair-component
   styling (`TopDogBadge`, the police-tape banners, the mustard/Anoint overlay base,
   reaction + vote controls, profile surfaces). **The token vocabulary is the durable
   contract for the rest of M8** — downstream tasks consume `var(--…)` tokens (never
   literal hex): themeable accents switch via a `data-accent="crimson" | "verdigris"`
   root attribute (default Mustard Gold), atop the surface/text/type/spacing/
   radius/shadow/motion token families. **Styling only** — no load / action / RLS /
   RPC / schema change; components stay presentational. Reviewer REQUEST_CHANGES →
   APPROVE after **1 fix cycle**: a WCAG 2.4.7 focus-visible regression where the
   wall-post `textarea:focus` rule used `outline: none` + a faint bg tint, which (via
   specificity) suppressed the global 2px gold `--ring-focus` for keyboard users too —
   fixed by dropping `outline: none` so the global focus ring renders on
   `:focus-visible` (a minor sub-AA token-comment narrowing was also fixed).
   Operational note: the implementer's sandbox blocked the font download, so the
   **director fetched the `.woff2` assets** out-of-band and the implementer wired the
   `@font-face` self-host. `pnpm check` 0, `pnpm lint` clean, `pnpm test` 783/783,
   `@smoke` 4/4, `@security` 94/94 on a fresh `supabase db reset`. **No migration, no
   new dependency, no new architecture-decision row** (decision table stays at #28).
   Forward contrast guard logged as DW-028 (faint-text tokens must stay AA on real
   content). Next: TASK-080 (global app shell + nav).

2. **Global app shell + persistent nav (TASK-080, PR #101 `544b7be`).** The second M8
   task and the structural successor to the dead-end hub. A new
   `(protected)/app/+layout.svelte` renders a **persistent header/nav across every
   `/app` route**, reading `{ user, profile }` from the existing
   `(protected)/app/+layout.server.ts` (no second crown query): the 🌭 brand mark is a
   real home button → **The Procession** (`/app/feed`), with nav to feed / **Your
   Litter** / **Epistles** / **The Catechism**, a visible ＋ Upload affordance, and a
   🍔/☩ **Tribunal** link **still gated on the server-derived `is_current_top_dog`
   flag** (decision #25, not widened) in both desktop and mobile nav. Two confirmed
   "Default landing route" consequences landed with it: the `/` redirect in
   `src/routes/+page.server.ts` was repointed `'/app'` → `'/app/feed'`, and the bare
   `/app` "kennel" hub is **retired** (`redirect(307, '/app/feed')`; the hub
   `+page.svelte` reduced to an SSR fallback, its inline `<nav class="app-nav">`
   removed). The auth guard is untouched (unauthenticated → `/sign-in`, profile-less →
   `/app/onboarding` cascade preserved). Svelte 5 runes, `resolve(...)` links, no
   `{@html}`, accessible nav (semantic `<nav>`, `aria-current`, keyboard focus, mobile
   `aria-expanded`, responsive collapse). **`TopDogPrivilegesNotice` (TASK-074)
   intentionally RETIRED (user-approved):** the reviewer's one blocking finding was that
   the hub retirement orphaned that working crown-gated feature; the user ruled to
   retire it — Top Dog powers are now in The Catechism (`/app/help`) and the crown-gated
   Tribunal nav link covers the adjudication CTA, so the standalone nudge is redundant.
   The component, its `topDogPrivilegesNotice.ts` helper, and its 8 dismissal-helper
   tests were deleted (`pnpm test` **783 → 775**, exactly −8). Reviewer REQUEST_CHANGES
   → APPROVE after **1 fix cycle** (the orphan retirement + deletion of the dead
   `.app-nav` CSS). `pnpm check` 0, `pnpm lint` clean, `pnpm test` 775, `@smoke` 4/4
   (`@security` not re-run — a UI/routing change orthogonal to the live-DB write
   guards). **No migration, no new dependency, no new architecture-decision row**
   (decision table stays at #28). The M7 wiring-audit statement listing
   `TopDogPrivilegesNotice` as wired was forward-noted as retired (see M7 close notes).
   Next: the auth cluster (TASK-082 / TASK-083) or TASK-081 (copy).

3. **Forgot/reset password — 6-digit OTP recovery (TASK-083, PR #103 `3e236be`).** The
   third M8 task and the first half of the auth cluster. Two new public routes:
   `/forgot-password` posts an email to **`resetPasswordForEmail`** and always returns the
   same **neutral, non-enumerating** message; `/reset-password` takes a **6-digit OTP
   code** + a new password (with confirm) and runs **`verifyOtp({ email, token, type:
'recovery' })` → `updateUser({ password })`** — the recovery session minted by
   `verifyOtp` is the authoritative gate on the password change (never changed without a
   verified code). `MIN_PASSWORD_LENGTH` (8) + confirm-match enforced at the boundary; a
   wrong/expired code fails friendly. **Security (L2):** non-enumeration on both the
   forgot and reset error paths, raw Supabase errors logged server-side only, no secret
   key on the client. The user chose **6 digits over the design's 4-mark**
   (`otp_length = 6`). Reviewer APPROVE after **1 fix cycle** — the load-bearing fix: as
   first built, Supabase fell back to its **default** recovery email, which sends a magic
   **link**, not a code, incompatible with the code-entry page; the fix added a cult-themed
   **`supabase/templates/recovery.html`** emitting the 6-digit `{{ .Token }}` (code-only)
   and wired **`[auth.email.template.recovery]`** in `supabase/config.toml`. Agent web
   tools were denied, so the **director doc-checked** the supabase-js v2 recovery handshake
   (`type:'recovery'` is TS-valid) and ran a **live Mailpit round-trip**
   (`http://localhost:54324`) confirming a real 6-digit, **code-only** email (subject "Your
   recovery rite — Snacktum Snacktorum", 1h expiry). `pnpm check` 0, `pnpm lint` clean,
   `pnpm test` **793**. **No migration, no new dependency, no new architecture-decision
   row** (the recovery template + `otp_length` are config; decision table stays at #28).
   **Hosted ops consequence (carried to the standing gate):** hosted production must carry
   the same code-emitting recovery template (dashboard or `supabase config push`) or it
   will send a link, not a code. Follow-up DW-029 logged (`MIN_PASSWORD_LENGTH` + the email
   pattern duplicated across the auth pages — extract a shared `$lib/features/auth`
   validation module). Next: TASK-082 (sign-in) or TASK-081 (copy).

4. **Interim gate-page visual polish + brand-asset wiring (PR #107 `4fcc3c7`, ad-hoc —
   NOT a queued task).** Emerged from live design iteration, not the M8 queue, so **M8
   remains 4/10 — no queued task was completed by it.** An iterative visual pass on the
   four gate pages (`/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`):
   vertical centering, the `the-holy-tube` relic mark (6.5rem) above each heading, the
   glow repositioned to halo the upper text, scroll fixes (at-rest + transient-during-
   animation via `overflow: clip`), and **autofill theming** (autofilled inputs kept
   on-theme via stacked inset `box-shadow`s — an opaque `--color-bg` base + the
   translucent `--accent-fill` tint — see the new [[CLAUDE]] gotcha). It also relocated
   the brand assets (marks → `src/lib/assets/brand/`, 5 avatar sigils →
   `src/lib/assets/sigils/`, favicons → `static/`, wired via `<link>`s in
   `src/routes/+layout.svelte`) and settled the gate-page copy conventions (Password →
   **"Seal"**, Email → **"Mustard Address"** / `you@mustard.condiment`, sign-in
   destination → **"the grill"**) that TASK-081 will apply consistently (recorded in the
   M8 milestone file). Reviewer APPROVE (minor notes). **No new dependency, no migration,
   no new architecture-decision row** (decision table stays at #28). DW-031 logged
   (orphaned sigil + brand-logo SVGs committed but not yet referenced); `/sign-up` is the
   one gate page not yet at full theme/copy parity (a TASK-081 / TASK-084 follow-up).

5. **Themed inline form validation — landed and made app-wide CANON (PR #109 `6c00c1c`,
   ad-hoc — NOT a queued task).** A themed, accessible, **inline client-side validation
   layer** replaced the browser's native HTML5 validation bubble on the auth-gate forms:
   new `src/lib/features/forms/` (`validationMessage.ts` pure + `createFormValidation()`
   rune) + `src/lib/motion/reducedMotion.ts` (`errorSlideFade`, SSR-safe /
   `prefers-reduced-motion`-aware). The form wraps its `use:enhance` through
   `validation.enhance(...)` (populates a reactive `errors` map, focuses the first invalid
   field, `cancel()`s); per field `aria-invalid` + `aria-describedby` +
   `oninput={validation.clearOnInput}`; messages are themed, field-naming cult copy
   (special-casing labels like **Mustard Address** / **Seal**). Recorded as a **binding
   convention** (the [[CLAUDE]] "Forms & validation" subsection): themed inline validation
   is the standard for EVERY form with required / empty-able fields; the native bubble is
   never used. Applied per form-bearing page; rollout to the remaining in-app forms tracked
   as **DW-032**. **No migration / no new dependency / no new decision row.**

6. **M8 RE-SCOPE — rebuild-from-design + re-slug (PR #111 `0991846`, planner,
   user-directed).** The remaining M8 pages stop being incremental restyles and are instead
   **REBUILT FROM their `design/pages/*.dc.html` mockups** (a per-page presentational
   rebuild of `+page.svelte` that **preserves each `+page.server.ts` load + actions** and
   re-wires all data/feature plumbing) **and the in-app routes are RE-SLUGGED to cult names**
   (`app` → `snacktum-snacktorum`; feed→`procession`, dogs→`litter`(+`litter/[id]`),
   profile/[handle]→`shrine/[handle]`, messages→`epistles`(+`epistles/[handle]`),
   invite→`summon`, court→`tribunal`, help→`catechism`). The **four auth slugs are KEPT
   descriptive** (user-finalized: `/sign-in`, `/sign-up`, `/forgot-password`,
   `/reset-password`); the onboarding rite lives at `/sign-up`. This **deviates from the
   original "URL paths UNCHANGED" plan** (in-app URLs now DO change) — recorded as a **scope
   decision, NOT a numbered decision row** (the table stays #28). Still skin-not-skeleton at
   the code level (no table/RPC/TS-symbol rename, no infra rename, decisions #1–#28 + L2
   preserved). Pre-launch (invite-only, not deployed) → **no old→new redirects.** Task set
   re-numbered to **4 complete + 12 pending**: TASK-090 (foundational slug refactor, lands
   first; the RISKY cross-cutting rename — `hooks.server.ts` auth-guard prefix, root
   redirect, shell links, per-page refs, E2E + unit path assertions; **checkpoint tag at
   execution**) then per-page rebuilds TASK-091/092/093/094/094-R/095/096/097/098/099/100/101.
   The old pending tasks (081/084/085/086/088/089) are **superseded/folded** (081 copy →
   carried by the rebuilds; 084→092, 085→093 Shrine, 086→094 Anoint, 088→101 error,
   089→094-R Reliquary). See [[tasks/milestone-08-snacktum-snacktorum-rebrand]] § Slug Map.

7. **The Snacktum Onboarding RITE at `/sign-up` — the first rebuild-from-design page
   (TASK-092, PR #112 `a5fd084`).** `/sign-up` was rebuilt as a single multi-step **rite**
   (Summoned → Inscribe → Choose Thy Sigil → Renounce → Received) that **absorbs and
   deletes** the standalone `(protected)/app/onboarding/` route — the profile-funnel guard
   (`ONBOARDING_PATH`) now points at `/sign-up`, and an authenticated-but-profile-less
   **resumer** picks the rite up at a handle-only Inscribe (handle carried to `createProfile`
   via client `$state`; forward-only). Two non-obvious **control-flow decisions** worth
   recording: (a) the profile is forged at the **Sigil** step and **Renounce is a pure-UI
   oath** gated only on the sworn state (no session check there); (b) `createProfile`
   **returns `{ created, handle }` instead of redirecting**, so the client advances
   Sigil → Renounce → Received **without re-running `load`** — re-running `load` would
   `throw redirect` on the now-existing profile and skip the oath/Received (Received has an
   explicit "Enter →" into the app; a `createProfile` failure recovers in place on the Sigil
   step). The chosen sigil is stored as `sigil:<id>` in `avatar_path` (no upload, no
   migration); new `src/lib/components/Sigil.svelte` (inline SVG, no `{@html}`) +
   `src/lib/features/profiles/sigils.ts`. The Ordo Sancti Tubi **seal** (15rem) +
   **wordmark header** (24rem, top-anchored) are unified across the four auth/gate pages via
   shared `.gate-mark`/`.gate-header` in `app.css`. Reviewer APPROVE (heavy interactive UI
   iteration, no formal fix cycles); `pnpm check` 0, `pnpm lint` clean, `pnpm test` **830**,
   `@smoke` 5/5, `@security` 94/94. **No migration / no new dependency / no new
   decision row** (table stays #28). The post-rite path slug rename
   (→ `/snacktum-snacktorum/shrine/<handle>`) rides with TASK-090's slug refactor — `@smoke`
   currently lands on `/app/profile/<handle>` (correct until TASK-090 runs). Discovered: a
   session-less hit at the Sigil step dead-ends with `fail(401)` and no in-rite recovery
   (**DW-033**); DW-031 updated (`snacktum-snacktorum-header.svg` now wired;
   `the-holy-tube.svg` newly orphaned; sigil SVGs possibly orphaned since `Sigil.svelte`
   inlines the art). Next: TASK-090 (slug refactor) or another per-page rebuild
   (TASK-091 Procession / TASK-093 Shrine).

See [[CLAUDE]] for stack/conventions and [[TASKS]] for the work queue.

## Architecture Decisions

| #   | Decision                                 | Choice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Date       |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | Coding paradigm                          | Pragmatic/modular, typed, feature-folder structure                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | SvelteKit + TS naturally encourages module/feature organization; keeps pure game logic separable from UI/wiring                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 2026-06-05 |
| 2   | Testing paradigm                         | Adaptive: TDD-first for pure logic, test-after for UI/wiring                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Vote/ranking, days-as-Top-Dog tally, mustard decay, emoji filter have crisp specs worth TDD; UI is exploratory                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 2026-06-05 |
| 3   | Hosting/data platform                    | Supabase (Postgres + Auth + Storage + RLS + Realtime)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Single platform for a solo dev; auth, DB, storage, realtime in one; generous free tier                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 2026-06-05 |
| 4   | Frontend framework                       | SvelteKit 2 + Svelte 5 (runes), `@supabase/ssr`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Cookie-based SSR auth; small bundles; runes for reactive state                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 2026-06-05 |
| 5   | API keys                                 | Publishable (`sb_publishable_*`) + secret (`sb_secret_*`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Legacy anon/service_role keys deprecate end-2026                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 2026-06-05 |
| 6   | Image storage                            | Two buckets: `hotdogs` (private, signed URLs) + `avatars` (public-read). DB stores only text path refs (`{owner_id}/{dog_id}.webp`); bytes never in Postgres                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Keeps DB small; signed URLs protect private content; path-only refs decouple schema from storage backend                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 2026-06-05 |
| 7   | Storage abstraction                      | Thin swappable storage module; one file to swap to Cloudflare R2 later                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | R2 (10 GB free) is the documented escape hatch from Supabase's 1 GB cap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 2026-06-05 |
| 8   | Image format                             | WebP, encoded client-side (canvas.toBlob); AVIF deferred                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Zero-dep, universal browser support; AVIF encode needs ~1MB WASM. Revisit near 1 GB cap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 2026-06-05 |
| 9   | Client compression                       | Resize ~1280px max, WebP ~80%, target ~100–200 KB/photo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Linchpin that makes the 1 GB free-tier cap viable (~6,800 photos)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 2026-06-05 |
| 10  | Per-user photo cap                       | 100 hot dogs/user (soft cap, "delete one to add another"); delete removes BOTH DB row + storage object                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Prevents orphans; bounds per-user storage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 2026-06-05 |
| 11  | Global storage guard                     | Monitoring threshold: warn ~800 MB, block new uploads ~950 MB                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Graceful degradation before Supabase's hard 1 GB                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 2026-06-05 |
| 12  | Vote vs reaction                         | VOTE = single, movable, one-per-user, not-own-dog, drives ranking. REACTION = cosmetic, many allowed, no ranking effect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Clear separation of competitive signal vs flair                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 2026-06-05 |
| 13  | Top Dog definition                       | User whose single highest-voted dog leads by vote count; tie-break = earliest to hold crown (sticky)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Deterministic crown with stable tie resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 2026-06-05 |
| 14  | Days as Top Dog                          | One per calendar day held; multiple reigns same day = one day; `top_dog_days` unique (profile_id, day)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Simple, idempotent daily tally                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 2026-06-05 |
| 15  | Mustard (Anoint)                         | Sprayed on PROFILES; rows persistent (append-only, decision #29); overlay decays full → 0 over **6h** (`MUSTARD_LIFESPAN_MS`, shortened from 24h by TASK-094); drip/opacity computed at RENDER time from stored timestamp + position (no cron for render); user-facing copy is "Anoint" (M8)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Avoids per-spray cron; cheap reads                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 2026-06-05 |
| 16  | Emoji handling                           | Hot-dog-only emoji library; **filter at RENDER time** (store original body)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | OVERRIDES earlier "on store" decision — filtering at render is reversible and never corrupts stored user text (adversarial finding F)                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 2026-06-05 |
| 17  | Invites                                  | Invite-only; user-generated invite links; no invite cap for v1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Controlled growth without heavy infra                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 2026-06-05 |
| 18  | Local dev environment                    | Supabase CLI local stack (`supabase start`, Docker); migrations in `supabase/migrations/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Standard hosted-Supabase pattern; satisfies "DBs containerized in dev"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 2026-06-05 |
| 19  | Runtime/tool management                  | mise: node 24.16.0, pnpm 11.5.2, supabase 2.106.0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Pinned, reproducible toolchain                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 2026-06-05 |
| 20  | Package manager                          | pnpm                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Fast, strict, disk-efficient; first-class SvelteKit support                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 2026-06-05 |
| 21  | Security level                           | L2 (Standard)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Auth + DMs + user uploads + PII                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 2026-06-05 |
| 22  | Invite single-use guard                  | Authoritative single-use signal is `invites.consumed_at` (FK never nulls it); `consumed_by` is `on delete set null` for audit only, guarded by a one-directional CHECK                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Keying the guard on a column an FK can null would re-open a spent token if the redeemer is deleted — guard must key on a never-nulled column                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 2026-06-09 |
| 23  | Invite redemption path                   | Consumption via anon-executable SECURITY DEFINER RPCs (`redeem_invite` / `invite_is_redeemable`), `search_path=''`, schema-qualified; no client UPDATE/DELETE on `invites`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Redemption happens pre-auth (can't use inviter's RLS); a single-transaction RPC is the controlled write path — consistent with the consuming-writes-via-RPC convention                                                                                                                                                                                                                                                                                                                                                                                                                                | 2026-06-09 |
| 24  | Non-client-writable counters             | Server-maintained counters (`vote_count`, `peak_votes`, `created_at`) are blocked from client writes via **column-level GRANTs on both INSERT and UPDATE** — revoke table-wide, then re-grant only safe columns; omitted columns fall to DEFAULTs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | RLS alone gates rows, not columns; restricting only UPDATE leaves the INSERT path open to seed a forged opening counter. Column-level grants on both write paths close it (caught in TASK-013 review). Reusable for any future denormalized counter                                                                                                                                                                                                                                                                                                                                                   | 2026-06-09 |
| 25  | Non-client-writable crown columns        | The `profiles` crown columns (`is_current_top_dog`, `top_dog_since`, `days_as_top_dog`) are blocked from client writes by applying decision #24's insert+update column-grant pattern: `revoke insert/update on profiles from authenticated`, then `grant insert (id, handle, display_name, avatar_path)` + `grant update (handle, display_name, avatar_path)`. Crown columns fall to DEFAULTs / are non-updatable; `recompute_top_dog()` (SECURITY DEFINER) is the sole maintainer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `profiles` previously had no column-level write grants, so an authenticated user could forge crown state via a plain PostgREST INSERT/UPDATE (caught in TASK-021 review). Extends the decision #24 pattern from `hot_dogs` counters to every server-maintained denormalized column                                                                                                                                                                                                                                                                                                                    | 2026-06-11 |
| 26  | Daily tally auth model (A1)              | A privileged-but-input-free scheduled job is an anon-callable, idempotent SECURITY DEFINER RPC. `tally_top_dog_day()` takes **no caller input** (`pronargs = 0`) and only ever records the actual current Top Dog's `current_date`; it is EXECUTE-granted to `anon` + `authenticated` so the keep-alive GitHub Actions workflow can call it via PostgREST with the **existing publishable key** — no new repo secret. Idempotent at two layers (`UNIQUE(profile_id, day)` + `ON CONFLICT DO NOTHING`; `days_as_top_dog` recomputed authoritatively from `COUNT`)                                                                                                                                                                                                                                                                                                                                                                                                                           | Avoids minting/managing a service-key secret in CI for a job that records only server-known facts; reviewer empirically confirmed it is not forgeable and is self-limiting (worst case: an anon caller triggers today's idempotent tally early — exactly what the cron does). Sets the auth pattern for the M4 mustard-prune job (TASK-042), wired into the same workflow                                                                                                                                                                                                                             | 2026-06-11 |
| 27  | Cross-member private-bucket signed URLs  | Signed URLs for another member's private-bucket (`hotdogs`) content are minted **server-side with the service client** (`$lib/server` `getServiceClient()`), constructed **after** the `safeGetSession()` gate, signing only `image_path` values from rows the viewer's own RLS query already returned. The dog / owner / reaction queries stay on the RLS-scoped `event.locals.supabase`; only the signer is privileged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `storage.createSignedUrl` is **RLS-gated at creation**, and the only `hotdogs` SELECT policy is owner-only (`hotdogs_select_own`) — so the viewer's RLS-scoped client can sign only its OWN objects, leaving every cross-member image unrenderable (P0 latent since TASK-024, surfaced by the TASK-032 feed E2E). Corrected realization of decision #6: the bucket stays private and URLs stay 1h-TTL signed, no storage RLS / bucket change; signing only already-authorized rows does not widen exposure. Lock-in unit tests pin the signer as the service client                                   | 2026-06-12 |
| 28  | Explicit Data API grant model            | The Supabase Data API (PostgREST) base GRANTs are **explicit and committed**, never platform-implicit. `auto_expose_new_tables = false` is pinned in `supabase/config.toml`, and **every new `public` table migration MUST declare its own base grants**: `authenticated` SELECT + only the writes its RLS actually allows (INSERT/DELETE on counter-free cosmetic tables, nothing on RPC-only surfaces); `service_role` full DML; **`anon` nothing**. PostgREST authz is **two-layer** — a passing RLS policy is necessary but **not sufficient**; the base table GRANT is also required. Grants must **never re-open a locked column table-wide**: preserve the decision #24/#25 column-level lockdowns (`profiles` / `hot_dogs` / `dms`) and the decision #12 RPC-only write paths (`votes` / `top_dog_days`). The baseline restore lives in `20260617000000_restore_data_api_grants.sql`; `tests/grants.e2e.ts` (`@security`) locks the required AND forbidden matrix in against drift | The CLI's `auto_expose_new_tables` default flipped `true`→`false` on 2026-05-30, so a fresh `supabase db reset` stopped issuing the implicit base GRANTs the schema had silently depended on since M0 — `@smoke`/`@security` went RED and the real invite path broke with `permission denied` though every RLS policy was intact (TASK-052, root-caused by an architect dispatch). The platform removes auto-expose entirely after 2026-10-30, so explicit grants are also the permanent forward path. Interacts with #12/#24/#25: the restore preserves those lockdowns rather than blanket-granting | 2026-06-17 |
| 29  | `mustard_sprays` retention (append-only) | The daily `prune_mustard_sprays()` job is **RETIRED** (dropped by `20260622120000_retire_mustard_prune.sql`, function-only — table shape/grants/RLS/`WITH CHECK` untouched). With no client DELETE policy AND no prune, `mustard_sprays` is now **effectively append-only**. The Anoint overlay still decays at **RENDER** over **6h** (`MUSTARD_LIFESPAN_MS`, shortened from 24h by TASK-094) from the raw `sprayed_at`; the **persisting** wall-notice is render-derived from the **full** spray history (`listAnointmentsForProfile`, capped 200 rows), distinct from the 6h overlay window (`listSpraysForProfile`). The `.github/workflows/keepalive.yml` mustard-prune step was removed in lockstep                                                                                                                                                                                                                                                                                  | OQ-2 Option A (user-approved): a **persisting** wall notice requires its source rows to survive, which the >24h prune (the original "unbounded `mustard_sprays` growth" mitigation, Accepted Risk C) would have deleted. Composes #12/#15/#25/#28 — the table's grants/RLS/`WITH CHECK` are unchanged; the migration touches only the function. Append-only growth is accepted at invite-only scale (sprays are tiny rows); revisit a bounded retention if volume ever warrants. Hosted-push gate: batch with the outstanding M7 migrations                                                           | 2026-06-22 |

### Accepted Risks (from Adversarial Review)

| Risk                                                          | Severity       | Why we proceed                                                                                                                                                                                                                                                                 | Mitigation task                                      |
| ------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Crown recompute + sticky tie-break under concurrent votes (A) | Medium         | Solvable with a single transactional SQL function                                                                                                                                                                                                                              | TASK in M2: ranking RPC + `top_dog_since`, TDD'd     |
| Denormalized `vote_count` drift (B)                           | Medium         | Counter updated only inside the vote transaction; RLS blocks client writes                                                                                                                                                                                                     | M2 vote RPC + trigger                                |
| Unbounded `mustard_sprays` growth (C)                         | Low (accepted) | Originally mitigated by the M4 >24h prune job; that job was RETIRED in M8 (decision #29) so a persisting Anoint wall-notice can keep its source rows — the table is now append-only. Accepted at invite-only scale (tiny rows); revisit a bounded retention if volume warrants | M4 prune job (TASK-042) — superseded by decision #29 |
| 1 GB storage cap viability (D)                                | Medium         | Client compression + per-user cap + global guard + R2 escape hatch                                                                                                                                                                                                             | M0 guard + M1 compression                            |
| Supabase single-platform lock-in (E)                          | Low (accepted) | Storage abstracted; auth/DB lock-in accepted for solo-dev velocity                                                                                                                                                                                                             | Documented; storage module isolates the largest risk |

## External Integrations

| Service           | Purpose                                   | Auth Method                              | Base URL / SDK                           | Rate Limits           | Notes                                                                |
| ----------------- | ----------------------------------------- | ---------------------------------------- | ---------------------------------------- | --------------------- | -------------------------------------------------------------------- |
| Supabase Auth     | Email + invite-link sign-in               | Publishable/secret keys, cookie sessions | `@supabase/ssr`, `@supabase/supabase-js` | Free tier             | SSR via `hooks.server.ts`                                            |
| Supabase Postgres | App data                                  | RLS + secret key (server)                | supabase-js                              | 500 MB DB             | Migrations in `supabase/migrations/`                                 |
| Supabase Storage  | Hot dog + avatar images                   | Signed URLs (private), public (avatars)  | supabase-js storage                      | 1 GB / 5 GB egress/mo | `hotdogs` private, `avatars` public                                  |
| GitHub Actions    | Daily keep-alive ping + Top Dog day tally | Repo secrets                             | scheduled workflow                       | —                     | Prevents 7-day auto-pause; mustard-prune step removed (decision #29) |

## Data Model

```
profiles      id, handle(@unique), display_name, avatar_path, joined_at,
              days_as_top_dog, is_current_top_dog, top_dog_since
hot_dogs      id, owner_id→profiles, image_path, caption, created_at,
              vote_count(denormalized), peak_votes
votes         voter_id→profiles, hot_dog_id→hot_dogs, created_at
              UNIQUE(voter_id)  -- one active vote; CHECK voter != owner (RLS)
hotdog_reactions  id, user_id, hot_dog_id, emoji, created_at
              UNIQUE(user_id, hot_dog_id, emoji)  -- cosmetic; many DISTINCT
              emojis per user; owner-scoped RLS insert/delete (no RPC, no
              counter) — counts computed at render, never affects ranking
burger_alarms id, reporter_id→profiles, hot_dog_id→hot_dogs, created_at
              UNIQUE(reporter_id, hot_dog_id)  -- cosmetic, no counter,
              ranking-inert; reporter ANONYMOUS (owner-scoped SELECT); public
              alarm aggregate read server-side; render-time 24h decay
burger_verdicts   id, hot_dog_id→hot_dogs, verdict, decided_by→profiles, decided_at
              UNIQUE(hot_dog_id)  -- per-dog Top-Dog verdict; written ONLY by
              render_burger_verdict RPC (no client write policy, SELECT-only);
              confirmed_hamburger ⇒ owner is a HERETIC (derived, persistent);
              ranking-inert
hamburger_liars   id, reporter_id→profiles, hot_dog_id→hot_dogs, created_at
              UNIQUE(reporter_id, hot_dog_id)  -- LIAR brand minted by the RPC on a
              not_a_hamburger verdict; no client write policy, SELECT-only;
              render-time ~7-day decay; cosmetic, no counter, ranking-inert
mustard_sprays    id, sprayer_id, target_profile_id, x, y, sprayed_at
              (Anoint overlay drip computed at render, decays over 6h; append-only —
              no DELETE path, prune retired, decision #29)
top_dog_days  profile_id, day(date)   UNIQUE(profile_id, day)
wall_messages id, wall_owner_id, author_id, body(original text), created_at
dms           id, sender_id, recipient_id, body, created_at, read_at
invites       id, inviter_id, token(unique), created_at, consumed_by, consumed_at
```

All tables protected by Row-Level Security. Authz enforced at the DB, not just UI.

### Runtime Data Flow

```
Invite link -> Auth.signUp -> profiles row (handle, avatar)
Photo file -> client WebP compress -> storage.upload(hotdogs/) -> hot_dogs row (image_path)
Vote click -> voting RPC (move vote, update vote_count, recompute crown) -> Top Dog + badge
Daily cron -> top_dog_days tally + mustard prune + keep-alive ping
Mustard spray (Top Dog only) -> mustard_sprays row -> render-time decay on target profile
Wall post -> wall_messages(original) -> emoji filter at render + random hot-dog sprinkle
```

## Known Limitations

- v1 non-goals: no push/email notifications, no comments on hot dogs, no global
  search, no native mobile app.
- Moderation v1: hard upload size/count limits + a report button only.
- Free tier: 1 GB storage / 500 MB DB / 5 GB egress per month; project
  auto-pauses after 7 days of no DB activity (mitigated by keep-alive ping).
- AVIF deferred (WASM encode cost); revisit near the 1 GB storage cap.

### Process notes

- **Task queue migrated to the indexed per-milestone layout (2026-06-11).** The
  monolithic `TASKS.md` is now an index/dashboard; each milestone's tasks live in
  its own `tasks/milestone-NN-slug.md` file (M2 active, M3–M7 pre-exploded),
  cross-milestone logs are `tasks/discovered.md` + `tasks/deferred.md`, and the
  completed pre-migration milestones (M0, M1) are grandfathered into
  `TASKS-ARCHIVE.md`. New completed milestones freeze in their own file rather than
  moving to the archive. See [[TASKS]] for the index and [[CLAUDE]] Project Map for
  the canonical wikilink targets.
- **Hosted schema drift resolved + keep-alive green again (2026-06-16, ops
  session).** The daily keep-alive workflow had been red for 4 runs. Root cause was
  **hosted schema drift**, not a secrets or auto-pause problem: the M2/M3 migrations
  (`20260610181704_votes_and_vote_rpc.sql`,
  `20260611174243_top_dog_days_and_tally.sql`,
  `20260612104439_hotdog_reactions.sql`) had never been `supabase db push`ed to
  hosted since the M0/M1 going-live, so the workflow's `Tally Top Dog day` step
  (`tally_top_dog_day()`) got a PostgREST 404. The `ping` step succeeded throughout,
  so the hosted DB was never actually at auto-pause risk (the daily read kept it
  alive even while the workflow showed red). Fixed by `supabase db push` (three
  migrations applied to hosted) + a workflow re-trigger → green. No repo diff (a
  hosted-DB + workflow-rerun action). **Durable lesson:** push hosted migrations
  **per-milestone** — at milestone close, or whenever a migration lands — not just at
  going-live, so a milestone's new RPCs are reachable before any scheduled job calls
  them. This gate applies immediately to M4: TASK-042 adds a fourth migration + a
  second prune RPC wired into the same keep-alive workflow, and that migration MUST
  be pushed to hosted before the prune step ships or this exact failure recurs.
- **M4 hosted-push gate — PENDING as of 2026-06-16 (M4 close).** M4 added two new
  migrations (`20260616163055_mustard_sprays.sql`,
  `20260616170706_mustard_prune.sql`) and a new scheduled keep-alive step that
  calls `prune_mustard_sprays()` via PostgREST. Both migrations **must be
  `supabase db push`ed to hosted before the next scheduled keep-alive run**, or the
  new prune step gets a PostgREST 404 and turns the workflow red — the exact
  hosted-drift class that took the workflow red for 4 runs over the M2/M3
  migrations. As of this writing the push has **not** been done; the director will
  surface it to the user as a post-merge ops step. This is the per-milestone
  hosted-push discipline from the entry above, applied at M4 close.
- **Session continuity — M4 built + closed in one session
  ([[Handoffs/handoff-011]], 2026-06-16).** M4 (pre-exploded) was activated,
  built end to end, and tagged in a single session; all three tasks landed
  reviewer APPROVE / 0 fix cycles. See the handoff for the full session record
  and the pending hosted-push gate. Next: M5 — Walls & DMs.
- **M5 hosted-push gate — DONE 2026-06-17 (TASK-054).** The user ran a single
  `supabase db push` carrying all three deferred migrations together
  (`20260616184139_wall_messages.sql`, `20260616191804_dms.sql`,
  `20260617000000_restore_data_api_grants.sql`), so hosted now has the M5
  walls/DMs surfaces **and** the explicit-grant restore — **walls & DMs are
  functional on hosted.** Post-push keep-alive verified **green**
  (`workflow_dispatch` run 27714086568 — ping + tally + prune all 2xx). This
  discharges the deferred ops follow-up that M5 close carried (it had no
  auto-pause risk, so it was deferred out of the milestone rather than gating
  its close). The per-milestone hosted-push discipline now applies forward to
  M6 — but M6 added **no migrations** (the emoji library is pure render-time
  TS), so there is no M6 hosted-push gate. See [[tasks/deferred]] (row marked
  `done`) and [[Handoffs/handoff-014]].
- **M7 hosted-push gate — DONE 2026-06-17 (TASK-070).** TASK-070 added
  one new migration, `20260617195233_upload_limits.sql` (the bucket
  `file_size_limit`, the `hot_dogs_byte_size_max` CHECK, and the
  `hot_dogs_enforce_per_user_cap()` BEFORE INSERT trigger). Per the per-milestone
  hosted-push discipline it **must be `supabase db push`ed to hosted** so the new
  CHECK/trigger/Storage-API caps are live on the hosted project — unlike M6 (pure
  render-time TS, no migration), M7 has reintroduced a migration. No scheduled job
  calls this migration's objects, so there is **no keep-alive 404 / auto-pause
  risk** if the push lags (the daily `ping` still reads `profiles`); the gate was
  about hosted enforcement parity, not workflow health. **The user ran `supabase db
push` on 2026-06-17**, so the CHECK/trigger/Storage-API caps are now live on hosted.
- **No new architecture-decision row for TASK-070 (2026-06-17).** Hard server-side
  upload-limit enforcement **composes** existing decision #10 (per-user 100 cap),
  decision #11 (global storage guard), and decision #24's column-grant lockdown
  (preserved untouched) under the L2 defense-at-the-DB posture — it is a hardening
  of those, recorded in the M7 progress note rather than as a new row in the
  Architecture Decisions table.
- **M7 hosted-push gate (TASK-071 + TASK-073) — OUTSTANDING as of 2026-06-18, TWO
  migrations to push together.** TASK-071 added `20260617205453_burger_alarms.sql`
  (the `burger_alarms` table + owner-scoped RLS + decision #28 base grants) and
  TASK-073 added `20260618120000_burger_verdicts.sql` (the `burger_verdicts` +
  `hamburger_liars` tables, their no-client-write RLS + decision #28 grants, and the
  `render_burger_verdict` RPC). Per the per-milestone hosted-push discipline **both
  must be `supabase db push`ed to hosted — batch them in a SINGLE push** so the full
  report → verdict flow is functional on the hosted project (the verdict migration
  depends on `burger_alarms` existing, so pushing them together also keeps the
  dependency order correct). As of this writing neither has been pushed; the director
  will surface it to the user as a post-merge ops step. **No** scheduled job calls
  either table's objects, so there is **no keep-alive 404 / auto-pause risk** if the
  push lags (the daily `ping` still reads `profiles`) — the gate is hosted
  enforcement/parity, not workflow health. (TASK-070's `20260617195233_upload_limits.sql`
  was the first M7 push, done 2026-06-17.)
- **M8 hosted bring-up gate — additions to batch on the same step (2026-06-19).** Two M8
  items join the standing hosted gate above so they go up together: **(1) TASK-083
  recovery email template (CONFIG, no migration)** — hosted production's recovery email
  must be set to the **code-emitting `{{ .Token }}` template** (the cult-themed
  `supabase/templates/recovery.html` + `[auth.email.template.recovery]` / `otp_length = 6`
  added to `config.toml`), via the Supabase **dashboard** or **`supabase config push`**.
  Without it, hosted falls back to the default email, which sends a recovery **link**, not
  a **code** — breaking the `/reset-password` code-entry page. No DB migration, no
  keep-alive/auto-pause risk; it is config parity, not workflow health. **(2) TASK-094
  prune-retirement migration (LANDED 2026-06-22, decision #29)** —
  `20260622120000_retire_mustard_prune.sql`, a function-only DROP of
  `prune_mustard_sprays()`, to be `supabase db push`ed with the two M7 burger migrations in
  lockstep. **The keep-alive workflow's daily prune step was already removed in the merged
  code**, so the workflow will NOT 404 on the retired RPC regardless of push order — the
  only outstanding hosted action is the `db push` of the DROP migration (no pending workflow
  edit; no auto-pause risk — the daily `ping` keeps the DB alive).
- **No new architecture-decision row for TASK-073 — a novel COMPOSITION of
  #12/#13/#15/#25 (2026-06-18).** The spec flagged this as a likely composition note
  rather than a new numbered row, and on inspection that is right — it introduces no
  new product/architecture _invariant_, but it IS a genuinely novel _combination_
  worth recording (following the TASK-070/071 composition-note precedents). The shape:
  a **server-imposed cosmetic consequence** table (`hamburger_liars`, plus the
  `burger_verdicts` store) is **decision #12** cosmetic / ranking-inert (no counter)
  BUT — unlike the self-service cosmetic tables (`hotdog_reactions` / `mustard_sprays`
  / `wall_messages`, which write through plain owner-scoped RLS) — it is written
  **only by an RPC**, so it takes the votes-style **"no client write policy" lockdown
  (decision #13)**, with the RPC's authorization reading the **non-client-writable
  crown column (decision #25)** and the brand decaying/persisting at render time
  (**decision #15**). This is the deliberate _inverse_ of the [[CLAUDE]] "cosmetic
  tables are plain-RLS, NOT an RPC" gotcha: a cosmetic table legitimately IS RPC-only
  here because the write is a **privileged consequence**, not a self-service toggle.
  The reviewer independently agreed with this framing. A one-paragraph [[CLAUDE]]
  gotcha was added (extending the "Cosmetic / many-allowed tables" gotcha with this
  server-imposed-consequence exception) so a future agent doesn't mis-apply the
  plain-RLS shape. Reusable for any future "the Top Dog brands you X" surface.
- **No new architecture-decision row for TASK-071 (2026-06-18).** The anonymous
  burger-report surface was flagged in the spec as a _likely_ new decision row
  ("owner-scoped RLS exposes only the actor's own rows; the public aggregate is
  computed server-side so actor identity never reaches the client"). On inspection it
  introduces **no new invariant**: it is **decision #12** (cosmetic / many-allowed,
  no denormalized counter → structurally ranking-inert) with the SELECT narrowed from
  select-all to owner-scoped, **composed with decision #27/#6** (privileged
  service-client read constructed after the `safeGetSession()` gate — here used for
  an anonymous count read rather than for signed-URL minting) for the public
  aggregate, and **decision #15** for the render-time alarm decay. Following the
  TASK-070 and M3-reactions precedent (compositions recorded as a progress note, not
  a new row), it lives as the M7 TASK-071 progress note above rather than a new
  Architecture Decisions row. The reviewer APPROVEd; reusable shape for any future
  **anonymous** cosmetic surface (owner-scoped SELECT + server-side aggregate).

## Milestones

| Milestone                        | Target                                                                                                                                                                                                              | Status                   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 — Scaffold & infra            | SvelteKit + Supabase, SSR auth, RLS baseline, keep-alive, secrets, security-profile                                                                                                                                 | complete                 | All 5 tasks done (TASK-001/002/003/004/005). Hosted Supabase project live: schema pushed, repo secrets set, keep-alive enabled + verified green (HTTP 200). Tag `milestone-00-scaffold-infra`. See M0 close notes above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| M1 — Vertical slice              | invite → profile → upload one compressed dog → see it + smoke test                                                                                                                                                  | complete                 | All 5 tasks done: TASK-010 invite mint + redemption (PR #13 `ef59aea`), TASK-012 client WebP compression (PR #16 `2828468`, new `src/lib/image/` seam), TASK-011 profile creation + onboarding funnel (PR #18 `38db5d9`, new `src/lib/features/profiles/` module), TASK-013 hot dog upload + display (PR #20 `c552be5`, last M0 foundational orphan resolved), and TASK-014 `@smoke` + `@security` E2E (PR #22 `aed7e90`). Tag `milestone-01-vertical-slice`. All later milestones must keep the `@smoke` test passing. See M1 close notes above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| M2 — Voting & Top Dog engine     | vote/move rules, ranking, sticky tie-break, daily tally, badge                                                                                                                                                      | complete                 | All 5 tasks done. TASK-020 (ranking + sticky tie-break, PR #25 `835c2f0`) — pure `selectTopDog` seam. TASK-021 (Vote RPC, PR #28 `a170676`) — `cast_vote`/`remove_vote` SECURITY DEFINER RPCs (sole write path), drift-free `vote_count` from `COUNT(votes)` in-transaction, crown recompute mirrors `selectTopDog`; decision #25 (crown-column write lockdown) added in the fix cycle. TASK-022 (daily tally, PR #31 `4351aa9`) — `top_dog_days` + idempotent anon-callable `tally_top_dog_day()` RPC (decision #26) wired into keep-alive. TASK-023 (badge UI, PR #37 `6d1b206`) — read-only `<TopDogBadge>`, winning dog resolved by reusing `selectTopDog`. TASK-024 (vote-casting feed, PR #40 `94d2e52`) — global `/app/feed` (browse + cast/move/remove) doubling as the live leaderboard, consuming `castVote`/`removeVote`; **M2-close wiring audit re-passed (DW-009 resolved)**, voting is now end-to-end. Tag `milestone-02-voting-top-dog-engine`. See M2 close notes above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| M3 — Reactions & per-dog stats   | cosmetic reactions, peak votes                                                                                                                                                                                      | complete                 | All 4 tasks done. TASK-030 (cosmetic reactions, PR #43 `b27dc63`) — `hotdog_reactions` table + owner-scoped RLS insert/delete (deliberately not an RPC; no denormalized counter, render-time counts, so it structurally cannot affect ranking), `ReactionBar` wired into `/app/feed`. TASK-031 (per-dog stats, PR #45 `e1ffa0e`) — display/wiring only (no schema change): new `src/lib/features/hotdogs/detail.ts` query + `/app/dogs/[id]` detail route (404/500 mapping, read-only reaction summary, Stats block, `<TopDogBadge>`), `peak_votes` surfaced on the feed/tiles. TASK-032 (E2E hardening, PR #47 `5cf5879`) — live-stack `feed-detail.e2e.ts` covering feed cast/move/remove + react toggle + detail render + 404s, which surfaced a P0. TASK-033 (P0 fix, PR #47 `5cf5879`) — non-owner `hotdogs` signed URLs now minted server-side via the service client after the auth gate (decision #6 model preserved, no storage RLS change) + malformed-id `isUuid()` 404 guard. Tag `milestone-03-reactions-per-dog-stats`. See M3 close notes above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| M4 — Mustard mechanic            | spray + render-time decay + >24h prune                                                                                                                                                                              | complete                 | All 3 tasks done. TASK-040 (mustard decay math, PR #53 `5afd0da`) — pure render-time `src/lib/features/mustard/decay.ts` (`MUSTARD_LIFESPAN_MS` + `mustardOpacity`, full→0 over 24h, clock-skew clamp), TDD-first (19 unit cases), realizing decision #15; orphan-by-design with TASK-041 as the named consumer, no schema/RLS/RPC change. TASK-041 (mustard spray + render, PR #55 `e1eafb9`) — `mustard_sprays` table + plain owner-scoped RLS write with a **Top-Dog `WITH CHECK` INSERT gate** (only the current Top Dog may spray; gate trustworthy because `is_current_top_dog` is non-client-writable per decision #25), immutable/persistent (no UPDATE/DELETE), profile-page overlay rendered at render-time decay via `mustardOpacity` (consumes the TASK-040 seam); cosmetic flair like reactions but with the extra authz conjunct — captured as a reusable [[CLAUDE]] gotcha, not a new decision row. TASK-042 (mustard prune job, PR #57 `6452407`) — `prune_mustard_sprays()` SECURITY DEFINER RPC (the table's **sole DELETE path**, mirroring `tally_top_dog_day()`) deletes >24h sprays + `sprayed_at` index; anon-callable / idempotent / not-forgeable (decision #26 applied to a destructive job — no input, deletes only provably-invisible rows), wired into keep-alive as a third fail-on-non-2xx step. Tag `milestone-04-mustard-mechanic`. **Hosted-push gate pending** — the `mustard_sprays` + `mustard_prune` migrations must be `supabase db push`ed to hosted before the next keep-alive run (see Process notes). See M4 close notes above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| M5 — Walls & DMs                 | message walls + direct messages                                                                                                                                                                                     | complete                 | All 4 tasks done. TASK-050 (message walls, PR #60 `d3c7a4d`) — `wall_messages` table, plain owner-scoped RLS (decision #12, no counter), stores original body verbatim, SELECT any member / un-forgeable author pin / two-principal DELETE (author OR wall owner) / no UPDATE, wired into the profile route. TASK-051 (direct messages, PR #62 `4ac8ff8`) — `dms` table with a privacy boundary (participant-scoped SELECT, sender-pinned INSERT, no DELETE) + a `read_at`-only UPDATE column grant (decision #24's mechanism applied to a privacy column), pure `summarizeConversations` inbox collapse, `/app/messages` inbox + `/app/messages/[handle]` thread routes. TASK-052 (restore Data API grants, PR #66 `18f9baa`) — **P0 hotfix** for the 2026-05-30 `auto_expose_new_tables` default flip that stopped a fresh `supabase db reset` issuing the implicit base GRANTs PostgREST needs alongside RLS; new `restore_data_api_grants` migration makes grants explicit (authenticated SELECT all 9 tables; INSERT/DELETE only on counter-free cosmetic tables; DELETE on `hot_dogs`; service_role full DML; anon nothing) preserving the decision #24/#25 lockdowns + decision #12 RPC-only paths, `auto_expose_new_tables = false` pinned in config — recorded as **decision #28**. TASK-053 (grant-invariant verification, PR #68 `7603438`) — `tests/grants.e2e.ts` (`@security`, 11 cases) locks the required AND forbidden grant matrix in against drift. Tag `milestone-05-walls-dms`. **Hosted-push gate deferred to TASK-054** (three migrations in one `supabase db push`; user-gated ops, no auto-pause risk — see [[tasks/deferred]]). See M5 close notes above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| M6 — Emoji library               | hot-dog emoji set + render filter + random sprinkle                                                                                                                                                                 | complete                 | All 2 tasks done. TASK-060 (emoji filter + sprinkle, PR #71 `a2e309d`) — new dependency-free `src/lib/features/emoji/` (`emojiSet.ts` curated `HOTDOG_EMOJIS` + `isHotdogEmoji`; `filter.ts` `filterToHotdog` grapheme-cluster-safe via `Intl.Segmenter` + `sprinkleHotdog` deterministic via a hand-written `mulberry32` PRNG, zero deps), realizing **decision #16** (hot-dog-only library, filter at RENDER, store original); **TDD-first**, orphan-by-design, no schema/RLS/RPC change, no new decision row. TASK-061 (apply filter in walls/DM render, PR #72 `3d85087`) — new pure composition layer `src/lib/features/emoji/render.ts` (`renderWallBody` = filter + seeded sprinkle for walls via an FNV-1a per-message-uuid seed; `renderMessageBody` = filter only for DMs), wired into the profile wall + DM thread + DM inbox preview, all through Svelte auto-escaped text (no `{@html}` → XSS-safe); decision #16's store-original guarantee holds structurally (no persist path). DW-019 (VS16-decorated library emoji → `🌭`) **resolved/accepted**; DW-020 (render-DOM E2E gap) accepted tracked gap. No new decision row. Reviewer APPROVE, 0 fix cycles each; `pnpm test` 622/622, `@smoke` 4/4. Tag `milestone-06-emoji-library`. See M6 progress + close notes above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| M7 — Safety & polish             | upload limits, report button, polish                                                                                                                                                                                | complete                 | All 6 tasks done. TASK-070 (upload limits, PR #74 `864b8e2`) — three hard server-side layers (Storage-API `file_size_limit = 2 MiB` on both buckets, DB CHECK on declared `byte_size`, per-user-cap BEFORE INSERT trigger), composing decisions #10/#11/#24, DW-005 substantially mitigated. TASK-071 (🍔 report-hamburger + HAMBURGER ALARM, PR #78 `0089eb2`) — `burger_alarms` cosmetic table (decision #12, no counter, ranking-inert) with anonymous reporter (owner-scoped SELECT + service-client aggregate after the auth gate, decision #27), render-time decay + seeded-angle police-tape banners. TASK-073 (Top-Dog verdict + HAMBURGER LIAR / HERETIC, PR #80 `cdd17ff`) — moderation half of the Court: `render_burger_verdict` Top-Dog-gated SECURITY DEFINER RPC, two no-client-write stores (`burger_verdicts` / `hamburger_liars`, votes-style lockdown), render-time LIAR decay + derived persistent HERETIC, double-gated `/app/court`; composes decisions #12/#13/#15/#25. TASK-074 (Top Dog privileges in-app notice, PR #82 `20adc9a`) — small crown-holder nudge on the app home (gated at the parent on the live `is_current_top_dog` flag, decision #25; presentational component, client-only `localStorage` dismiss), **no schema / no migration / no new decision row**. TASK-075 (how-it-works help page, PR #84 `f894112`) — static everyone-facing `/app/help` route (no `load`, no per-user data) explaining the mechanics with the vote system emphasized; every mechanic-bearing line cross-checked against source (`voting/ranking.ts`, `mustard/decay.ts`, `reports/verdict.ts`); **no tests / no schema / no deps → no hosted-push gate, no new decision row**. TASK-072 (polish pass, PR #86 `8496d94`) — empty/loading/responsive AC polish (no redesign) + four DW fixes (DW-018 bounded DM reads, DW-021 friendly oversized-avatar `fail(400)`, DW-022 render-only report-control gate, DW-024 stabilized the flaky `@smoke` reaction test); no migration / no deps / no new decision row; one follow-up logged DW-025. **M7-close wiring audit CLEAN.** Tag `milestone-07-safety-polish`. **Closes M7 — and with it all pre-specified plenary milestones M0–M7.** **Two hosted pushes still OUTSTANDING** (user's hand) — the TASK-071 `burger_alarms` + TASK-073 `burger_verdicts` migrations must be `supabase db push`ed together (TASK-070's was pushed 2026-06-17; TASK-074/075/072 added none), no auto-pause risk. See M7 progress + close notes + Process notes above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| M8 — Snacktum Snacktorum rebrand | rebrand "Top Dog" → the hot-dog CULT app; app shell + nav, auth cluster (sign-in / reset / ritual sign-up), per-page rebuilds from the design mockups + cult slug renames, "Anoint" re-theme, error/404, cult theme | active — BUILDING (8/16) | **User-pivot milestone, SKIN NOT SKELETON** (user-facing copy/markup/CSS/new pages only — NO code-identifier or infra rename; "Top Dog" → "The Anointed Wiener" is **copy only**). Scoped in PR #90; auth-cluster + app-shell designs delivered in PR #91. **‼️ RE-SCOPED 2026-06-19 (PR #111, user-directed) — rebuild-from-design + re-slug.** The remaining pages are now **REBUILT FROM their `design/pages/*.dc.html` mockups** (per-page presentational rebuild of `+page.svelte`, preserving each `+page.server.ts` load+actions) **and the in-app routes RE-SLUGGED to cult names** (`app` → `snacktum-snacktorum`; feed→`procession`, dogs→`litter`, profile/[handle]→`shrine/[handle]`, messages→`epistles`, invite→`summon`, court→`tribunal`, help→`catechism`). The **four auth slugs are KEPT descriptive** (`/sign-in` / `/sign-up` / `/forgot-password` / `/reset-password`); the onboarding rite lives at `/sign-up`. Pre-launch (invite-only, not deployed) → **no old→new redirects.** A **scope decision, NOT a numbered decision row** (table stays #28; only planned new row is TASK-094's #29 prune retirement). Task set re-numbered: **8/16 complete** — TASK-087 (base cult theme, PR #99 `dcce8c3`), TASK-080 (app shell + persistent nav, PR #101 `544b7be` — bare `/app` hub retired, **`TopDogPrivilegesNotice` RETIRED**), TASK-083 (forgot/reset password — **6-digit OTP** + code-emitting recovery email template, PR #103 `3e236be`), TASK-082 (real `/sign-in` — `signInWithPassword`, non-enumerating, PR #105 `5445002` — **closes the auth cluster, functional end-to-end**), TASK-092 (the Snacktum Onboarding RITE at `/sign-up`, PR #112 `a5fd084` — the first rebuild-from-design page), **TASK-090 (the foundational slug refactor, PR #115 `38c8844`, 2026-06-20 — checkpoint tag `checkpoint-2026-06-20-pre-slug-refactor`)**: moved the in-app route **prefix** `/app` → `/snacktum-snacktorum` (directory + the `hooks.server.ts` auth-guard prefix so the protected area stays guarded in lockstep), repointed the root redirect to `/snacktum-snacktorum/feed` (the live leaf — TASK-091 renamed it to `procession`, since landed), re-wired the shell links, and swept the `/app/...` references in code + tests + live docs; **leaf names UNCHANGED** (deferred to the per-page rebuilds), the four gate slugs unchanged, the `/sign-in` redirect targets kept; 0 fix cycles, no migration / no dep / no new decision row. **TASK-091 (The Procession, PR #117 `dffaee5`, 2026-06-20 — the first rebuild-from-design IN-APP page):** the feed `+page.svelte` rebuilt from `design/pages/The Procession.dc.html`, the **load + all 6 actions preserved** (skin-not-skeleton, ~95% rename), the champion ribbon plumbed in via a widened `listVotableDogs` select (`is_current_top_dog` → derived `championDogId`, RLS-scoped read of the non-client-writable crown column, decision #25), the first leaf renamed `feed` → `procession` (the feed is now at `/snacktum-snacktorum/procession`; **only the feed leaf moved**), and the README/CLAUDE `/feed`→`/procession` current-state docs swept; champion title copy "The Anointed Wiener" (copy only). Reviewer APPROVE, 0 fix cycles (one mid-task escalation resolved by director decision), no migration / no dep / no new decision row. **TASK-093 (The Shrine, PR #122 `851fa0e`, 2026-06-22 — the second rebuild-from-design IN-APP page):** the profile `+page.svelte` rebuilt from `design/pages/The Shrine.dc.html`, the **load + all 3 actions (`spray` / `post` / `deleteMessage`) preserved** (skin-not-skeleton), the leaf renamed `profile` → `shrine` (the profile is now at `/snacktum-snacktorum/shrine/[handle]`; **only the `profile` leaf moved**), and a **derived stat ledger** added — new read-only `src/lib/features/profiles/stats.ts` (`loadShrineStats(...)` → `ShrineStats`, `EMPTY_SHRINE_STATS`) computing aggregates over existing tables with no schema/write path; seven counts stay RLS-scoped, the eighth ("Disciples Summoned" / redeemed invites) runs on the **service client** as a `head:true` count after `safeGetSession()` because `invites` is owner-scoped-RLS (`invites_select_own`) so an RLS count returns 0 cross-member — **generalizing the decision #27 service-client-after-gate pattern to a cross-member aggregate** (a head count ships no rows → no exposure widening). **2 fix cycles:** a tester-caught P0 (wall composer `<textarea name>` mismatched the `post` action's `formData.get('body')` → silent empty posts; fixed to `name="body"`) and reviewer two majors ("Disciples Summoned" RLS undercount → service-client head count; wall textarea themed validation never fired because the `<label>` was a sibling not a wrapper → nested it so `fieldLabel()`'s `closest('label')` resolves). The validation module was widened to validate `<textarea>` and `validationMessage.ts` gained the "Word upon the Shrine" themed label. Reviewer APPROVE (after 1 REQUEST_CHANGES round); `pnpm check` 0/0, `pnpm lint` clean, `pnpm test` 861/861, `@smoke` 5/5, `@security` 94/94; no migration / no dep / no new decision row. Discovered DW-035 (no jsdom vitest project → DOM-touching `.svelte.ts` logic unit-untested). TASK-092 details: a multi-step rite (Summoned → Inscribe → Choose Thy Sigil → Renounce → Received) that **absorbs and deletes** `(protected)/app/onboarding/`; profile forged at the Sigil step, Renounce a pure-UI oath, `createProfile` **returns `{ created, handle }` instead of redirecting** so the client advances without re-running `load` (which would redirect on the new profile); sigil stored as `sigil:<id>` in `avatar_path` (new `Sigil.svelte` + `sigils.ts`, no migration); Ordo Sancti Tubi **seal + wordmark header unified across all four auth/gate pages** via shared `.gate-mark`/`.gate-header`. Reviewer APPROVE; `pnpm check` 0, `pnpm lint` clean, `pnpm test` **830**, `@smoke` 5/5, `@security` 94/94. **All design questions RESOLVED** (2026-06-18 + 2026-06-19 OQ-5 dog-detail = **"The Relic"** + OQ-2 the five Anoint sub-decisions). **Ad-hoc M8 follow-up (not a queued task): themed inline form-validation landed and is now an app-wide CANON** (PR #109 `6c00c1c` — `createFormValidation()` rune + `validationMessage.ts` + `errorSlideFade`, replacing the native HTML5 bubble; rollout to remaining in-app forms tracked DW-032). **‼️ Posture change (OQ-2 Option A): TASK-094 (Anoint) will RETIRE `prune_mustard_sprays()`, carrying M8's ONE migration + a keep-alive workflow edit + a LIKELY new decision row #29 (mustard_sprays retention)** — recorded as a **plan**; the decision table stays at **#28** until it lands. **No migration / no new dependency / no new decision row this session.** Remaining 8 pending — the per-page rebuilds: TASK-094 (Anoint, carries the migration) / 094-R (Reliquary) / 095 / 096 / 097 / 098 / 099 / 100 / 101 (error page). See [[tasks/milestone-08-snacktum-snacktorum-rebrand]] |
