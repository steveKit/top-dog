# Milestone M8: Snacktum Snacktorum — Rebrand & Redesign

> **Status:** `active` — **BUILDING** (activated 2026-06-19; **RE-SCOPED 2026-06-19**).
> **13/16 complete** — auth cluster + theme + shell + onboarding rite + the foundational
> slug refactor + seven rebuild-from-design pages done: TASK-087 (theme) + TASK-080
> (shell) + TASK-083 (password recovery) + TASK-082 (sign-in) + TASK-092 (onboarding rite) +
> **TASK-090 (slug refactor — PR #115, 2026-06-20)** + **TASK-091 (The Procession — PR #117,
> `dffaee5`, 2026-06-20)** + **TASK-093 (The Shrine — PR #122, `851fa0e`, 2026-06-22)** +
> **TASK-094 (Anoint re-theme — PR #124, `645373a`, 2026-06-22; the M8 migration + decision
> #29)**. The slug refactor moved the in-app route prefix `/app` →
> `/snacktum-snacktorum` (directory + auth-guard prefix; leaf names unchanged, deferred to
> the per-page rebuilds); TASK-091 rebuilt the feed as The Procession (leaf `feed` →
> `procession`); TASK-093 rebuilt the profile as The Shrine (leaf `profile` → `shrine`,
> URL now `/snacktum-snacktorum/shrine/[handle]`, + a derived stat ledger); TASK-094 re-themed
> the mustard surface to Anoint (splat, 6h decay, persisting wall-notice, retired the prune →
> `mustard_sprays` now append-only); **TASK-094-R (Reliquary derived badge module + shelf —
> PR #126, `870e401`) also complete, closing the Shrine cluster.** (094-R is a derived
> sub-module, not counted in the `/16`.) **TASK-095 (Your Litter — PR #128, `4cab7df`) rebuilt
> the own-dogs gallery + moved the whole `dogs` folder → `litter`.** **TASK-096 (The Relic —
> PR #130, `d07315f`) rebuilt the dog-detail page in place at `litter/[id]`, preserving the
> decision-#27 signed-URL load byte-identical.** **TASK-097 (Epistles + Whispers — PR #132,
> `8764287`) rebuilt both DM pages + moved the leaf `messages` → `epistles` (+ `epistles/[handle]`),
> both servers preserved.** **TASK-098 (Summon a Frank — PR #134, `dc7a229`) rebuilt the invite
> page + moved the leaf `invite` → `summon` (`+page.server.ts` byte-identical / R100 rename,
> the invite-mint action untouched; a copy-to-clipboard affordance added).** **Next: TASK-099
> Tribunal → TASK-100 Catechism → TASK-101 Lost Pilgrim.** The three complete gate
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

> Re-scoped 2026-06-19. The completed gate/shell/theme tasks (the foundational slug
> refactor TASK-090 and the rebuild-from-design pages TASK-091/093/094/094-R/095/096/097/098)
> are in § Completed Tasks. Dispatch **only on explicit user instruction**, in the
> § Dependencies & Sequencing order. **The slug refactor and six leaf rebuilds have landed** —
> the in-app prefix is `/snacktum-snacktorum` and the leaves `feed`/`profile`/`dogs`/
> `messages`/`invite` are renamed to `procession`/`shrine`/`litter`/`epistles`/`summon`
> (`court`, `help` are still pre-rename, riding their own rebuild tasks). The remaining active
> tasks are **TASK-099 (The Tribunal) → TASK-100 (The Catechism) → TASK-101 (The Lost
> Pilgrim)**, with **TASK-099 (The Tribunal) next.**

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

### TASK-098: Summon a Frank (invite) — rebuild from design + leaf `invite` → `summon` [`complete`] [`P2`] [`M`]

**Owner:** implementer — PR #134 (squash `dc7a229`), merged 2026-06-23. Reviewer APPROVE, 0 fix cycles (two minor optional a11y enhancements noted for the tweak session). Rebuilt the invite `+page.svelte` from `Summon a Frank.dc.html` as Summon a Frank (main content only — header/nav chrome stays in the app shell); ported the DSL `<sc-if>` states to Svelte 5 runes bound to the REAL form contract (idle → minting → minted → error); added a copy-to-clipboard affordance. The whole `invite` folder was `git mv`'d → `summon` (`+page.server.ts` byte-identical / R100 rename — the `?/create` invite-mint action, decisions #17/#22/#23, untouched; the test renamed `invite-action.test.ts` → `summon-action.test.ts`, only its `describe` label + header comment rescoped). No migration / dep / decision row / code-identifier rename (`$lib/features/invites` untouched). Gates at merge (live stack): `pnpm check` 0/0, `pnpm lint` clean, `pnpm test` 946/946, `@smoke` 5/5, `@security` 93/93.

The sixth rebuild-from-design in-app page. The invite `+page.svelte` was **rebuilt from
`design/pages/Summon a Frank.dc.html`** as Summon a Frank — a skin-not-skeleton pass that
rebuilt only the page's **main content** (the header/nav chrome stays owned by the app
shell) and **preserved the `+page.server.ts`** entirely. The mockup's DSL `<sc-if>` states
were ported to **Svelte 5 runes** bound to the page's REAL form contract — the four states
**idle → minting → minted → error** are driven from the actual `?/create` action result and
the `use:enhance` lifecycle, not a static mock. A **copy-to-clipboard affordance** was added
for the minted invite link (`navigator.clipboard.writeText` with a legacy `execCommand`
fallback and a transient "Copied ✓"); this is **net-new over the original page**, which had
no copy affordance at all.

**The `+page.server.ts` is byte-identical** — the whole `invite` folder was `git mv`'d →
`summon` as an **R100 rename**, so the invite-mint server moved without a diff. The
load-bearing **`?/create` invite-mint action** (decisions #17/#22/#23 — single-use invites,
the consumed-once guard keyed on `consumed_at`, owner-scoped issuance) is wholly untouched.
The invite is now at **`/snacktum-snacktorum/summon`**; only the `invite` leaf moved this
task (`court`, `help` remain pre-rename, riding their own rebuilds — `feed`/`profile`/`dogs`/
`messages` already renamed to `procession`/`shrine`/`litter`/`epistles`). The co-located test
was renamed `invite-action.test.ts` → `summon-action.test.ts` (only its `describe` label +
header comment rescoped — the assertions are unchanged).

This was a **skin-not-skeleton** pass at its lightest: **no migration, no new dependency, no
new architecture-decision row, and no code-identifier rename** — `$lib/features/invites` and
every DB/RPC identifier stay as-is (decisions stay #1–#29, L2 preserved). Reviewer APPROVE,
**0 fix cycles**. The two findings the reviewer surfaced were **minor, optional, and additive
over the original page** (which had no copy affordance), deferred to the visual-tweak session,
not fixed: (1) the "Copied ✓" feedback has no `aria-live` / `role="status"` region, and (2)
the legacy `execCommand` fallback path doesn't restore focus to the copy button. Gates at
merge (live stack): `pnpm check` 0/0, `pnpm lint` clean, `pnpm test` 946/946, `@smoke` 5/5,
`@security` 93/93. Did NOT close the milestone (M8 is 13/16). Discovered: the Summon page has
**no inbound nav link**, and the app shell's "＋ Summon a Frank" header button actually targets
**upload** (`/snacktum-snacktorum/litter`), not this invite page — a label/reachability clash
logged DW-039, to be resolved in the visual-tweak session.

---

### TASK-097: Epistles (DM inbox) + Whispers (DM thread) — rebuild from design + leaf `messages` → `epistles` [`complete`] [`P2`] [`L`]

**Owner:** implementer — PR #132 (squash `8764287`), merged 2026-06-22. Reviewer APPROVE, 0 fix cycles. Rebuilt both DM pages from `Epistles.dc.html` (inbox) + `Whispers.dc.html` (thread); whole `messages` folder `git mv`'d → `epistles` (+ `epistles/[handle]`). Both `+page.server.ts` preserved — inbox a pure rename; thread's ONLY change the self-thread redirect literal `/messages`→`/epistles` (conversation-scoped privacy SELECT, `read_at`-only mark-read boundary [decision #24], bounded reads [DW-018/025], sender-pinned send all intact). Form-validation CANON on the compose box (label-nested; new prefix-matched "Whisper unto …" message + over-match guards). All `messages`→`epistles` refs updated (grep zero). No migration / dep / decision row. Gates at merge (live stack): `pnpm check` 0/0, `pnpm lint` clean, `pnpm test` 946/946, `@smoke` 5/5, `@security` 93/93 (DM guards green).

The fifth rebuild-from-design in-app page, and the DM cluster's single task — both DM
pages rebuilt at once. The inbox `+page.svelte` was **rebuilt from `Epistles.dc.html`** as
Epistles and the thread `+page.svelte` from `Whispers.dc.html` as Whispers — a
skin-not-skeleton pass that **preserved both `+page.server.ts` files** and re-wired their
plumbing into the new markup. The whole `messages` folder was `git mv`'d → `epistles`
(carrying the `[handle]` thread subfolder), so the inbox is now at
`/snacktum-snacktorum/epistles` and the thread at `/snacktum-snacktorum/epistles/[handle]`
(param preserved); **only the `messages` leaf moved** (`invite`, `court`, `help` remain
pre-rename, riding their own rebuilds).

**Both servers are preserved with the lightest possible touch.** The inbox
`+page.server.ts` is a **pure rename** — its load is untouched. The thread
`+page.server.ts`'s ONLY change is the self-thread redirect literal `/messages` →
`/epistles` (the path moved, so its own redirect target had to move with it); everything
load-bearing stays verbatim: the **conversation-scoped privacy SELECT** (a member reads
only threads they are party to), the **`read_at`-only mark-read write boundary** (decision
#24's column-grant lockdown — mark-read may touch only `read_at`, never forge a message),
the **bounded reads** (DW-018/DW-025's `.limit(50)` on `listConversations` / `listThread`),
and the **sender-pinned send** (`sender_id = auth.uid()`, un-forgeable) all intact.

The compose box adopts the **themed-validation CANON** (the empty-able message field): the
textarea is **nested inside its `<label>`** (the gate-form pattern, so `fieldLabel()`'s
`closest('label')` resolves the visible label rather than falling back to the field
`name`), and `validationMessage.ts` gained a new **prefix-matched "Whisper unto …" themed
message** for the missing-body case — matched on a stable prefix (with over-match guards so
it does not swallow unrelated field labels) rather than a hand-written string at the call
site.

Every `messages` → `epistles` reference across the rebuilt pages, their server wiring, and
the live docs was updated (a grep for the `messages` route segment now returns zero). **No
migration, no new dependency, no new decision row, no `{@html}`** (decisions stay #1–#29,
L2 preserved). Reviewer APPROVE, **0 fix cycles**. Gates at merge (live stack): `pnpm
check` 0/0, `pnpm lint` clean, `pnpm test` 946/946, `@smoke` 5/5, `@security` 93/93 (the DM
write guards green). Did NOT close the milestone (M8 is 12/16). Discovered: a pre-existing
dangling link — The Catechism's "← Back to your kennel" still points at the retired
`/snacktum-snacktorum` hub (which 307-redirects to `/procession`) — logged DW-038, to be
fixed naturally when TASK-100 rebuilds The Catechism.

---

### TASK-096: The Relic (dog detail) — rebuild from design + leaf `dogs/[id]` → `litter/[id]` [`complete`] [`P2`] [`M`]

**Owner:** implementer — PR #130 (squash `d07315f`), merged 2026-06-22. Reviewer APPROVE, 0 fix cycles (one minor additive-copy note). Markup-only rebuild of the dog-detail `+page.svelte` from `The Relic.dc.html` as The Relic (leaf already at `litter/[id]` from TASK-095). **`+page.server.ts` byte-identical** — the load-bearing decision-#27 service-client signed-URL (service client after `safeGetSession()`, RLS client for queries, anonymous burger-alarm aggregate) preserved exactly; DW-022 adjudicated-state gating preserved verbatim. No migration / dep / decision row / `{@html}`. Gates at merge (live stack): `pnpm check` 0/0, `pnpm lint` clean, `pnpm test` 940/940, `@smoke` 5/5 (incl. the dog-detail render test), `@security` 93/93.

The fourth rebuild-from-design in-app page, and the cleanest of the milestone — a
**markup-only** rebuild. The dog-detail `+page.svelte` was **rebuilt from
`design/pages/The Relic.dc.html`** as The Relic — the relic-reliquary framing, the big
signed photo, the owner attribution, and the vote / reaction controls re-placed per the
mock, the HAMBURGER ALARM / adjudicated-state treatment re-skinned. The leaf was
**already** at `litter/[id]` (TASK-095 `git mv`'d the whole `dogs` folder rename-only),
so this task did no slug move — purely the presentational rebuild that TASK-095 deferred.

**The `+page.server.ts` is byte-identical** — not "preserved and re-wired" but literally
untouched, the tightest possible skin-not-skeleton pass. The load-bearing **decision #27
service-client signed-URL pattern** stays exactly as built: the RLS-scoped client
(`event.locals.supabase`) runs the dog / owner / reaction queries, and **only** the
private-bucket `image_path` signing is minted with the service client
(`getServiceClient()`) **after** the `safeGetSession()` gate, signing only rows the
member's own RLS query already returned (no exposure widening). This is the historical
**TASK-033 P0 surface** — the cross-member view of private-bucket content that must sign
server-side — and it was deliberately left wholly unmodified. **DW-022's adjudicated-state
gating** (the anonymous burger-alarm aggregate + verdict display logic) is preserved
verbatim.

Reactions on the detail page stay **read-only** (decision #12) — the page renders the
render-time `summarizeReactions` aggregate, with no write path that could touch
`vote_count` / `peak_votes` / crown. The one additive-copy note the reviewer surfaced
(non-blocking, folded in): an owner viewing **their own** alarmed dog now sees a passive
**"Thy relic stands accused"** notice — a display-only addition, no logic or
authorization change.

**No migration, no new dependency, no new decision row, no `{@html}`** (decisions stay
#1–#29, L2 preserved). Reviewer APPROVE, **0 fix cycles**. Gates at merge (live stack):
`pnpm check` 0/0, `pnpm lint` clean, `pnpm test` 940/940, `@smoke` 5/5 (incl. the
dog-detail render test), `@security` 93/93. Did NOT close the milestone (M8 is 11/16).

---

### TASK-095: Your Litter (own-dogs gallery + upload) — rebuild from design + leaf `dogs` → `litter` [`complete`] [`P2`] [`L`]

**Owner:** implementer — PR #128 (squash `4cab7df`), merged 2026-06-22. Reviewer APPROVE, 0 fix cycles (two minor doc-staleness notes → folded into bookkeeping). Rebuilt the own-dogs gallery + upload `+page.svelte` from `Your Litter.dc.html` as Your Litter; the WHOLE `dogs` folder was `git mv`'d → `litter` (incl. the `[id]` detail subfolder, rename-only — TASK-096 rebuilds The Relic). `+page.server.ts` preserved (pure rename; load + upload/delete actions, own-gallery on the RLS client). Form-validation CANON on the `photo` field (label-nested; new "Relic Image" message). All `dogs`→`litter` references updated (grep zero). No migration / dep / decision row. Gates at merge (live stack): `pnpm check` 0/0, `pnpm lint` clean, `pnpm test` 940/940, `@smoke` 5/5, `@security` 93/93.

The third rebuild-from-design in-app page. The own-dogs gallery + upload `+page.svelte` was
**rebuilt from `design/pages/Your Litter.dc.html`** as Your Litter — a skin-not-skeleton pass:
the `+page.server.ts` was **PRESERVED** and re-wired into the new markup (its `load` plus the
`upload` / `delete` actions, the own-gallery query running entirely on the **RLS-scoped**
client — no service client; this is the member's OWN litter, so decision #27's
service-client-after-gate signing is not needed here, the inverse of the cross-member feed/Relic
loads). The page presents the member's dogs as a litter of relics with rebuilt upload framing and
new cult copy.

The leaf-slug was renamed **`dogs` → `litter`**: the **whole `dogs` folder was `git mv`'d** to
`litter` in one atomic move, so the `[id]` detail subfolder rode along **rename-only** — its
markup is untouched and still pre-rebuild, leaving The Relic (`/snacktum-snacktorum/litter/[id]`)
for **TASK-096**, which now shares the already-renamed `litter` leaf parent. The own-gallery is at
**`/snacktum-snacktorum/litter`**; only the `dogs` leaf moved this task (`messages`, `invite`,
`court`, `help` remain pre-rename, riding their own rebuilds — `feed`/`profile` already renamed to
`procession`/`shrine`).

The upload form adopts the **themed-validation CANON** on its `photo` field: the file input is
**nested inside its `<label>`** (the gate-form pattern, so `fieldLabel()`'s `closest('label')`
resolves the visible label), and `validationMessage.ts` gained a new **"Relic Image"**
themed-label special-case for the missing-photo message rather than a hand-written string at the
call site.

The whole-folder move is **leaf-rename complete** — every `dogs` reference in the rebuilt page and
its server wiring updated, with the README/CLAUDE narrative `/snacktum-snacktorum/dogs` →
`/snacktum-snacktorum/litter` doc sweep folded into this bookkeeping (the two minor doc-staleness
notes the reviewer flagged). **No migration, no new dependency, no new decision row** (decisions
stay #1–#29, L2 preserved). Reviewer APPROVE, 0 fix cycles. Gates at merge (live stack):
`pnpm check` 0/0, `pnpm lint` clean, `pnpm test` 940/940, `@smoke` 5/5, `@security` 93/93.
Did NOT close the milestone (M8 is 10/16).

---

### TASK-094-R: The Reliquary — derived badge / honors module + shelf [`complete`] [`P3`] [`M`]

**Owner:** implementer — PR #126 (squash `870e401`), merged 2026-06-22. Reviewer APPROVE. 0 fix cycles (two minor no-action observations). A purely DERIVED, read-only honors feature: new pure `src/lib/features/badges/badges.ts` (`computeBadges`) + `src/lib/components/Reliquary.svelte`, wired into the Shrine load (reusing `loadShrineStats` values + existing `isHeretic`/liar-brand reads + one new RLS-client inquisitor head-count). Composes decisions #12/#13/#15/#27 — **no new decision row**; no migration / schema / RPC / dependency / service-client read. Reporter anonymity (#27) preserved structurally. Gates at merge (live stack): `pnpm check` 0/0, `pnpm lint` clean, `pnpm test` 938/938, `@smoke` 5/5, `@security` 93/93. (Derived sub-module — not counted in the milestone `/16`.)

The Reliquary closes the Shrine cluster (093 / 094 / 094-R) — a purely DERIVED, read-only
honors feature that fills the badge placeholder TASK-093 left on the Shrine. New pure module
`src/lib/features/badges/badges.ts` (`computeBadges(BadgeInputs)`) follows the project's
self-contained-pure-module convention (no SvelteKit / Supabase imports, co-located unit tests
— same shape as `voting/ranking.ts`, `mustard/decay.ts`, `reports/verdict.ts`), plus a new
presentational `src/lib/components/Reliquary.svelte` shelf. Every badge is computed at render
time from facts the app already keeps — **no migration / schema / RPC / dependency / write
path / service-client read** — so the honors are un-forgeable by construction (nothing on the
shelf is client-settable).

**The v1 badge set** (neutral code ids; cult display labels live in the component): a flat
`first_frank` (≥ 1 hot dog), four tiered relics — `crowned` 1 / 7 / 30 days as The Anointed
Wiener, `summoner` 1 / 5 / 25 redeemed invites, `drenched` 1 / 10 / 50 anointings received,
`inquisitor` 1 / 5 / 25 verdicts rendered (each tier = the highest threshold the count meets,
with a `nextThreshold` for the shelf) — a flat `centurion` (a frank that ever bore ≥ 100
votes, max `peak_votes`), an `elder` keyed on the founding-cohort cutoff
`ELDER_CUTOFF_ISO = 2026-09-01` (a single named constant, not a scattered magic date), and two
shame MARKS (`heretic`, `liar` = display "False Witness") rendered in a distinct disgrace
register and excluded from the earned-honors tally. **`liar` is earned on EVER-branded, not
currently-branded** — the relic is the lasting record of having borne false witness even after
the decaying banner has faded (the live banner stays a separate `summarizeLiarBrand`
derivation). All numeric inputs are default-safe (a missing / negative / non-finite read
degrades that badge to locked, never throws).

**Assembled once from already-loaded facts; no new aggregation pass.** The Shrine load builds
the `BadgeInputs` value object by REUSING the `loadShrineStats` aggregates (TASK-093) — including
the service-client redeemed-invites count for `summoner`, so there is **no second service-client
read** — plus the existing `isHeretic` / liar-brand reads, and adds exactly **one new RLS-client
`inquisitor` head-count** (`burger_verdicts` where `decided_by` = the member). **Decision #27
reporter anonymity is preserved BY CONSTRUCTION:** no input keys on the reporter side of a report
— `heretic` keys on the member's OWN dogs' verdicts, `liar` on the member's OWN brand, and
`inquisitor` on the adjudicator's OWN public action (`decided_by` = the member); there is
deliberately no "heresies you've called" badge. The feature **composes decisions #12 / #13 / #15
/ #27 — no new numbered decision row**.

Reviewer APPROVE, 0 fix cycles (two minor no-action observations). Gates at merge (live stack):
`pnpm check` 0/0, `pnpm lint` clean, `pnpm test` 938/938, `@smoke` 5/5, `@security` 93/93. As a
derived sub-module it is **not counted in the milestone `/16`** (M8 stays 9/16). Discovered: two
honors are out of v1 because they would need NEW persisted tracking the app does not keep — a
**total-votes-ever** honor (the `votes` table keeps only the current vote per voter,
`UNIQUE(voter_id)`) and **reign-streak** honors (`top_dog_days` records discrete days, not
consecutive-run metadata) — logged DW-037 (the v1 `crowned` relic tiers on cumulative
`days_as_top_dog` instead).

---

### TASK-094: "Anoint" — mustard re-theme (splat + 6h decay + persisting wall notice + prune retirement) [`complete`] [`P2`] [`M`]

**Owner:** implementer — PR #124 (squash `645373a`), merged 2026-06-22. Reviewer APPROVE. 2 fix cycles (notice-persistence: derive from full history not the 6h overlay; + stale-comment + copy nits). The ONLY M8 migration (`20260622120000_retire_mustard_prune.sql`, DROP `prune_mustard_sprays`) + keep-alive prune step removed in lockstep. **Introduces architecture decision #29 (mustard_sprays retention — table now effectively append-only).** Gates at merge (live stack): `pnpm check` 0/0, `pnpm lint` clean, `pnpm test` 878/878, `@smoke` 5/5, `@security` 93/93 (incl. the new retention guard). **Hosted-push gate:** batch the prune-retirement migration with the M7 migrations + drop the keep-alive prune step in lockstep (user's hand, async).

The "Anoint" mustard re-theme — the user-facing re-skin of the Top-Dog mustard mechanic
on The Shrine, plus the one M8 migration. **The mustard spray is now "Anoint"** (champion
= "The Anointed Wiener"): the Shrine splat was re-themed to the design's Anoint visual, and
the render-time decay window was shortened from **24h → 6h** (`MUSTARD_LIFESPAN_MS` in
`src/lib/features/mustard/decay.ts`, the single source of truth). The shortening is
**overlay-only** — `mustardOpacity` still computes full → 0 linearly from the raw
`sprayed_at`, never persisted (decision #15 unchanged); only the lifespan constant moved.

**A persisting wall-notice was added, render-derived from the FULL spray history.** Two
render-time views now read the same raw rows: the **decaying Anoint overlay** reads only
the live (≤ 6h) window via `listSpraysForProfile`, while the **persisting "recently
anointed" wall-notice** derives from the entire spray history via a new
`listAnointmentsForProfile` (capped 200 rows) — so the notice outlives the splat's 6h fade.
This is the OQ-2 Option A posture: a persisting notice requires its source rows to survive.

**The daily prune was retired (the only M8 migration).**
`supabase/migrations/20260622120000_retire_mustard_prune.sql` is a **function-only** DROP
of `public.prune_mustard_sprays()` — the table's shape, grants, RLS, and `WITH CHECK` gate
are untouched. With no client DELETE policy AND no prune, `mustard_sprays` is now
**effectively append-only**, which is what lets the persisting notice keep its source rows.
The `.github/workflows/keepalive.yml` mustard-prune step was removed **in lockstep** (the
workflow now drives only `ping` + the Top Dog `tally`). This introduces **architecture
decision #29 (`mustard_sprays` retention — append-only)**; it composes decisions
#12/#15/#25/#28 with no other schema/RLS/grant change.

**Two fix cycles, both reviewer-surfaced.** (1) **notice persistence** — as first built the
persisting wall-notice was derived from the 6h overlay query (`listSpraysForProfile`), so it
vanished when the splat faded; fixed by deriving it from the full history via the new
`listAnointmentsForProfile` (cap 200). (2) **stale-comment + Anoint-copy nits** — a comment
left over from the 24h/prune era plus a couple of copy lines were re-voiced to the Anoint /
6h reality. Copy was re-voiced to the cult register ("Anoint", "The Anointed Wiener")
throughout the surface; code identifiers (`mustard_sprays`, `sprayer_id`, `mustardOpacity`,
`MUSTARD_LIFESPAN_MS`) are unchanged per the HARD SCOPE CONSTRAINT.

A rewritten mustard-retention `@security` guard asserts the append-only posture (no DELETE
path) against the live local stack. Reviewer APPROVE; gates at merge (live stack): `pnpm
check` 0/0, `pnpm lint` clean, `pnpm test` 878/878, `@smoke` 5/5, `@security` 93/93. **No
new dependency.** **Hosted-push gate:** the prune-retirement migration batches with the two
outstanding M7 hosted pushes (`burger_alarms` + `burger_verdicts`) and the TASK-083 recovery
template config — user's hand, async, no auto-pause risk (the daily `ping` keeps the DB
alive). Did NOT close the milestone (M8 is 9/16). Discovered: the historical base migration
`20260616163055_mustard_sprays.sql` now carries stale 24h/prune comments (logged DW-036 —
candidate only if a migration-comment-accuracy pass is ever run; historical migrations are
generally not rewritten).

---

### TASK-093: The Shrine (profile) — rebuild from design + display-name + stat ledger + Reliquary slot [`complete`] [`P2`] [`L`]

**Owner:** implementer — PR #122 (squash `851fa0e`), merged 2026-06-22. Reviewer APPROVE (after 1 REQUEST_CHANGES round). 2 fix cycles. All acceptance criteria verified met (reviewer AC-by-AC confirmation + green gates). Gates at merge (live stack): `pnpm check` 0/0, `pnpm lint` clean, `pnpm test` 861/861, `@smoke` 5/5, `@security` 94/94.

The second rebuild-from-design in-app page. The profile `+page.svelte` was **rebuilt from
`design/pages/The Shrine.dc.html`** as The Shrine — a skin-not-skeleton pass: the
`+page.server.ts` `load` **and all 3 actions (`spray` / `post` / `deleteMessage`) were
PRESERVED** and re-wired into the new markup. The leaf-slug was renamed **`profile` →
`shrine`** — the profile page is now at **`/snacktum-snacktorum/shrine/[handle]`** (param
preserved) — and only the `profile` leaf moved (`dogs`, `messages`, `invite`, `court`,
`help` remain pre-rename, riding their own rebuilds). Champion title copy is **"The Anointed
Wiener"** (copy only; `is_current_top_dog` and every other code identifier unchanged).

The page adds a **derived stat ledger** — new pure-ish read-only module
`src/lib/features/profiles/stats.ts` (`loadShrineStats(supabase, serviceClient, profileId,
inviterUserId)` → `ShrineStats`; `EMPTY_SHRINE_STATS` degradation baseline) that computes
aggregates over existing tables with **no schema and no write path**. Seven of the eight
counts stay on the RLS-scoped client; the eighth — "Disciples Summoned" (redeemed invites) —
runs on the **service client** as a `head:true` count (`{ count: 'exact', head: true }`)
**after** the `safeGetSession()` gate, because `invites` has only an owner-scoped SELECT
policy (`invites_select_own`) so an RLS-scoped count returns 0 on any cross-member view. This
generalizes the decision #27 service-client-after-gate pattern to a cross-member
**aggregate** — a head count ships no rows, so there is no exposure widening, and there is no
new architecture-decision row.

**Two fix cycles, both root-caused:** (1) a **tester-caught P0** — the wall composer's
`<textarea name="word upon the shrine">` didn't match the `post` action's
`formData.get('body')`, so every wall post silently submitted an empty body; fixed by setting
`name="body"`. (2) **reviewer two majors** — (a) the "Disciples Summoned" stat read 0 on
every cross-member view because the count ran on the RLS-scoped client against owner-scoped
`invites` (fixed to the service-client-after-gate head count above); (b) the wall textarea's
themed validation never fired because the `<label>` was a **sibling** of the textarea rather
than wrapping it, so `fieldLabel()`'s `closest('label')` couldn't resolve the visible label
and the themed message never showed — fixed by **nesting the textarea inside the `<label>`**
(the gate-form pattern). The form-validation module
(`$lib/features/forms/formValidation.svelte.ts`) was widened to validate `<textarea>` (was
input-only; backward compatible) and `validationMessage.ts` gained the **"Word upon the
Shrine"** themed-label special-case.

**Decision #27 reporter/anonymity posture is preserved structurally:** the only cross-member
read widened to the service client is the head count of the viewer's-OWN-derived stat surface
(no reporter-side or row-level exposure). No migration, no new dependency, **no new decision
row** (table stays #28). Did NOT close the milestone (M8 is 8/16). Discovered: there is no
jsdom/client vitest project, so DOM-touching `.svelte.ts` validation logic has no unit
coverage — the exact gap that let fix-cycle Issue-2 pass green unit tests (logged DW-035).

---

### TASK-091: The Procession (feed) — rebuild from design + leaf-slug `feed` → `procession` [`complete`] [`P1`] [`L`]

**Owner:** implementer — PR #117 (squash `dffaee5`), merged 2026-06-20. Reviewer APPROVE. 0 fix cycles (one mid-task escalation resolved: champion-ribbon data plumbing).

The first rebuild-from-design in-app page. `/snacktum-snacktorum/feed`'s `+page.svelte` was
**rebuilt from `design/pages/The Procession.dc.html`** as The Procession — a skin-not-skeleton
pass: the `+page.server.ts` `load` **and all 6 actions were PRESERVED** (~95% rename), the only
server change being a derived `championDogId`. The champion title copy is **"The Anointed
Wiener"** (copy only; `is_current_top_dog` / `TopDogBadge` / `selectTopDog` and every other code
identifier unchanged). **Mid-task escalation (resolved by director decision, no fix cycle):** the
designed champion ribbon had no data source, so `listVotableDogs`' embedded `profiles(...)` join
was **widened to carry `is_current_top_dog`** (following the `detail.ts` pattern) and the load
derives `championDogId` = the highest-ranked crowned owner's dog. The champion data path is a
**read-only read of the non-client-writable crown column** (decision #25), kept **RLS-scoped on
`event.locals.supabase`** — no service-client widening, and public info, so no decision #27
anonymity concern. The leaf-slug was renamed **`feed` → `procession`** (URL now
`/snacktum-snacktorum/procession`); **only the feed leaf** moved — `dogs`, `profile`, `messages`,
`invite`, `court`, `help` are UNCHANGED (their renames ride their own rebuild tasks) — and every
`feed` reference was retargeted in lockstep. The README + CLAUDE.md current-state
`/snacktum-snacktorum/feed` doc references were also swept to `/snacktum-snacktorum/procession`
as part of this bookkeeping, resolving the reviewer's stale-doc finding. No migration, no new
dependency, **no new decision row** (table stays #28). Gates at merge (live stack): `pnpm check`
0/0, `pnpm lint` clean, `pnpm test` 834/834, `@smoke` 5/5, `@security` 94/94, `feed-detail` 3/3.

---

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
