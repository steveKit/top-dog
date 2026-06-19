# Milestone M8: Snacktum Snacktorum — Rebrand & Redesign

> **Status:** `active` — **BUILDING** (activated 2026-06-19). TASK-087 (theme) + TASK-080 (app shell) **complete** — 2/10. Next: the auth cluster (TASK-082 sign-in / TASK-083 reset) or TASK-081 (copy). **OQ-2 + OQ-5 now FULLY RESOLVED (2026-06-19); dog-detail page = "The Relic"; TASK-086 adopts Option A — it WILL carry one migration (retire `prune_mustard_sprays`) + a likely decision #29.**
> Index: [[TASKS]] · Architecture: [[PROJECT]] · Conventions: [[CLAUDE]]
> **Goal:** Rebrand "Top Dog" → the hot-dog **CULT** app "Snacktum Snacktorum", and
> redesign the user-facing surface — a global app shell + nav, the auth cluster
> (real sign-in, password reset, ritual sign-up), a profile redesign, an error/404
> page, the "Anoint" mustard re-theme, and a base cult visual/theme layer — plus
> the champion-title copy swap "Top Dog" → **"The Anointed Wiener"** everywhere users
> see it.

---

## ⛔ Execution Block — read before dispatching ANY task

**This milestone is exploded but MUST NOT be executed yet.** Every task below
carries a hard dependency: **DESIGNS — final page designs from the user**. The
user is providing page designs for the rebrand/redesign and has explicitly stated
that **no build starts until those designs land**.

- The whole milestone is gated on a single shared dependency named **`DESIGNS`**
  (final page designs delivered + reviewed with the user). Until then, **every
  task is `blocked`**, not `pending`.
- When designs arrive: resolve the Open Questions (below) **with** the designs,
  flip the relevant tasks `blocked → pending` in this file, then dispatch in the
  sequence in § Dependencies & Sequencing. The director does the flip on explicit
  user activation; this is not an automatic transition.
- A handful of tasks are **mostly design-independent** (the auth backend logic, the
  app-shell wiring) and could begin earlier **if the user chooses to unblock them
  ahead of the full design set** — they are marked **`design-light`** below. They
  still default to `blocked` until the user says go; do not start them on your own
  initiative.

---

## ‼️ HARD SCOPE CONSTRAINT — user-facing ONLY (rebrand the skin, keep the skeleton)

**This milestone changes ONLY what users SEE — strings, copy, lore, components,
styles, and new user-facing pages/flows.** It does **NOT** rename code identifiers
or infrastructure. Every task below repeats this; here is the canonical list so no
task can drift:

**MUST NOT rename / change (forbidden in every task):**

- **Infrastructure identities** (pinned per [[resource-naming]] — renaming forks
  state / orphans resources):
  - the Supabase project / DB / local containers (`top-dog`)
  - the git repository name
  - the keep-alive GitHub Actions workflow + its labels
    (`com.supabase.cli.project=top-dog`)
- **Code identifiers** (DB, TS, components — internal names stay as-is):
  - DB columns/tables: `is_current_top_dog`, `top_dog_since`, `days_as_top_dog`,
    `hot_dogs`, `mustard_sprays`, `hotdog_reactions`, `burger_alarms`,
    `burger_verdicts`, `hamburger_liars`, `wall_messages`, `dms`, `votes`,
    `top_dog_days`, `invites`, `profiles`, etc.
  - functions/RPCs: `recompute_top_dog`, `tally_top_dog_day`, `cast_vote`,
    `render_burger_verdict`, `prune_mustard_sprays`, etc.
  - TS symbols & components: `selectTopDog`, `TopDogBadge`, `mustardOpacity`,
    `summarizeBurgerAlarm`, etc. (Note: `TopDogPrivilegesNotice` was **retired** in
    TASK-080 — see Completed Tasks — so it is no longer a symbol to preserve.)
- **Architecture & security posture:** preserve **every** locked decision #1–#28
  and the **L2** security profile. No new architecture-decision row is expected
  (this is a skin/UX pass); if one genuinely surfaces, record it per the normal gate.

**MAY change (in scope):** user-visible **strings / copy / lore / titles /
microcopy**, **Svelte component markup & styling**, **CSS / theme**, **new
user-facing routes & flows** (sign-in form, password reset, ritual sign-up,
error/404, app-shell nav), and **rendered labels** that today read "Top Dog".

> **Champion-title swap is COPY ONLY.** "Top Dog" the _displayed title_ becomes
> **"The Anointed Wiener"** wherever a user reads it — badge label, "Days as Top
> Dog" stat, the Court's "Top Dog is the
> adjudicator" tape, feed/leaderboard, help page. (The Top-Dog-privileges notice was
> **retired in TASK-080** — Top Dog powers are now documented in The Catechism — so it
> is no longer a copy target.) The _code_ keeps
> `is_current_top_dog` / `TopDogBadge` / `selectTopDog` / `days_as_top_dog`
> untouched. A task that renames a code symbol to match the new title has
> **violated scope.**

---

## Confirmed decisions (baked into the tasks below)

- **App name:** "Snacktum Snacktorum" (the temple). Replaces "Top Dog" as the
  product/brand name in all user-facing copy, page `<title>`s, and headings.
- **Champion title:** "Top Dog" → **"The Anointed Wiener"** — user-facing copy swap
  everywhere the crown is shown. Code identifiers unchanged (see scope box).
- **Theme:** a hot-dog **CULT / temple** aesthetic and lore pass across all pages.
  The Hamburger Court / false-accuser brand (display label **FALSE WITNESS**, see the
  cult naming-map below) / HAMBURGER HERETIC mechanics **already** fit the cult/heresy
  theme — lean into them (heresy, excommunication, the unclean hamburger) rather than
  reinventing.
- **False-accuser brand display label:** **HAMBURGER LIAR → FALSE WITNESS** — the
  consequence a `not_a_hamburger` verdict inflicts on false accusers is shown to users
  as **FALSE WITNESS** (it pairs with HERETIC in the cult voice). This is a
  **DISPLAY-LABEL change only**: every code/data identifier is UNCHANGED — the
  `hamburger_liars` table, the `not_a_hamburger` verdict value, the
  `getLiarBrandTimestamps` / `summarizeLiarBrand` helpers, the `liarBrand` /
  `ProfilePoliceBanner` symbols, and the badge id `liar` all stay exactly as they are.
  The copy pass (TASK-081) and badge/profile/Tribunal tasks (TASK-085, TASK-089) apply
  the FALSE WITNESS label; the design prompts already use it (`design/page-design-prompts.md`).
- **Default landing route = The Procession (`/app/feed`).** The post-auth home is
  **The Procession** (the feed / "Standings of the Blessed"), not the old `/app`
  "kennel" hub. This is a **CONFIRMED decision** (NOT an open question). Two
  consequences, both baked into **TASK-080**:
  1. **The `/` redirect repoints `/app` → `/app/feed`** — a one-line change to
     `src/routes/+page.server.ts` (`redirect(307, '/app')` → `'/app/feed'`).
  2. **The bare `/app` "kennel" hub is retired/absorbed** — its only job today is
     holding the nav links, which the new global app shell + nav (TASK-080)
     supersedes. Recommended disposition: **retire `/app` → redirect to
     `/app/feed`** (or repurpose it as designed). See TASK-080.
  - The **auth cascade is unaffected**: `/app/feed` lives under `(protected)/app`, so
    its layout guard still funnels an **unauthenticated** user → `/sign-in` and a
    **profile-less** user → `/app/onboarding` before The Procession renders. This is
    a **route/user-facing** change only — **no infra or code-identifier change**
    (the `(protected)/app` group, the layout guard, and every internal name are
    untouched).

---

## Page inventory (the surface this milestone restyles)

For grounding — the current user-facing routes (≈14 pages) the copy/theme/redesign
pass must cover (all under `src/routes`). The **Cult name** column carries the
CONFIRMED themed display names where the user has decided one; see the
**Page Naming Map** below for the full mapping + rationale. **OQ-5 is now fully
resolved** — every user-facing page name is confirmed (the dog-detail page is
**The Relic**).

| Route                            | File(s)                                               | Cult name                                                       | Touched by                                        |
| -------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------- |
| `/sign-up`                       | `sign-up/+page.svelte` (+ `+page.server.ts`)          | **Take the Casing**                                             | copy, ritual sign-up, theme                       |
| `/sign-in`                       | `sign-in/+page.svelte` (**stub — no action**)         | **Enter the Snacktum** (heading)                                | **build the form/action**, copy, theme            |
| `/forgot-password`               | **does not exist**                                    | _(new — name w/ designs)_                                       | **new**                                           |
| `/reset-password`                | **does not exist**                                    | _(new — name w/ designs)_                                       | **new**                                           |
| `/app` (home / "kennel")         | `(protected)/app/+page.svelte`                        | **N/A** — retired/absorbed by the shell (redirects to feed)     | copy, app-shell, theme                            |
| `/app` shell                     | `(protected)/app/+layout.svelte` (**does not exist**) | _(chrome, not a page)_                                          | **new app-shell + nav**                           |
| `/app/onboarding`                | `(protected)/app/onboarding/+page.svelte`             | **Choose Your Frank Name**                                      | ritual sign-up (may absorb), copy, theme          |
| `/app/feed`                      | `(protected)/app/feed/+page.svelte`                   | **The Procession: Standings of the Blessed**                    | copy (title swap), theme                          |
| `/app/dogs` (+ `/app/dogs/[id]`) | `(protected)/app/dogs/...`                            | **Your Litter** (`/app/dogs`); **The Relic** (`/app/dogs/[id]`) | copy, theme                                       |
| `/app/profile/[handle]`          | `(protected)/app/profile/[handle]/+page.svelte`       | **The Shrine**                                                  | **profile redesign**, display-name, Anoint, theme |
| `/app/messages` (+ `/[handle]`)  | `(protected)/app/messages/...`                        | **Epistles** (inbox) / **Whispers** (thread)                    | copy, theme                                       |
| `/app/invite`                    | `(protected)/app/invite/+page.svelte`                 | **Summon a Frank**                                              | copy, theme                                       |
| `/app/court`                     | `(protected)/app/court/+page.svelte`                  | **The Tribunal of the Holy Tube**                               | copy (title swap), theme                          |
| `/app/help`                      | `(protected)/app/help/+page.svelte`                   | **The Catechism**                                               | copy (title swap + lore), theme                   |
| error / 404                      | `+error.svelte` (**does not exist**)                  | _(new — name w/ designs)_                                       | **new**                                           |

