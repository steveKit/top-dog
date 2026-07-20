# Handoff 016 — 2026-06-18

> **CLEAN SESSION END.** No PR is open — every PR this session merged. This session
> ran **well past the M7 close** (handoff-015): the user **pivoted the project to a
> hot-dog CULT rebrand — "Snacktum Snacktorum", the Order of the Holy Tube** — and we
> (1) cleaned up the post-`sv-create` scaffold, (2) diagnosed local-dev (WSL) access +
> seeded a dev login, (3) **scoped Milestone M8** (the rebrand/redesign — a "skin not
> skeleton" pass), and (4) **delivered + committed the auth-cluster and app-shell
> designs** plus 11 paste-ready prompts for the still-unbuilt in-app pages. **No M8
> build has started** — it is gated on the user's explicit "go". M8 is `active` but
> **execution-blocked**: every task stays `blocked` until the user activates after the
> design set lands. Five design decisions were **RESOLVED** this session (OQ-1, avatar,
> OQ-3 theme, OQ-4 fonts, the reset flow); **OQ-2 / OQ-5** and the remaining in-app
> page designs are still **OPEN**.

## Session Summary

handoff-015 closed **Milestone M7 — Safety & Polish** (all pre-specified plenary
milestones M0–M7 done). This session continued past it and **changed the project's
direction**: a rebrand of "Top Dog" into a hot-dog **CULT** app, **Snacktum
Snacktorum** (the Order of the Holy Tube). Branch: `main`. **No PR is open.** All
merges this session were clean.

What landed (merged PRs, in order):

- **PR #89 `chore`** — **post-M7 scaffold cleanup.** `/` now `redirect(307)`s to
  `/app` (was the boilerplate "Welcome to SvelteKit" page), and the `sv create`
  `demo/` route was removed. Tidies the leftover scaffold so the app's real entry
  point is the protected `/app` surface. (M8's TASK-080 will repoint `/` → `/app/feed`
  once The Procession becomes the default landing.)
- **PR #90 `docs`** — **Milestone M8 scoped** (design-blocked). The full rebrand/
  redesign milestone exploded into [[workflow/tasks/milestone-08-snacktum-snacktorum-rebrand]]
  with a **HARD SCOPE CONSTRAINT — user-facing ONLY ("rebrand the skin, keep the
  skeleton")**: change strings / copy / lore / components / styles / new user-facing
  pages, but **NEVER** rename a code identifier or infrastructure name (the Supabase
  project / DB / containers stay `top-dog`; `is_current_top_dog` / `TopDogBadge` /
  `selectTopDog` / table + RPC names all stay). Champion title "Top Dog" → **"The
  Anointed Wiener"** (copy only); mustard spray → **"Anoint"**; **The Procession**
  (`/app/feed`) becomes the **default landing** and the bare `/app` "kennel" hub
  retires into the new app shell. Carries a confirmed **Page Naming Map** (Take the
  Casing, Choose Your Frank Name, Your Litter, The Procession, The Tribunal of the
  Holy Tube, Summon a Frank, The Catechism) plus six still-TBD page names (OQ-5).
- **PR #91 `docs`** — **designs delivered + committed.** The **auth cluster + the app
  shell are fully designed**, plus brand assets, sigils, and the page-design prompts:
  - `design/pages/` — **Log In**, **Reset Password**, **Snacktum Onboarding** (the
    ritual), and **App Chrome** (the global shell/nav) `.dc.html` mockups.
  - `design/avatars/` — **5 SVG "sigils"** (Cowled, Haloed, Shadowed, Tube, Candle).
  - `design/assets/` — the **Holy Tube relic mark**, the **full logo**, the **header
    lockup**, and the **favicon set** (svg + 32/64 + apple-touch-icon).
  - `design/page-design-prompts.md` — **11 paste-ready prompts** for the still-unbuilt
    in-app pages (the temple Design System preamble + per-page prompts: shell, the
    Procession, profile, Your Litter, dog detail, the Tribunal, messages inbox +
    thread, Summon a Frank, the Catechism, the Lost Pilgrim error/404).

**No build code shipped this session** — PR #89 was a one-line redirect + scaffold
delete; PR #90/#91 are docs/design. The M8 implementation is entirely ahead of us and
gated on the user's "go".

### Local-dev (WSL) support — diagnosed this session

While the user tried to click around the app locally, two things surfaced:

- **WSL dev-server access.** `pnpm dev` runs inside WSL and Vite binds there, so a
  **Windows-native browser must use `pnpm dev --host`** (and hit
  `http://localhost:5173` or the WSL IP) to reach it — the default WSL-internal bind
  isn't visible to a Windows browser. Folded into [[CLAUDE]] as a durable Local dev
  (WSL) note. `pnpm dev --host` is **currently running**.
- **Seeded a local dev login.** Seeded `dev@topdog.test` / `topdog-dev-1234` + an
  invite token via the service-role client so the user could sign in and explore.
  **A `supabase db reset` wipes them** — re-seed, or run `pnpm test:e2e --grep @smoke`
  (which mints `smoke-inviter@topdog.test`). Because **`/sign-in` is currently a
  non-functional stub**, local login today goes via the **sign-up + invite path**
  (the seeded `dev@topdog.test` becomes directly usable once TASK-082 builds sign-in).
- These two real gaps — the **non-functional `/sign-in` stub** and the **absence of
  persistent navigation** (every sub-page is a dead end) — are now **folded into M8**
  (TASK-082 builds sign-in; TASK-080 builds the global app shell + nav).

## Key Decisions

Five design questions were **RESOLVED** with the user this session (also recorded in
[[workflow/tasks/milestone-08-snacktum-snacktorum-rebrand]] § Open Questions, marked RESOLVED).
All are **user-facing / skin-only** — none touches infra or code identifiers, none
adds a migration, none adds a numbered architecture-decision row (the canonical
[[PROJECT]] decision table stays at **#28**).

- **OQ-1 — ritual sign-up: RESOLVED → a multi-step rite that ABSORBS onboarding.**
  The initiation flows straight through as ceremonial stages: **Summoned** (invite
  token) → **Inscribe Thy Name** (Casing Name = `@handle` + email + password) →
  **Choose Thy Sigil** (avatar) → **Renounce the Patty** (a pure-UX oath, **no
  data**) → **Received.** This is Option B-with-absorb from the task's OQ-1: the rite
  subsumes the `/app/onboarding` `@handle`+avatar step, so TASK-084 must update the
  profile-funnel guard coherently and keep the `@smoke` slice green. The invite
  redemption mechanics + handle validation stay unchanged.
- **Avatar — RESOLVED → pick from 5 built-in SVG "sigils".** Cowled, Haloed,
  Shadowed, Tube, Candle. Stored as a small **sigil id** and rendered as **inline
  SVG** — **NO migration, NO storage upload.** Mechanism: **repurpose the existing
  `avatar_path` column to hold the sigil id** (no schema change — `avatar_path`
  already exists and loads). User-**uploaded** avatars are **deferred** to a later
  pass. (Keeps M8 a true skin pass — no DB/storage change for avatars.)
- **OQ-3 — visual theme: RESOLVED → the "dark temple" aesthetic.** Background
  `#17120e` painted with a radial gold glow, parchment text `#f3e9d2`, accent
  **Mustard Gold `#E0A82E`** (themeable alternates **Relic Crimson `#cf4636`** /
  **Verdigris `#57b59a`**). This is the core thing the designs deliver; the full
  Design System lives in `design/page-design-prompts.md`.
- **OQ-4 — fonts: RESOLVED → Cinzel + Cormorant Garamond, self-hosted woff2.**
  **Cinzel** (display serif, ALL-CAPS letter-spaced) for headings/labels/buttons;
  **Cormorant Garamond** (body serif) for prose. **Self-hosted `.woff2`** (SIL OFL) —
  an asset, **NOT** a package, so the dependency gate is **not** triggered and **no
  new dependency** is added.
- **Reset flow — RESOLVED → a 6-digit OTP code recovery** (request → emailed code →
  verify → set new password), **NOT** a magic link. The recovery email template shows
  the **code**; locally the email lands in **Mailpit** (`http://localhost:54324`).
  This shapes TASK-083's build (a code-entry step, not a link click) — confirm the
  `@supabase/ssr` OTP recovery handshake against the docs before building, as the task
  already flags.

**Still OPEN** (must be resolved with the user before the affected tasks build):

- **OQ-2 (the "Anoint" specifics)** — all four sub-decisions: gating (Top-Dog-only vs
  everyone), relationship to reactions (replace / re-theme / merge),
  splat-vs-drip visual, decay-vs-permanent. Affects TASK-086 (and a possible
  architecture/migration escalation if a behavior change is chosen).
- **OQ-5 (the 6 still-unnamed pages)** — `/app` home/hub, `/sign-in`,
  `/app/dogs/[id]`, `/app/profile/[handle]`, `/app/messages`, `/app/messages/[handle]`.
  Non-binding suggestions are in the prompts appendix; the user picks the final names
  before TASK-081 finalizes their copy.
- **The remaining in-app page designs** — Procession, profile, Your Litter, dog
  detail, the Tribunal, messages (inbox + thread), invite, the Catechism, and the
  error/404 page — still need generating from `design/page-design-prompts.md`.

## Files Changed

This session shipped **docs + design + one scaffold tidy** — no feature code:

- `src/routes/+page.server.ts` — MODIFIED (PR #89): `/` → `redirect(307, '/app')`
  (was the SvelteKit welcome boilerplate).
- `src/routes/demo/` — REMOVED (PR #89): the `sv create` demo scaffold route deleted.
- `workflow/tasks/milestone-08-snacktum-snacktorum-rebrand.md` — **NEW** (PR #90; updated
  **this handoff** with the RESOLVED OQs + the design-ready note). The M8 scope,
  HARD SCOPE CONSTRAINT, Page Naming Map, task set (TASK-080..088), Open Questions.
- `design/pages/Log In.dc.html`, `design/pages/Reset Password.dc.html`,
  `design/pages/Snacktum Onboarding.dc.html`, `design/pages/App Chrome.dc.html` —
  **NEW** (PR #91): the auth-cluster + app-shell mockups.
- `design/avatars/Sigil{Cowled,Haloed,Shadowed,Tube,Candle}.dc.html` — **NEW**
  (PR #91): the 5 SVG sigils.
- `design/assets/the-holy-tube.svg`, `snacktum-snacktorum-logo-full.svg`,
  `snacktum-snacktorum-header.svg`, `favicon/{favicon.svg,favicon-32.png,favicon-64.png,apple-touch-icon.png}`
  — **NEW** (PR #91): the relic mark, full logo, header lockup, favicon set.
- `design/page-design-prompts.md` — **NEW** (PR #91; path refs to the auth mockups
  tidied **this handoff** — they live in `design/pages/`, not `design/`). The 11
  paste-ready in-app page prompts + the temple Design System preamble.
- `PROJECT.md` — MODIFIED (**this handoff**): Status → M7 complete + **M8 scoped and
  in the design phase** (auth cluster + shell designed, build pending the user's go);
  Milestones table M8 row added; Last Updated → 2026-06-18.
- `CLAUDE.md` — MODIFIED (**this handoff**): Project Map latest-handoff pointer →
  `[[workflow/handoffs/handoff-016]]`; a durable **Local dev (WSL)** note (`pnpm dev --host`
  for a Windows-native browser; `/sign-in` is a stub so local login goes via the
  sign-up + invite path, or the seeded `dev@topdog.test` once sign-in is built).
- `workflow/handoffs/handoff-016.md` — **NEW** (this file).

> **Index note for the director:** the [[TASKS]] M8 index entry may want a "design
> phase" tweak (auth cluster + shell designed; remaining in-app designs + OQ-2/OQ-5
> pending; build gated on the user's go). [[TASKS]] is the director's file — flagged
> here rather than edited.

## Blockers & Open Questions

**No blocker is local-blocking** — `main` is clean, no open PRs, hosted is healthy.
The standing items:

- **M8 build is gated on the user's explicit "go".** Every M8 task is `blocked`. The
  design-ready set (TASK-080/082/083/084/087 — see § Next Steps) has designs in hand
  but **must not start** until the user activates; the director flips the `blocked →
pending` tags on the user's word, not the documenter.
- **OQ-2 / OQ-5 are still OPEN** and the **remaining in-app page designs** are not yet
  generated (see § Key Decisions). TASK-086 (Anoint) and TASK-081 (the six TBD page
  names) cannot finalize until these resolve.
- **Two M7 hosted pushes still pending** (carried from handoff-015, user's hand):
  `20260617205453_burger_alarms.sql` (TASK-071) + `20260618120000_burger_verdicts.sql`
  (TASK-073), to be `supabase db push`ed **together**. **No keep-alive / auto-pause
  risk** (no scheduled job touches those tables); the only consequence is the 🍔
  Hamburger Court flow doesn't work **on hosted** until they land. **M8 adds no
  migration under its recommended scope**, so it does not extend this gate.

Two **process notes** still apply (both recurring, from prior sessions):

- **Documenter does not run prettier in-sandbox** — bookkeeping markdown is formatted
  **by construction**; the director runs the final `prettier --write` pass on the main
  thread before landing.
- **Main-commit / push hook boundary** — the pre-tool-safety hook blocks the director
  from committing/pushing directly to `main`, so every bookkeeping commit needs the
  **user's hand** (the known `chore/*`-branch constraint in [[workflow/memory/MEMORY]]).

## Discovered Work

**No new discovered-work items this session** — it was a pivot/scoping/design session,
not an implementation one. The standing open backlog (per [[workflow/tasks/discovered]]) is
unchanged from handoff-015: **DW-002** (generic RLS/DB integration-test harness),
**DW-004** (shared profile layout/page data-key footgun), **DW-005** (accepted v1
`byte_size`-understatement residual), **DW-007** (`isValidHandle` test-only export
tidy), **DW-012** (interim reaction emoji set → M6 emoji library), **DW-014**
(`@security` fixture-id collision on a dirty DB), **DW-015** (`isUuid` unit coverage),
**DW-016** (extract shared service-role E2E helpers), **DW-017** (`spray` action
missing-coordinate `0,0` default), **DW-020** (render-DOM E2E for the emoji filter),
**DW-023** (`toEpochMs`/`tryEpochMs` duplication tidy), **DW-025** (`listThread`
oldest-vs-latest, the most recent item). M8's redesign work may naturally absorb a few
of these (e.g. DW-012's interim emoji set, DW-004's profile data-key footgun) when it
reworks those surfaces.

## Next Steps

Prioritized — see [[TASKS]] and [[workflow/tasks/milestone-08-snacktum-snacktorum-rebrand]] for
full context:

1. **[user] Resolve the remaining design gaps, then say "go".** Specifically:
   (a) **generate the remaining in-app page designs** from
   `design/page-design-prompts.md` (Procession, profile, Your Litter, dog detail, the
   Tribunal, messages inbox + thread, invite, the Catechism, the error/404 page);
   (b) **resolve OQ-2** (the four Anoint sub-decisions) and **OQ-5** (the six TBD page
   names). The build does not begin until the user activates the milestone.
2. **[on the user's "go"] Build the design-ready set, in order.** The pieces with
   designs already in hand: **theme foundation (TASK-087)** → **app shell (TASK-080)**
   → **sign-in (TASK-082)** → **reset (TASK-083)** → **ritual sign-up (TASK-084)**.
   Lead with the theme tokens + the shell so the copy/page work has a home; the
   `design-light` trio (shell, sign-in, reset) closes the real functional gaps
   (dead-end nav, the non-functional sign-in stub, no password recovery). The director
   flips `blocked → pending` and dispatches on activation — **do not self-start.**
3. **[user, standing] The two M7 hosted pushes** (`burger_alarms` + `burger_verdicts`,
   together) remain the only pre-existing open ops action; no urgency (no auto-pause
   risk), but the 🍔 Hamburger Court is non-functional on hosted until they land.
4. **[session boundary] The local Supabase stack is up and `pnpm dev --host` is
   running.** Stop them (`supabase stop`; halt the dev server) if done for the day.
   Remember a `supabase db reset` wipes the seeded `dev@topdog.test` login.

Nothing is urgent or blocking. M8 is fully scoped and partway designed; the next move
is the user's (finish the designs / resolve OQ-2 + OQ-5 / activate).

## Files to Read on Resume

- [[workflow/tasks/milestone-08-snacktum-snacktorum-rebrand]] — the M8 spec: the HARD SCOPE
  CONSTRAINT, the Page Naming Map, the task set (TASK-080..088), and the **Open
  Questions** (OQ-1/avatar/OQ-3/OQ-4/reset now RESOLVED; OQ-2/OQ-5 still OPEN) + the
  design-ready note.
- `design/page-design-prompts.md` — the temple **Design System** (palette, fonts,
  voice, motifs) + the **11 paste-ready prompts** for the unbuilt in-app pages. The
  single source for the visual language.
- `design/pages/` — the four delivered mockups (**Log In**, **Reset Password**,
  **Snacktum Onboarding** ritual, **App Chrome** shell). `design/avatars/` — the 5
  sigils. `design/assets/` — brand marks + favicons.
- [[PROJECT]] — Status (M0–M7 complete; **M8 scoped + design phase**) and the
  Milestones table M8 row; the Process notes (the two outstanding hosted pushes).
- [[CLAUDE]] — the new **Local dev (WSL)** note (`pnpm dev --host`; `/sign-in` stub →
  sign-up + invite path) and the recurring format-ownership / `chore/*`-branch
  bookkeeping constraints.
- [[TASKS]] — index: M8 `active` but execution-blocked; M0–M7 in Completed Milestones.

## Library Candidates

_None extractable (assessed)._ Everything this session is **project-specific**: the
**design source** (the temple Design System, the sigils, the brand assets, the cult
page prompts) is bespoke to Snacktum Snacktorum, and the only code change (PR #89's `/`
redirect + demo-route delete) is a one-line scaffold tidy. The M8 build itself, when it
comes, is a theme/copy/markup pass on the existing SvelteKit surface — also
project-specific by design (the cult aesthetic, the rebrand strings, the app-specific
nav). Nothing here is reusable outside Top Dog / Snacktum Snacktorum. Consistent with
the prior handoffs' calls; assessed and declined. (Re-assess once the theme layer
lands — a generic, hot-dog-agnostic CSS-token or self-hosted-font-loading pattern
_could_ surface as a candidate then, but it does not exist yet.)

See [[workflow/handoffs/handoff-015]] for prior session context (the M7 close).
