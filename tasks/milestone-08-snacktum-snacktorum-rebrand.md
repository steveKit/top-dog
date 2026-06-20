# Milestone M8: Snacktum Snacktorum — Rebrand & Redesign

> **Status:** `active` — **BUILDING** (activated 2026-06-19; **RE-SCOPED 2026-06-19**).
> **6/16 complete** — auth cluster + theme + shell + onboarding rite + the foundational
> slug refactor done: TASK-087 (theme) + TASK-080 (shell) + TASK-083 (password recovery) +
> TASK-082 (sign-in) + TASK-092 (onboarding rite) + **TASK-090 (slug refactor — PR #115,
> 2026-06-20)**. The slug refactor moved the in-app route prefix `/app` →
> `/snacktum-snacktorum` (directory + auth-guard prefix; leaf names unchanged, deferred to
> the per-page rebuilds); **TASK-091 (The Procession) is next.** The three complete gate
> pages (sign-in / forgot-password / reset-password) are finalized **and KEEP their
> descriptive slugs** (`/sign-in`, `/forgot-password`, `/reset-password` — the user
> finalized that these stay; they are NOT re-slugged).
> **Re-scope (2026-06-19):** the remaining work is **REBUILT FROM the design mockups**
> in `design/pages/*.dc.html` (a presentational rebuild per page, not an incremental
> restyle) **and the IN-APP routes are RE-SLUGGED to cult names** (the `app` URL segment →
> `snacktum-snacktorum`; each `/app/*` leaf → a cult slug). The four auth slugs are
> unchanged. One foundational slug-refactor task lands the prefix rename + reference
> rewrite; each remaining page gets its own rebuild-from-design task that **preserves its
> `+page.server.ts` and re-wires all data/feature plumbing** (skin not skeleton).
> Index: [[TASKS]] · Architecture: [[PROJECT]] · Conventions: [[CLAUDE]]
> **Goal:** Rebrand "Top Dog" → the hot-dog **CULT** app "Snacktum Snacktorum" and
> **rebuild the user-facing surface from the delivered design mockups** — re-slugged
> cult routes, a per-page presentational rebuild of every remaining page, the
> "Anoint" mustard re-theme, an error/404 page, and a derived honors Reliquary — plus
> the champion-title copy swap "Top Dog" → **"The Anointed Wiener"** everywhere users
> see it. **All designs are in hand** (`design/pages/`).

---

## ✅ Designs delivered — milestone is ACTIVE and re-scoped

**Every page is now mocked** (`design/pages/*.dc.html`) and all Open Questions are
resolved (OQ-1…OQ-5; see § Resolved decisions). The original "wait for DESIGNS"
execution block is **lifted** — the milestone is building. Dispatch tasks **only on
explicit user instruction**, in the § Dependencies & Sequencing order; do not
auto-chain.

> **What changed at the 2026-06-19 re-scope (user-directed):**
>
> 1. **Rebuild each remaining page FROM its design mockup** in `design/pages/*.dc.html`
>    — a presentational rebuild of `+page.svelte` (markup + styling), NOT an
>    incremental restyle of the existing markup.
> 2. **Re-slug the in-app routes to cult names** — the `app` URL segment becomes
>    `snacktum-snacktorum`, and each `/app/*` leaf takes a cult slug (see § Slug Map).
>    **The four auth slugs (`/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`)
>    are KEPT descriptive** (the user finalized this) — the gate pages are NOT re-slugged.
>    (Pre-launch, invite-only, not deployed → **no old→new redirects needed.**)
>
> This is a **deviation from the original plan's "URL paths UNCHANGED" note** (the old
> Page Naming Map said the rename was display-only). **URLs now DO change.** It remains
> a **skin-not-skeleton** pass at the code level (see the HARD SCOPE CONSTRAINT): no
> table/RPC/TS-symbol rename, no infra rename, decisions #1–#28 + L2 preserved.

---

## ‼️ HARD SCOPE CONSTRAINT — skin not skeleton (rebuild the presentation, preserve the wiring)

**This milestone changes what users SEE and the URL slugs they navigate — markup,
styling, copy, lore, and the route paths.** It does **NOT** rename code identifiers or
infrastructure, and it does **NOT** delete server logic. Every rebuild task repeats
this; here is the canonical list so no task can drift:

**MUST PRESERVE (forbidden to change in every task):**

- **Each page's `+page.server.ts`** — the `load` function AND its `actions`. A rebuild
  task replaces the **presentational** `+page.svelte`, re-wires the page's data/feature
  plumbing into the new markup, and **must NOT delete or gut the server load/actions.**
  If a server change is genuinely required, that is an escalation to the director, not a
  silent rewrite.