> **`/` redirect:** `/` currently redirects to `/app` (post-M7 scaffold cleanup,
> PR #89). **M8 repoints it to `/app/feed`** — see the **Default landing route**
> section below; the mechanical change lands in **TASK-080**. `/` itself is not a
> page this milestone designs.

---

## Page Naming Map — themed cult DISPLAY names (CONFIRMED)

These are **user-facing display names / page `<title>`s / nav labels** mapped onto
the EXISTING routes. **URL paths are UNCHANGED** — this is a skin, not a skeleton:
the route param, the file path, and every internal/code identifier stay exactly as
they are (per the HARD SCOPE CONSTRAINT). Only what a user reads in the title bar,
the page heading, and the nav changes.

**TASK-081 (brand & lore copy) is the source of truth for applying these exact
names** — the copy pass MUST use the confirmed strings below verbatim (subject to
the designs' final voice/casing) and MUST NOT invent alternatives for the
already-decided routes.

| Route (UNCHANGED)        | Cult display name (CONFIRMED)                |
| ------------------------ | -------------------------------------------- |
| `/sign-up`               | **Take the Casing**                          |
| `/sign-in`               | **Enter the Snacktum** (page heading)        |
| `/app/onboarding`        | **Choose Your Frank Name**                   |
| `/app/dogs`              | **Your Litter**                              |
| `/app/dogs/[id]`         | **The Relic**                                |
| `/app/feed`              | **The Procession: Standings of the Blessed** |
| `/app/profile/[handle]`  | **The Shrine**                               |
| `/app/messages`          | **Epistles**                                 |
| `/app/messages/[handle]` | **Whispers**                                 |
| `/app/court`             | **The Tribunal of the Holy Tube**            |
| `/app/invite`            | **Summon a Frank**                           |
| `/app/help`              | **The Catechism**                            |

> **OQ-5 is now FULLY RESOLVED** (2026-06-18 / 2026-06-19, from the user's mockup
> filenames + the final dog-detail choice): `/sign-in` → **Enter the Snacktum**,
> `/app/profile/[handle]` → **The Shrine**, `/app/messages` → **Epistles**,
> `/app/messages/[handle]` → **Whispers**, and **`/app/dogs/[id]` → "The Relic"** are
> all CONFIRMED above. The `/app` home/hub is **retired/absorbed** (redirects to The
> Procession — see § Default landing route), so it needs no display name. **Every
> user-facing page name is now confirmed** — TASK-081 applies them verbatim.

### Confirmed cult copy beyond page names (verdict / brand labels)

These are CONFIRMED user-facing label decisions the copy pass (TASK-081) and the
brand-bearing tasks (TASK-085 Tribunal/profile, TASK-089 Reliquary badge) MUST apply
verbatim — like the page names above, they are decided, not open:

| User-facing label (CONFIRMED)            | Replaces                  | Code/data identifier (UNCHANGED)                                                                                        |
| ---------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **The Anointed Wiener** (champion title) | "Top Dog"                 | `is_current_top_dog` / `TopDogBadge` / `selectTopDog` / `days_as_top_dog`                                               |
| **FALSE WITNESS** (false-accuser brand)  | "HAMBURGER LIAR" / "LIAR" | `hamburger_liars` / `not_a_hamburger` / `getLiarBrandTimestamps` / `summarizeLiarBrand` / `liarBrand` / badge id `liar` |

> **FALSE WITNESS is a DISPLAY-LABEL change only.** Wherever a user reads "HAMBURGER
> LIAR" or (in the verdict-consequence context) "LIAR" — the Tribunal verdict copy,
> the profile police-tape brand, the Reliquary shame-relic — show **FALSE WITNESS**
> (it pairs naturally with HERETIC). **PRESERVE every code/data identifier unchanged**
> (the `hamburger_liars` table, the `not_a_hamburger` verdict value, the
> `getLiarBrandTimestamps` / `summarizeLiarBrand` wrappers, the `liarBrand` /
> `ProfilePoliceBanner` symbols, the `liar` badge id, and any `*Liar*` / `*liar*`
> symbol). The Reliquary shame-relic badge reads **FALSE WITNESS** (not "False
> Witness / Liar"). The design prompts already use the FALSE WITNESS wording
> (`design/page-design-prompts.md`).

---

## Active Tasks

> All tasks are **`blocked`** on **`DESIGNS`** (final page designs). Sizes are
> pre-design estimates and may move once designs land. Do **not** dispatch until
> the user activates after delivering designs.

### TASK-081: Brand & lore copy pass — app name + "The Anointed Wiener" + cult terminology [`blocked`] [`P1`] [`L`]

**Owner:** unassigned
**Dependencies:** `DESIGNS` (final lore/voice + per-page copy); soft-depends on
TASK-080 (shell exists to hold nav/header copy) and is the **source of truth for
the title swap** that TASK-082/084/085/086 reference.

**Scope:** a **user-facing-strings-only** sweep across all ≈14 pages (see the Page
inventory): product name "Top Dog" → **"Snacktum Snacktorum"**; champion title
"Top Dog" → **"The Anointed Wiener"**; the **per-page cult display names** from the
**Page Naming Map** (the confirmed page `<title>`s / headings / nav labels); and a
cult/temple lore voice for titles, headings, and microcopy. **No code identifiers,
no infra names.**

**Acceptance Criteria:**

- [ ] **Per-page display names applied from the Page Naming Map.** This task is the
      **source of truth** for those strings — apply the **CONFIRMED** names verbatim
      (subject to the designs' final casing/voice) to each route's `<title>`,
      top-level heading, and nav label:
      `/sign-up` → **Take the Casing**, `/sign-in` heading → **Enter the Snacktum**,
      `/app/onboarding` → **Choose Your Frank Name**, `/app/dogs` → **Your Litter**,
      `/app/feed` → **The Procession: Standings of the Blessed**,
      `/app/profile/[handle]` → **The Shrine**, `/app/messages` → **Epistles**,
      `/app/messages/[handle]` → **Whispers**, `/app/court` → **The Tribunal of the
      Holy Tube**, `/app/invite` → **Summon a Frank**, `/app/help` → **The Catechism**,
      and **`/app/dogs/[id]` → "The Relic"** (resolved 2026-06-19 — OQ-5 fully closed).
      The **`/app` home/hub is retired** (redirects to The Procession — no name
      needed). **Every page name is now confirmed** — apply "The Relic" verbatim to the
      dog-detail page; do not invent alternatives. URL paths and code identifiers stay
      UNCHANGED (skin, not skeleton).
- [ ] **App name** "Snacktum Snacktorum" replaces "Top Dog" as the product/brand
      name in: page `<title>`s, top-level headings, the sign-in/sign-up copy
      ("Top Dog is invite-only" → cult-framed equivalent), the help page, and any
      other user-visible "Top Dog the app" reference.
- [ ] **Champion-title swap "Top Dog" → "The Anointed Wiener"** in **every**
      user-facing place the crown is shown:
  - the badge label (`TopDogBadge` `label` prop value — **prop value only**, not the
    component name)
  - the **"Days as Top Dog"** stat label → "Days as The Anointed Wiener" (or the
    designed phrasing)
  - _(the Top-Dog-privileges notice was **retired in TASK-080** — Top Dog powers now
    live in The Catechism, so it is no longer a copy target)_
  - the Court's **"TOP DOG IS THE ADJUDICATOR"** police-tape label
    (`HamburgerAlarmBanner` / court copy)
  - the **feed/leaderboard** crown references
  - the **help page** crown/vote explanation
- [ ] **Cult/temple lore voice** applied to headings + microcopy across the pages,
      consistent with the designs. Lean into the **existing** heresy theme: the
      Hamburger Court, the false-accuser brand (display label **FALSE WITNESS** — see
      the cult naming-map; the old "HAMBURGER LIAR" wording is renamed in display copy,
      the `hamburger_liars` code/data is unchanged), and **HAMBURGER HERETIC** already
      fit (excommunication / the unclean hamburger / heresy) — re-theme their copy to
      match, but **keep the underlying mechanic labels recognizable** (a user who saw
      the brand should still understand the consequence).
- [ ] **Help page (`/app/help`) accuracy preserved.** It describes live mechanics;
      the copy re-theme must **not** change any _described behavior_ — only the voice.
      Re-verify every mechanic-bearing line still matches source
      (`voting/ranking.ts`, `mustard/decay.ts`, `reports/verdict.ts`) exactly as
      TASK-075 did. The vote system stays accurately described (one movable vote, no
      self-vote, most votes → crown, sticky tie-break, the days tally). **NOTE
      (OQ-2d, 2026-06-19):** the mustard/Anoint overlay lifespan changes from ~24h →
      **~6h** (`MUSTARD_LIFESPAN_MS`) — update the Catechism's "~24h" mustard copy to
      **~6h** in lockstep with whichever of TASK-081 / TASK-086 lands the constant
      change, so the help page stays accurate.
- [ ] **No code identifier renamed; no infra name changed.** Grep check at the end:
      `is_current_top_dog`, `days_as_top_dog`, `selectTopDog`, `TopDogBadge`,
      `recompute_top_dog`, table/RPC names — all still present and unchanged. Only
      _string literals / markup text_ differ.
- [ ] **XSS-safe:** all copy is fixed strings (no `{@html}`, no user content
      interpolated unescaped).
- [ ] Gates green: `pnpm check` 0, `pnpm lint` clean, `pnpm test` green (update any
      test that asserts on a changed user-facing string), **`@smoke` 4/4** (smoke
      may assert visible copy — update selectors/text expectations in lockstep),
      `@security` green. No migration.

**Notes (for the implementer):**

- This is the **largest-surface** task but the **lowest-risk per change** (strings).
  It is **highly design-dependent** — the final voice/wording comes from the
  designs; do not invent the lore ahead of them.
- Watch for copy asserted in tests: `@smoke` and unit tests may match on visible
  text (headings, button labels). Changing a string without updating its assertion
  turns a suite red — update both together.
- No new dependency; no schema; no new architecture-decision row (copy only).

---

### TASK-082: Build `/sign-in` — real email/password form + server action [`blocked`] [`P1`] [`M`] (`design-light`)

**Owner:** unassigned
**Dependencies:** `DESIGNS` (sign-in page design); mirror the existing
`sign-up/+page.server.ts` action structure.

**Problem:** `/sign-in` is a **non-functional stub** — `sign-in/+page.svelte` is two
lines (a heading + one sentence), with **no form and no `+page.server.ts`**. There
is no way to actually sign in. The app guard redirects unauthenticated `/app`
requests to `/sign-in` (`(protected)/app/+layout.server.ts` line 24), so this dead
stub is the destination of every bounce — a real gap.

**Acceptance Criteria:**

- [ ] New **`sign-in/+page.server.ts`** with a default form action that calls
      **`supabase.auth.signInWithPassword({ email, password })`** on
      `event.locals.supabase` (the RLS-scoped per-request client), mirroring the
      sign-up action's shape.
- [ ] **Boundary validation** before the call (email format, non-empty password),
      returning `fail(400, { email, error })` with friendly messages and echoing the
      submitted `email` back to the form (mirror sign-up's pattern — never echo the
      password).
- [ ] On success, **`throw redirect(303, '/app')`**. On auth failure, a friendly,
      **non-enumerating** error (e.g. "Those credentials didn't work." — do **not**
      reveal whether the email exists). Raw Supabase errors logged server-side only,
      never surfaced to the client (project error-handling convention).
- [ ] **`sign-in/+page.svelte`** renders the real form (email + password inputs,
      submit), wired with `use:enhance` and a submitting/loading affordance
      (consistent with TASK-072's `use:enhance` patterns), Svelte 5 runes.
- [ ] Links to **`/sign-up`** ("have an invite?") and **`/forgot-password`** (built
      in TASK-083) per the designs.
- [ ] **Auth-trust boundary respected:** the action uses `event.locals.supabase`;
      the post-login session is established via the SSR cookie flow (hooks), and any
      session read elsewhere goes through `safeGetSession()` (never raw
      `getSession()`) — no change to that boundary, just don't regress it.
- [ ] **Tests (the missing coverage):**
  - unit/action coverage for the sign-in action: invalid email → `fail(400)`,
    empty password → `fail(400)`, success → `redirect(303,'/app')`, auth error →
    friendly non-enumerating `fail`. Model on `sign-up/signup-action.test.ts`.
  - an **`@smoke` sign-in path**: a known seeded user signs in through the real
    form and reaches `/app`. Extend the E2E harness/global-setup as needed (the
    smoke harness already mints an invite + creates a user — reuse that user's
    credentials to sign in). Keep the existing M1 `@smoke` slice green.
- [ ] Gates green: `pnpm check` 0, `pnpm lint` clean, `pnpm test` green, **`@smoke`
      ≥ 4/4 + the new sign-in path**, `@security` green. No migration.

**Notes (for the implementer):**

- **`design-light`:** the action logic + tests are design-independent; only the page
  markup/styling waits on designs. The user may unblock this early.
- **Security (L2):** non-enumerating auth errors matter — do not leak
  "no account with that email" vs "wrong password". Supabase's
  `signInWithPassword` returns a generic invalid-credentials error; surface a single
  friendly message for all failure modes.
- No new dependency; no schema; no new architecture-decision row.

---

### TASK-083: Forgot-password + reset-password flow [`in_progress`] [`P1`] [`M`] (`design-light`)

**Owner:** unassigned
**Dependencies:** `DESIGNS` (both page designs); soft-depends on TASK-082 (sign-in
links to forgot-password).

**Problem:** there is **no password-recovery path** — neither `/forgot-password`
nor `/reset-password` exists. A member who forgets their password is locked out.

**Acceptance Criteria:**

- [ ] **`/forgot-password`** (`forgot-password/+page.svelte` + `+page.server.ts`):
      a form that takes an email and calls
      **`supabase.auth.resetPasswordForEmail(email, { redirectTo: <reset URL> })`**.
      Always returns the **same neutral, non-enumerating** success message
      ("If that email is registered, a reset link is on its way.") whether or not the
      email exists. Boundary-validate the email; `use:enhance` + loading affordance.
- [ ] **`/reset-password`** (`reset-password/+page.svelte` + `+page.server.ts`):
      reached from the emailed recovery link (Supabase establishes a recovery
      session). A form takes the **new password** (with confirm) and calls
      **`supabase.auth.updateUser({ password })`** on `event.locals.supabase`.
      Enforce the **same `MIN_PASSWORD_LENGTH` (8)** as sign-up. On success, friendly
      confirmation and a link/redirect to `/sign-in` (or `/app` if a full session is
      present). On failure (expired/invalid recovery link), a friendly message.
- [ ] **Recovery-session handling** done correctly for `@supabase/ssr` — verify the
      current SSR recovery flow against Supabase docs (the recovery token arrives via
      the URL; the session must be picked up server-side via the per-request client /
      hooks). **This is the one task that needs a quick doc check** — confirm the
      current `resetPasswordForEmail` + `updateUser` SSR pattern before building.
- [ ] **Local email testing documented:** local reset emails land in **Mailpit**
      (`http://localhost:54324`). Add a note (task Notes + a line for the README /
      [[CLAUDE]] testing section via the documenter) so the flow is testable locally.
- [ ] **Security (L2):** non-enumerating forgot-password response; password length
      enforced; raw errors logged server-side only; the recovery session is the
      authoritative gate for `updateUser` (a user cannot reset another account's
      password). No secret key on the client.
- [ ] **Tests:** action coverage for both pages (valid/invalid email → neutral
      success; short/blank/mismatched new password → `fail(400)`; success →
      confirmation/redirect). An E2E that exercises the local Mailpit round-trip is
      **optional/stretch** (Mailpit message-fetch); at minimum the action logic is
      unit-tested. If an E2E is added it uses the **local stack only** (never hosted),
      per the harness guardrail.
- [ ] Gates green: `pnpm check` 0, `pnpm lint` clean, `pnpm test` green, `@smoke`
      4/4, `@security` green. No migration.

**Notes (for the implementer):**

- **`design-light`:** logic is design-independent; only markup/styling waits.
- **Doc check required** (the SSR recovery-session handshake) — do this before
  coding. Everything else reuses the established `event.locals.supabase` +
  `safeGetSession()` boundary.
- No new dependency expected (Supabase Auth covers reset natively); no schema; no
  new architecture-decision row.

---

### TASK-084: Ritual sign-up — re-theme (and possibly redesign the flow of) onboarding [`blocked`] [`P2`] [`L`]

**Owner:** unassigned
**Dependencies:** `DESIGNS` (the ritual design — **and the resolution of OQ-1**,
which decides this task's true size); TASK-081 (copy/voice); touches
`sign-up/+page.svelte` and `(protected)/app/onboarding/+page.svelte`.

**Scope (DEFERRED until OQ-1 is decided with the designs):** re-frame the
invite-redemption + onboarding sequence as an **initiation "ritual"** into the cult.
**The size of this task depends on which option the designs choose (see OQ-1):**

- **Option A — cosmetic re-theme (S/M):** restyle + re-copy the existing sign-up
  and onboarding steps as a "ritual" (ceremony framing, cult voice) **without
  changing the flow or the underlying actions**. Lowest risk. The `@handle` + avatar
  onboarding step stays where it is.
- **Option B — multi-step rite (M/L):** redesign sign-up into a guided multi-step
  "rite" (e.g. invite → credentials → naming → avatar as ceremonial stages),
  **possibly absorbing the `/app/onboarding` step** into the rite so a new initiate
  flows straight through. Higher risk: it touches the post-sign-up funnel
  (`(protected)/app/+layout.server.ts` routes a profile-less user to
  `/app/onboarding`) and must **not** break invite redemption or the profile-funnel
  guard.

**Acceptance Criteria (common to both options):**

- [ ] The invite-redemption mechanics are **unchanged and intact**: the
      pre-check → `signUp` → atomic `redeem_invite` RPC → orphan-cleanup-on-lost-race
      → session-branch redirect sequence (decisions #17/#22/#23) still works
      end-to-end. **No change to `redeem_invite` / invite RLS / the action's
      redemption ordering.**
- [ ] The **profile-funnel guard still holds**: a freshly-redeemed, profile-less
      user still ends up setting a validated unique `@handle` (+ optional avatar)
      before using the app, with **no redirect loop** (decision: onboarding guard in
      `+layout.server.ts`). If Option B absorbs onboarding, the guard must be updated
      coherently (a user who completed the rite has a profile; one who didn't is still
      funneled) — and re-tested.
- [ ] **Handle validation unchanged:** charset `^[A-Za-z0-9_]{2,32}$` at the app
      boundary, case-insensitive uniqueness via `citext`, `HANDLE_TAKEN` sentinel on
      `23505` (decision/DW history) — re-themed copy must not weaken validation.
- [ ] Cult "ritual/initiation" voice + visual treatment per the designs (TASK-081
      owns the shared lore; this task applies it to the sign-up/onboarding surface).
- [ ] **Security (L2):** no secret key on the client; avatar upload still goes
      through `$lib/storage` with the owner-prefix path + the hard 2 MiB Storage-API
      cap (TASK-070); compression via `compressToWebp`.
- [ ] **Tests:** the existing `sign-up/signup-action.test.ts` and
      `onboarding/onboarding-action.test.ts` stay green (update assertions for changed
      copy only); if Option B changes the flow, add coverage for the new step
      sequence and the updated funnel guard. **The M1 `@smoke` slice (invite → profile
      → upload → see dog) MUST stay green** — if the rite changes the path the smoke
      test walks, update the smoke test in lockstep.
- [ ] Gates green: `pnpm check` 0, `pnpm lint` clean, `pnpm test` green, **`@smoke`
      4/4**, `@security` green. Migration only if the flow genuinely requires one
      (Option A/B as scoped should need **none** — flag immediately if you think it
      does).

**Notes (for the implementer):**

- **Do NOT pick A vs B yourself — OQ-1 is decided with the designs.** Scope
  conservatively toward **A** unless the designs clearly call for **B**. If B, treat
  the funnel-guard change as the riskiest part and cover it with tests.
- This is the most flow-sensitive task in the milestone because it sits on the
  invite/auth critical path and the `@smoke` slice. Preserve the redemption
  ordering and the profile funnel above all.
- No new dependency expected; no new architecture-decision row anticipated.

---

### TASK-085: Profile page redesign + display-name surfacing [`blocked`] [`P2`] [`L`]

**Owner:** unassigned
**Dependencies:** `DESIGNS` (the profile design — the user's screenshot is the
"before"); TASK-080 (shell), TASK-081 (copy/title swap), TASK-087 (theme tokens).
**Soft-couples with TASK-089** (the derived badge reliquary renders on this page —
this task lays out the shelf slot; TASK-089 owns the badge module/logic; neither
hard-blocks the other). Touches `(protected)/app/profile/[handle]/+page.svelte` and
its `+page.server.ts` — the redesign surfaces `display_name` (already loaded) and
**adds read-only aggregate queries for the derived stat ledger** (counts/sums over
`top_dog_days` / `hot_dogs` / `invites` / `mustard_sprays` / `hotdog_reactions` —
all existing tables, no schema change).

**Problem:** the profile page is cramped — avatar + an inline/squeezed wall
composer, with **`display_name` barely surfaced** even though it exists (free-form,
may contain spaces) alongside the URL-safe `@handle`. The user's screenshot of the
current page is the "before."

**Acceptance Criteria:**

- [ ] **Redesigned profile layout** per the designs: avatar (with a designed
      placeholder when `avatar_path` is null), a **display-name-forward** header, and
      a **proper wall composer** (not the cramped inline box — a real compose area
      with the post affordance, `use:enhance` loading state preserved).
- [ ] **Display-name surfacing:** `display_name` is shown as the **human name**
      (headings, wall message authorship, profile header), while **`@handle` remains
      the URL-safe identifier** (the route param, mentions, the canonical id). **No
      schema change** — both `profiles.display_name` and `profiles.handle` already
      exist and already load. Where a name is shown to humans, prefer `display_name`
      (falling back to `@handle` if display name is blank — note onboarding defaults
      `display_name` to the handle, so it's rarely empty).
- [ ] **Derived profile stat ledger** — surface the member's standing as a stat
      block, **every value DERIVED from data the app already keeps** (no new schema,
      no new tracking, no new write path; the load gains read-only aggregate queries
      only). Show:
  - **Days as The Anointed Wiener** — already shown (`profiles.days_as_top_dog`).
  - **Times Crowned** — distinct crowned-day count (`top_dog_days`, `profile_id` =
    this member).
  - **Franks Offered** — count of this member's `hot_dogs`.
  - **Total Devotion** — sum of `vote_count` across this member's `hot_dogs`.
  - **Highest Blessing** — `max(peak_votes)` across this member's `hot_dogs`.
  - **Disciples Summoned** — count of `invites` they minted that were redeemed
    (`inviter_id` = this member AND `consumed_at is not null`).
  - **Anointings Received** — count of `mustard_sprays` where
    `target_profile_id` = this member.
  - **Reactions Received** — count of reactions across this member's dogs
    (`hotdog_reactions` joined via `hot_dogs.owner_id`).
  - the **HERETIC / FALSE WITNESS** shame marks — already surfaced as the
    `ProfilePoliceBanner` brands (`isHeretic` / `liarBrand` — code symbols
    UNCHANGED; "FALSE WITNESS" is a display-label rename only); keep those, do not
    duplicate them as a "stat".
  - **‼️ Reports are ANONYMOUS — do NOT surface the reporter side on a public
    profile.** Never show "heresies you've called", a count of reports this member
    _made_, or any reporter-side tally. Reporter ids are deliberately never exposed
    (decision #27 / TASK-071 anonymity). Only the _consequences a member bears_
    (HERETIC, FALSE WITNESS, anointings received) are public — the accusations they
    _make_ are not. This is a hard constraint, not a preference.
  - Prefer adding these as small read-only count/sum queries to the existing
    `event.locals.supabase` (RLS-scoped) load. Where a render-time pure summary
    already exists for a value, **reuse it** (e.g. the HERETIC / FALSE WITNESS brands
    via `verdict.ts`); do not recompute. If TASK-089 (the derived badge module) lands
    first, these same aggregates can feed both — coordinate to avoid duplicate
    queries, but neither task is a hard dependency of the other.
- [ ] **Reliquary (badge shelf) placement** — the profile is where the derived
      **badge reliquary** renders (TASK-089). This task lays out the **section/shelf
      slot** on the redesigned profile per the design (see the Reliquary prompt in
      `design/page-design-prompts.md` #12); **TASK-089 owns the badge module + the
      shelf component's earned/locked logic.** If TASK-089 has not landed when this
      task builds, leave a clearly-marked placeholder slot for the shelf and wire it
      when TASK-089 is in. (Soft-coupled, not a hard blocker either direction.)
- [ ] **All existing profile features keep working** and stay correctly wired:
  - the **mustard overlay** (now "Anoint" per TASK-086) — render-time decay via
    `mustardOpacity`, positioned in the spray area (decision #15)
  - the **wall** — `renderWallBody` (emoji filter at render, decision #16), post +
    delete actions, `invalidateAll` after mutation
  - the **🍔 FALSE WITNESS / HERETIC profile banners** (`ProfilePoliceBanner`) —
    render-time FALSE WITNESS decay + persistent HERETIC (decision #15, TASK-073)
  - the **`TopDogBadge`** (label re-copied to "The Anointed Wiener" per TASK-081)
  - the **canSpray** gate (Top-Dog-only) — unchanged authorization (decision #25)
- [ ] **Title swap** "Top Dog" → "The Anointed Wiener" anywhere the profile shows the
      crown/badge/stat. Code identifiers unchanged.
- [ ] **Security/wiring unchanged:** the load stays on `event.locals.supabase`
      (RLS-scoped); cross-member private-bucket images (if any rendered here) keep the
      decision #27 server-side service-client signing pattern; no new trust path.
      `display_name` and wall bodies render through Svelte auto-escaped text (no
      `{@html}`) — XSS-safe.
- [ ] Responsive + accessible (semantic headings, labeled compose textarea, image
      `alt` text using the display name).
- [ ] **Tests:** the existing `profile-load.test.ts`, `wall-action.test.ts`,
      `spray-action.test.ts` stay green (update only for intentional copy/markup
      changes); add coverage if the load surfaces a newly-shown field. `@smoke`
      (which walks profile → wall in the slice) stays green.
- [ ] Gates green: `pnpm check` 0, `pnpm lint` clean, `pnpm test` green, **`@smoke`
      4/4**, `@security` green. No migration.

**Notes (for the implementer):**

- **Highly design-dependent** — the layout comes from the designs; do not redesign
  ahead of them.
- This page composes the **most** features (mustard/Anoint, wall+emoji,
  FALSE WITNESS/HERETIC banners, badge, canSpray) — the redesign must preserve every
  one of those wirings.
  Treat it as a re-skin + re-layout, not a rewrite of the data flow.
- **The derived stat ledger + the badge reliquary are both pure reads of EXISTING
  data** — no new schema, no migration, no new write path, no new dependency. The
  ledger is small aggregate queries on the RLS-scoped load; the reliquary is
  TASK-089's derived module. **The hard constraint:** reports are anonymous —
  never surface a reporter-side count on a public profile (only consequences borne,
  not accusations made). See decision #27 / TASK-071 anonymity.
- No new dependency; no schema change (display-name + every stat source already
  exists); no new architecture-decision row.

---

### TASK-086: "Anoint" — mustard re-theme [`blocked`] [`P2`] [`M`]

**Owner:** unassigned
**Dependencies:** `DESIGNS` (the splat treatment in `design/pages/The Shrine.dc.html`);
**OQ-2 is now FULLY RESOLVED (2026-06-19)** — all five sub-decisions are decided (see
the Scope + AC below); TASK-085 (profile redesign hosts the overlay **and the wall**
the anoint-notice composes into), TASK-081 (copy). Touches the mustard surface:
`(protected)/app/profile/[handle]/+page.svelte`, the spray action, the render-time
`mustardOpacity` overlay (+ `MUSTARD_LIFESPAN_MS` constant), **and the wall render**
(where the derived, coalesced anoint-notice is composed in alongside `wall_messages` —
read-only, no write). **Under Option A (user-approved) it ALSO touches**
`prune_mustard_sprays` — the prune job is **retired** (one migration + a keep-alive
workflow edit) so the persisting wall-notice's source rows survive. It does **NOT**
change the `mustard_sprays` table shape, the `wall_messages` table/immutability, or the
`spray` write path's authorization.

**Scope (OQ-2 RESOLVED — build to these decided values):** rename the Top-Dog
mustard-spray action to **"Anoint"** (the champion bestows a blessing — a "splat" of
mustard) in user-facing copy, re-theme the visual to a **splat**, shorten the overlay
decay to **~6h**, **and surface a derived, coalesced "anoint → wall notice"** on the
anointed member's wall. The five sub-decisions are now all decided (2026-06-19):

- **OQ-2a — who may Anoint → KEEP GATED.** Only the reigning champion ("The Anointed
  Wiener" / `is_current_top_dog`) may Anoint — the decision #25 `WITH CHECK`
  authorization on the non-client-writable crown column is **unchanged**.
- **OQ-2b — Anoint vs reactions → NO re-mechanic, NO merge.** Anoint stays the
  **existing mustard spray**, re-copied as "anointing." The emoji reactions surface is
  **untouched** (no replace, no merge).
- **OQ-2c — visual → SPLAT.** Reuse the splat animation in
  `design/pages/The Shrine.dc.html` (replacing the old drip framing).
- **OQ-2d — decay → DECAYS, but over ~6h (was ~24h).** The overlay still fades at
  render via `mustardOpacity` (decision #15), but the lifespan shortens from ~24h →
  **~6h**: a render-time constant change to `MUSTARD_LIFESPAN_MS` in
  `src/lib/features/mustard/decay.ts` (+ its co-located tests). The DB still stores
  only the raw `sprayed_at` timestamp — **no migration for the decay change itself.**
- **OQ-2e — anoint → wall notice → 24h ROLLING STACK; PERSISTS.** Render-time derived
  from `mustard_sprays`, coalesced into one "×N" notice on the anointed member's wall.
  **(i) coalescing window — a rolling 24h that RESETS at each anointing:** successive
  anoints collapse into the SAME notice as long as each lands within 24h of the
  previous one (the window slides forward with each anoint); a gap of **>24h** ends that
  burst and the next anoint starts a **new** notice. **(ii) the wall notice PERSISTS**
  as a lasting record — only the visual mustard **overlay** decays (~6h, OQ-2d).

> **‼️ IMPLEMENTATION DIRECTION = Option A (user-approved 2026-06-19) — TASK-086
> CARRIES ONE MIGRATION.** Because the wall notice PERSISTS and is render-derived from
> `mustard_sprays` rows, those rows must SURVIVE. So the daily **`prune_mustard_sprays()`
> job is RETIRED**: TASK-086 ships (a) **one migration** that retires/neuters
> `prune_mustard_sprays` (drop or no-op the function — keep its EXECUTE lockdown
> posture; preserve the table's decision #28 grants + decision #12 RLS), (b) a
> **keep-alive workflow edit** dropping the daily prune step from
> `.github/workflows/keepalive.yml`, and (c) a **likely NEW architecture-decision row
> #29** (mustard_sprays retention: rows permanent; overlay decays at render ~6h;
> wall-notice render-derived, coalesced, permanent). **This means M8 is no longer
> strictly "no migration."** Batch TASK-086's hosted push onto the standing M7
> hosted-push gate (see § Standing ops note). Decision #29 is recorded as a **plan**
> here + in the OQ section; the director adds the real [[PROJECT]] decision-table row
> when TASK-086 is implemented.

**Acceptance Criteria:**

- [ ] User-facing **"Anoint" copy** replaces "spray mustard" wherever a user reads it
      (the profile action button, any help/Catechism text). Code identifiers
      (`mustard_sprays`, `mustardOpacity`, `MUSTARD_LIFESPAN_MS`, the `spray` action
      name, `prune_mustard_sprays`) **stay unchanged** (scope box) — the prune
      function is _retired_ (dropped/neutered), not renamed.
- [ ] **Overlay decay shortened to ~6h (OQ-2d).** `MUSTARD_LIFESPAN_MS` in
      `src/lib/features/mustard/decay.ts` changes from `24 * 60 * 60 * 1000` →
      **`6 * 60 * 60 * 1000`**; update the module doc-comment ("fully fades 24h" → "6h")
      and the co-located `decay.test.ts` boundary cases (the 24h clamp/half-life
      assertions move to the 6h boundary). The DB stores only the raw timestamp; the
      decayed splat is computed at render — **no persisted decayed output, no migration
      for this change.**
- [ ] **Derived, coalesced "anoint → wall notice" (OQ-2e).** When a member is anointed,
      their **wall shows a notice** attributing it to **The Anointed Wiener**; rapid
      successive anoints **coalesce into ONE notice listing the count** ("The Anointed
      Wiener anointed you ×N"). **RENDER-TIME DERIVED from the existing `mustard_sprays`
      rows — NO new schema, NO new table, NO new write path, NO change to
      `wall_messages` immutability.** The wall render composes the real `wall_messages`
      with a **synthesized** anoint-notice derived from `mustard_sprays` (which already
      records every anoint with a timestamp; the sprayer is always the reigning champion
      per decision #25), grouped/coalesced by a **rolling-24h window that resets at each
      anointing** (a >24h gap ends a burst and starts a new notice) and sorted
      chronologically among the wall messages. The notice **persists** as a lasting
      record (only the visual overlay decays, ~6h). **Un-forgeable by construction** —
      the same derived, no-write pattern as the Reliquary badges (TASK-089) / the alarm
      summarizer / mustard decay.
- [ ] **`prune_mustard_sprays()` retired (Option A — REQUIRED for the persisting
      notice).** Ship **one migration** that retires/neuters the prune function (drop
      it, or make it a no-op) so anoint rows are NEVER pruned — they are the source of
      the persisting wall notice. Preserve the `mustard_sprays` table's decision #28
      base grants and its decision #12 plain owner-scoped RLS (this migration touches
      only the prune function, not the table's shape/grants). **Edit
      `.github/workflows/keepalive.yml`** to drop the daily prune step (the keep-alive
      ping + tally steps stay). **Record decision #29** (mustard_sprays retention) per
      the normal gate — flag it to the director to add the [[PROJECT]] decision-table
      row at implementation time.
- [ ] **Authorization preserved (OQ-2a = keep-gated):** only the current crown holder
      may Anoint — the existing plain owner-scoped RLS write with the Top-Dog
      `WITH CHECK` conjunct on the non-client-writable `is_current_top_dog` column
      (decision #25) is **untouched**. The `canSpray` UI gate stays driven by the
      server-derived crown flag.
- [ ] **Visual re-theme — SPLAT (OQ-2c)** applied in the overlay component + theme
      styles (TASK-087 tokens), reusing the splat animation from
      `design/pages/The Shrine.dc.html`.
- [ ] **Reactions untouched (OQ-2b):** no change to the emoji-reactions surface — Anoint
      is a re-skin of the existing mustard spray, not a replacement or merge.
- [ ] **Hosted-push gate:** the prune-retirement migration must be pushed to hosted via `supabase db push` (batch it with the standing M7 `burger_alarms` /
      `burger_verdicts` migrations per the per-milestone hosted-push discipline). The
      keep-alive prune step must be dropped **in lockstep** so a retired/neutered prune
      function doesn't leave a workflow step calling a missing RPC (avoiding the
      hosted-schema-drift 404 failure mode in [[CLAUDE]]).
- [ ] **Tests:** `spray-action.test.ts` stays green (update for copy); `decay.test.ts`
      updated for the 6h lifespan; add coverage for the pure anoint-notice coalescing
      (rolling-24h-window grouping, ×N count, >24h gap → new notice). If the prune
      retirement changes a live-DB guarantee, adjust any affected `@security` case.
      `@smoke` / `@security` green.
- [ ] Gates green: `pnpm check` 0, `pnpm lint` clean, `pnpm test` green, `@smoke`
      4/4, `@security` green. **One migration** (prune retirement) — the only M8 task
      that carries one.

**Notes (for the implementer):**

- **OQ-2 is fully decided — build to the resolved values above, do not re-guess.** The
  user-facing changes are: "Anoint" copy, a **splat** visual, a **6h** overlay decay,
  and a derived/coalesced/persisting wall notice. The one structural change is the
  **Option A prune retirement** + its migration + workflow edit + decision #29.
- **The decay-constant change (6h) needs NO migration** — it's a pure TS constant +
  tests + a Catechism copy update (~24h → ~6h, in lockstep with TASK-081/this task).
- **The prune retirement is the load-bearing structural change.** It is what makes the
  persisting wall notice coherent (the notice is render-derived from `mustard_sprays`,
  so those rows must never be pruned). Ship the migration, the workflow edit, and the
  decision-#29 row together; batch the hosted push with the M7 gate.
- No new dependency. **One migration + a likely new architecture-decision row #29**
  (the only M8 task that breaks the "no migration / no new decision row" posture).

---

### TASK-088: Designed error / 404 page [`blocked`] [`P3`] [`S`] (`design-light`)

**Owner:** unassigned
**Dependencies:** `DESIGNS` (error-page design); TASK-081 (copy/voice), TASK-087
(theme).

**Problem:** there is **no `+error.svelte`** anywhere — errors and 404s fall back to
SvelteKit's default unstyled boundary page.

**Acceptance Criteria:**

- [ ] A designed **`src/routes/+error.svelte`** (root error boundary) rendering a
      branded, cult-voiced error/404 page using `page.status` and `page.error`
      (`$app/state`), with a friendly message and a way back (a link to `/app` or
      `/` per the designs). Handles **404** (unknown route) and generic errors with
      appropriate copy.
- [ ] Cult lore voice (TASK-081) + theme styling (TASK-087). XSS-safe (no `{@html}`;
      `page.error.message` is rendered as escaped text, and **no sensitive internal
      error detail is shown to the user** — friendly copy only; server logs hold the
      detail).
- [ ] Optionally a nested `(protected)/app/+error.svelte` if the designs want a
      distinct in-app error treatment (so an error inside `/app` keeps the shell
      chrome). Decide with the designs; the root boundary is the required minimum.
- [ ] Gates green: `pnpm check` 0, `pnpm lint` clean, `pnpm test` green, `@smoke`
      4/4, `@security` green. No migration.

**Notes (for the implementer):**

- **`design-light`:** an error boundary is standard SvelteKit; only copy/visual wait
  on designs. Small task.
- **Security:** never render raw stack traces or internal error details to the user
  — friendly message only (L2 / OWASP "security misconfiguration" + insufficient-
  logging awareness: detail goes to server logs, not the page).
- No new dependency; no schema; no new architecture-decision row.

---

### TASK-089: The Reliquary — derived badge / honors system [`blocked`] [`P3`] [`M`]

**Owner:** unassigned
**Dependencies:** `DESIGNS` (the **Reliquary** design mock — `design/page-design-prompts.md`
#12); **soft-couples with TASK-085** (the profile redesign hosts the reliquary shelf —
TASK-085 lays out the slot, this task owns the badge module + the earned/locked shelf
component; neither hard-blocks the other), TASK-081 (badge name copy/voice), TASK-087
(theme tokens for the relic medallions).

**Problem / opportunity:** the app already stores everything needed to award members
**honors** — a first frank, a long reign, a 100-vote frank, redeemed invites, anointings
received, a heresy verdict, an inquisitor's rulings, early membership — but nothing
surfaces them. Add a **badge / honors "Reliquary"** on the profile (The Shrine),
computed **DERIVED at render (Option A)** from data the app **already has**.

**Scope / posture (read first — this is what keeps it inside M8's skin-not-skeleton
constraint):**

- This is a **purely DERIVED, read-only** feature: pure functions over **EXISTING**
  tables, surfaced on the profile load. **NO new schema, NO migration, NO new write
  path, NO new dependency, NO new RPC.**
- Because a badge is computed at render from existing records, it is **un-forgeable by
  construction** — there is **no client-settable badge state** anywhere (nothing to
  POST, nothing to write, no "badge" row). A member cannot grant themselves a badge any
  more than they can forge the underlying record (votes/crown/verdicts are already
  server-maintained and non-client-writable per decisions #13/#24/#25/#28).
- It **mirrors the project's existing pure render-time modules** — `voting/ranking.ts`
  (`selectTopDog`), `mustard/decay.ts` (`mustardOpacity`), `reports/alarm.ts`
  (`summarizeBurgerAlarm`), `reports/verdict.ts` (`isHamburgerHeretic` /
  `summarizeLiarBrand`): a dependency-free `.ts` module with co-located `*.test.ts`,
  no SvelteKit/Supabase imports in the pure part.
- **NOT a new numbered architecture-decision row.** This composes existing decisions
  (#12 cosmetic/ranking-inert, #13 crown, #15 render-time derivation, #27 anonymity)
  with no new invariant — record it as a **design/scope note** (derived, read-only,
  composes existing data), exactly as TASK-071/073 recorded their compositions.

**Acceptance Criteria:**

- [ ] **New pure feature module `src/lib/features/badges/`** — a dependency-free
      `.ts` module (e.g. `badges.ts`) with **no SvelteKit and no Supabase imports in
      the pure part**, following the `ranking.ts` / `decay.ts` / `alarm.ts` shape. It
      takes a plain **`BadgeInputs`** value object (the already-loaded member facts —
      counts/maxes/flags/timestamps) and returns the member's **earned + locked badge
      state** (each badge: id, earned boolean, and for tiered badges the current tier +
      the next-tier threshold). The route load assembles `BadgeInputs` from the
      member's existing data and passes it in; the module computes, the load does I/O.
- [ ] **Co-located unit tests** `src/lib/features/badges/badges.test.ts` — TDD-first
      (this is pure threshold logic, exactly the CLAUDE.md "what to test TDD-first"
      category). Cover: each badge's earned/not-earned boundary (at, just-below,
      just-above the threshold), every tier boundary for tiered badges, the
      all-locked (new member) case, the all-earned case, and defensive handling of
      missing/zero inputs. No live DB — pure value-in / value-out.
- [ ] **The v1 badge set — EXACTLY these, each VERIFIED derivable from existing
      schema** (do **not** add any that need tracking the app does not keep):
  - **First Frank** — member has **≥1** hot dog. _Source:_ count of `hot_dogs` where
    `owner_id` = member.
  - **Crowned** — _tiered_ **1 / 7 / 30**. _Source:_ `profiles.days_as_top_dog`
    (already loaded).
  - **Centurion** — a frank ever reached **≥100** votes. _Source:_ `max(peak_votes)`
    over the member's `hot_dogs`. (Tiers optional, designer's call.)
  - **The Summoner** — _tiered_ — **N** invites the member minted that were redeemed.
    _Source:_ count of `invites` where `inviter_id` = member **AND `consumed_at is not
null`** (the authoritative spent-signal — NOT `consumed_by`, which is nullable by
    FK; see the single-use-guard gotcha in [[CLAUDE]]).
  - **The Drenched** — _tiered_ — anointed **N** times. _Source:_ count of
    `mustard_sprays` where `target_profile_id` = member.
  - **Heretic** — owns a frank with a `confirmed_hamburger` verdict. _Source:_
    `burger_verdicts` joined via `hot_dogs.owner_id` = member — **reuse the existing
    `isHamburgerHeretic` / `getDogVerdictsForOwner`** (`reports/verdict.ts` /
    `reports/verdictStore.ts`); do not re-derive. (A shame-mark, not a gilded honor —
    see the design.)
  - **False Witness** (display label; internal badge id `liar` — unchanged) — has a
    `hamburger_liars` brand. _Source:_
    `hamburger_liars` where `reporter_id` = member — **reuse the existing
    `getLiarBrandTimestamps`**. (Decide with the designer whether this badge keys on
    _ever branded_ (any row) or _currently branded_ (within the ~7-day
    `summarizeLiarBrand` window); a relic/honor shelf usually wants _ever_, while the
    existing profile banner uses _currently_. A shame-mark.)
  - **The Inquisitor** — _tiered_ — rendered **N** verdicts as champion. _Source:_
    count of `burger_verdicts` where `decided_by` = member.
  - **Elder** — early member by `profiles.joined_at` (or a member-№ threshold derived
    by ordering `profiles.joined_at` ascending). _Source:_ `profiles.joined_at`. Pick
    a concrete, documented threshold (e.g. "sworn before {date}" or "among the first N
    sworn") — record it in the module so it's a single source of truth, not a magic
    number scattered in markup.
- [ ] **Out of v1 — flag, do NOT build** (badges needing data the app does NOT track):
      a **total-votes-ever-cast** honor (the `votes` table stores only the **one
      current** vote per member — `UNIQUE(voter_id)`, re-casting MOVES the row — so
      there is no lifetime vote-cast history) and **reign-streak** honors (`top_dog_days`
      records discrete held days, not contiguous-streak metadata). These are **future /
      out of v1**; note them in the module doc-comment + log them as Discovered Work so
      the decision is durable, not lost.
- [ ] **Rendered as a reliquary / relic-shelf on the profile (The Shrine)** — a new
      presentational shelf component (e.g. `src/lib/components/Reliquary.svelte` /
      `BadgeShelf.svelte`) shows **earned** relics (lit gold) vs **locked** ones (dim
      silhouettes), with **tier** indicators for tiered badges, per the Reliquary design
      (`design/page-design-prompts.md` #12). The component is **presentational only** —
      it takes the computed badge state as a prop and renders; **no badge logic in the
      component** (mirrors the `TopDogBadge` / `ProfilePoliceBanner` pattern: logic in
      the pure module + load, rendering in the component).
- [ ] **Wired into the profile load** (`(protected)/app/profile/[handle]/+page.server.ts`)
      — the load gathers the badge inputs via **read-only** queries on the **RLS-scoped**
      `event.locals.supabase` (counts/maxes over existing tables; reuse the existing
      verdict/liar helpers), builds `BadgeInputs`, runs the pure `badges` module, and
      passes the result to the page. **No service client needed** (no anonymity-sensitive
      reads — see below); **no new write path; no mutation.** A read failure on any input
      **degrades that badge to locked** rather than failing the page (the established
      per-feature graceful-degradation pattern in this load).
- [ ] **‼️ Reporter anonymity preserved (decision #27 / TASK-071).** **No badge keys on
      the reporter side of a report.** "Heretic" keys on the member's OWN dogs' verdicts
      (a consequence they bear); "False Witness" keys on the member's OWN
      `hamburger_liars` brand
      (a consequence they bear); "Inquisitor" keys on `decided_by` = the member (their
      own rulings as champion). **None** surfaces "who reported whom" or a report-count a
      member _made_. Do **not** add a "number of heresies you've called" badge — that
      would leak the anonymous reporter side. This is a hard constraint.
- [ ] **Un-themed code identifiers preserved (HARD SCOPE CONSTRAINT).** New code uses
      neutral internal names (`badges`, `Reliquary`/`BadgeShelf`, `BadgeInputs`, badge
      ids like `first_frank` / `crowned` / `centurion` / `summoner` / `drenched` /
      `heretic` / `liar` / `inquisitor` / `elder`). The **cult display names** (e.g. "The
      Anointed", "The Drenched", "Elder", "False Witness") are **copy/labels only**
      (props/strings, TASK-081 voice), never code identifiers. Existing identifiers
      (`is_current_top_dog`, `days_as_top_dog`, `selectTopDog`, table/RPC names) stay
      untouched.
- [ ] **Purely derived / read-only — restated as an explicit AC:** **no migration, no
      new write path, no new dependency, no new RPC, no new schema.** Un-forgeable by
      construction (no client-settable badge state — nothing to POST/insert). Grep check
      at the end: no new `create table` / `supabase migration`, no package-manifest
      change, no new `.rpc(` call.
- [ ] **Keep the M1 `@smoke` vertical slice GREEN.** The badge shelf renders on the
      profile, which the smoke slice walks (invite → profile → upload → see dog) — adding
      a derived shelf must not break that flow. If the smoke test asserts on profile
      content, update it in lockstep; otherwise it must remain 4/4.
- [ ] Gates green: `pnpm check` 0, `pnpm lint` clean, `pnpm test` green (the new
      `badges.test.ts` cases included), **`@smoke` 4/4**, `@security` green. **No
      migration.**

**Notes (for the implementer):**

- **This is the textbook pure-render-time seam for this codebase.** Read
  `voting/ranking.ts`, `mustard/decay.ts`, `reports/alarm.ts`, and `reports/verdict.ts`
  first — copy their shape exactly: a self-contained, import-free `.ts` module with a
  doc-comment explaining the derivation, co-located TDD tests, and the live wiring done
  by the route load (the module never does I/O). The reliquary component mirrors
  `TopDogBadge.svelte` / `ProfilePoliceBanner.svelte` (presentational, logic-free).
- **Reuse, don't re-derive, where a helper exists.** HERETIC → `isHamburgerHeretic` +
  `getDogVerdictsForOwner`; FALSE WITNESS → `getLiarBrandTimestamps` (+ optionally
  `summarizeLiarBrand` if keying on _currently_ branded). Only the new
  count/max/threshold logic is genuinely new.
- **Coordinate with TASK-085's stat ledger** — several badge inputs (franks-offered
  count, max peak_votes, redeemed-invite count, anointings-received count, crowned-day
  count) are the **same aggregates** the TASK-085 stat ledger needs. If both land,
  assemble the inputs once and feed both the ledger and the badges to avoid duplicate
  queries. Neither task hard-blocks the other; whichever lands second reuses the first's
  query helpers.
- **Design-gated like the rest of M8** — `blocked` pending the Reliquary mock. The pure
  module + tests are design-independent (the thresholds + derivation are real-data
  facts, not visual), but the shelf component's earned/locked/tier visual treatment
  needs the mock; treat the module as buildable-first and the component as design-led, as
  the milestone does elsewhere.
- **No new dependency; no schema; no migration; no new architecture-decision row** —
  recorded as a derived/no-schema **design/scope note** (composes decisions
  #12/#13/#15/#27).

---

## Completed Tasks (this milestone)

### TASK-087: Base cult visual / theme layer [`complete`] [`P2`] [`L`]

**Owner:** implementer — PR #99 (squash `dcce8c3`), merged 2026-06-19. Reviewer
APPROVE after 1 fix cycle (WCAG 2.4.7 focus-ring regression on the wall textarea).

**Problem:** the app was deliberately near-unstyled — `src/app.css` was ~80 neutral
lines from the TASK-072 polish pass. The rebrand needed a real cult/temple aesthetic.

**Acceptance Criteria:**

- [x] A **base theme layer** implementing the cult aesthetic from the designs:
      **palette** (CSS custom properties / design tokens), **type scale**,
      **spacing**, and base element styling, wired through the root layout. Delivered
      as `src/lib/styles/tokens.css` (imported by `src/app.css`).
- [x] **Flair-component styling** for the signature surfaces: `TopDogBadge`,
      the police-tape banners (`HamburgerAlarmBanner`, `ProfilePoliceBanner`,
      `ConfirmedHamburgerStamp`), the mustard/Anoint overlay **base**, reaction
      controls, vote controls.
- [x] **Responsive** layout system (successor to `.page-container` / `.app-nav`).
- [x] **Accessibility:** WCAG AA contrast (verified by hand at review); visible focus
      states (the wall-textarea focus-ring regression was caught + fixed in review);
      state not conveyed by color alone.
- [x] **No behavior change** — styling only; no load/action/RLS/RPC change; no
      `{@html}`; components stay presentational.
- [x] Gates green: `pnpm check` 0, `pnpm lint` clean, `pnpm test` 783, `@smoke` 4/4,
      `@security` 94/94. No migration. No new dependency (fonts self-hosted, SIL OFL).

**Notes:**

TASK-087 lays the **foundation/theme layer for all of M8** — the dark-temple cult
aesthetic as a tokenized CSS layer, with no behavior, schema, dependency, or
architecture-decision change. PR #99, squash `dcce8c3`, merged 2026-06-19.

- **The token vocabulary is the durable seam every downstream M8 task consumes.**
  A new `src/lib/styles/tokens.css` holds the canonical CSS custom properties
  (imported by `src/app.css`); downstream styling MUST reference `var(--…)`
  tokens, **never literal hex**. The vocabulary:
  - **Surfaces:** `--color-bg`, `--color-bg-deep` / `-mid` / `-lift`,
    `--color-bg-chrome`, `--surface-temple` (the radial gold-glow paint).
  - **Text ramp:** `--color-text`, `--color-heading`, `--color-text-muted` /
    `-faint` / `-fainter`.
  - **Accent (themeable):** `--accent`, `--accent-dim`, `--glow`, with per-theme
    `--accent-gold` / `-crimson` / `-verdigris`; **switch the active accent via
    `data-accent="crimson" | "verdigris"`** on a root element (default = Mustard
    Gold). Derived gold tints: `--accent-strong` / `-soft` / `-border` /
    `-plaque-border` / `-divider` / `-fill` / `-fill-strong`.
  - **Status:** `--color-error`, `--color-on-accent`, `--color-selection`;
    police-tape literals `--tape-alarm` / `-confirmed` / `-stripe-dark`,
    `--mustard-splat`.
  - **Type:** `--font-display` (Cinzel), `--font-body` (Cormorant Garamond);
    scale `--text-eyebrow` / `-label` / `-sm` / `-base` / `-lg` / `-xl` / `-h2` /
    `-h1`; tracking `--tracking-tight` / `-label` / `-eyebrow` / `-wide`.
  - **Layout/motion:** spacing `--space-2xs`…`-3xl`; radii `--radius-control` /
    `-card` / `-pill`; shadows/glow `--shadow-button` / `-button-glow` / `-card` /
    `-plaque`, `--text-shadow-hero`, `--ring-focus`, `--ring-focus-offset`;
    measures `--measure-form` / `-content` / `-wide`; motion `--motion-fast` /
    `-base` / `-entrance` / `-glow-pulse`, easings `--ease-standard` / `-out` /
    `-in-out`.
- **`src/app.css` rewritten** to import the tokens, declare self-hosted
  `@font-face`, paint the dark-temple base, provide responsive
  `.page-container` / `.app-nav` successors, port the design `@keyframes`
  (`glowPulse` / `fadeUp` / `stamp` / `unroll`) as tokenized utilities, and
  honor `prefers-reduced-motion`.
- **Self-hosted fonts — no new dependency.** Cinzel + Cormorant Garamond ship as
  `.woff2` assets under `static/fonts/` (SIL OFL), with the bundled
  `OFL-Cinzel.txt` / `OFL-CormorantGaramond.txt` license files. No CDN, no npm
  package (resolves OQ-4). The implementer's sandbox blocked the font download,
  so **the director fetched the `.woff2` files** out-of-band and the implementer
  wired the `@font-face` self-host.
- **Themed flair components (styles only):** `TopDogBadge`,
  `HamburgerAlarmBanner`, `ProfilePoliceBanner`, `ConfirmedHamburgerStamp`,
  `ReactionBar`, `BurgerReportControl`, `TopDogPrivilegesNotice`; plus themed
  feed vote controls and profile surfaces (sigil ring, stat-ledger scaffold,
  wall, mustard-overlay base). Components stay presentational — no load / action
  / RLS / RPC change.
- **1 fix cycle (WCAG 2.4.7 focus-visible).** Reviewer REQUEST_CHANGES → APPROVE.
  The blocking finding: the wall-post `textarea:focus` rule used `outline: none`
  plus a ~3% bg tint, which (via specificity) suppressed the global 2px gold
  `--ring-focus` for keyboard users too. Fixed by dropping `outline: none` so the
  global `--ring-focus` renders on `:focus-visible`. A minor finding (narrow the
  sub-AA `--color-text-fainter` token comment to "placeholders only") was also
  fixed.
- **Gates:** `pnpm check` 0 · `pnpm lint` clean · `pnpm test` 783/783 · `@smoke`
  4/4 · `@security` 94/94 on a fresh `supabase db reset`. **No migration, no new
  dependency, no new architecture-decision row** (the decision table stays at
  #28 — this is a visual/skin layer).
- **Forward note for downstream M8 tasks:** consume `var(--…)` tokens from
  `src/lib/styles/tokens.css` (no literal hex); switch accent via `data-accent`;
  reuse the themed flair components rather than re-styling them. Per-content
  contrast caveat logged as **DW-028** (see [[tasks/discovered]]).

**Discovered during this task:** DW-028 (faint-text tokens must stay AA on real
content — see [[tasks/discovered]]).

---

### TASK-080: Global app shell + persistent navigation [`complete`] [`P1`] [`M`] (`design-light`)

**Owner:** implementer — PR #101 (squash `544b7be`), merged 2026-06-19. Reviewer
REQUEST_CHANGES → APPROVE after 1 fix cycle (a working crown-gated feature,
`TopDogPrivilegesNotice`, was orphaned by the hub retirement).

**Problem:** navigation lived only on the bare `/app` hub, so every sub-page was a
dead end. The shell + The-Procession-as-home decision supersede the hub.

**Acceptance Criteria:**

- [x] New `(protected)/app/+layout.svelte` renders a persistent header/nav across
      all `/app` routes; reads `{ user, profile }` from the existing
      `+layout.server.ts` (no second crown query).
- [x] 🌭 is a real home button → The Procession (`/app/feed`) via `resolve(...)`.
- [x] Nav to feed / Your Litter (`/app/dogs`) / Epistles (`/app/messages`) / The
      Catechism (`/app/help`) + a visible ＋ Upload affordance → `/app/dogs`.
      (Labels are confirmed cult-name placeholders pending TASK-081.)
- [x] 🍔/☩ Tribunal link stays gated on server-derived `is_current_top_dog`
      (decision #25), both desktop + mobile nav — not widened.
- [x] Old inline `<nav class="app-nav">` removed (no double nav); dead `.app-nav`
      CSS deleted in the fix cycle.
- [x] `/` redirect repointed `'/app'` → `'/app/feed'`; auth guard untouched.
- [x] Bare `/app` hub retired → `redirect(307, '/app/feed')`.
- [x] Svelte 5 runes, `resolve(...)` links, no `{@html}`; accessible nav
      (semantic `<nav>`, `aria-current`, keyboard focus, mobile `aria-expanded`);
      responsive collapse.
- [x] Gates green: `pnpm check` 0, `pnpm lint` clean, `pnpm test` 775, `@smoke`
      4/4. No migration. (`@security` not re-run — orthogonal to UI/routing.)

**Decision (user-approved):** the `TopDogPrivilegesNotice` (TASK-074) was
**intentionally retired in M8** — Top Dog powers are documented in the Catechism
(`/app/help`) and the crown-gated Tribunal nav link covers adjudication. Component

- helper + tests deleted (783 → 775).

**Notes:**

TASK-080 closes the dead-end-navigation gap: app navigation now lives in a
**persistent global shell**, and the bare `/app` "kennel" hub is retired. PR #101,
squash `544b7be`, merged 2026-06-19. **1 fix cycle** (reviewer REQUEST_CHANGES →
APPROVE).

- **Persistent app shell.** A new `(protected)/app/+layout.svelte` renders a
  persistent header/nav across **every** `/app` route, reading `{ user, profile }`
  from the existing `(protected)/app/+layout.server.ts` — **no second crown query**.
  The 🌭 brand mark is a real home button → **The Procession** (`/app/feed`) via
  `resolve(...)`; nav links cover feed / **Your Litter** (`/app/dogs`) / **Epistles**
  (`/app/messages`) / **The Catechism** (`/app/help`), plus a visible ＋ Upload
  affordance → `/app/dogs`. (Labels are confirmed cult-name placeholders pending the
  TASK-081 copy pass.) The 🍔/☩ **Tribunal** link stays gated on the server-derived
  `is_current_top_dog` crown flag (decision #25) in both desktop and mobile nav — the
  privilege gate is **not** widened. Svelte 5 runes, `resolve(...)` links, no
  `{@html}`, accessible nav (semantic `<nav>`, `aria-current`, keyboard focus, mobile
  `aria-expanded`, responsive collapse). The auth guard in `+layout.server.ts` is
  untouched — the unauthenticated → `/sign-in` and profile-less → `/app/onboarding`
  cascade is preserved.
- **Default-route repoint.** The `/` redirect in `src/routes/+page.server.ts` was
  repointed `redirect(307, '/app')` → `'/app/feed'`, realizing the CONFIRMED
  "Default landing route = The Procession" decision (no infra / code-identifier
  change — route only).
- **Hub retirement.** The bare `/app` "kennel" hub is retired: its `+page.server.ts`
  now `redirect(307, '/app/feed')`, and the hub `+page.svelte` is reduced to an SSR
  fallback (its inline `<nav class="app-nav">` removed — the new shell supersedes it,
  so there is no double nav). The dead `.app-nav` CSS was deleted in the fix cycle.
- **`TopDogPrivilegesNotice` retirement (user-approved).** The reviewer's one
  blocking finding was that retiring the hub orphaned `TopDogPrivilegesNotice`
  (TASK-074) — a working crown-gated feature that had rendered only on the old `/app`
  home. **User ruling: intentionally RETIRE it.** Top Dog powers are now documented in
  **The Catechism** (`/app/help`), and the crown-gated **Tribunal** nav link in the new
  shell covers the adjudication call-to-action — so the standalone nudge is redundant.
  The fix cycle deleted the `TopDogPrivilegesNotice.svelte` component, the
  `topDogPrivilegesNotice.ts` helper (`DISMISSED_KEY` / `isNoticeDismissed` /
  `persistNoticeDismissed`), and its 8 dismissal-helper unit tests — accounting for the
  test-count drop **783 → 775** (−8 = exactly the retired helper's cases).
- **Gates (director-run):** `pnpm check` 0 · `pnpm lint` clean · `pnpm test` 775 ·
  `@smoke` 4/4. `@security` was **not re-run** — TASK-080 is a UI/routing change
  orthogonal to the live-DB write guards. **No migration, no new dependency, no new
  architecture-decision row** (the decision table stays at #28).
- **Forward note:** the M7 `TopDogPrivilegesNotice` wiring-audit statement in
  [[PROJECT]] is historically true for M7 but no longer matches the tree — the
  component was retired here. A forward-note was added at the M7 wiring-audit line so
  the audit statement isn't left silently contradicting the current code.

---

## Open Questions (REQUIRED — resolve WITH the designs before/at activation)

These are the undecided items the build must not guess. Resolve each **with the
user, alongside the designs**, then update the affected task(s) and flip them
`blocked → pending`.

> **Resolution status (2026-06-19 update):** **OQ-1, the avatar mechanism, OQ-3,
> OQ-4, and the reset flow** were RESOLVED 2026-06-18 (see the RESOLVED rows + notes
> below). **OQ-2 and OQ-5 are now FULLY RESOLVED (2026-06-19):**
>
> - **OQ-5 (dog-detail page name) → "The Relic"** (`/app/dogs/[id]`). With this the
>   Page Naming Map is **complete** — every user-facing page name is confirmed; OQ-5
>   is **fully resolved**.
> - **OQ-2 — all five sub-decisions RESOLVED:** **OQ-2a** keep Anoint gated to the
>   reigning champion ("The Anointed Wiener" / `is_current_top_dog`, decision #25
>   `WITH CHECK` unchanged); **OQ-2b** no re-mechanic / no merge with reactions — it
>   stays the existing mustard spray, re-copied as "anointing" (reactions untouched);
>   **OQ-2c** **splat** visual (reuse the splat animation in
>   `design/pages/The Shrine.dc.html`); **OQ-2d** overlay decays over **6h** (was 24h)
>   — a render-time constant change to `MUSTARD_LIFESPAN_MS`, no migration; **OQ-2e**
>   the anoint → wall-notice is a message on the anointed member's wall with a **24h
>   ROLLING STACK** (an anoint within 24h of the previous one increments the existing
>   message's ×N count and RESETS the window; a >24h gap starts a fresh message), and
>   the wall notice **PERSISTS** (only the overlay decays).
>
> **‼️ One M8 posture change (2026-06-19):** OQ-2e's **persisting** wall notice is
> render-derived from `mustard_sprays` rows, so those rows must SURVIVE — which means
> the daily `prune_mustard_sprays()` job must be **retired** (TASK-086, **Option A**,
> user-approved). **TASK-086 therefore WILL carry one migration** (retire/neuter
> `prune_mustard_sprays`) + a keep-alive workflow edit (drop the prune step) + a
> **likely new architecture-decision row #29** (mustard_sprays retention). So **M8 is
> no longer strictly "no migration"** — TASK-086 adds one (to be batched onto the
> standing hosted-push gate with the M7 burger migrations). The decay-constant change
> itself (OQ-2d, 6h) needs **no** migration. Everything else stays skin-only — no
> infra / code-identifier rename. (Decision #29 is recorded here as a **plan**; it
> becomes a real [[PROJECT]] decision-table row only when TASK-086 is implemented — the
> table stays at #28 until then.) Several in-app page designs are still to be generated
> from `design/page-design-prompts.md`.

| ID        | Question                                                                                                                                                                                                                                                                                                                                                                                                 | Affects                                             | Recommended default                                                                                                                             | Status                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **OQ-1**  | **Ritual sign-up scope:** cosmetic re-theme of the existing steps (Option A) vs. a multi-step "rite" (Option B) vs. a rite that **absorbs** the `/app/onboarding` `@handle`+avatar step into sign-up?                                                                                                                                                                                                    | TASK-084 (size + funnel-guard risk)                 | **A** (cosmetic re-theme) unless designs clearly call for a guided rite; **B-with-absorb** only if the designs show a single flowing initiation | **RESOLVED** (B-absorb)                    |
| **OQ-2a** | **Who may "Anoint"?** Keep Top-Dog/"Anointed Wiener"-gated, or democratize to everyone?                                                                                                                                                                                                                                                                                                                  | TASK-086 (decision #25 authorization)               | **Keep gated** (preserves the non-client-writable-crown `WITH CHECK`; low-risk)                                                                 | **RESOLVED** (keep gated)                  |
| **OQ-2b** | **Anoint vs reactions:** does Anoint **replace** reactions, **re-theme the mustard spray**, or **merge** them?                                                                                                                                                                                                                                                                                           | TASK-086 (+ reactions surface)                      | **Re-theme the mustard spray** (smallest change; reactions untouched)                                                                           | **RESOLVED** (re-theme the spray)          |
| **OQ-2c** | **Anoint visual:** **splat** vs **drip**?                                                                                                                                                                                                                                                                                                                                                                | TASK-086, TASK-087                                  | Per designs (no architectural impact either way)                                                                                                | **RESOLVED** (splat)                       |
| **OQ-2d** | **Anoint decay:** still **decays ~24h**, or **permanent**?                                                                                                                                                                                                                                                                                                                                               | TASK-086 (decision #15 + prune job)                 | **Decays ~24h** (keeps render-time decay; no DB/cron change)                                                                                    | **RESOLVED** (decays, but **6h** not 24h)  |
| **OQ-2e** | **Anoint → wall notice** (derived, coalesced; approach already chosen — render-time from `mustard_sprays`, NO schema/write-path). Two specifics open: **(i)** the **coalescing window** (what counts as "quick succession"); **(ii)** **persist vs. fade** of the wall notice.                                                                                                                           | TASK-086 (wall render — derived, read-only)         | **(i)** rolling "×N within ~an hour" (or a 24h bucket); **(ii)** **persists** as a lasting record (overlay still decays per OQ-2d). No DB/cron. | **RESOLVED** (24h rolling stack; persists) |
| **OQ-3**  | **Overall visual theme** — palette, type scale, ceremonial font, density, the cult "vibe."                                                                                                                                                                                                                                                                                                               | TASK-087 (and every page's look)                    | **Pending the designs** — this is the core thing the designs deliver                                                                            | **RESOLVED** (dark temple)                 |
| **OQ-4**  | **Custom display/ceremonial font?** If yes, self-hosted `.woff2` vs. a font package (dependency gate).                                                                                                                                                                                                                                                                                                   | TASK-087 (§ Possible Dependencies)                  | Self-hosted single `.woff2` or a system-font stack → **no new dependency**; only propose a package if designs require it                        | **RESOLVED** (self-hosted woff2)           |
| **OQ-5**  | **Cult display names for the TBD pages.** **FULLY RESOLVED:** `/app/profile/[handle]` → **The Shrine**, `/app/messages` → **Epistles**, `/app/messages/[handle]` → **Whispers**, `/sign-in` heading → **Enter the Snacktum**, **`/app/dogs/[id]` (dog detail) → "The Relic"** (resolved 2026-06-19). `/app` home → **N/A** (retired → redirects to The Procession). The Page Naming Map is now complete. | TASK-081 (applies the strings); the Page Naming Map | **Non-binding** director suggestions, user decides (see below)                                                                                  | **RESOLVED** (all page names confirmed)    |

### RESOLVED decisions (2026-06-18) — bake these into the affected tasks at build time

- **OQ-1 — RESOLVED → a multi-step rite that ABSORBS onboarding** (Option B-with-absorb).
  The initiation is a single flowing ceremony: **Summoned** (invite token) →
  **Inscribe Thy Name** (Casing Name = `@handle` + email + password) → **Choose Thy
  Sigil** (avatar) → **Renounce the Patty** (a pure-UX oath — **no data persisted**) →
  **Received.** The rite **subsumes the `/app/onboarding` `@handle`+avatar step** into
  sign-up. **TASK-084 consequences:** this is the higher-risk Option B — the
  profile-funnel guard in `(protected)/app/+layout.server.ts` must be updated
  coherently (a user who completed the rite has a profile and is NOT funneled; one who
  didn't still is) **with no redirect loop**, and the **`@smoke` slice (invite →
  profile → upload → see dog) must be updated in lockstep** if the rite changes the
  path it walks. The invite-redemption mechanics (decisions #17/#22/#23) and handle
  validation (`^[A-Za-z0-9_]{2,32}$`, `citext` uniqueness, `HANDLE_TAKEN` on `23505`)
  stay **unchanged**. No migration expected.
- **Avatar (within the rite) — RESOLVED → pick from 5 built-in SVG "sigils".** Cowled,
  Haloed, Shadowed, Tube, Candle (designed at `design/avatars/Sigil*.dc.html`). Stored
  as a small **sigil id** and rendered as **inline SVG**. **Mechanism: repurpose the
  existing `avatar_path` column to hold the sigil id** — **NO migration, NO storage
  upload.** This keeps the avatar step a pure skin change (no DB/storage/Storage-API
  touch). **User-uploaded avatars are DEFERRED** to a later pass — TASK-084's "Choose
  Thy Sigil" step offers only the 5 built-ins. (Note: this **removes** the avatar
  upload path from the onboarding/ritual surface for now, which also retires the
  TASK-070 2 MiB avatar-upload concern at this surface — keep the bucket cap in place;
  it simply isn't exercised by the rite anymore.)
- **OQ-3 — RESOLVED → the "dark temple" aesthetic.** Background `#17120e` painted with
  a radial gold glow, parchment text `#f3e9d2`, accent **Mustard Gold `#E0A82E`**
  (themeable alternates **Relic Crimson `#cf4636`** / **Verdigris `#57b59a`**). The
  full Design System (palette, type scale, motifs, voice) is the source of truth in
  `design/page-design-prompts.md` — **TASK-087** implements it in CSS.
- **OQ-4 — RESOLVED → Cinzel + Cormorant Garamond, self-hosted woff2.** **Cinzel**
  (display serif, ALL-CAPS letter-spaced) for headings/labels/buttons; **Cormorant
  Garamond** (body serif) for prose. **Self-hosted `.woff2` files** (SIL OFL licensed)
  — an **asset, NOT a package**, so the dependency gate is **NOT** triggered and **no
  new dependency** is added (resolves the § Possible Dependencies candidate to "no
  dependency"). TASK-087 wires the `@font-face` self-host through the root layout.
- **Reset flow (TASK-083) — RESOLVED → a 6-digit OTP code recovery** (request →
  emailed code → verify → set new password), **NOT** a magic link. The recovery email
  template shows the **code**; locally the email lands in **Mailpit**
  (`http://localhost:54324`). **TASK-083 consequence:** build a code-entry step (not a
  link click). Confirm the current `@supabase/ssr` OTP recovery handshake against the
  Supabase docs before building (the task's existing "one doc check" requirement still
  applies — verify the OTP-code path, not the magic-link path).

### Design-ready tasks (2026-06-18) — designs in hand; awaiting the user's build go-ahead

**These tasks now have designs** and the resolved decisions above, so they are ready
to build **the moment the user activates the milestone** — but they **remain
`blocked`** (the director flips `blocked → pending` on the user's explicit "go", not
the documenter, and not on the documenter's initiative):

- **TASK-080 (global app shell + persistent nav)** — designed: `design/pages/App
Chrome.dc.html`.
- **TASK-082 (build `/sign-in`)** — designed: `design/pages/Log In.dc.html`.
- **TASK-083 (forgot/reset password)** — designed: `design/pages/Reset Password.dc.html`
  (+ the RESOLVED 6-digit OTP flow above).
- **TASK-084 (ritual sign-up)** — designed: `design/pages/Snacktum Onboarding.dc.html`
  (+ the RESOLVED OQ-1 B-absorb rite + the 5-sigil avatar above).
- **TASK-087 (base cult theme)** — the Design System in `design/page-design-prompts.md`
  (+ the RESOLVED OQ-3 dark-temple palette + OQ-4 self-hosted Cinzel/Cormorant fonts).

**Still NOT design-ready** (need the remaining in-app designs and/or the OPEN OQs):
TASK-081 (copy — OQ-5 now mostly resolved; only the dog-detail page name is still
open), TASK-085 (profile redesign — needs the profile/The Shrine mockup), TASK-086
(Anoint — blocked on OQ-2's sub-decisions OQ-2a–e, including the new derived
anoint → wall-notice sub-decision OQ-2e), TASK-088 (error/404 — has a prompt, "The
Lost Pilgrim", but no mockup yet), TASK-089 (the derived badge reliquary — has a
prompt, "The Reliquary" #12, but no mockup yet; the pure module + tests are
design-independent and buildable first). Per § Next Steps in the handoff, build order
on the user's "go" is theme → shell → sign-in → reset → ritual.

**OQ-5 — FULLY RESOLVED (page names all confirmed):**

CONFIRMED (2026-06-18, from the user's mockup filenames — bake these into TASK-081):

- **`/app/profile/[handle]`** (profile) → **The Shrine**
- **`/app/messages`** (DM inbox) → **Epistles**
- **`/app/messages/[handle]`** (DM thread) → **Whispers**
- **`/sign-in`** heading → **Enter the Snacktum** (from the Log In design)
- **`/app` home/hub** → **N/A** — retired/absorbed (redirects to The Procession; see
  § Default landing route + TASK-080), so no display name is needed.

RESOLVED 2026-06-19 (the last remaining OQ-5 item — user's choice):

- **`/app/dogs/[id]`** (dog detail) → **The Relic**.

With "The Relic" decided, **every user-facing page name is confirmed and OQ-5 is
fully resolved.** TASK-081 applies "The Relic" verbatim to the `/app/dogs/[id]`
`<title>` / heading / nav label (URL path + code identifiers UNCHANGED — skin, not
skeleton). The Page Naming Map above is updated to carry it.

**OQ-2 — FULLY RESOLVED (2026-06-19) — bake into TASK-086:**

- **OQ-2a → keep gated.** Only the reigning champion ("The Anointed Wiener" /
  `is_current_top_dog`) may Anoint — the decision #25 `WITH CHECK` authorization on
  the non-client-writable crown column is **unchanged**.
- **OQ-2b → no re-mechanic, no merge with reactions.** Anoint stays the **existing
  mustard spray**, re-copied as "anointing." The emoji reactions surface is
  **untouched** (no replace, no merge).
- **OQ-2c → splat visual.** Reuse the splat animation in
  `design/pages/The Shrine.dc.html` (replacing the old "drip" framing).
- **OQ-2d → decays, but over 6h (not 24h).** The overlay still fades at render via
  `mustardOpacity` (decision #15), but the lifespan shortens from ~24h → **~6h** — a
  render-time constant change to `MUSTARD_LIFESPAN_MS` in
  `src/lib/features/mustard/decay.ts` (+ its co-located tests). The Catechism
  (`/app/help`) "~24h" mustard copy must update to **~6h** when TASK-081/086 run.
  **No migration for the decay change itself** (the DB still stores only the raw
  `sprayed_at`; the decayed splat is computed at render).
- **OQ-2e → wall message with a 24h ROLLING STACK; persists.** The anoint → wall
  notice is a message on the **anointed member's wall** attributing it to The Anointed
  Wiener. Coalescing is a **rolling 24h window that RESETS at each anointing**: an
  anoint within 24h of the previous one **increments the existing message's ×N count
  and resets the 24h window**; a **>24h** gap ends that burst and starts a **fresh**
  message. The wall notice **PERSISTS** as a lasting record — **only the visual
  overlay decays** (~6h, per OQ-2d).

> **‼️ IMPLEMENTATION DIRECTION (TASK-086) = Option A (user-approved 2026-06-19).**
> Because the wall notice PERSISTS and is render-derived from `mustard_sprays` rows,
> those rows must SURVIVE — so the daily **`prune_mustard_sprays()` job is retired**.
> Consequences for TASK-086 (re-scoped below): it **WILL carry one migration**
> (retire/neuter `prune_mustard_sprays`) **+** a keep-alive workflow edit (drop the
> prune step) **+** a **likely new architecture-decision row #29** (mustard_sprays
> retention: rows permanent; overlay decays at render ~6h; wall-notice render-derived,
> coalesced, permanent). This **changes M8's posture: it is no longer strictly "no
> migration."** Batch TASK-086's hosted push onto the standing M7 hosted-push gate.
> **Decision #29 is recorded here as a PLAN only** — it becomes a real [[PROJECT]]
> decision-table row when TASK-086 is implemented; the table stays at #28 until then.

---

## Possible Dependencies (PROPOSED — none added; do not assume)

No new dependency is expected for this milestone — it is a copy/markup/CSS pass on
the existing SvelteKit + Supabase stack. The **only** candidate, contingent on the
designs:

- **A custom display/ceremonial web font** (OQ-4). If the designs require one, the
  **lowest-cost option is self-hosting a single `.woff2`** (an asset, **not** a
  package — no dependency gate triggered) or using a **system-font stack** (zero
  cost). A **font npm package** (e.g. a Fontsource family) would be a real dev/runtime
  dependency and **must go through the dependency gate** ([[dependencies]]) with the
  alternatives-considered analysis (self-host the file vs. package vs. system stack)
  **before** anyone adds it. **Decision deferred to the designs; nothing is added
  now.**

Everything else (sign-in, password reset, ritual sign-up, profile redesign, error
page, theme) is buildable with **no new dependency**.

---

## Dependencies & Sequencing

**The whole milestone gates on `DESIGNS` (final page designs).** Nothing starts
until the user delivers them and activates the milestone. Once unblocked, a sensible
internal order (most design-independent first, most design-dependent last):

```
DESIGNS (the gate) ──▶ resolve Open Questions (OQ-1..OQ-5) ──▶ flip tasks blocked→pending
                                   │
   design-light (can lead) ───────┤
     TASK-080  app shell + nav     │   ← structure design-independent; labels/style wait
     TASK-082  /sign-in form+action│   ← logic+tests design-independent
     TASK-083  forgot/reset password│  ← logic design-independent (one doc check)
                                   │
   design-dependent (follow) ──────┤
     TASK-081  brand & lore copy    │   ← needs final voice; threads through the shell + pages
     TASK-087  base cult theme      │   ← IS the designs in CSS; styles everything above
     TASK-085  profile redesign     │   ← needs profile design; composes the most features
     TASK-084  ritual sign-up       │   ← size set by OQ-1; sits on the invite/auth critical path
     TASK-086  Anoint re-theme      │   ← gated by OQ-2; default = pure re-skin
     TASK-088  error / 404 page     │   ← small; needs copy + theme
     TASK-089  badge reliquary      │   ← derived/read-only; pure module buildable first, shelf needs the mock; soft-pairs with TASK-085 (same profile page)
```

- **Lead with the `design-light` trio** (TASK-080 shell, TASK-082 sign-in,
  TASK-083 password reset) — these can be built (or at least skeletoned) with the
  least dependence on the visual designs, and they close real functional gaps
  (dead-end nav, the non-functional sign-in stub, no password recovery).
- **TASK-081 (copy)** and **TASK-087 (theme)** are cross-cutting — they touch every
  page. Land the shell + page structure first so there is somewhere for copy and
  styles to live; sequence the copy pass and the theme pass to avoid two agents
  editing the same `+page.svelte` simultaneously (see the parallel-collision note).
- **TASK-085 (profile)**, **TASK-084 (ritual)**, **TASK-086 (Anoint)** are the most
  feature-entangled and design-dependent — do them once the theme + copy foundations
  are set.

**Parallel-dispatch collision warning ([[workflow]] § Parallelism):** TASK-081
(copy), TASK-085 (profile), TASK-086 (Anoint), TASK-087 (theme), and **TASK-089
(badge reliquary)** **all edit overlapping `+page.svelte` / component files**
(especially the profile page + its `+page.server.ts`, which TASK-081/085/086/089 all
touch — TASK-089 adds the reliquary shelf + its input queries to the same load
TASK-085 redesigns). These **cannot run in parallel on the same files** — sequence
them, or split a page's copy vs. layout vs. style vs. badge-shelf into separate prereq
edits. **TASK-089's pure module (`src/lib/features/badges/`) + its tests are a
separate file with no overlap** and can be built in parallel with anything; only its
profile-load wiring + shelf component collide with TASK-085. The director must build
the file-scope matrix before any parallel batch and fail-closed on every overlap.

**Keep the M1 `@smoke` vertical slice GREEN throughout.** The slice (invite →
profile → upload → see dog) crosses sign-up/onboarding (TASK-084), the app shell
(TASK-080), and the profile page (TASK-085). **Any** auth/flow/nav/copy change that
the smoke test walks **must update the smoke test in lockstep** — a redesign that
silently breaks the smoke flow is a milestone regression. TASK-082 additionally
**adds** a new `@smoke` sign-in path.

---

## Standing ops note (context only — NOT a task in this milestone)

Unrelated to M8 but recorded for anyone who touches **hosted** during this work:
the **two M7 migrations still await a hosted `supabase db push`** —
`20260617205453_burger_alarms.sql` (TASK-071) and `20260618120000_burger_verdicts.sql`
(TASK-073). No auto-pause risk (no scheduled job touches those tables; the daily
keep-alive `ping` still reads `profiles`), but the report→verdict flow is
non-functional on hosted until they're pushed (user's hand).

> **‼️ UPDATE (2026-06-19) — M8 now DOES add a migration.** OQ-2's Option A
> (user-approved) means **TASK-086 retires `prune_mustard_sprays()`**, so it carries
> **one migration** (prune retirement) **+** a keep-alive workflow edit dropping the
> daily prune step. **Batch TASK-086's hosted push with the two M7 migrations above**
> (one `supabase db push`), and drop the prune step from
> `.github/workflows/keepalive.yml` **in lockstep** so the workflow doesn't keep
> calling a retired/neutered RPC (which would 404 → the hosted-schema-drift failure
> mode in [[CLAUDE]]). Follow the per-milestone hosted-push discipline ([[PROJECT]]
> Process notes). No other M8 task adds a migration.

---

> **No caps.** Acceptance criteria, subtasks, and integration points are
> unbounded. Give each task as much specificity as it needs to be completed to
> spec — never trim detail to hit a count. These tasks are **`blocked` pending
> final page designs**; do not dispatch until the user activates after delivering
> them.
