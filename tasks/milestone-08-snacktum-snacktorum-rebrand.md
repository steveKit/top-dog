# Milestone M8: Snacktum Snacktorum — Rebrand & Redesign

> **Status:** `active` — **⛔ EXECUTION BLOCKED PENDING FINAL PAGE DESIGNS**
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
  - TS symbols & components: `selectTopDog`, `TopDogBadge`, `TopDogPrivilegesNotice`,
    `mustardOpacity`, `summarizeBurgerAlarm`, etc.
- **Architecture & security posture:** preserve **every** locked decision #1–#28
  and the **L2** security profile. No new architecture-decision row is expected
  (this is a skin/UX pass); if one genuinely surfaces, record it per the normal gate.

**MAY change (in scope):** user-visible **strings / copy / lore / titles /
microcopy**, **Svelte component markup & styling**, **CSS / theme**, **new
user-facing routes & flows** (sign-in form, password reset, ritual sign-up,
error/404, app-shell nav), and **rendered labels** that today read "Top Dog".

> **Champion-title swap is COPY ONLY.** "Top Dog" the _displayed title_ becomes
> **"The Anointed Wiener"** wherever a user reads it — badge label, "Days as Top
> Dog" stat, the Top-Dog-privileges notice, the Court's "Top Dog is the
> adjudicator" tape, feed/leaderboard, help page. The _code_ keeps
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
  The Hamburger Court / HAMBURGER LIAR / HAMBURGER HERETIC mechanics **already** fit
  the cult/heresy theme — lean into them (heresy, excommunication, the unclean
  hamburger) rather than reinventing.
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
**Page Naming Map** below for the full mapping + rationale, and **OQ-5** for the
six pages still TBD.

| Route                            | File(s)                                               | Cult name                                                  | Touched by                                        |
| -------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| `/sign-up`                       | `sign-up/+page.svelte` (+ `+page.server.ts`)          | **Take the Casing**                                        | copy, ritual sign-up, theme                       |
| `/sign-in`                       | `sign-in/+page.svelte` (**stub — no action**)         | _TBD (OQ-5)_                                               | **build the form/action**, copy, theme            |
| `/forgot-password`               | **does not exist**                                    | _(new — name w/ designs)_                                  | **new**                                           |
| `/reset-password`                | **does not exist**                                    | _(new — name w/ designs)_                                  | **new**                                           |
| `/app` (home / "kennel")         | `(protected)/app/+page.svelte`                        | _TBD (OQ-5)_ — **see note: retired/absorbed by the shell** | copy, app-shell, theme                            |
| `/app` shell                     | `(protected)/app/+layout.svelte` (**does not exist**) | _(chrome, not a page)_                                     | **new app-shell + nav**                           |
| `/app/onboarding`                | `(protected)/app/onboarding/+page.svelte`             | **Choose Your Frank Name**                                 | ritual sign-up (may absorb), copy, theme          |
| `/app/feed`                      | `(protected)/app/feed/+page.svelte`                   | **The Procession: Standings of the Blessed**               | copy (title swap), theme                          |
| `/app/dogs` (+ `/app/dogs/[id]`) | `(protected)/app/dogs/...`                            | **Your Litter** (`/app/dogs`); `[id]` _TBD (OQ-5)_         | copy, theme                                       |
| `/app/profile/[handle]`          | `(protected)/app/profile/[handle]/+page.svelte`       | _TBD (OQ-5)_                                               | **profile redesign**, display-name, Anoint, theme |
| `/app/messages` (+ `/[handle]`)  | `(protected)/app/messages/...`                        | _TBD (OQ-5)_                                               | copy, theme                                       |
| `/app/invite`                    | `(protected)/app/invite/+page.svelte`                 | **Summon a Frank**                                         | copy, theme                                       |
| `/app/court`                     | `(protected)/app/court/+page.svelte`                  | **The Tribunal of the Holy Tube**                          | copy (title swap), theme                          |
| `/app/help`                      | `(protected)/app/help/+page.svelte`                   | **The Catechism**                                          | copy (title swap + lore), theme                   |
| error / 404                      | `+error.svelte` (**does not exist**)                  | _(new — name w/ designs)_                                  | **new**                                           |

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