- **All data/feature wiring, re-connected into the new markup:**
  - RLS-scoped queries on `event.locals.supabase` (never widen to the service client
    except where decision #27 already requires it);
  - the **decision #27 server-side signed-URL pattern** for cross-member private-bucket
    images (`getServiceClient()` minting signed URLs **after** `safeGetSession()`, for
    rows the RLS query already returned — see the feed/detail loads);
  - the votes / reactions / walls / DMs / mustard(Anoint) / crown / badge / report+verdict
    wiring each page composes today.
- **Infrastructure identities** (pinned per [[resource-naming]]):
  - the Supabase project / DB / local containers (`top-dog`)
  - the git repository name
  - the keep-alive GitHub Actions workflow + its labels (`com.supabase.cli.project=top-dog`)
- **Code identifiers** (DB, TS, components — internal names stay as-is):
  - DB columns/tables: `is_current_top_dog`, `top_dog_since`, `days_as_top_dog`,
    `hot_dogs`, `mustard_sprays`, `hotdog_reactions`, `burger_alarms`, `burger_verdicts`,
    `hamburger_liars`, `wall_messages`, `dms`, `votes`, `top_dog_days`, `invites`,
    `profiles`, etc.
  - functions/RPCs: `recompute_top_dog`, `tally_top_dog_day`, `cast_vote`,
    `render_burger_verdict`, `prune_mustard_sprays`, etc.
  - TS symbols & components: `selectTopDog`, `TopDogBadge`, `mustardOpacity`,
    `summarizeBurgerAlarm`, etc.
- **Architecture & security posture:** preserve **every** locked decision #1–#28 and
  the **L2** security profile. The only planned migration in the whole milestone is
  TASK-094's prune retirement (+ a likely decision #29 — recorded as a plan); no other
  task adds a migration or a new decision row.

> **The route slug IS allowed to change (that is the point of the re-scope).** The
> directory/file path under `src/routes` changes (`app` → `snacktum-snacktorum`, leaf
> slugs to cult names) and the URL changes with it. What stays fixed is everything
> _inside_ the files: the `load`/`actions` logic, the feature module names, the DB/RPC
> identifiers. Renaming a route folder is in scope; renaming a code symbol to "match"
> the cult name is **out** of scope.

**MUST change (in scope):** the **route slugs** (§ Slug Map), each remaining page's
**`+page.svelte` markup + styling** (rebuilt from its mockup), user-visible
**strings / copy / lore / titles / microcopy**, and **new user-facing surfaces** (the
error/404 page, the onboarding rite, the Reliquary shelf).

> **Champion-title swap is COPY ONLY.** "Top Dog" the _displayed title_ becomes **"The
> Anointed Wiener"** wherever a user reads it. The _code_ keeps `is_current_top_dog` /
> `TopDogBadge` / `selectTopDog` / `days_as_top_dog`. A task that renames a code symbol
> to match the new title has **violated scope.**

---

## Form-validation CANON (apply in EVERY rebuilt form with required fields)

Every rebuilt page that has a form with required / empty-able fields MUST adopt the
app-wide themed-validation canon (see [[CLAUDE]] "Forms & validation (CANON)") — the
native HTML5 bubble is never used:

- `novalidate` on the `<form>`;
- `const validation = createFormValidation()` from
  `$lib/features/forms/formValidation.svelte.ts`, wrapping the page's `use:enhance`
  SubmitFunction via `validation.enhance(...)`;
- per field: `aria-invalid` + `aria-describedby` (in lockstep, removed together by
  `clearError`) + `oninput={validation.clearOnInput}`;
- render: `{#if validation.errors.<name>}<p class="field-error" role="alert" id={...}
transition:errorSlideFade>{...}</p>{/if}`;
- messages come from `$lib/features/forms/validationMessage.ts` (extend its themed
  label special-cases — **Mustard Address**, **Seal**, etc. — rather than hand-writing
  strings at the call site).

This applies to the rebuilt **onboarding rite** (TASK-092), the **Shrine** wall
composer (TASK-093), and any **Summon a Frank** / **Tribunal** / **DM composer** forms
in the litter / epistles / invite / tribunal rebuilds. Rollout is tracked as DW-032.

---

## Porting the design DSL → Svelte 5 (read once before any rebuild)

The mockups are a bespoke design DSL, **not** Svelte. Port the **visual/animation
intent**, do not copy the DSL. The constructs and their Svelte 5 equivalents:

| Mockup DSL                                                                                        | Port to                                                                                                                               |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `<x-dc>…</x-dc>`, `<helmet>`, `<script type="text/x-dc">` (a `DCLogic` class with `renderVals()`) | the page's `<script lang="ts">` + `<svelte:head>` where needed; the `renderVals()` mapping becomes `$derived` values from real `data` |
| `{{ expr }}` interpolation                                                                        | Svelte `{expr}` bound to real `data` from the load                                                                                    |
| `<sc-if value="{{ x }}">…</sc-if>`                                                                | `{#if x}…{/if}`                                                                                                                       |
| `<sc-for list="{{ items }}" as="item">`                                                           | `{#each items as item}…{/each}`                                                                                                       |
| `style-hover="…"`, `style-focus="…"`                                                              | real CSS `:hover` / `:focus-visible` rules (keep AA + visible focus, decision/DW-028)                                                 |
| inline `style="…"` with literal hex/px                                                            | **theme tokens** `var(--…)` from `src/lib/styles/tokens.css` (TASK-087) — **never literal hex**; switch accent via `data-accent`      |
| `<image-slot>` / `<dc-import name="Sigil…">`                                                      | real `<img>` (signed/public URL) / the inline sigil SVGs under `src/lib/assets/sigils/`                                               |
| Google-Fonts `<link>` in `<helmet>`                                                               | already self-hosted (`static/fonts/`, TASK-087) — **do not** re-add a CDN link                                                        |
| inline `@keyframes` (`glowPulse`/`fadeUp`/`stamp`/`unroll`)                                       | the tokenized utilities already in `src/app.css` (TASK-087) — reuse them, honor `prefers-reduced-motion`                              |

The signature flair (champion ribbon, HAMBURGER ALARM / CONFIRMED HAMBURGER stamps,
HERETIC / FALSE WITNESS police-tape, the badge, the mustard/Anoint splat) already
exists as themed components (`TopDogBadge`, `HamburgerAlarmBanner`,
`ProfilePoliceBanner`, `ConfirmedHamburgerStamp`, `ReactionBar`, `BurgerReportControl`)
— **reuse and re-place** them per the mock, don't re-implement them.

---

## Slug Map (FINALIZED by the user)

**The `(protected)` group stays** (it is a SvelteKit layout group — the `(protected)`
segment is not in the URL). What changes is the `app` segment → **`snacktum-snacktorum`**
and each in-app leaf slug. **Route params (`[handle]`, `[id]`) are preserved.**

### Group prefix + auth/gate pages (FINALIZED by the user)

**The four auth slugs are KEPT DESCRIPTIVE — they are NOT re-slugged.** The user finalized
that the auth cluster stays plain (`/sign-in`, `/sign-up`, `/forgot-password`,
`/reset-password`). The three complete gate pages keep their folders and paths in place;
only the in-app `app` prefix moves.

| Current route          | New route                                                        | File move / disposition                                                       |
| ---------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `/app/*` (URL segment) | `/snacktum-snacktorum/*`                                         | `src/routes/(protected)/app/` → `src/routes/(protected)/snacktum-snacktorum/` |
| `/sign-in`             | **`/sign-in` (UNCHANGED)**                                       | folder stays `src/routes/sign-in/` — no move (TASK-082, complete)             |
| `/sign-up`             | **`/sign-up` (UNCHANGED — hosts the onboarding rite, TASK-092)** | folder stays `src/routes/sign-up/`                                            |
| `/forgot-password`     | **`/forgot-password` (UNCHANGED)**                               | folder stays `src/routes/forgot-password/` — no move (TASK-083, complete)     |
| `/reset-password`      | **`/reset-password` (UNCHANGED)**                                | folder stays `src/routes/reset-password/` — no move (TASK-083, complete)      |

### Leaf slugs under `/snacktum-snacktorum/` (FINALIZED by the user)

| Current leaf             | Page (cult display name)                 | New route                                                                                                   |
| ------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `/app/feed`              | The Procession: Standings of the Blessed | `/snacktum-snacktorum/procession`                                                                           |
| `/app/dogs`              | Your Litter                              | `/snacktum-snacktorum/litter`                                                                               |
| `/app/dogs/[id]`         | The Relic                                | `/snacktum-snacktorum/litter/[id]`                                                                          |
| `/app/profile/[handle]`  | The Shrine                               | `/snacktum-snacktorum/shrine/[handle]`                                                                      |
| `/app/messages`          | Epistles                                 | `/snacktum-snacktorum/epistles`                                                                             |
| `/app/messages/[handle]` | Whispers                                 | `/snacktum-snacktorum/epistles/[handle]`                                                                    |
| `/app/invite`            | Summon a Frank                           | `/snacktum-snacktorum/summon`                                                                               |
| `/app/court`             | The Tribunal of the Holy Tube            | `/snacktum-snacktorum/tribunal`                                                                             |
| `/app/help`              | The Catechism                            | `/snacktum-snacktorum/catechism`                                                                            |
| `/app/onboarding`        | Snacktum Onboarding (the rite)           | **REMOVED — absorbed into `/sign-up`** (the rite lives at `/sign-up`; no standalone in-app onboarding leaf) |
| `/app` (retired hub)     | — (redirects to The Procession)          | `/snacktum-snacktorum` → `redirect → /snacktum-snacktorum/procession`                                       |

> **Onboarding — FINALIZED: the rite lives at `/sign-up`, no standalone leaf.** Under OQ-1
> B-absorb, **TASK-092's rite IS the `/sign-up` route**; the standalone
> `(protected)/app/onboarding/` route is **removed/absorbed**. There is **no
> `/snacktum-snacktorum/onboarding` or `/initiation`** slug. The profile-funnel guard (an
> authenticated-but-profile-less member) now funnels into the **`/sign-up` rite at the
> naming/sigil step** (the rite is resumable — they do NOT re-do invite-token/credentials);
> TASK-092 owns finalizing this. See TASK-092.
> **Dog detail** is nested under `litter` as `litter/[id]` ("The Relic" is a relic _in_
> your litter) — keeps the gallery→detail relationship in the URL.

> **No redirects needed.** The app is **pre-launch, invite-only, and not deployed**, so
> there are **no old→new redirect shims** — the old paths simply cease to exist. (If the
> app were live we'd add 301s; it is not, so we don't.)

---

## Page inventory & per-page disposition (the re-scoped surface)

| Page (cult name)                 | Mockup (`design/pages/`)        | Current route → new route                                           | Disposition                                                                                                 | Task                                  |
| -------------------------------- | ------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Enter the Snacktum** (sign-in) | `Log In.dc.html`                | `/sign-in` (UNCHANGED slug)                                         | COMPLETE — no slug change                                                                                   | —                                     |
| **Forgot password** (forgot)     | `Reset Password.dc.html` (req.) | `/forgot-password` (UNCHANGED slug)                                 | COMPLETE — no slug change                                                                                   | —                                     |
| **Reset password** (reset)       | `Reset Password.dc.html`        | `/reset-password` (UNCHANGED slug)                                  | COMPLETE — no slug change                                                                                   | —                                     |
| **App shell + nav**              | `App Chrome.dc.html`            | chrome (no own URL)                                                 | DONE (TASK-080) — refresh nav links + labels in the refactor + a styling pass folded into the per-page work | TASK-090 (links)                      |
| **Snacktum Onboarding** (rite)   | `Snacktum Onboarding.dc.html`   | `/sign-up` (the rite; standalone `/app/onboarding` REMOVED)         | REPLACE — rebuild `/sign-up` as the rite                                                                    | TASK-092                              |
| **The Procession** (feed)        | `The Procession.dc.html`        | `/app/feed` → `/snacktum-snacktorum/procession`                     | REBUILD from design                                                                                         | TASK-091                              |
| **Your Litter** (gallery)        | `Your Litter.dc.html`           | `/app/dogs` → `/snacktum-snacktorum/litter`                         | REBUILD from design                                                                                         | TASK-095                              |
| **The Relic** (dog detail)       | `The Relic.dc.html`             | `/app/dogs/[id]` → `/snacktum-snacktorum/litter/[id]`               | REBUILD from design                                                                                         | TASK-096                              |
| **The Shrine** (profile)         | `The Shrine.dc.html`            | `/app/profile/[handle]` → `/snacktum-snacktorum/shrine/[handle]`    | REBUILD from design (+ Anoint, + Reliquary slot)                                                            | TASK-093                              |
| **Epistles** (DM inbox)          | `Epistles.dc.html`              | `/app/messages` → `/snacktum-snacktorum/epistles`                   | REBUILD from design                                                                                         | TASK-097                              |
| **Whispers** (DM thread)         | `Whispers.dc.html`              | `/app/messages/[handle]` → `/snacktum-snacktorum/epistles/[handle]` | REBUILD from design                                                                                         | TASK-097                              |
| **Summon a Frank** (invite)      | `Summon a Frank.dc.html`        | `/app/invite` → `/snacktum-snacktorum/summon`                       | REBUILD from design                                                                                         | TASK-098                              |
| **The Tribunal** (court)         | `The Tribunal.dc.html`          | `/app/court` → `/snacktum-snacktorum/tribunal`                      | REBUILD from design                                                                                         | TASK-099                              |
| **The Catechism** (help)         | `The Catechism.dc.html`         | `/app/help` → `/snacktum-snacktorum/catechism`                      | REBUILD from design (accuracy-checked)                                                                      | TASK-100                              |
| **The Lost Pilgrim** (error/404) | `The Lost Pilgrim.dc.html`      | NEW `+error.svelte`                                                 | NEW                                                                                                         | TASK-101                              |
| **The Reliquary** (badges)       | prompt #12 (+ The Shrine mock)  | a section of The Shrine                                             | NEW derived module + shelf                                                                                  | TASK-094-R (folds into TASK-093 page) |
| **"Anoint"** (mustard re-theme)  | `The Shrine.dc.html` (splat)    | the mustard surface on The Shrine                                   | RE-THEME (+ the one migration)                                                                              | TASK-094                              |

---

## Confirmed decisions (baked into the tasks below)

- **App name:** "Snacktum Snacktorum" (the temple). Carried by the designs.
- **Champion title:** "Top Dog" → **"The Anointed Wiener"** — user-facing copy swap.
  Code identifiers unchanged (scope box).
- **False-accuser brand display label:** **HAMBURGER LIAR → FALSE WITNESS** — a
  DISPLAY-LABEL change only (the `hamburger_liars` table, `not_a_hamburger` verdict
  value, `getLiarBrandTimestamps` / `summarizeLiarBrand` / `liarBrand` /
  `ProfilePoliceBanner` symbols, and the `liar` badge id all stay). The designs already
  use "FALSE WITNESS".
- **Default landing route = The Procession.** Post-auth home is The Procession (the
  feed). Realized in TASK-080 as `/` → `/app/feed`; the slug refactor (TASK-090)
  repoints it to `/snacktum-snacktorum/procession`. The bare hub is retired (redirects
  to The Procession).
- **Cult / temple aesthetic** — the dark-temple theme (TASK-087) is the foundation; the
  rebuilds consume its `var(--…)` tokens and reuse its themed flair components.
- **Rebuild-from-design + re-slug (2026-06-19 re-scope, user-directed)** — recorded as a
  **scope decision** (not a numbered architecture-decision row): the deviation from the
  original "URL paths UNCHANGED" plan. URLs now change; code identifiers + infra do not.
  The decision table stays at **#28** (the only planned new row is TASK-094's #29).

---

## Active Tasks

> Re-scoped 2026-06-19. The completed gate/shell/theme tasks (and the foundational slug
> refactor, TASK-090) are in § Completed Tasks. Dispatch **only on explicit user
> instruction**, in the § Dependencies & Sequencing order. **TASK-090 (slug refactor) has
> landed** — every rebuild now builds on the final base paths (in-app prefix
> `/snacktum-snacktorum`, leaf names still pre-rename); **TASK-091 (The Procession) is
> next.**

### TASK-091: The Procession (feed) — rebuild from design + leaf-slug `feed` → `procession` [`pending`] [`P1`] [`L`]

**Owner:** unassigned
**Dependencies:** TASK-090 (final base paths); TASK-087 (theme tokens — done). Mockup:
`design/pages/The Procession.dc.html`. **`@smoke`-critical** (the slice's leaderboard
surface; the vote path is exercised). Touches
`src/routes/(protected)/snacktum-snacktorum/feed/+page.svelte` (rebuild) and renames the
leaf folder `feed` → `procession`.

**Scope:** rebuild the feed `+page.svelte` from the mockup as **The Procession: Standings
of the Blessed**, preserve `feed/+page.server.ts` (load + the 6 actions), re-wire all
feature plumbing into the new markup, and rename the leaf slug.

**Acceptance Criteria:**

- [ ] **`+page.svelte` rebuilt from `The Procession.dc.html`:** the centered temple
      column, eyebrow → h1 ("The Procession" / "Standings of the Blessed"), the ✦
      divider, the ranked `№`-numbered frank cards with image, `@handle`, vote count +
      `peak`, caption, and the vote/move/voted control states. Port the DSL `sc-for`
      cards → `{#each data.dogs}`, the `sc-if` champion ribbon / vote-state branches →
      `{#if}`, inline styles → `var(--…)` tokens. Reuse the themed flair components.
- [ ] **`feed/+page.server.ts` PRESERVED and re-wired** — the load (votable dogs,
      current vote, reactions via `summarizeReactions`, **decision #27 service-client
      signed URLs**, anonymous burger-alarm counts via the service client, my-reports,
      verdicts via `dogAlarmState`) and **all six actions** (`vote`, `remove`, `react`,
      `unreact`, `report`, `unreport`) are unchanged; the new markup wires every one. Do
      NOT delete or gut the load/actions.
- [ ] **Champion ribbon / HAMBURGER ALARM / CONFIRMED HAMBURGER** render correctly from
      the existing data (`isChampion` ↔ the crown, `alarm`/`alarmState` ↔
      `summarizeBurgerAlarm` + verdict). Reuse `HamburgerAlarmBanner` /
      `ConfirmedHamburgerStamp` / `TopDogBadge`; re-place per the mock.
- [ ] **Champion-title copy = "The Anointed Wiener"** in the ribbon/crown labels (copy
      only; `is_current_top_dog` untouched).
- [ ] **Leaf-slug rename** `feed` → `procession` (folder move). Update the root redirect
      target (`src/routes/+page.server.ts` → `/snacktum-snacktorum/procession`), the shell
      nav link + active-route check, and any other internal link to feed, in lockstep.
      (Coordinate with TASK-090 if it lands the redirect; whichever lands the rename owns
      the redirect target.)
- [ ] **Form-validation canon** is N/A here (the feed has no required-field form — its
      controls are single-button vote/react/report posts); no `createFormValidation`
      needed unless a rebuilt control gains a text field.
- [ ] **Security/wiring unchanged:** queries stay RLS-scoped on `event.locals.supabase`;
      only the existing decision #27 signed-URL minting uses the service client; no new
      trust path; no `{@html}` (captions render as auto-escaped text — XSS-safe).
- [ ] **Responsive + accessible:** semantic `<article>`/headings, image `alt`, visible
      focus on controls (decision/DW-028 — no color-only state cues), keyboard-operable
      vote/move/report controls.
- [ ] **Tests:** `feed/feed-action.test.ts` stays green (update only for intentional
      copy/markup changes). **`@smoke` stays green** — if the smoke flow asserts feed
      copy or the leaderboard, update it in lockstep with this page's new strings + path.
- [ ] **Gates green:** `pnpm check` 0, `pnpm lint` clean, `pnpm test` green, **`@smoke`
      green**, `@security` green. **No migration.**

**Notes (for the implementer):** the feed is the densest read surface (votes + reactions

- alarms + verdicts + signed URLs) — treat it as a re-skin + re-layout of an unchanged
  data flow, not a rewrite. Read `feed/+page.server.ts` and the existing `+page.svelte`
  fully first. No new dependency; no schema; no new decision row.

---

### TASK-093: The Shrine (profile) — rebuild from design + display-name + stat ledger + Reliquary slot [`pending`] [`P2`] [`L`]

**Owner:** unassigned
**Dependencies:** TASK-090 (paths); mockup `design/pages/The Shrine.dc.html`; TASK-087
(theme). **Composes with TASK-094 (Anoint splat on this page) and TASK-094-R (the
Reliquary shelf renders here).** **`@smoke`-critical** (the slice walks profile → wall).
Touches `src/routes/(protected)/snacktum-snacktorum/profile/[handle]/+page.svelte`
(rebuild) + its `+page.server.ts` (preserve load/actions; **add read-only aggregate
queries** for the derived stat ledger), and renames the leaf `profile` → `shrine`.

**Scope:** rebuild the profile `+page.svelte` from the mockup as **The Shrine** — a
display-name-forward header, the sigil ring, a proper wall composer, the derived stat
ledger, the Anoint splat surface, the FALSE WITNESS / HERETIC banners, and the Reliquary
shelf slot — preserving every existing feature wiring and adding only read-only
aggregate reads.

**Acceptance Criteria:**

- [ ] **`+page.svelte` rebuilt from `The Shrine.dc.html`:** the temple profile layout —
      sigil avatar (designed placeholder when `avatar_path` is null), a
      **display-name-forward** header with the `@handle` as the URL-safe id beneath, the
      stat ledger plaques, the wall, and the shelf slot. Port the DSL → Svelte 5 with
      `var(--…)` tokens.
- [ ] **`profile/[handle]/+page.server.ts` PRESERVED and re-wired** — the load
      (profile-by-handle, avatar public URL, `canSpray` from the viewer's crown, sprays
      for render-time decay, wall messages, `liarBrand` via `summarizeLiarBrand`,
      `isHeretic` via `isHamburgerHeretic`) and **all three actions** (`spray`, `post`,
      `deleteMessage`) are unchanged; the new markup wires every one. **Add only
      read-only aggregate queries** for the stat ledger (below). Do NOT delete/gut the
      load/actions.
- [ ] **Display-name surfacing:** `display_name` is the human name (header, wall
      authorship), `@handle` stays the URL-safe identifier (route param, canonical id);
      fall back to `@handle` if display name is blank. **No schema change** (both columns
      already load).
- [ ] **Derived stat ledger** — every value DERIVED from existing data via **read-only
      aggregate queries on the RLS-scoped load** (no new schema, no write path): Days as
      The Anointed Wiener (`days_as_top_dog`), Times Crowned (`top_dog_days` count),
      Franks Offered (`hot_dogs` count), Total Devotion (`sum(vote_count)`), Highest
      Blessing (`max(peak_votes)`), Disciples Summoned (redeemed `invites` where
      `inviter_id` = member AND `consumed_at is not null`), Anointings Received
      (`mustard_sprays` where `target_profile_id` = member), Reactions Received
      (`hotdog_reactions` via `hot_dogs.owner_id`). Reuse the HERETIC / FALSE WITNESS
      brands from the existing helpers — do not recompute. **Coordinate with TASK-094-R**:
      several of these aggregates are the same the badge module needs — assemble once,
      feed both.
- [ ] **‼️ Reports are ANONYMOUS — never surface the reporter side** (decision #27 /
      TASK-071). No "heresies you've called", no reporter-made count. Only consequences
      _borne_ (HERETIC, FALSE WITNESS, anointings received) are public. Hard constraint.
- [ ] **Wall composer** rebuilt as a real compose area (not the cramped inline box) with
      the **form-validation CANON** applied (the body field), `use:enhance` loading
      preserved, `renderWallBody` (emoji filter at render, decision #16) intact, post +
      delete actions wired, `invalidateAll` after mutation.
- [ ] **Reliquary shelf slot** laid out per the design (prompt #12) — this task lays out
      the **section/shelf slot**; **TASK-094-R owns the badge module + earned/locked
      shelf component**. If TASK-094-R hasn't landed, leave a clearly-marked placeholder
      and wire it when it's in (soft-coupled, neither hard-blocks the other).
- [ ] **Anoint splat surface** — the mustard overlay area is laid out for the **splat**
      treatment (TASK-094 owns the splat visual + decay + wall-notice). The `canSpray`
      gate (Top-Dog-only, decision #25) stays driven by the server-derived crown flag.
- [ ] **All existing profile features keep working + correctly wired:** mustard/Anoint
      overlay (`mustardOpacity`), wall (`renderWallBody`, post/delete), FALSE WITNESS /
      HERETIC banners (`ProfilePoliceBanner`), `TopDogBadge` (label "The Anointed
      Wiener"), `canSpray`.
- [ ] **Leaf-slug** `profile` → `shrine` (folder move → `shrine/[handle]`, param
      preserved); update the shell/links and the `@smoke` profile-URL assertion
      (`**/app/profile/${handle}` → `**/snacktum-snacktorum/shrine/${handle}`) in
      lockstep.
- [ ] **Security/wiring unchanged:** load stays RLS-scoped; cross-member private images
      (if any here) keep the decision #27 server-side signing; `display_name` + wall
      bodies render auto-escaped (no `{@html}`) — XSS-safe.
- [ ] **Tests:** `profile-load.test.ts`, `wall-action.test.ts`, `spray-action.test.ts`
      stay green (update for intentional copy/markup); add coverage for any newly-loaded
      ledger field. **`@smoke` stays green** (profile → wall in the slice; update its
      copy/path assertions in lockstep).
- [ ] **Gates green:** `pnpm check` 0, `pnpm lint` clean, `pnpm test` green, **`@smoke`
      green**, `@security` green. **No migration.**

**Notes (for the implementer):** this page composes the MOST features (Anoint, wall +
emoji, FALSE WITNESS / HERETIC, badge, canSpray, stat ledger) — preserve every wiring;
re-skin + re-layout, do not rewrite the data flow. The stat ledger + Reliquary are pure
reads of existing data. **The hard constraint: reports are anonymous — never a
reporter-side count.** Sequence after TASK-094 / TASK-094-R, or coordinate file scope
(all three touch this page + its load). No new dependency; no schema; no new decision row.

---

### TASK-094: "Anoint" — mustard re-theme (splat + 6h decay + persisting wall notice + prune retirement) [`pending`] [`P2`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-090 (paths); mockup `design/pages/The Shrine.dc.html` (the splat);
**OQ-2 FULLY RESOLVED** (all five sub-decisions — see below); composes with TASK-093 (the
Shrine hosts the overlay + the wall the notice composes into) and TASK-094-R. **The ONLY
M8 task that carries a migration.** Touches the mustard surface on the Shrine
`+page.svelte`, the spray action, `src/lib/features/mustard/decay.ts`
(`MUSTARD_LIFESPAN_MS`), the wall render (derived anoint-notice), `prune_mustard_sprays`
(retired — one migration), and `.github/workflows/keepalive.yml` (drop the prune step).
Does **NOT** change the `mustard_sprays` table shape, the `wall_messages`
table/immutability, or the spray write-path authorization.

**Scope (OQ-2 RESOLVED — build to these decided values):** rename the spray action to
**"Anoint"** in user-facing copy, re-theme the visual to a **splat**, shorten the overlay
decay to **~6h**, surface a derived/coalesced/**persisting** "anoint → wall notice", and
**retire the prune job** so the notice's source rows survive.

- **OQ-2a — keep gated.** Only the reigning champion may Anoint — the decision #25
  `WITH CHECK` on the non-client-writable crown column is **unchanged**.
- **OQ-2b — no re-mechanic, no merge.** Anoint stays the existing mustard spray, re-copied
  as "anointing." The emoji reactions surface is **untouched**.
- **OQ-2c — splat visual.** Reuse the splat animation in `design/pages/The Shrine.dc.html`.
- **OQ-2d — decays over ~6h** (was ~24h): a render-time constant change to
  `MUSTARD_LIFESPAN_MS` (`24h` → `6h`) + its co-located tests. **No migration for the
  decay change** (DB still stores the raw `sprayed_at`).
- **OQ-2e — anoint → wall notice = 24h ROLLING STACK; PERSISTS.** Render-time derived from
  `mustard_sprays`, coalesced into one "×N" notice on the anointed member's wall; rolling
  24h window that RESETS at each anointing; a >24h gap starts a new notice. The notice
  PERSISTS (only the overlay decays).

> **‼️ IMPLEMENTATION DIRECTION = Option A (user-approved) — CARRIES ONE MIGRATION.**
> Because the wall notice PERSISTS and is render-derived from `mustard_sprays` rows, those
> rows must SURVIVE → the daily **`prune_mustard_sprays()` job is RETIRED.** This task
> ships (a) **one migration** retiring/neutering `prune_mustard_sprays` (drop or no-op —
> keep its EXECUTE-lockdown posture; preserve the table's decision #28 grants + decision
> #12 RLS), (b) a **keep-alive workflow edit** dropping the daily prune step, and (c) a
> **likely new architecture-decision row #29** (mustard_sprays retention). Batch the
> hosted push onto the standing M7 hosted-push gate. The director adds the real
> [[PROJECT]] decision-table row when this task is implemented (the table stays #28 until
> then).

**Acceptance Criteria:**

- [ ] **"Anoint" copy** replaces "spray mustard" wherever a user reads it (the Shrine
      action button, the Catechism). Code identifiers (`mustard_sprays`, `mustardOpacity`,
      `MUSTARD_LIFESPAN_MS`, the `spray` action, `prune_mustard_sprays`) **stay unchanged**
      — the prune function is _retired_ (dropped/neutered), not renamed.
- [ ] **Overlay decay → ~6h (OQ-2d):** `MUSTARD_LIFESPAN_MS` `24*60*60*1000` →
      `6*60*60*1000`; update the module doc-comment + `decay.test.ts` boundary cases
      (the 24h clamp/half-life assertions move to 6h). No migration.
- [ ] **Splat visual (OQ-2c)** applied in the overlay component + theme styles, reusing
      the splat animation from the Shrine mock.
- [ ] **Derived, coalesced, persisting "anoint → wall notice" (OQ-2e):** RENDER-TIME
      derived from existing `mustard_sprays` rows — **NO new schema/table/write path, NO
      change to `wall_messages` immutability.** The wall render composes real
      `wall_messages` with a **synthesized** anoint-notice ("The Anointed Wiener anointed
      you ×N"), grouped by a rolling-24h window that resets at each anointing (>24h gap →
      new notice), sorted chronologically among the messages. Un-forgeable by construction
      (same derived no-write pattern as the Reliquary / alarm summarizer / decay).
- [ ] **`prune_mustard_sprays()` retired (Option A):** one migration retires/neuters the
      prune function so anoint rows are never pruned; preserve the `mustard_sprays`
      decision #28 grants + decision #12 RLS (touch only the prune function). Edit
      `.github/workflows/keepalive.yml` to drop the daily prune step (ping + tally stay).
      Flag **decision #29** to the director.
- [ ] **Authorization preserved (OQ-2a):** the plain owner-scoped RLS spray write with the
      Top-Dog `WITH CHECK` on `is_current_top_dog` (decision #25) is **untouched**;
      `canSpray` stays server-derived.
- [ ] **Reactions untouched (OQ-2b).**
- [ ] **Hosted-push gate:** push the prune-retirement migration to hosted (batch with the
      M7 `burger_alarms` / `burger_verdicts` migrations) and drop the keep-alive prune
      step **in lockstep** so the workflow never calls a retired RPC (avoiding the
      hosted-schema-drift 404 in [[CLAUDE]]).
- [ ] **Tests:** `spray-action.test.ts` green (copy); `decay.test.ts` updated for 6h; add
      coverage for the pure anoint-notice coalescing (rolling-24h grouping, ×N, >24h →
      new notice). Adjust any affected `@security` case if the prune retirement changes a
      live-DB guarantee. `@smoke` / `@security` green.
- [ ] **Gates green:** `pnpm check` 0, `pnpm lint` clean, `pnpm test` green, `@smoke`
      green, `@security` green. **One migration** (prune retirement) — the only M8 task
      with one.

**Notes (for the implementer):** OQ-2 is fully decided — build to the resolved values, do
not re-guess. The decay-constant change needs no migration; the **prune retirement is the
load-bearing structural change** that makes the persisting notice coherent. Ship the
migration + workflow edit + decision-#29 row together; batch the hosted push. Composes
into TASK-093's Shrine page — sequence/coordinate file scope. No new dependency.

---

### TASK-094-R: The Reliquary — derived badge / honors module + shelf [`pending`] [`P3`] [`M`]

**Owner:** unassigned
**Dependencies:** mockup prompt #12 ("The Reliquary") + `design/pages/The Shrine.dc.html`
(the shelf renders on the Shrine); **soft-couples with TASK-093** (the Shrine lays out the
slot; this owns the module + shelf); TASK-087 (theme). **The pure module + tests are a
separate file with no overlap — buildable in parallel with anything; only the
profile-load wiring + shelf component collide with TASK-093.**

**Scope / posture:** a **purely DERIVED, read-only** honors feature — pure functions over
EXISTING tables, surfaced on the Shrine load. **NO new schema, NO migration, NO new write
path, NO new dependency, NO new RPC.** Un-forgeable by construction (no client-settable
badge state). Mirrors `voting/ranking.ts` / `mustard/decay.ts` / `reports/alarm.ts` /
`reports/verdict.ts`. **Composes existing decisions #12/#13/#15/#27 — NOT a new numbered
decision row** (recorded as a derived/scope note).

**Acceptance Criteria:**

- [ ] **New pure module `src/lib/features/badges/`** (e.g. `badges.ts`) — dependency-free,
      no SvelteKit/Supabase imports in the pure part; takes a `BadgeInputs` value object
      (already-loaded member facts) and returns earned + locked badge state (each badge:
      id, earned, and for tiered badges the current tier + next threshold). The route load
      assembles `BadgeInputs`; the module computes.
- [ ] **Co-located TDD tests `badges.test.ts`** — each badge's earned/not-earned boundary
      (at / just-below / just-above), every tier boundary, the all-locked (new member)
      case, the all-earned case, defensive zero/missing inputs. Pure value-in/value-out.
- [ ] **The v1 badge set — EXACTLY these, each VERIFIED derivable from existing schema:**
  - **First Frank** — ≥1 `hot_dogs` (owner = member).
  - **Crowned** — tiered 1/7/30, from `days_as_top_dog`.
  - **Centurion** — `max(peak_votes)` ≥ 100 over the member's dogs.
  - **The Summoner** — tiered, redeemed `invites` (`inviter_id` = member AND
    `consumed_at is not null` — the authoritative spent signal, NOT `consumed_by`).
  - **The Drenched** — tiered, `mustard_sprays` where `target_profile_id` = member.
  - **Heretic** — owns a `confirmed_hamburger` verdict; **reuse `isHamburgerHeretic` /
    `getDogVerdictsForOwner`**.
  - **False Witness** (display label; badge id `liar` unchanged) — has a `hamburger_liars`
    brand; **reuse `getLiarBrandTimestamps`** (decide _ever-branded_ vs _currently_ with
    the designer; a relic shelf usually wants _ever_).
  - **The Inquisitor** — tiered, `burger_verdicts` where `decided_by` = member.
  - **Elder** — early member by `profiles.joined_at` (document a concrete threshold in the
    module — a single source of truth, not a scattered magic number).
- [ ] **Out of v1 — flag, do NOT build:** a total-votes-ever honor (the `votes` table
      keeps only the one current vote — `UNIQUE(voter_id)`) and reign-streak honors
      (`top_dog_days` records discrete days, not streak metadata). Note in the module
      doc-comment + log as Discovered Work.
- [ ] **Reliquary shelf component** (e.g. `src/lib/components/Reliquary.svelte`) —
      presentational only (takes computed badge state as a prop; no badge logic in the
      component), showing earned (lit) vs locked (dim) relics with tier indicators, per
      the design. Mirrors `TopDogBadge` / `ProfilePoliceBanner`.
- [ ] **Wired into the Shrine load** (`shrine/[handle]/+page.server.ts`) — gather inputs
      via read-only queries on the RLS-scoped `event.locals.supabase`, build `BadgeInputs`,
      run the module, pass the result to the page. **No service client** (no
      anonymity-sensitive reads); **no write path.** A read failure degrades that badge to
      locked. **Coordinate with TASK-093's stat ledger** — assemble the shared aggregates
      once.
- [ ] **‼️ Reporter anonymity preserved (decision #27):** no badge keys on the reporter
      side. "Heretic" keys on the member's OWN dogs' verdicts; "False Witness" on the
      member's OWN `hamburger_liars` brand; "Inquisitor" on `decided_by` = member. No
      "heresies you've called" badge. Hard constraint.
- [ ] **Code identifiers neutral** (HARD SCOPE): `badges`, `Reliquary`, `BadgeInputs`,
      ids `first_frank`/`crowned`/`centurion`/`summoner`/`drenched`/`heretic`/`liar`/
      `inquisitor`/`elder`. Cult names are copy/labels only.
- [ ] **Purely derived / read-only:** no migration, no new write path, no new dependency,
      no new RPC, no new schema. Un-forgeable. Grep at the end: no `create table` / no
      manifest change / no new `.rpc(`.
- [ ] **`@smoke` stays green** (the shelf renders on the Shrine the slice walks).
- [ ] **Gates green:** `pnpm check` 0, `pnpm lint` clean, `pnpm test` green (the new
      `badges.test.ts` included), `@smoke` green, `@security` green. **No migration.**

**Notes (for the implementer):** the textbook pure-render-time seam for this codebase —
copy the shape of `voting/ranking.ts` / `mustard/decay.ts` / `reports/verdict.ts`. Reuse
the existing verdict/liar helpers; only the count/max/threshold logic is new. The pure
module is buildable first (design-independent); the shelf component is design-led. No new
dependency; no schema; no new decision row.

---

### TASK-095: Your Litter (own-dogs gallery + upload) — rebuild from design + leaf `dogs` → `litter` [`pending`] [`P2`] [`L`]

**Owner:** unassigned
**Dependencies:** TASK-090 (paths); mockup `design/pages/Your Litter.dc.html`; TASK-087
(theme). **`@smoke`-critical** (the slice uploads a dog + sees it here). Touches
`src/routes/(protected)/snacktum-snacktorum/dogs/+page.svelte` (rebuild) + preserves its
`+page.server.ts`; renames the leaf `dogs` → `litter`.

**Scope:** rebuild the own-dogs gallery + upload `+page.svelte` from the mockup as **Your
Litter**, preserve the upload/list/delete load + actions, re-wire all plumbing, rename
the leaf.

**Acceptance Criteria:**

- [ ] **`+page.svelte` rebuilt from `Your Litter.dc.html`** — the temple gallery layout,
      the upload affordance, the per-dog tiles (own dogs gallery stays on the RLS client —
      own-bucket SELECT works without the service client). Port DSL → Svelte 5 / tokens.
- [ ] **`dogs/+page.server.ts` PRESERVED and re-wired** — the load (own dogs + per-row
      signed URLs via the RLS client, per-row graceful degradation) and the upload + delete
      actions (client-side `compressToWebp`, the 100-per-user cap, `evaluateUpload` global
      guard, owner-prefix path, fail-closed compensating delete on insert failure) are
      unchanged; the new markup wires them. Do NOT delete/gut.
- [ ] **Upload-limit wiring intact** (TASK-070): the form-action size/count check stays as
      the friendly UX layer; the authoritative DB + Storage-API caps are unchanged.
- [ ] **Form-validation CANON** applied to the upload form's required fields (the photo /
      caption inputs) where empty-able.
- [ ] **HAMBURGER ALARM / CONFIRMED HAMBURGER** on a flagged own-dog render correctly
      (reuse the components) per the mock.
- [ ] **Leaf-slug** `dogs` → `litter` (folder move); update the shell ＋Upload target +
      nav, and the `@smoke` `/app/dogs` navigation (`→ /snacktum-snacktorum/litter`) +
      its copy assertions ("Your hot dogs", "Add hot dog", "No hot dogs yet...") in
      lockstep with the new strings.
- [ ] **Security/wiring unchanged:** own-gallery stays on `event.locals.supabase`
      (RLS-scoped); no `{@html}`; no new trust path.
- [ ] **Responsive + accessible:** semantic gallery, image `alt`, labeled upload inputs,
      visible focus.
- [ ] **Tests:** `dogs/dogs-action.test.ts` stays green (update for copy/markup).
      **`@smoke` stays green** (upload → see dog; update copy/path in lockstep).
- [ ] **Gates green:** `pnpm check` 0, `pnpm lint` clean, `pnpm test` green, **`@smoke`
      green**, `@security` green. **No migration.**

**Notes (for the implementer):** the own-dogs gallery correctly stays fully on the RLS
client (own-bucket SELECT) — do NOT introduce the service client here (that is only for
cross-member views, decision #27, which is the Relic/Procession concern). No new
dependency; no schema; no new decision row.

---

### TASK-096: The Relic (dog detail) — rebuild from design + leaf `dogs/[id]` → `litter/[id]` [`pending`] [`P2`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-090 (paths); mockup `design/pages/The Relic.dc.html`; TASK-087
(theme); coordinates with TASK-095 (shares the `litter` leaf parent). Touches
`src/routes/(protected)/snacktum-snacktorum/dogs/[id]/+page.svelte` (rebuild) + preserves
its `+page.server.ts`; renames the leaf under `litter/[id]`.

**Scope:** rebuild the dog-detail `+page.svelte` from the mockup as **The Relic**,
preserve the detail load + any actions, re-wire the cross-member signed-URL + stats +
reactions + alarm/verdict plumbing, rename the leaf.

**Acceptance Criteria:**

- [ ] **`+page.svelte` rebuilt from `The Relic.dc.html`** — the relic detail layout (the
      enshrined frank, its stats, reactions, owner, alarm/verdict state). Port DSL →
      Svelte 5 / tokens; reuse the flair components.
- [ ] **`dogs/[id]/+page.server.ts` PRESERVED and re-wired** — the detail load (per-dog
      stats via `detail.ts`, the **decision #27 server-side service-client signed URL** for
      this cross-member private-bucket image, reactions via `summarizeReactions`,
      alarm/verdict state) and any actions are unchanged; the new markup wires them. Do
      NOT delete/gut.
- [ ] **‼️ Decision #27 preserved:** because The Relic shows ANOTHER member's dog from the
      private `hotdogs` bucket, the signed URL is minted **server-side with the service
      client AFTER `safeGetSession()`**, signing only the `image_path` the RLS query
      returned. Keep the dog/owner/reaction QUERIES on the RLS client. No exposure
      widening.
- [ ] **Reactions + HAMBURGER ALARM / CONFIRMED HAMBURGER** render from the existing data;
      reuse the components per the mock.
- [ ] **Leaf-slug** `dogs/[id]` → `litter/[id]` (param preserved); update every link to a
      dog detail (from the gallery + feed cards) in lockstep.
- [ ] **Security/wiring unchanged** beyond the existing decision #27 signing; no `{@html}`
      (caption auto-escaped).
- [ ] **Responsive + accessible:** semantic detail, image `alt`, visible focus.
- [ ] **Tests:** `dogs/[id]/detail-load.test.ts` stays green (update for copy/markup).
      `@smoke` / `@security` green (the feed-detail E2E exercises this surface — update
      paths/copy if it asserts them).
- [ ] **Gates green:** `pnpm check` 0, `pnpm lint` clean, `pnpm test` green, `@smoke`
      green, `@security` green. **No migration.**

**Notes (for the implementer):** The Relic is the canonical decision #27 surface
(cross-member private image) — the server-side service-client signing is load-bearing; a
P0 was caught here historically (TASK-033). Preserve it exactly. No new dependency; no
schema; no new decision row.

---

### TASK-097: Epistles (DM inbox) + Whispers (DM thread) — rebuild from design + leaf `messages` → `epistles` [`pending`] [`P2`] [`L`]

**Owner:** unassigned
**Dependencies:** TASK-090 (paths); mockups `design/pages/Epistles.dc.html` +
`design/pages/Whispers.dc.html`; TASK-087 (theme). Touches
`src/routes/(protected)/snacktum-snacktorum/messages/+page.svelte` (inbox rebuild) and
`messages/[handle]/+page.svelte` (thread rebuild) + preserves both `+page.server.ts`;
renames the leaf `messages` → `epistles` (+ `epistles/[handle]`).

**Scope:** rebuild both DM `+page.svelte`s from their mockups as **Epistles** (inbox) and
**Whispers** (thread), preserve both loads + the send action, re-wire all plumbing, rename
the leaf (and its `[handle]` child).

**Acceptance Criteria:**

- [ ] **Epistles inbox rebuilt from `Epistles.dc.html`** — the conversation list with the
      `summarizeConversations` render-time collapse, preview via `renderMessageBody`
      (emoji filter, decision #16), per-conversation `read_at` state. Preserve
      `messages/+page.server.ts` (the bounded inbox load, DW-018) + re-wire.
- [ ] **Whispers thread rebuilt from `Whispers.dc.html`** — the message thread with the
      compose box, messages via `renderMessageBody`, the conversation-scoped privacy load.
      Preserve `messages/[handle]/+page.server.ts` (the thread load + the send action, the
      `read_at`-only mutation boundary, DW-025's head-limit note) + re-wire.
- [ ] **Both `+page.server.ts` PRESERVED and re-wired** — the conversation-scoped privacy
      SELECT, the `read_at`-only mutation boundary (decision #24 applied to a privacy
      column), the bounded reads. Do NOT delete/gut.
- [ ] **Form-validation CANON** applied to the Whispers compose box (the message body
      field).
- [ ] **Leaf-slug** `messages` → `epistles` (+ `messages/[handle]` → `epistles/[handle]`,
      param preserved); update the shell nav (Epistles link) + every link to a thread in
      lockstep.
- [ ] **Security/wiring unchanged:** loads stay RLS-scoped + conversation-privacy-scoped;
      bodies render auto-escaped via `renderMessageBody` (no `{@html}`); the send action
      pins `author_id = auth.uid()`.
- [ ] **Responsive + accessible:** semantic list/thread, labeled compose box, visible
      focus.
- [ ] **Tests:** `messages/inbox-load.test.ts` + `messages/[handle]/thread-load.test.ts`
      stay green (update for copy/markup). `tests/dms.e2e.ts` green (update paths/copy if
      asserted).
- [ ] **Gates green:** `pnpm check` 0, `pnpm lint` clean, `pnpm test` green, `@smoke`
      green, `@security` green. **No migration.**

**Notes (for the implementer):** two pages (inbox + thread) share the `epistles` leaf —
rebuild both together so the leaf rename is atomic. Store-original / render-filter
(decision #16) is structural — never persist the filtered output. No new dependency; no
schema; no new decision row.

---

### TASK-098: Summon a Frank (invite) — rebuild from design + leaf `invite` → `summon` [`pending`] [`P2`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-090 (paths); mockup `design/pages/Summon a Frank.dc.html`;
TASK-087 (theme). Touches
`src/routes/(protected)/snacktum-snacktorum/invite/+page.svelte` (rebuild) + preserves its
`+page.server.ts`; renames the leaf `invite` → `summon`.

**Scope:** rebuild the invite `+page.svelte` from the mockup as **Summon a Frank**,
preserve the invite-minting load + action, re-wire, rename the leaf.

**Acceptance Criteria:**

- [ ] **`+page.svelte` rebuilt from `Summon a Frank.dc.html`** — the temple "summon" ritual
      framing, the generated invite link display + copy affordance. Port DSL → Svelte 5 /
      tokens.
- [ ] **`invite/+page.server.ts` PRESERVED and re-wired** — the invite-mint load/action
      (a unique invite link via the existing invite RPC/flow, decisions #17/#22/#23) is
      unchanged; the new markup wires it. Do NOT delete/gut.
- [ ] **Form-validation CANON** applied if the rebuilt form has a required field (e.g. a
      "mint" trigger or any input the design adds); otherwise N/A for a single-button mint.
- [ ] **Leaf-slug** `invite` → `summon` (folder move); update any link to invite (e.g. the
      shell's ＋Summon target if it points at invite vs upload — verify which) in lockstep.
- [ ] **Security/wiring unchanged:** load/action stay RLS-scoped; the invite token is
      minted server-side; no `{@html}`.
- [ ] **Responsive + accessible:** labeled copy-link control, visible focus.
- [ ] **Tests:** `invite/invite-action.test.ts` stays green (update for copy/markup).
- [ ] **Gates green:** `pnpm check` 0, `pnpm lint` clean, `pnpm test` green, `@smoke`
      green, `@security` green. **No migration.**

**Notes (for the implementer):** the invite mint is the growth path's source — preserve
the single-use invite mechanics exactly. No new dependency; no schema; no new decision row.

---

### TASK-099: The Tribunal (court) — rebuild from design + leaf `court` → `tribunal` [`pending`] [`P2`] [`L`]

**Owner:** unassigned
**Dependencies:** TASK-090 (paths); mockup `design/pages/The Tribunal.dc.html`; TASK-087
(theme). Touches `src/routes/(protected)/snacktum-snacktorum/court/+page.svelte` (rebuild)

- preserves its `+page.server.ts`; renames the leaf `court` → `tribunal`.

**Scope:** rebuild the court `+page.svelte` from the mockup as **The Tribunal of the Holy
Tube**, preserve the double-gated adjudication load + verdict action, re-wire, rename the
leaf.

**Acceptance Criteria:**

- [ ] **`+page.svelte` rebuilt from `The Tribunal.dc.html`** — the tribunal layout: the
      flagged-frank docket, the verdict controls (confirm heresy / acquit), the cult-voiced
      framing. Port DSL → Svelte 5 / tokens; reuse the police-tape components.
- [ ] **`court/+page.server.ts` PRESERVED and re-wired** — the **double-gated**
      adjudication (UI crown gate + the `render_burger_verdict` SECURITY DEFINER RPC's
      authoritative DB gate on the non-client-writable `is_current_top_dog`, decision #25),
      the **anonymous flagged-dog aggregate** (service-client after the gate, preserving
      TASK-071 reporter anonymity, decision #27), and the verdict action are unchanged; the
      new markup wires them. Do NOT delete/gut.
- [ ] **‼️ Reporter anonymity + crown gate preserved (decisions #25/#27):** the flagged-dog
      list stays an anonymous service-client aggregate AFTER the crown gate; never expose
      reporter ids; the verdict write stays RPC-only.
- [ ] **Champion-title copy = "The Anointed Wiener"** in the "Top Dog is the adjudicator"
      framing (copy only). FALSE WITNESS / HERETIC labels applied per the design.
- [ ] **Leaf-slug** `court` → `tribunal` (folder move); update the **crown-gated shell nav
      link** (☩ The Tribunal) target + active-route check, and the gate stays driven by
      `data.profile.is_current_top_dog` — not widened.
- [ ] **Security/wiring unchanged:** the double gate + anonymity are load-bearing; no
      `{@html}`.
- [ ] **Responsive + accessible:** semantic docket, labeled verdict controls, visible
      focus.
- [ ] **Tests:** `court/court-action.test.ts` stays green (update for copy/markup).
      `tests/burger-court.e2e.ts` green (update paths/copy if asserted).
- [ ] **Gates green:** `pnpm check` 0, `pnpm lint` clean, `pnpm test` green, `@smoke`
      green, **`@security` green** (the court is a privileged surface). **No migration.**

**Notes (for the implementer):** the Tribunal is the most authorization-sensitive page —
the double gate (UI + DB RPC) and the anonymous aggregate are load-bearing; preserve them
exactly. No new dependency; no schema; no new decision row.

---

### TASK-100: The Catechism (help) — rebuild from design + leaf `help` → `catechism` (accuracy-checked) [`pending`] [`P3`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-090 (paths); mockup `design/pages/The Catechism.dc.html`; TASK-087
(theme); **must reflect TASK-094's ~6h mustard change** (OQ-2d) if TASK-094 has landed.
Touches `src/routes/(protected)/snacktum-snacktorum/help/+page.svelte` (rebuild — it has no
`+page.server.ts`, static content); renames the leaf `help` → `catechism`.

**Scope:** rebuild the help `+page.svelte` from the mockup as **The Catechism**, re-theme
the copy to cult voice, **preserve mechanical accuracy** (it describes live mechanics),
rename the leaf.

**Acceptance Criteria:**

- [ ] **`+page.svelte` rebuilt from `The Catechism.dc.html`** — the catechism / illuminated
      doctrine layout explaining what members can do, the **vote system** emphasized (one
      movable vote, no self-vote, most votes → crown, sticky tie-break, days tally), plus
      Top Dog powers, reactions, Anoint(mustard), walls & DMs, the Tribunal. Port DSL →
      Svelte 5 / tokens. Static content (no load, no per-user data).
- [ ] **‼️ Mechanical accuracy preserved** — the cult re-theme changes only the VOICE, not
      any described BEHAVIOR. Re-verify every mechanic-bearing line against source
      (`voting/ranking.ts`, `mustard/decay.ts`, `reports/verdict.ts`) exactly as TASK-075
      did. **Update the mustard/Anoint lifespan copy from "~24h" → "~6h"** (OQ-2d /
      `MUSTARD_LIFESPAN_MS`) in lockstep with TASK-094 — if TASK-094 lands first, reflect
      ~6h; if this lands first, coordinate so the two don't disagree. Apply the FALSE
      WITNESS / "The Anointed Wiener" labels.
- [ ] **Leaf-slug** `help` → `catechism` (folder move); update the shell nav (The Catechism
      link) + any "how it works" link in lockstep.
- [ ] **XSS-safe:** fixed strings, no `{@html}`, no user content. `aria-labelledby`
      sections.
- [ ] **Responsive + accessible:** semantic sections, visible focus on any links.
- [ ] **Tests:** no per-user tests (static), but `@smoke` green (if the shell/nav link is
      asserted, update). Add/adjust nothing unless a test asserts catechism copy.
- [ ] **Gates green:** `pnpm check` 0, `pnpm lint` clean, `pnpm test` green, `@smoke`
      green, `@security` green. **No migration.**

**Notes (for the implementer):** the Catechism is static but **accuracy-critical** — a
re-themed line that misstates a mechanic is a bug. Cross-check every mechanic against
source; the ~24h→~6h mustard update is the one factual change (it tracks
`MUSTARD_LIFESPAN_MS`). No new dependency; no schema; no new decision row.

---

### TASK-101: The Lost Pilgrim — designed error / 404 page [`pending`] [`P3`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-090 (final paths for the "return" link); mockup
`design/pages/The Lost Pilgrim.dc.html`; TASK-087 (theme). `design-light` — an error
boundary is standard SvelteKit; only copy/visual come from the mock.

**Problem:** there is **no `+error.svelte`** anywhere — errors and 404s fall back to
SvelteKit's default unstyled boundary.

**Acceptance Criteria:**

- [ ] **`src/routes/+error.svelte` rebuilt from `The Lost Pilgrim.dc.html`** — the root
      error boundary: the haloed relic mark, the big `{{ status }}` numeral, the cult-voiced
      eyebrow + line, and a "Return to the Procession →" CTA. Drive it from `page.status` +
      `page.error` (`$app/state`): a **404** ("Thou Hast Strayed") vs a generic error
      ("A Disturbance in the Tube"), mirroring the mock's `mode` (404/500) branching. The
      CTA links to **The Procession** (the final feed slug — `/snacktum-snacktorum/procession`)
      or `/` per the design.
- [ ] **XSS-safe + no internal-detail leak:** `page.error.message` renders as escaped text
      and **no sensitive internal error detail is shown** — friendly copy only (server logs
      hold the detail). No `{@html}`.
- [ ] **Optional nested `(protected)/snacktum-snacktorum/+error.svelte`** if the design
      wants a distinct in-app error treatment (keeping the shell chrome). The root boundary
      is the required minimum; decide the nested one with the design.
- [ ] **Responsive + accessible:** semantic, visible focus on the CTA, the relic mark
      `aria-hidden`.
- [ ] **Tests:** none required (error boundary); `@smoke` / `@security` green.
- [ ] **Gates green:** `pnpm check` 0, `pnpm lint` clean, `pnpm test` green, `@smoke`
      green, `@security` green. **No migration.**

**Notes (for the implementer):** the mock is a clean, near-direct port (`mode`/`eyebrow`/
`status`/`line`/CTA). **Security:** never render raw stack traces or internal detail to the
user (L2 / OWASP "security misconfiguration" + insufficient-logging awareness). Small task.
No new dependency; no schema; no new decision row.

---

## Completed Tasks (this milestone)

### TASK-090: Foundational slug refactor — `app` → `snacktum-snacktorum` prefix + every reference [`complete`] [`P1`] [`L`]

**Owner:** implementer — PR #115 (squash `38c8844`), merged 2026-06-20. Reviewer APPROVE. 0 fix cycles. Checkpoint tag `checkpoint-2026-06-20-pre-slug-refactor`.

The foundational slug refactor: **only the in-app route PREFIX changed**, `/app` →
`/snacktum-snacktorum`, with the directory moved `src/routes/(protected)/app/` →
`src/routes/(protected)/snacktum-snacktorum/`. **The load-bearing change is the
`hooks.server.ts` auth-guard prefix** (`startsWith('/app')` → `'/snacktum-snacktorum'`) —
the protected area stays guarded in lockstep with the rename, so no `/snacktum-snacktorum/*`
route went unguarded. **Leaf names are UNCHANGED** (deferred to the per-page rebuilds):
`feed`, `dogs`, `dogs/[id]`, `profile/[handle]`, `messages`, `messages/[handle]`, `invite`,
`court`, `help` — so every `/app/<leaf>` became `/snacktum-snacktorum/<leaf>` with the SAME
leaf (e.g. `/app/feed` → `/snacktum-snacktorum/feed`, `/app/court` →
`/snacktum-snacktorum/court`, `/app/profile/[handle]` →
`/snacktum-snacktorum/profile/[handle]`). The leaf renames (feed→procession etc.) are
TASK-091+. The **four gate slugs are UNCHANGED** (`/sign-in`, `/sign-up`,
`/forgot-password`, `/reset-password`); the `/sign-in` redirect targets were preserved and
the profile-funnel `ONBOARDING_PATH` still points at `/sign-up`. **Scope decision worth
recording:** the root redirect points at `/snacktum-snacktorum/feed` (the live leaf), NOT
`/procession` — TASK-091 renames the leaf and retargets the redirect. The live-doc path
sweep (CLAUDE.md + README.md `/app/*` route references → `/snacktum-snacktorum/*`, same
leaves) was done as part of this bookkeeping, resolving the reviewer's stale-doc finding.
No migration, no new dependency, **no new decision row** (table stays #28). Gates at merge:
`pnpm check` 0/0, `pnpm lint` clean, `pnpm test` 830/830, `@smoke` 5/5, `@security` 94/94,
form-validation 2/2.

---

### TASK-092: The Snacktum Onboarding rite — rebuild `/sign-up` as the rite (absorbs onboarding) [`complete`] [`P1`] [`L`]

**Owner:** implementer — PR #112 (squash `a5fd084`), merged 2026-06-19. Reviewer APPROVE.

Rebuilt `/sign-up` as a single multi-step **rite** (Summoned → Inscribe → Choose Thy
Sigil → Renounce → Received), **absorbing and deleting** the standalone
`(protected)/app/onboarding/` route; the profile-funnel guard (`ONBOARDING_PATH`) now
targets `/sign-up`, and an authenticated-but-profile-less **resumer** picks the rite back
up at a handle-only Inscribe (handle carried forward to `createProfile` via client
`$state`; forward-only flow). Two non-obvious control-flow decisions: (a) the profile is
forged at the **Sigil** step and **Renounce is a pure-UI oath** gated only on the sworn
state (no session check there); (b) `createProfile` **returns `{ created, handle }`
instead of redirecting**, and the client advances Sigil→Renounce→Received **without
re-running `load`** — because re-running `load` would `throw redirect` on the now-existing
profile and skip the oath/Received (Received has an explicit "Enter →" into the app); a
`createProfile` failure recovers in place on the Sigil step. The chosen sigil is stored as
`sigil:<id>` in `avatar_path` (no upload, no migration); new `src/lib/components/Sigil.svelte`
(inline SVG, no `{@html}`) + `src/lib/features/profiles/sigils.ts`. The Ordo Sancti Tubi
**seal** (15rem) + **wordmark header** (24rem, top-anchored) are unified across the four
auth/gate pages via shared `.gate-mark`/`.gate-header` in `app.css`. No migration, no new
dependency, **no new decision row** (table stays #28). Gates at merge: `pnpm check` 0,
lint clean, 830 unit, `@smoke` 5/5, `@security` 94/94. **Deferred to TASK-090:** the
post-rite path slug rename (→ `/snacktum-snacktorum/shrine/<handle>`) rides with the slug
refactor — `@smoke` currently lands on `/app/profile/<handle>` (correct until TASK-090
runs). Discovered: a session-less hit at the Sigil step dead-ends with `fail(401)` and no
in-rite recovery (logged DW-033); DW-031 brand-asset wiring updated.

---

### TASK-087: Base cult visual / theme layer [`complete`] [`P2`] [`L`]

**Owner:** implementer — PR #99 (squash `dcce8c3`), merged 2026-06-19. Reviewer
APPROVE after 1 fix cycle (WCAG 2.4.7 focus-ring regression on the wall textarea).

The M8 FOUNDATION: a tokenized dark-temple CSS layer (`src/lib/styles/tokens.css`,
imported by `src/app.css`) that every downstream M8 task consumes via `var(--…)` tokens
(accents switch via `data-accent`), self-hosted SIL OFL Cinzel + Cormorant Garamond
`.woff2` fonts under `static/fonts/` (no CDN, no npm package), and themed flair-component
styling. No migration, no new dependency, no new architecture-decision row (decision
table stays #28). The token vocabulary (surfaces / text ramp / themeable accent / status
/ type scale / layout-motion) is the durable seam every rebuild references — **consume
`var(--…)`, never literal hex; switch accent via `data-accent`; reuse the themed flair
components**. Discovered: DW-028 (faint-text tokens must stay AA on real content).

> **Re-scope note:** the rebuilds now port directly from the mockups, mapping inline mock
> hex → these tokens. TASK-087 remains the styling foundation; nothing about it changes.

---

### TASK-080: Global app shell + persistent navigation [`complete`] [`P1`] [`M`] (`design-light`)

**Owner:** implementer — PR #101 (squash `544b7be`), merged 2026-06-19. Reviewer
REQUEST_CHANGES → APPROVE after 1 fix cycle.

A persistent `(protected)/app/+layout.svelte` shell renders a header/nav across every
`/app` route (🌭 home → The Procession; The Procession / Your Litter / Epistles / The
Catechism; ＋ Summon a Frank; crown-gated ☩ The Tribunal), reads `{ user, profile }` from
the existing `+layout.server.ts` (no second crown query), repointed the `/` redirect
`/app` → `/app/feed`, and retired the bare `/app` hub (`redirect(307, '/app/feed')`).
**`TopDogPrivilegesNotice` (TASK-074) was intentionally RETIRED** (Top Dog powers now in
The Catechism + the crown-gated Tribunal link) — `pnpm test` 783 → 775. No migration / no
new dependency / no new decision row.

> **Re-scope note:** the shell is done, but TASK-090 **updates its `resolve(...)` route
> ids + active-route checks to the new `snacktum-snacktorum` paths**, finalizes its cult
> nav labels, and re-points its links to the renamed leaves. The shell's STYLING already
> matches `App Chrome.dc.html` (TASK-087-themed); TASK-090 only re-wires its links.

---

### TASK-083: Forgot-password + reset-password flow [`complete`] [`P1`] [`M`] (`design-light`)

**Owner:** implementer — PR #103 (squash `3e236be`), merged 2026-06-19. Reviewer
APPROVE, 1 fix cycle (added a code-emitting recovery email template).

The recovery cluster: `/forgot-password` (`resetPasswordForEmail`, neutral
non-enumerating) + `/reset-password` (**6-digit OTP** → `verifyOtp(type:'recovery')` →
`updateUser`; `MIN_PASSWORD_LENGTH` 8 + confirm). The fix cycle added
`supabase/templates/recovery.html` (`{{ .Token }}`, code-only) +
`[auth.email.template.recovery]` / `otp_length = 6`, director-verified by a live Mailpit
round-trip. `pnpm test` 793; no migration / no new dependency / no new decision row. Adds
a hosted CONFIG item to the standing ops gate + DW-029.

> **Re-scope note:** these two pages are COMPLETE and **KEEP their slugs**
> (`/forgot-password`, `/reset-password` — the user finalized that the auth slugs stay
> descriptive). TASK-090 does **NOT** move these folders, does **NOT** retarget any
> `/sign-in` redirect, and the recovery email template's `/reset-password` reference is
> **unchanged**. The only TASK-090 effect on this cluster is the in-app `/app/` prefix
> rename in any shared link/test — these gate pages are otherwise untouched. No restyle
> (the visual is final per `Reset Password.dc.html`).

---

### TASK-082: Build `/sign-in` — real email/password form + server action [`complete`] [`P1`] [`M`] (`design-light`)

**Owner:** implementer — PR #105 (squash `5445002`), merged 2026-06-19. Reviewer
APPROVE, 0 fix cycles.

The real themed sign-in form ("Enter the Snacktum") with a default action →
`signInWithPassword` on `event.locals.supabase` → on success `redirect(303,'/app')` through
the auth cascade (profile-less → `/app/onboarding`), non-enumerating (one generic error;
password never echoed; raw errors server-side only). A new `tests/sign-in.e2e.ts` `@smoke`
spec signs a seeded user in through the real form — live suite 5/5. `pnpm test` 801; no
migration / no new dependency / no new decision row + DW-030.

> **Re-scope note:** the page is COMPLETE and **KEEPS its slug** (`/sign-in` — the user
> finalized that the auth slugs stay descriptive). TASK-090 does **NOT** rename this
> folder and does **NOT** retarget any `/sign-in` redirect (it stays the bounce target).
> TASK-090's only effect here is repointing the success `redirect(303,'/app')` →
> `'/snacktum-snacktorum'` (the in-app prefix) and updating the `/app/onboarding` funnel
> hop → the `/sign-up` rite (TASK-092). The `tests/sign-in.e2e.ts` + `tests/form-validation.e2e.ts`
> `/sign-in` navigations are unchanged; only their `/app/...` literals change. No restyle
> (final per `Log In.dc.html`).

---

## Superseded tasks (folded into the re-scope)

The original pending tasks TASK-081 / TASK-084 / TASK-085 / TASK-086 / TASK-088 / TASK-089
are **superseded** by the re-scoped task set above. Their substance is preserved:

| Old task     | Was                                                                                                | Folded into                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TASK-081** | Brand & lore copy pass (apply cult display names + "The Anointed Wiener" + voice across all pages) | **The designs now carry the copy.** Each per-page rebuild applies its own page's cult copy + the title swap verbatim from its mockup. Cross-cutting strings that aren't on a single page (the shell nav labels) are finalized in **TASK-090**. There is **no separate copy-only sweep** — the copy lives in the rebuilds. (The confirmed display-name + label decisions in § Page Naming Map / § Resolved decisions are the source of truth the rebuilds apply.) |
| **TASK-084** | Ritual sign-up (OQ-1 B-absorb)                                                                     | **TASK-092** (the Snacktum Onboarding rite — same B-absorb scope, now a rebuild-from-`Snacktum Onboarding.dc.html`).                                                                                                                                                                                                                                                                                                                                             |
| **TASK-085** | Profile redesign + display-name + stat ledger                                                      | **TASK-093** (The Shrine rebuild — same scope, now rebuild-from-`The Shrine.dc.html`, composes TASK-094 + TASK-094-R).                                                                                                                                                                                                                                                                                                                                           |
| **TASK-086** | "Anoint" mustard re-theme (+ the one migration, decision #29)                                      | **TASK-094** (same scope + the prune-retirement migration + workflow edit + decision-#29 plan, unchanged).                                                                                                                                                                                                                                                                                                                                                       |
| **TASK-088** | Designed error/404 page                                                                            | **TASK-101** (The Lost Pilgrim — now rebuild-from-`The Lost Pilgrim.dc.html`).                                                                                                                                                                                                                                                                                                                                                                                   |
| **TASK-089** | The Reliquary derived badge module                                                                 | **TASK-094-R** (same purely-derived scope, unchanged).                                                                                                                                                                                                                                                                                                                                                                                                           |

The new per-page rebuild tasks **TASK-091 / TASK-095 / TASK-096 / TASK-097 / TASK-098 /
TASK-099 / TASK-100** (Procession, Litter, Relic, Epistles+Whispers, Summon, Tribunal,
Catechism) are net-new under the re-scope — these pages were previously only "copy + theme"
touches under TASK-081/087 and now get a full rebuild-from-design each.

---

## Page Naming Map — themed cult DISPLAY names (CONFIRMED)

The confirmed user-facing display names / page `<title>`s / nav labels. **Under the
re-scope the in-app URL paths ALSO change** (see § Slug Map) — but the display names are
unchanged, and the **four auth slugs are KEPT descriptive** (only the display copy is
cult-voiced; the paths stay `/sign-in`, `/sign-up`, `/forgot-password`,
`/reset-password`). Each per-page rebuild applies its page's name verbatim.

| Page (route)                                 | Cult display name (CONFIRMED)                    |
| -------------------------------------------- | ------------------------------------------------ |
| `/sign-in` (UNCHANGED slug)                  | **Enter the Snacktum** (heading)                 |
| `/forgot-password` (UNCHANGED slug)          | (gate page — cult-voiced per its mock)           |
| `/reset-password` (UNCHANGED slug)           | (gate page — cult-voiced per its mock)           |
| `/sign-up` (UNCHANGED slug — hosts the rite) | **Snacktum Onboarding** / Choose Your Frank Name |
| `/snacktum-snacktorum/litter`                | **Your Litter**                                  |
| `/snacktum-snacktorum/litter/[id]`           | **The Relic**                                    |
| `/snacktum-snacktorum/procession`            | **The Procession: Standings of the Blessed**     |
| `/snacktum-snacktorum/shrine/[handle]`       | **The Shrine**                                   |
| `/snacktum-snacktorum/epistles`              | **Epistles**                                     |
| `/snacktum-snacktorum/epistles/[handle]`     | **Whispers**                                     |
| `/snacktum-snacktorum/tribunal`              | **The Tribunal of the Holy Tube**                |
| `/snacktum-snacktorum/summon`                | **Summon a Frank**                               |
| `/snacktum-snacktorum/catechism`             | **The Catechism**                                |
| `+error.svelte`                              | **The Lost Pilgrim**                             |

### Confirmed cult labels beyond page names

| User-facing label (CONFIRMED)            | Replaces                  | Code/data identifier (UNCHANGED)                                                                                        |
| ---------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **The Anointed Wiener** (champion title) | "Top Dog"                 | `is_current_top_dog` / `TopDogBadge` / `selectTopDog` / `days_as_top_dog`                                               |
| **FALSE WITNESS** (false-accuser brand)  | "HAMBURGER LIAR" / "LIAR" | `hamburger_liars` / `not_a_hamburger` / `getLiarBrandTimestamps` / `summarizeLiarBrand` / `liarBrand` / badge id `liar` |

### Confirmed auth/gate-page copy conventions (already applied on the complete gate pages; preserve)

| Concept                          | CONFIRMED user-facing copy                                                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Password**                     | **"Seal"** — field labels, "Forgotten thy seal?", "Forge a New Seal", "Confirm the Seal", validation messages                                              |
| **Email field**                  | label **"Mustard Address"**, placeholder **`you@mustard.condiment`**                                                                                       |
| **Sign-in destination metaphor** | **"the grill"** (the place a member is admitted to on sign-in) — a copy/heading metaphor only; the **slug stays `/sign-in`** (auth slugs kept descriptive) |

---

## Resolved decisions (bake into the affected tasks)

> All Open Questions are RESOLVED. The full resolution history is preserved below.

- **OQ-1 — RESOLVED → a multi-step rite that ABSORBS onboarding, AT `/sign-up`** (Option
  B-with-absorb). Summoned (invite token) → Inscribe Thy Name (`@handle` + email +
  password) → Choose Thy Sigil (avatar) → Renounce the Patty (pure-UX oath, no data
  persisted) → Received. **The rite IS the `/sign-up` route; the standalone
  `/app/onboarding` route is REMOVED/absorbed** (no `/snacktum-snacktorum/onboarding` or
  `/initiation` leaf). The profile-funnel guard now targets `/sign-up` and the rite is
  resumable (an authenticated-profile-less member resumes at the naming/sigil step).
  Invite-redemption mechanics (#17/#22/#23) + handle validation unchanged. No migration.
  → **TASK-092.**
- **Avatar — RESOLVED → pick 1 of 5 built-in SVG sigils** (cowled / haloed / shadowed /
  tube / candle), stored as a sigil id **reusing `avatar_path`** — NO migration, NO
  storage upload. User-uploaded avatars deferred. → **TASK-092.**
- **OQ-2 — RESOLVED (all five):** (a) keep Anoint gated; (b) re-theme the mustard spray,
  no merge with reactions; (c) **splat** visual; (d) decays over **~6h** (constant change,
  no migration); (e) anoint → wall notice = **24h rolling stack, persists** (render-derived
  from `mustard_sprays`). **Option A (user-approved): retire `prune_mustard_sprays()`** so
  the persisting notice's rows survive → **TASK-094 carries one migration + a keep-alive
  workflow edit + a likely decision #29** (recorded as a plan; the table stays #28 until
  implemented). → **TASK-094.**
- **OQ-3 — RESOLVED → the "dark temple" aesthetic** (bg `#17120e` + radial gold glow,
  parchment `#f3e9d2`, accent Mustard Gold `#E0A82E`; themeable Relic Crimson / Verdigris).
  → implemented in **TASK-087** (done); the rebuilds consume its tokens.
- **OQ-4 — RESOLVED → Cinzel + Cormorant Garamond, self-hosted woff2** (SIL OFL assets,
  not a package — no dependency gate). → **TASK-087** (done).
- **OQ-5 — RESOLVED → all page names confirmed** (see § Page Naming Map); the dog-detail
  page is **The Relic**.
- **Reset flow — RESOLVED → 6-digit OTP code recovery** (not magic-link). → **TASK-083**
  (done).
- **Re-scope (2026-06-19) — DECIDED by the user:** rebuild each remaining page from its
  mockup; re-slug the in-app prefix `app` → `snacktum-snacktorum` + each leaf (§ Slug Map).
  **The four auth slugs are KEPT descriptive** (`/sign-in`, `/sign-up`, `/forgot-password`,
  `/reset-password` — the gate pages are NOT re-slugged); the onboarding rite lives at
  `/sign-up` (no standalone onboarding leaf). No old→new redirects (pre-launch). Recorded
  as a **scope decision** (deviation from the original "URL paths UNCHANGED" note) — not a
  numbered architecture-decision row.

---

## Possible Dependencies (PROPOSED — none added; do not assume)

No new dependency is expected — this is a markup/CSS/route-rename pass on the existing
SvelteKit + Supabase stack, rebuilding from mockups with the already-self-hosted fonts
(TASK-087). The only historical candidate (a font package, OQ-4) was **resolved to
self-hosted woff2** — **no dependency added**. Everything in the re-scope is buildable with
**no new dependency**.

---

## Dependencies & Sequencing

**Re-scoped order.** The foundational slug refactor lands first (or its prefix piece does),
then the per-page rebuilds. The completed gate/shell/theme tasks are already in.

```
TASK-090  foundational slug refactor (app → snacktum-snacktorum PREFIX + every /app/ ref; auth slugs KEPT)
            ← RISKY cross-cutting refactor; checkpoint tag at execution; lands FIRST
   │
   ├─ @smoke-critical rebuilds (the slice crosses these — keep @smoke green):
   │    TASK-092  Snacktum Onboarding rite   (slice START: invite → profile; B-absorb funnel)
   │    TASK-091  The Procession (feed)       (slice leaderboard; vote path)
   │    TASK-095  Your Litter (gallery+upload)(slice upload → see dog)
   │    TASK-093  The Shrine (profile)        (slice profile → wall; composes 094 + 094-R)
   │
   ├─ feature-entangled rebuilds (sequence after / coordinate with the Shrine):
   │    TASK-094    "Anoint" re-theme         (THE migration; composes into the Shrine page)
   │    TASK-094-R  The Reliquary             (pure module buildable FIRST/parallel; shelf on the Shrine)
   │    TASK-096    The Relic (dog detail)    (decision #27 signed URL; shares the `litter` leaf)
   │
   └─ remaining page rebuilds (independent files — parallelizable across distinct pages):
        TASK-097  Epistles + Whispers (DMs)
        TASK-098  Summon a Frank (invite)
        TASK-099  The Tribunal (court)        (double-gate + anonymity — @security)
        TASK-100  The Catechism (help)        (accuracy-checked; ~24h→~6h tracks TASK-094)
        TASK-101  The Lost Pilgrim (error/404)(design-light; near-direct port)
```

- **TASK-090 lands first** so every rebuild builds on the final base paths and each rebuild
  then touches exactly its own page's directory (the leaf-renames fold into the rebuilds).
- **@smoke-critical pages** (onboarding, feed, litter, shrine) — the slice
  (invite → profile → upload → see dog) crosses all four. **Any path/flow/copy change the
  smoke test walks MUST update `tests/smoke.e2e.ts` in lockstep** (and TASK-082 added a
  sign-in `@smoke` path — TASK-090 re-points it).
- **TASK-094 / TASK-094-R compose into TASK-093's Shrine page** (all three touch the Shrine
  `+page.svelte` + its load). TASK-094-R's **pure module** is a separate file (buildable
  first / in parallel); only its profile-load wiring + shelf component collide with
  TASK-093. **TASK-096 (Relic) shares the `litter` leaf parent with TASK-095** — coordinate
  the leaf rename so it's atomic.

**Parallel-dispatch collision warning ([[workflow]] § Parallelism):** the Shrine cluster
(TASK-093 + TASK-094 + TASK-094-R) all edit the profile `+page.svelte` / `+page.server.ts`
— **sequence them** (or split copy vs layout vs Anoint-surface vs badge-shelf as separate
prereq edits). The Litter + Relic pair shares the `litter` parent. **Distinct pages with
no shared files (e.g. Epistles vs Summon vs Tribunal vs Catechism vs Lost Pilgrim) can run
in parallel** once TASK-090 has landed the base paths. The director builds the file-scope
matrix before any parallel batch and fails-closed on every overlap.

**Keep the M1 `@smoke` vertical slice GREEN throughout.** TASK-090 re-points every path the
slice walks; the four @smoke-critical rebuilds change the copy/markup it asserts — update
the smoke test in lockstep at each. A redesign that silently breaks the slice is a
milestone regression.

---

## Standing ops note (context only — NOT a task in this milestone)

For anyone who touches **hosted** during this work — three items batch onto one hosted
bring-up step (per the per-milestone hosted-push discipline, [[PROJECT]] Process notes):

1. **Two M7 migrations** await a hosted `supabase db push` —
   `20260617205453_burger_alarms.sql` (TASK-071) and
   `20260618120000_burger_verdicts.sql` (TASK-073). No auto-pause risk; the report→verdict
   flow is non-functional on hosted until pushed (user's hand).
2. **TASK-094's prune-retirement migration** (M8) — batch its hosted push with the two
   above, and drop the keep-alive prune step from `.github/workflows/keepalive.yml` **in
   lockstep** so the workflow never calls a retired RPC (which would 404 → the
   hosted-schema-drift failure mode in [[CLAUDE]]).
3. **TASK-083's hosted CONFIG item** (no migration) — the hosted recovery email template
   must be the code-emitting `{{ .Token }}` template (dashboard or `supabase config push`)
   or production sends a recovery LINK instead of a CODE, breaking the reset page (at
   `/reset-password` — slug unchanged).

---

> **No caps.** Acceptance criteria, subtasks, and integration points are unbounded. Give
> each task as much specificity as it needs to be completed to spec — never trim detail to
> hit a count. These tasks are `pending` (designs delivered, milestone active); **dispatch
> only on explicit user instruction**, in the § Dependencies & Sequencing order.