| Route (UNCHANGED) | Cult display name (CONFIRMED)                |
| ----------------- | -------------------------------------------- |
| `/sign-up`        | **Take the Casing**                          |
| `/app/onboarding` | **Choose Your Frank Name**                   |
| `/app/dogs`       | **Your Litter**                              |
| `/app/feed`       | **The Procession: Standings of the Blessed** |
| `/app/court`      | **The Tribunal of the Holy Tube**            |
| `/app/invite`     | **Summon a Frank**                           |
| `/app/help`       | **The Catechism**                            |

> Six further pages are **not yet themed** — `/app` home/hub, `/sign-in`,
> `/app/dogs/[id]`, `/app/profile/[handle]`, `/app/messages`, `/app/messages/[handle]`.
> Their names are tracked as **OQ-5** (with non-binding suggested options) and must
> be resolved with the user before TASK-081 finalizes their copy.

---

## Active Tasks

> All tasks are **`blocked`** on **`DESIGNS`** (final page designs). Sizes are
> pre-design estimates and may move once designs land. Do **not** dispatch until
> the user activates after delivering designs.

### TASK-080: Global app shell + persistent navigation [`blocked`] [`P1`] [`M`] (`design-light`)

**Owner:** unassigned
**Dependencies:** `DESIGNS` (nav layout / branding); pairs with the existing
`(protected)/app/+layout.server.ts` (which already surfaces `{ user, profile }`).
**Blocks:** TASK-081 (brand/lore copy lands partly in the shell), TASK-087 (theme
styles the shell). Soft-sequence: land the shell skeleton **before** the copy +
theme passes so they have a home.

**Problem:** today the app navigation lives **only** on the `/app` home page
(`(protected)/app/+page.svelte` — a single `<nav class="app-nav">`). Every
sub-page (`/app/feed`, `/app/dogs`, `/app/profile/[handle]`, `/app/messages`,
`/app/court`, `/app/help`, `/app/invite`) is a **dead end** — no way back home, no
cross-navigation, no upload affordance. Users must use the browser back button.

**Also folds in the CONFIRMED default-route decision** (see § Default landing
route): with the global shell holding the nav AND **The Procession (`/app/feed`)**
as the new home, the bare `/app` "kennel" hub's only remaining job (holding the
nav links) is superseded by the shell. So this task ALSO (a) **repoints the `/`
redirect `/app` → `/app/feed`** and (b) **retires/absorbs the `/app` hub**.

**Acceptance Criteria:**

- [ ] A new **`(protected)/app/+layout.svelte`** renders a **persistent
      header/nav across all `/app` routes** (it wraps every nested page). It reads
      `{ user, profile }` from the existing `+layout.server.ts` load (do not add a
      second crown query — reuse the surfaced `profile`).
- [ ] The **🌭 is a real home button** that lands on **The Procession** (the new
      home) — today the emoji is decorative. Target the home route via the project
      `resolve(...)` path-alias idiom; since `/app` redirects to `/app/feed` (below),
      linking either `/app` or `/app/feed` lands on The Procession — prefer pointing
      directly at `/app/feed` (`resolve('/(protected)/app/feed')`) to skip the
      redirect hop.
- [ ] Nav links to the core surfaces — **The feed**, **Your hot dogs** (gallery),
      **Messages**, **How it works** (help) — plus a **visible "＋ Upload"
      affordance** routing to the hot-dog upload (`/app/dogs`). Exact set/order/labels
      per the designs.
- [ ] The **🍔 Hamburger Court** link stays gated on the live, server-derived
      `is_current_top_dog` crown flag (decision #25) — present only for the crown
      holder, exactly as today. **Do not** widen who sees it.
- [ ] The **home page's own inline `<nav class="app-nav">` is removed** (or reduced
      to non-duplicated home content) once the shell nav exists — no double nav.
- [ ] **The `/` redirect repoints to The Procession** — change
      `src/routes/+page.server.ts` from `redirect(307, '/app')` to
      `redirect(307, '/app/feed')` (one-line). A signed-in member hitting `/` lands on
      **The Procession (`/app/feed`)**, the new home. The auth cascade still applies
      (the `(protected)/app` layout guard funnels unauth → `/sign-in`, profile-less →
      `/app/onboarding` before the feed renders) — **do not** touch that guard.
- [ ] **The bare `/app` "kennel" hub is retired/absorbed.** With the shell holding
      the nav and The Procession as home, `/app`'s sole job (holding nav links) is
      gone. **Recommended:** retire `/app` → **redirect to `/app/feed`** (replace the
      hub's `+page.svelte` body / add a `+page.server.ts` `redirect(307,'/app/feed')`)
      so the route still resolves but lands on the home feed. _(Repurposing `/app`
      as a designed landing surface is the alternative — small call; **flag to the
      director as a mini open question if the designs imply a distinct hub page**,
      otherwise default to the redirect.)_ Either way, the home-button target below
      stays coherent.
- [ ] **Labels follow the rebrand** (TASK-081 owns the final strings) — the title
      swap "Top Dog" → "The Anointed Wiener" applies to any crown-referencing nav
      label. Code identifiers unchanged (see scope box).
- [ ] Svelte 5 runes (`$props`), `resolve(...)` for links, no `{@html}`. The shell
      is presentational + navigation only — **no crown logic in the component** (gate
      stays driven by the server-derived `profile.is_current_top_dog`, mirroring
      TASK-074's "gate at the parent" pattern).
- [ ] Keyboard-accessible nav (semantic `<nav>`, real `<a>` links); responsive
      (collapses sensibly on narrow screens — works with the existing `app.css`
      `.app-nav` wrap or its redesigned successor from TASK-087).
- [ ] Gates green: `pnpm check` 0, `pnpm lint` clean, `pnpm test` green, **`@smoke`
      4/4** (the shell wraps the smoke-flow pages — must not break navigation),
      `@security` green. No migration.

**Notes (for the implementer):**

- **`design-light`:** the _structure_ (a layout with nav + home button + upload
  affordance) is design-independent; only the exact labels/branding/placement wait
  on designs. **The `/` redirect repoint and the `/app` hub retirement are fully
  design-independent** (a one-line redirect change + a route disposition) — they can
  ship with the skeleton. If the user unblocks this ahead of the full set, build the
  skeleton with placeholder copy and let TASK-081/087 finalize text + style.
- **Files this task touches beyond the new layout:** `src/routes/+page.server.ts`
  (the `/` redirect target → `/app/feed`) and `(protected)/app/+page.svelte` /
  `(protected)/app/+page.server.ts` (the hub's retirement/redirect). Still **no
  `load` change** to `(protected)/app/+layout.server.ts` beyond reusing what it
  already returns.
- **Route/user-facing only — no infra or code-identifier change.** Repointing a
  redirect and retiring a hub page changes neither the `(protected)/app` route group,
  the layout auth guard, nor any internal name. Stays inside the HARD SCOPE
  CONSTRAINT.
- No new dependency; no schema; no new architecture-decision row.

---

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
      `/sign-up` → **Take the Casing**, `/app/onboarding` → **Choose Your Frank
      Name**, `/app/dogs` → **Your Litter**, `/app/feed` → **The Procession:
      Standings of the Blessed**, `/app/court` → **The Tribunal of the Holy Tube**,
      `/app/invite` → **Summon a Frank**, `/app/help` → **The Catechism**.
      The **six TBD pages** (`/app` home, `/sign-in`, `/app/dogs/[id]`,
      `/app/profile/[handle]`, `/app/messages`, `/app/messages/[handle]`) await
      **OQ-5** — do **not** invent names for them; use the user-decided strings once
      OQ-5 resolves. URL paths and code identifiers stay UNCHANGED (skin, not
      skeleton).
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
  - the **Top-Dog-privileges notice** (`TopDogPrivilegesNotice.svelte` copy)
  - the Court's **"TOP DOG IS THE ADJUDICATOR"** police-tape label
    (`HamburgerAlarmBanner` / court copy)
  - the **feed/leaderboard** crown references
  - the **help page** crown/vote explanation
- [ ] **Cult/temple lore voice** applied to headings + microcopy across the pages,
      consistent with the designs. Lean into the **existing** heresy theme: the
      Hamburger Court, **HAMBURGER LIAR**, **HAMBURGER HERETIC** already fit
      (excommunication / the unclean hamburger / heresy) — re-theme their copy to
      match, but **keep the underlying mechanic labels recognizable** (a user who saw
      "HAMBURGER HERETIC" should still understand the consequence).
- [ ] **Help page (`/app/help`) accuracy preserved.** It describes live mechanics;
      the copy re-theme must **not** change any _described behavior_ — only the voice.
      Re-verify every mechanic-bearing line still matches source
      (`voting/ranking.ts`, `mustard/decay.ts`, `reports/verdict.ts`) exactly as
      TASK-075 did. The vote system stays accurately described (one movable vote, no
      self-vote, most votes → crown, sticky tie-break, the days tally).
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

### TASK-083: Forgot-password + reset-password flow [`blocked`] [`P1`] [`M`] (`design-light`)

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
  - the **HERETIC / LIAR** shame marks — already surfaced as the
    `ProfilePoliceBanner` brands (`isHeretic` / `liarBrand`); keep those, do not
    duplicate them as a "stat".
  - **‼️ Reports are ANONYMOUS — do NOT surface the reporter side on a public
    profile.** Never show "heresies you've called", a count of reports this member
    _made_, or any reporter-side tally. Reporter ids are deliberately never exposed
    (decision #27 / TASK-071 anonymity). Only the _consequences a member bears_
    (HERETIC, LIAR, anointings received) are public — the accusations they _make_
    are not. This is a hard constraint, not a preference.
  - Prefer adding these as small read-only count/sum queries to the existing
    `event.locals.supabase` (RLS-scoped) load. Where a render-time pure summary
    already exists for a value, **reuse it** (e.g. the HERETIC/LIAR brands via
    `verdict.ts`); do not recompute. If TASK-089 (the derived badge module) lands
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
  - the **🍔 LIAR / HERETIC profile banners** (`ProfilePoliceBanner`) — render-time
    LIAR decay + persistent HERETIC (decision #15, TASK-073)
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
- This page composes the **most** features (mustard/Anoint, wall+emoji, LIAR/HERETIC
  banners, badge, canSpray) — the redesign must preserve every one of those wirings.
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
**Dependencies:** `DESIGNS` + **the resolution of OQ-2 (all four sub-decisions)**;
TASK-085 (profile redesign hosts the overlay), TASK-081 (copy). Touches the
mustard surface: `(protected)/app/profile/[handle]/+page.svelte`, the spray action,
and the render-time `mustardOpacity` overlay — **NOT** the `mustard_sprays` table,
the `spray` write path's authorization, or `prune_mustard_sprays`, unless OQ-2
explicitly decides a behavior change.

**Scope (DEFERRED until OQ-2 is decided):** rename the Top-Dog mustard-spray action
to **"Anoint"** (the champion bestows a blessing — a "splat" of mustard) in
user-facing copy and re-theme the visual. **Four sub-decisions are OPEN — do NOT
guess; resolve with the designs (see OQ-2).** Recommended low-risk defaults noted,
but the call is the user's:

- **OQ-2a — who may Anoint:** keep it **Top-Dog / "Anointed Wiener"-gated**
  _(RECOMMENDED — low-risk, preserves the decision #25 `WITH CHECK` authorization on
  the non-client-writable crown column)_ vs. democratize to everyone _(higher risk —
  would remove the privilege gate; re-examine RLS)_.
- **OQ-2b — relationship to reactions:** does "Anoint" **replace** the emoji
  reactions, **re-theme the existing mustard spray** _(RECOMMENDED — smallest change,
  pure re-skin of the existing mechanic)_, or **merge** the two surfaces.
- **OQ-2c — visual:** **splat** vs **drip** mustard treatment (the current overlay
  is a drip; "splat" is the new framing) — per the designs.
- **OQ-2d — decay:** does an anointing still **decay (~24h)** _(RECOMMENDED — keep
  decision #15's render-time decay, no DB/cron change)_ or become **permanent**
  _(would change the decay model / prune job)_.

**Acceptance Criteria (scoped to the RECOMMENDED defaults — re-scope if OQ-2 chooses
otherwise):**

- [ ] User-facing **"Anoint" copy** replaces "spray mustard" wherever a user reads it
      (the profile action button, the Top-Dog-privileges notice guidance, any help
      text). Code identifiers (`mustard_sprays`, `mustardOpacity`, the `spray` action
      name, `prune_mustard_sprays`) **stay unchanged** (scope box).
- [ ] **Authorization preserved (if OQ-2a = keep-gated):** only the current crown
      holder may Anoint — the existing plain owner-scoped RLS write with the Top-Dog
      `WITH CHECK` conjunct on the non-client-writable `is_current_top_dog` column
      (decision #25) is **untouched**. The `canSpray` UI gate stays driven by the
      server-derived crown flag.
- [ ] **Render-time decay preserved (if OQ-2d = decay):** the overlay still fades via
      `mustardOpacity` (full → 0 over ~24h) from the stored `sprayed_at` timestamp
      (decision #15) — the DB still stores only the raw timestamp; the decayed
      "splat" is computed at render. **No persisted decayed output.**
- [ ] **Visual re-theme** (splat vs drip per OQ-2c) applied in the overlay component + theme styles (TASK-087 tokens).
- [ ] **If OQ-2 decides a behavior change** (democratize / permanent / merge-with-
      reactions): **STOP and escalate** — a write-path/authorization/decay change is a
      potential new architecture-decision row and a possible migration; it must be
      re-scoped and re-approved before implementation, not absorbed silently.
- [ ] **Tests:** `spray-action.test.ts` stays green (update for copy; if behavior
      changes, add/adjust coverage + a live-DB `@security` case for any new write
      authorization). `@smoke` / `@security` green.
- [ ] Gates green: `pnpm check` 0, `pnpm lint` clean, `pnpm test` green, `@smoke`
      4/4, `@security` green. **No migration** under the recommended defaults — flag
      immediately if a chosen option requires one.

**Notes (for the implementer):**

- **Default to the recommended low-risk options** (keep-gated, re-theme-the-spray,
  decay-as-is). Only the _visual_ (splat) and _copy_ (Anoint) change under those —
  a pure re-skin of an existing, well-tested mechanic with **no DB/RLS change**.
- **The riskier options touch security/architecture** — democratizing removes a
  privilege gate (decision #25 surface), permanence changes the decay model
  (decision #15) and the prune job. Treat any such choice as an escalation, not a
  silent in-task change.
- No new dependency; no new architecture-decision row under the recommended path.

---

### TASK-087: Base cult visual / theme layer [`blocked`] [`P2`] [`L`]

**Owner:** unassigned
**Dependencies:** `DESIGNS` (**the** design dependency — palette, type, spacing,
component styling all come from the designs); soft-pairs with **every** other M8
task (it styles their markup). Best landed **after** the shell + page structure
exist (TASK-080/082/083/085) so there is markup to style, but its **tokens** can be
defined early.

**Problem:** the app is deliberately near-unstyled today — `src/app.css` is ~80
neutral lines (box-sizing, base type, a centered `.page-container`, a wrapping
`.app-nav`, `img` max-width) from the TASK-072 polish pass. The rebrand needs a
real cult/temple aesthetic.

**Acceptance Criteria:**

- [ ] A **base theme layer** implementing the cult aesthetic from the designs:
      **palette** (CSS custom properties / design tokens), **type scale** (headings,
      body, the ceremonial/display face if the designs specify one), **spacing**, and
      base element styling. Built on/extending `src/app.css` (and/or a tokens module),
      wired through the root layout — the existing neutral baseline is the starting
      point, not a constraint to preserve.
- [ ] **Flair-component styling** for the user-facing signature surfaces (driven by
      the designs):
  - the champion **badge** (`TopDogBadge` — "The Anointed Wiener" treatment)
  - the **police-tape HAMBURGER banners** (`HamburgerAlarmBanner`,
    `ProfilePoliceBanner`, `ConfirmedHamburgerStamp`) — the heresy/excommunication
    visual, leaning into the cult theme
  - **mustard / Anoint** overlay (the splat/drip treatment from TASK-086)
  - **reactions** controls
  - **vote controls** (the feed cast/move/remove affordances)
- [ ] **Responsive** layout system (the redesigned successor to the current
      `.page-container` / `.app-nav` rules) — works across the page set on narrow and
      wide screens.
- [ ] **Accessibility:** color choices meet **WCAG AA contrast** for text; focus
      states are visible; the theme does not rely on color alone to convey state
      (e.g. an alarmed dog is not distinguished by color only). (A `/a11y-audit` pass
      is a sensible follow-up once the theme lands.)
- [ ] **No behavior change** — this is styling only. No load/action/RLS/RPC change;
      no `{@html}`; components stay presentational. Flair components keep their
      existing props/logic; only their styles change.
- [ ] Gates green: `pnpm check` 0, `pnpm lint` clean, `pnpm test` green (styling
      rarely breaks tests; update any snapshot/text assertion that changes), `@smoke`
      4/4, `@security` green. No migration.

**Notes (for the implementer):**

- **The most design-dependent task** — it essentially _is_ the designs in CSS. Do
  not invent the aesthetic; implement what the designs specify.
- **Possible dependency (PROPOSE, do not assume):** if the designs call for a custom
  **display/ceremonial font**, that may mean adding a web font. Per the dependency
  gate, **propose it** (self-hosted font file vs. a font package) with the
  alternatives-considered analysis — do **not** add it unprompted. A system-font
  stack or a single self-hosted `.woff2` (no package) is the lowest-cost default and
  likely needs **no** new dependency at all. (See § Possible Dependencies.)
- No schema; no new architecture-decision row anticipated (a visual layer introduces
  no invariant).

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
  - **False Witness / Liar** — has a `hamburger_liars` brand. _Source:_
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
      (a consequence they bear); "Liar" keys on the member's OWN `hamburger_liars` brand
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
  `getDogVerdictsForOwner`; LIAR → `getLiarBrandTimestamps` (+ optionally
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

## Open Questions (REQUIRED — resolve WITH the designs before/at activation)

These are the undecided items the build must not guess. Resolve each **with the
user, alongside the designs**, then update the affected task(s) and flip them
`blocked → pending`.

> **Resolution status (2026-06-18, [[Handoffs/handoff-016]]):** **OQ-1, the avatar
> mechanism, OQ-3, OQ-4, and the reset flow are RESOLVED** (see the RESOLVED rows +
> notes below). **OQ-2 (all four Anoint sub-decisions) and OQ-5 (the six TBD page
> names) remain OPEN**, as do the not-yet-generated in-app page designs (Procession,
> profile, Your Litter, dog detail, the Tribunal, messages inbox + thread, invite,
> the Catechism, the error/404 page — to be generated from
> `design/page-design-prompts.md`). The RESOLVED decisions are all user-facing /
> skin-only — **no migration, no infra/code-identifier rename, no new
> architecture-decision row** (the [[PROJECT]] decision table stays at #28).

| ID        | Question                                                                                                                                                                                                                                                                      | Affects                                             | Recommended default                                                                                                                             | Status                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **OQ-1**  | **Ritual sign-up scope:** cosmetic re-theme of the existing steps (Option A) vs. a multi-step "rite" (Option B) vs. a rite that **absorbs** the `/app/onboarding` `@handle`+avatar step into sign-up?                                                                         | TASK-084 (size + funnel-guard risk)                 | **A** (cosmetic re-theme) unless designs clearly call for a guided rite; **B-with-absorb** only if the designs show a single flowing initiation | **RESOLVED** (B-absorb)          |
| **OQ-2a** | **Who may "Anoint"?** Keep Top-Dog/"Anointed Wiener"-gated, or democratize to everyone?                                                                                                                                                                                       | TASK-086 (decision #25 authorization)               | **Keep gated** (preserves the non-client-writable-crown `WITH CHECK`; low-risk)                                                                 | OPEN                             |
| **OQ-2b** | **Anoint vs reactions:** does Anoint **replace** reactions, **re-theme the mustard spray**, or **merge** them?                                                                                                                                                                | TASK-086 (+ reactions surface)                      | **Re-theme the mustard spray** (smallest change; reactions untouched)                                                                           | OPEN                             |
| **OQ-2c** | **Anoint visual:** **splat** vs **drip**?                                                                                                                                                                                                                                     | TASK-086, TASK-087                                  | Per designs (no architectural impact either way)                                                                                                | OPEN                             |
| **OQ-2d** | **Anoint decay:** still **decays ~24h**, or **permanent**?                                                                                                                                                                                                                    | TASK-086 (decision #15 + prune job)                 | **Decays ~24h** (keeps render-time decay; no DB/cron change)                                                                                    | OPEN                             |
| **OQ-3**  | **Overall visual theme** — palette, type scale, ceremonial font, density, the cult "vibe."                                                                                                                                                                                    | TASK-087 (and every page's look)                    | **Pending the designs** — this is the core thing the designs deliver                                                                            | **RESOLVED** (dark temple)       |
| **OQ-4**  | **Custom display/ceremonial font?** If yes, self-hosted `.woff2` vs. a font package (dependency gate).                                                                                                                                                                        | TASK-087 (§ Possible Dependencies)                  | Self-hosted single `.woff2` or a system-font stack → **no new dependency**; only propose a package if designs require it                        | **RESOLVED** (self-hosted woff2) |
| **OQ-5**  | **Cult display names for the six still-TBD pages** — `/app` home, `/sign-in`, `/app/dogs/[id]` (dog detail), `/app/profile/[handle]` (profile), `/app/messages` (DM inbox), `/app/messages/[handle]` (DM thread). The other seven page names are CONFIRMED (Page Naming Map). | TASK-081 (applies the strings); the Page Naming Map | **Non-binding** director suggestions, user decides (see below)                                                                                  | OPEN                             |

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
TASK-081 (copy — blocked on OQ-5's six page names), TASK-085 (profile redesign — needs
the profile mockup), TASK-086 (Anoint — blocked on OQ-2's four sub-decisions),
TASK-088 (error/404 — has a prompt, "The Lost Pilgrim", but no mockup yet), TASK-089
(the derived badge reliquary — has a prompt, "The Reliquary" #12, but no mockup yet; the
pure module + tests are design-independent and buildable first). Per § Next Steps in the
handoff, build order on the user's "go" is theme → shell → sign-in → reset → ritual.

**OQ-5 — suggested options (NON-BINDING prompts; the user chooses the final names):**

- **`/app` home/hub** (currently "kennel") — _The Sanctum_ / _The Inner Temple_ /
  _Your Pew_. \_(Note: the hub is being retired/absorbed (see § Default landing route
  - TASK-080); a name is only needed if the user keeps `/app` as a distinct landing
    surface rather than redirecting it to The Procession.)\_
- **`/sign-in`** — _Return to the Fold_
- **`/app/dogs/[id]`** (dog detail) — _Veneration_ / _The Relic_
- **`/app/profile/[handle]`** (profile) — _The Shrine_ / _Reliquary of the Faithful_
- **`/app/messages`** + **`/app/messages/[handle]`** (DM inbox / thread) — _Epistles_
  / _Whispers in the Sanctum_

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
non-functional on hosted until they're pushed (user's hand). **M8 adds no migration
under its recommended scope**, so it does not extend this gate — but if any M8 task
unexpectedly needs a migration, batch its hosted push with these two and follow the
per-milestone hosted-push discipline ([[PROJECT]] Process notes).

---

> **No caps.** Acceptance criteria, subtasks, and integration points are
> unbounded. Give each task as much specificity as it needs to be completed to
> spec — never trim detail to hit a count. These tasks are **`blocked` pending
> final page designs**; do not dispatch until the user activates after delivering
> them.
