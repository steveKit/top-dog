# Top Dog

workflow-version: 5

Invite-only social app for showing off homemade hot dogs. See [[PROJECT]] for
architecture decisions and [[TASKS]] for the work queue.

## Stack

- **Language:** TypeScript 5.x
- **Framework:** SvelteKit 2.63 + Svelte 5 (runes)
- **Database:** Supabase Postgres (RLS-enforced) via `@supabase/supabase-js` + `@supabase/ssr`
- **Auth:** Supabase Auth (email + invite-link), cookie sessions via SSR
- **Storage:** Supabase Storage — `hotdogs` (private/signed), `avatars` (public-read), behind a swappable storage module
- **Coding Paradigm:** Pragmatic/modular, typed, feature-folder structure
- **Testing Paradigm:** Adaptive — TDD-first for pure logic, test-after for UI/wiring
- **Test Runner:** Vitest 4 (unit/logic), Playwright 1.60 (E2E/smoke)
- **Linter/Formatter:** ESLint + Prettier (svelte plugins), `svelte-check` for types
- **Package Manager:** pnpm 11.5.2 (via mise)

## Project Map

Canonical [[wikilink]] targets for this project:

- [[CLAUDE]] — this file (agent conventions, stack, commands)
- [[PROJECT]] — status, architecture decisions, milestones
- [[TASKS]] — milestone index / dashboard
- [[tasks/discovered]] — discovered-work log
- [[tasks/deferred]] — deferred / descoped task log
- [[TASKS-ARCHIVE]] — completed-milestone archive (pre-migration M0/M1)
- [[README]] — setup, usage, contributing
- [[memory/MEMORY]] — stable cross-session agent patterns
- [[Handoffs/]] — session continuity directory (latest: [[Handoffs/handoff-020]])

## Commands

```bash
# Install tool versions (mise: node, pnpm, supabase)
mise install

# Install dependencies
pnpm install

# Start local Supabase stack (Docker: Postgres + Auth + Storage + Studio).
# Use the wrapper, not raw `supabase start`: it runs `supabase start` then
# clears the CLI's hardcoded `restart: unless-stopped` policy (docker update
# --restart=no, scoped by label com.supabase.cli.project=top-dog) so the stack
# won't auto-start on a Docker/host reboot. The CLI re-applies unless-stopped on
# every start and has no config.toml knob for it, so the wrapper re-applies the
# override each run — a raw `supabase start` leaves auto-restart ON.
pnpm db:start                # canonical: wraps `supabase start` + disables auto-restart
# Stop it
supabase stop
# Apply / create migrations
supabase migration new <name>
supabase db reset            # re-apply all migrations to local DB

# Run development server
pnpm dev
# Local dev on WSL: `pnpm dev` binds inside WSL, so a Windows-native browser cannot
# reach the default bind. Use `pnpm dev --host` and open http://localhost:5173 (or the
# WSL IP) from Windows.
pnpm dev --host              # expose the dev server to a Windows-native browser

# Password-recovery flow (local test, TASK-083): the reset is a 6-digit OTP CODE, not a
# magic link. (1) go to /forgot-password and submit the account email; (2) open Mailpit at
# http://localhost:54324 and read the 6-digit code from the "recovery rite" email
# (code-only — config.toml sets otp_length=6 + the supabase/templates/recovery.html
# template; the Supabase default sends a LINK, so the template must be present locally AND
# on hosted); (3) go to /reset-password and enter the code + a new password (>= 8 chars,
# confirmed) to set it. A `supabase db reset` wipes any test user — re-seed / re-redeem.

# Run tests (CI mode — no watch)
pnpm test                    # vitest run
pnpm test:e2e                # playwright test

# Run linter
pnpm lint                    # eslint + prettier --check

# Run type checker
pnpm check                   # svelte-check

# E2E precondition: reset the local DB first for a deterministic run.
# Some specs use pinned fixture ids (tracked as DW-014), so a dirty DB can
# collide (e.g. hot_dogs_pkey duplicate). Run with `supabase start` up:
supabase db reset            # clean slate, all migrations re-applied
# Smoke test (end-to-end vertical slice: invite -> profile -> upload -> see dog)
pnpm test:e2e --grep @smoke
# Security suite (live-DB write guards: RLS, column grants, forged counters)
pnpm test:e2e --grep @security

# Build for production
pnpm build
```

## Code Intelligence

- **Primary language:** TypeScript / Svelte
- **Language server:** `typescript-language-server` (+ `svelte-language-server` for `.svelte` files)
- **Claude plugin:** TypeScript code-intelligence plugin (see https://code.claude.com/docs/en/discover-plugins) — install if available for your Claude Code version
- **Status:** not installed — user installs the plugin + servers; LSP tool falls back to Grep/Read until then

## Project Structure

```
top-dog/
├── .mise.toml                 # node, pnpm, supabase pins
├── .env.example               # documented required env vars (real .env gitignored)
├── security-profile.yaml      # L2
├── .github/workflows/
│   └── keepalive.yml          # daily keep-alive + Top Dog tally
├── supabase/
│   ├── config.toml
│   └── migrations/            # SQL migrations (schema + RLS + RPC functions)
├── src/
│   ├── hooks.server.ts        # per-request @supabase/ssr client, auth guard
│   ├── app.d.ts               # App.Locals types (supabase, session)
│   ├── lib/
│   │   ├── assets/            # brand/ (the-holy-tube + logo marks) + sigils/ (5 avatar SVGs) (M8)
│   │   ├── supabase/          # browser client factory
│   │   ├── server/            # server-only secret-key client
│   │   ├── storage/           # SWAPPABLE storage module (hotdogs/avatars)
│   │   ├── features/          # one folder per domain
│   │   │   ├── auth/  invites/  profiles/  hotdogs/   # profiles/ adds sigils.ts (M8) — 5 built-in sigil ids stored as `sigil:<id>` in avatar_path
│   │   │   ├── voting/        # pure ranking/tie-break logic + vote RPC wrappers + feed/leaderboard queries
│   │   │   ├── reactions/  mustard/  walls/  dms/
│   │   │   ├── badges/        # PURE derived-honors module: computeBadges(BadgeInputs) — the Reliquary, no schema/write (M8 TASK-094-R)
│   │   │   ├── emoji/         # render-time filter + sprinkle (TDD)
│   │   │   └── forms/         # themed inline validation: validationMessage.ts (pure) + createFormValidation() rune (M8)
│   │   ├── motion/            # reducedMotion.ts — errorSlideFade transition + prefers-reduced-motion helpers (M8)
│   │   ├── styles/            # tokens.css — CSS-custom-property theme layer (M8)
│   │   └── components/        # shared Svelte components (incl. Sigil.svelte — inline SVG sigil avatar, no {@html}, M8 TASK-092; Reliquary.svelte — presentational badge shelf, M8 TASK-094-R)
│   └── routes/                # SvelteKit routes (+page, +layout, +server)
│       └── (protected)/snacktum-snacktorum/+layout.svelte  # persistent app shell + nav (M8 TASK-080; prefix renamed TASK-090)
├── static/
│   ├── fonts/                 # self-hosted SIL OFL .woff2 (Cinzel, Cormorant) + OFL licenses
│   └── favicon.svg, favicon-32/64.png, apple-touch-icon.png  # wired in +layout.svelte (M8)
├── tests/                     # Playwright E2E
└── Handoffs/                  # session continuity
```

## Conventions

### File Organization

- Group by **feature/domain** under `src/lib/features/`, not by type.
- Pure logic (ranking, decay, emoji filter) lives in plain `.ts` modules with
  co-located `*.test.ts` — no SvelteKit/Supabase imports, fully unit-testable.
- Storage access goes through `src/lib/storage/` only. No direct
  `supabase.storage` calls elsewhere — this is the swappable seam for R2.

### Naming

- Svelte components `PascalCase.svelte`; modules `camelCase.ts`.
- Booleans read as questions: `isCurrentTopDog`, `hasVoted`, `canSprayMustard`.
- DB columns `snake_case`; TS interfaces `PascalCase`.

### Patterns

- Svelte 5 **runes** (`$state`, `$derived`, `$props`, `$effect`) — no legacy
  `export let` / reactive `$:` in new components.
- Server-side data load in `+page.server.ts` / `+layout.server.ts`; mutations
  via **form actions** or `+server.ts` endpoints, never client-side secret key.
- Competitive writes (votes, crown, counters) go through **Postgres RPC
  functions** in a single transaction — never multi-step client writes.
- Storage ops call `$lib/storage` (`upload`/`getSignedUrl`/`getPublicUrl`/`remove`)
  and **pass the `SupabaseClient` in** — `event.locals.supabase` for RLS-scoped
  ops, the service client for privileged ops. These functions return a
  discriminated `StorageResult<T>` (`{ ok: true; data } | { ok: false; error }`)
  rather than throwing; branch on `ok`. Build object paths with the pure
  `hotdogPath`/`avatarPath` helpers — never hand-construct the `{owner_id}/`
  prefix (uuid validation there backs the storage RLS write policies).

### Theme & Styling (M8 dark-temple)

- **The theme is a CSS-custom-property token layer** in `src/lib/styles/tokens.css`,
  imported by `src/app.css`. Downstream styling **MUST consume `var(--…)` tokens —
  never literal hex/px**. The vocabulary covers surfaces (`--color-bg*`,
  `--surface-temple`), the text ramp (`--color-text*`, `--color-heading`), accents,
  type (`--font-display` Cinzel / `--font-body` Cormorant Garamond + the
  `--text-*` scale + `--tracking-*`), spacing (`--space-*`), radii, shadows/glow,
  focus ring (`--ring-focus`), measures, and motion/easing.
- **Three accent themes switch via a `data-accent` root attribute** —
  `data-accent="crimson" | "verdigris"`; default (unset) is Mustard Gold. Style
  against `--accent` / `--accent-*`, not a fixed gold literal, so the switch works.
- **Fonts are self-hosted SIL OFL `.woff2` in `static/fonts/`** (Cinzel + Cormorant
  Garamond), wired via `@font-face` in `src/app.css` — **NOT an npm package** (no
  CDN, no dependency). The bundled `OFL-*.txt` license files must stay alongside.
- **Reuse the themed flair components** (`TopDogBadge`, the police-tape banners,
  the mustard/Anoint overlay base, reaction/vote controls) rather than re-styling
  them. `--color-text-fainter` is **placeholders-only** (sub-AA by design); keep
  `--color-text-faint` (≥AA) for real content (see DW-028).

### Forms & validation (CANON — themed inline validation, never the native bubble)

- **Themed inline client-side validation is the STANDARD for EVERY form in the app
  that has required / empty-able fields. The browser's native HTML5 validation
  bubble is NEVER used.** New and reworked forms MUST adopt this — it is a binding
  convention, not an option. (Landed ad-hoc as PR #109 on the auth-gate forms; made
  app-wide canon. Rollout to remaining in-app forms tracked as DW-032.)
- **The shape every form-bearing page follows:**
  - Add `novalidate` to the `<form>` (suppresses the native bubble so our layer owns
    the messaging).
  - Construct `const validation = createFormValidation()` from
    `$lib/features/forms/formValidation.svelte.ts` (a rune factory) and **wrap the
    page's `use:enhance` SubmitFunction** through `validation.enhance(...)`. On a
    failed submit it populates the reactive `validation.errors` map, focuses the
    first invalid field, and `cancel()`s the submit; there is no timer / auto-dismiss.
  - Per field: add `aria-invalid` + `aria-describedby` (kept in lockstep with the
    error message and removed together by the shared `clearError`), and
    `oninput={validation.clearOnInput}` (hides that field's error on the **first
    keystroke in that field**, per-field).
  - Render the message:
    `{#if validation.errors.<name>}<p class="field-error" role="alert" id={...} transition:errorSlideFade>{...}</p>{/if}`.
- **Messages are themed, field-naming cult copy from
  `$lib/features/forms/validationMessage.ts`** (pure, unit-tested) — `classifyFailure`
  - `validationMessage`. It special-cases themed field labels (e.g. **Mustard
    Address**, **Seal**); **extend its label special-cases when a new themed field name
    is introduced** rather than hand-writing message strings at the call site.
- **`.field-error` (uses `--color-error`)** is the message style; the slide+fade
  entrance/exit is `errorSlideFade` from `$lib/motion/reducedMotion.ts`, which animates
  height (the layout shift) and is SSR-safe / `prefers-reduced-motion`-aware via
  `prefersReducedMotion()` / `motionDuration()`.
- **‼️ The validated field MUST be NESTED INSIDE its `<label>` (the gate-form pattern) — a
  sibling `<label>` silently breaks the themed message.** `validationMessage.ts`'s themed
  copy keys on the visible **label text**, resolved at submit time by `fieldLabel()` via
  `closest('label')` on the invalid field (falling back to `aria-label`, then the field
  `name`). If the `<label>` is a **sibling** of the input/textarea (not a wrapper) **and**
  there is no `aria-label`, `closest('label')` finds nothing and `fieldLabel()` falls back
  to the raw field **`name`** — so the special-cased themed message never fires and you get a
  generic message off the `name` instead (e.g. "Speak thy body." rather than the "Word upon
  the Shrine" copy). Wrap the field in its `<label>` (or give it an `aria-label`). **Note the
  two-key split:** the `validation.errors` map and the a11y attrs (`aria-invalid` /
  `aria-describedby`) key on the field **`name`**, while the themed-message special-case keys
  on the visible **label text** — keep both correct. `formValidation.svelte.ts` validates
  `<textarea>` as well as `<input>` (widened in TASK-093). (Caught as a major in the TASK-093
  review on the Shrine wall composer — the textarea's `<label>` was a sibling, so the themed
  validation never showed.) **Related field-name footgun (same page, separate tester-caught
  P0):** a form field's `name` MUST match the action's `formData.get('<name>')` key — the
  Shrine wall composer's textarea is `name="body"` to match the `post` action's
  `formData.get('body')` (it had shipped as `name="word upon the shrine"`, so every post
  submitted an empty body silently). Pin the field `name` to the action's expected key, not
  the visible label.

### State Management

- Server is source of truth (Supabase). Client holds derived/ephemeral UI state
  via runes. Use `invalidate`/`depends` to refresh after mutations.

### Error Handling

- Validate at boundaries (form actions, `+server.ts`, RPC inputs).
- Return typed results from feature modules; surface user-facing errors via
  SvelteKit `fail()` in form actions. Don't swallow Supabase errors — log
  context (operation, ids) server-side, show a friendly message client-side.

### Imports

- Use `$lib/...` alias for everything under `src/lib`.
- Server-only code (secret key client) imports from `$lib/server/*` so
  SvelteKit guarantees it never ships to the browser.

## Testing Strategy

testing-paradigm: adaptive

- **Approach:** Adaptive. TDD-first for pure logic; test-after for UI/wiring.
- **What to test (TDD-first):** vote/move-vote rules, ranking + sticky tie-break,
  days-as-Top-Dog tally, mustard decay/opacity math, emoji replacement + sprinkle,
  per-user cap + global storage guard thresholds.
- **What to test (test-after):** form actions, load functions, route wiring,
  the M1 vertical-slice smoke flow (Playwright `@smoke`).
- **What to skip:** Supabase internals, third-party library behavior, pure
  presentational markup with no logic.
- All later milestones must keep the M1 vertical-slice smoke test passing.

## Secrets & Environment

- **Secrets file format:** `.env` (SvelteKit/Vite). Real `.env` is gitignored.
- **Example file:** [[.env.example]] documents every required variable.
- Required vars: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  (browser), `SUPABASE_SECRET_KEY` (server-only). Never expose the secret key
  to the client or prefix it with `PUBLIC_`.
- Agents must NEVER read the real `.env`. Use `.env.example` only.

## Convention Overrides

| Area                    | Global Standard             | This Project                                | Rationale                                                  |
| ----------------------- | --------------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| Dev DB containerization | Hand-written docker-compose | Supabase CLI local stack (`supabase start`) | Hosted Supabase; CLI manages the Docker stack + migrations |

## Tech-Specific Agents

- See `.claude/agents/` for SvelteKit/Supabase-specific instructions.

## Gotchas

- **Secret vs publishable keys:** only `PUBLIC_`-prefixed vars reach the browser.
  The secret key must stay server-only (`$lib/server`).
- **Denormalized `vote_count`** is maintained by a DB trigger/RPC inside the vote
  transaction — never write it from the client. **Enforcement is column-level, on
  BOTH write paths:** RLS gates rows, not columns, so server-maintained counters
  (`vote_count`, `peak_votes`, `created_at`) are blocked by revoking table-wide
  write then re-granting only safe columns — `grant insert (id, owner_id,
image_path, caption, byte_size)` + `grant update (caption)` on `hot_dogs`.
  Omitted columns fall to DEFAULTs so a direct PostgREST insert can't forge an
  opening counter. Restricting only UPDATE is insufficient (it leaves the INSERT
  path open). Replicate this insert+update column-grant pair for every future
  denormalized counter.
- **The same insert+update column-grant pattern applies to the `profiles` crown
  columns.** `is_current_top_dog` / `top_dog_since` / `days_as_top_dog` are
  server-maintained by `recompute_top_dog()` (SECURITY DEFINER) — never
  client-writable. `profiles` originally had no column-level write grants, so a
  plain PostgREST INSERT/UPDATE could forge crown state; locked down with `revoke
insert/update on profiles from authenticated` then `grant insert (id, handle,
display_name, avatar_path)` + `grant update (handle, display_name, avatar_path)`
  (decision #25, caught in the TASK-021 review). This is decision #24 applied to
  the crown columns — replicate it for every server-maintained denormalized
  column, not just counters.
- **Cosmetic / many-allowed tables write through plain owner-scoped RLS, NOT an
  RPC — the deliberate inverse of the consuming-writes-via-RPC convention.** The
  RPC convention exists to maintain a denormalized counter transactionally; a
  table with **no server-maintained denormalized column** (e.g. `hotdog_reactions`)
  has nothing to maintain, so a plain owner-scoped RLS `insert`/`delete`
  (`(select auth.uid()) = user_id`) is correct. Counts are computed at **render
  time** by a pure aggregator (`summarizeReactions`), never stored — so the
  "no ranking effect" guarantee (decision #12) holds **structurally** (there is
  no write path that could touch `vote_count`/`peak_votes`/crown), not by code
  discipline. Corollary: decision #24's insert+update column-grant lockdown does
  **not** apply to such a table — `created_at`/`id` being client-insertable is
  inert because there is no denormalized column to forge. Make these writes
  idempotent (UNIQUE → 23505 maps to a benign add; a missing-row delete is a
  no-op). Reuse this shape for future flair/cosmetic surfaces (e.g. M6 emoji).
  Another instance: `wall_messages` (TASK-050) — plain owner-scoped RLS, store the
  **original** body verbatim (so the M6 emoji render-time filter applies at render,
  never persisted); INSERT pins `author_id = (select auth.uid())`, but DELETE allows
  the message author **OR** the wall owner (`author_id = … OR profile_id = …`) and
  there is no UPDATE (messages immutable). Decision #24/#25 lockdown likewise does not
  apply (no server-maintained column to forge).
  **EXCEPTION — a cosmetic table is RPC-only-write when the write is a SERVER-IMPOSED
  PRIVILEGED CONSEQUENCE, not a self-service toggle.** The plain-RLS shape above is for
  a member acting on their OWN behalf (I react, I spray, I post). When a cosmetic /
  ranking-inert table is instead written as a _consequence imposed by a privileged
  actor on someone else_ — e.g. the current Top Dog branding a member a HAMBURGER LIAR
  / HERETIC (`burger_verdicts` / `hamburger_liars`, TASK-073) — invert it: give the
  table the **votes-style "no client write policy" lockdown** (SELECT-only for
  `authenticated`, default-deny on writes, like `votes` / `top_dog_days`) and make a
  SECURITY DEFINER **RPC the sole write path**, with the RPC's authorization gating on
  a non-client-writable column (the crown, decision #25; actor from `auth.uid()`
  inside the RPC). The table is still decision #12 (no counter, ranking-inert) and
  still decays/persists at render (decision #15) — but it is RPC-only because the
  write is privileged, not because it maintains a counter. This is the deliberate
  inverse of the bullet above; do NOT reach for plain owner-scoped RLS here (there is
  no owner who may self-issue the brand). Note the contrast with the next gotcha
  (`mustard_sprays`): there the privileged-but-cosmetic write stays **plain RLS** with
  a `WITH CHECK` gate because the actor sprays on their own behalf; here the actor
  brands _another_ member, so it is RPC-only. Composes #12/#13/#15/#25, no new
  decision row. Reuse for any future "the Top Dog brands you X" surface.
- **Privileged-but-cosmetic write = plain RLS write + an authorization `WITH CHECK`
  conjunct that reads a server-maintained, non-client-writable column.** When a
  cosmetic/many-allowed surface (no denormalized counter, see the gotcha above) is
  additionally restricted to a privileged actor (e.g. only the current Top Dog —
  user-facing "The Anointed Wiener" — may Anoint a member, the user-facing copy for
  spraying on the Shrine; table/column code identifiers `mustard_sprays` / `sprayer_id`
  are unchanged, TASK-041/094), DO NOT reach for a SECURITY DEFINER RPC. Keep the plain owner-scoped RLS write and add the authorization as a second
  INSERT `WITH CHECK` conjunct: pin the actor (`sprayer_id = (select auth.uid())`,
  so it can't be forged) AND gate on a privilege column via an EXISTS
  (`exists (select 1 from profiles p where p.id = (select auth.uid()) and
p.is_current_top_dog)`). **This is trustworthy ONLY because the gate column is
  itself non-client-writable** (the crown columns, decision #25) — a member cannot
  set their own crown to self-satisfy the check. If the gate column WERE
  client-writable, the predicate would be self-forgeable and the gate worthless, so
  this pattern presupposes the decision #24/#25 column-grant lockdown on whatever
  column the gate reads. Pair with NO UPDATE/DELETE policy when the rows are meant to
  be immutable/persistent (Anoint sprays persist across crown changes per decision
  #15; as of decision #29 the table has NO DELETE path at all — the daily prune was
  retired, so `mustard_sprays` is effectively append-only). This is decisions
  #12/#15/#25 composed, not a new architecture decision — reuse the shape for any
  future privileged-flair surface (e.g. an M5 "only the Top Dog may …" write).
- **`revoke execute ... from public` is NOT sufficient to lock down a function on
  Supabase.** Supabase explicitly grants EXECUTE on new `public.*` functions to
  `anon` and `authenticated`; `revoke ... from public` only strips the PUBLIC
  pseudo-role, leaving those grants intact (the function stays callable). To
  actually lock a SECURITY DEFINER helper down, `revoke execute ... from public,
anon, authenticated`. Easy to miss — apply it to every private helper RPC (e.g.
  `recompute_vote_count` / `recompute_top_dog`).
- **Single-use guards must key on a column the FK never nulls.** The invite
  single-use check keys on `invites.consumed_at` (set once, never nulled), NOT on
  `consumed_by` (which is `on delete set null` for audit). Keying a single-use
  guard on a nullable-by-FK column would re-open a spent record once the
  referenced user is deleted. Pair with a one-directional CHECK
  (`consumed_by is null or consumed_at is not null`), never a bidirectional one —
  a bidirectional CHECK blocks deleting the referenced user entirely. Applies to
  any future "consume once" record (redemptions, one-shot tokens, claims).
- **Mustard(Anoint) + emoji are render-time computations** — the DB stores raw
  timestamps and original text; never persist the decayed/filtered output. The
  Anoint overlay decays full → 0 over **6h** (`MUSTARD_LIFESPAN_MS` in
  `src/lib/features/mustard/decay.ts`, shortened from 24h by TASK-094 / decision
  #29 — the single source of truth; if you see "24h" mustard copy anywhere it is
  stale).
- **Decaying overlay + PERSISTING render-derived notice off ONE append-only table
  (decision #29).** `mustard_sprays` is **append-only** (no client DELETE policy AND
  the daily `prune_mustard_sprays()` job is RETIRED/dropped — TASK-094) so the spray
  rows survive forever. Two render-time views compute off the same raw rows: (1) the
  **decaying Anoint overlay** on the Shrine reads only the live (≤ 6h) window —
  `listSpraysForProfile`, opacity via `mustardOpacity`; (2) the **persisting wall
  notice** ("recently anointed") must derive from the **FULL spray history**, NOT the
  6h overlay window — use `listAnointmentsForProfile` (capped 200 rows), because a
  notice that says "you've been anointed" must outlive the visual splat's 6h fade.
  The fix-cycle bug here was deriving the persisting notice from the 6h overlay query,
  so it vanished with the splat. Reuse this shape — append-only source + one decaying
  view + one persisting view — for any future "fades visually but the fact persists"
  surface; never prune the source rows the persisting view needs.
- **Storage `{owner_id}/` prefix is load-bearing for RLS:** `storage.objects`
  write/update/delete policies allow only objects whose first path segment is the
  uploader's `auth.uid()` (`(storage.foldername(name))[1] = (select auth.uid()::text)`).
  Uploads MUST place objects under `auth.uid()/...` or RLS rejects them. Buckets
  (`hotdogs` private, `avatars` public-read) are defined **in SQL migrations**, not
  the Supabase dashboard, so they reproduce under `supabase db reset`.
- **`storage.createSignedUrl` is RLS-gated at CREATION — a client can only sign
  objects it has storage SELECT on.** The bypass is only on the resulting URL's
  read, NOT on minting it. For the `hotdogs` **private** bucket (owner-only SELECT,
  `hotdogs_select_own`), the viewer's RLS-scoped client (`event.locals.supabase`)
  can only sign the viewer's OWN objects — so any **cross-member view of
  private-bucket content** (the `/snacktum-snacktorum/procession` and
  `/snacktum-snacktorum/litter/[id]` loads, which show
  OTHER members' dogs) MUST mint signed URLs **server-side with the service client**
  (`$lib/server` `getServiceClient()`), constructed **AFTER** the `safeGetSession()`
  gate, signing only `image_path` from rows the member's own RLS query already
  returned (no exposure widening). Keep the dog/owner/reaction QUERIES on the
  RLS-scoped client — only the storage signing uses the service client; the
  `/snacktum-snacktorum/litter` own-dogs gallery correctly stays fully on the RLS client. This
  preserves decision #6 (bucket private, 1h TTL signed URLs, service client
  server-only) with no storage RLS / bucket change. (Caught as a P0 in TASK-033 —
  the storage-baseline migration comment claiming "signed URL bypasses RLS" was
  wrong about the creation side.) Applies to any future cross-member view of
  private-bucket content.
- **Cross-member aggregate / `count` queries over an owner-scoped-RLS table must use the
  service-client-after-gate head count, NOT the RLS-scoped client — this generalizes the
  decision #27 service-client pattern from rows/signed-URLs to COUNTS.** A `count` query
  on a table whose only SELECT policy is owner-scoped (e.g. `invites` /
  `invites_select_own` = `(select auth.uid()) = inviter_id`) silently returns **`0`** for
  any **non-owner viewer** — there is no error, the count just under-reports to zero. So a
  cross-member derived stat that counts another member's owner-scoped rows MUST be minted on
  the service client (`$lib/server` `getServiceClient()`) **AFTER** the `safeGetSession()`
  gate, as a **head count** (`{ count: 'exact', head: true }`) so it ships **no rows** (only
  the integer) → no exposure widening, decision-#27-safe. (Caught as a major in the TASK-093
  review: The Shrine's "Disciples Summoned" — redeemed-invite count — read 0 on every
  cross-member view because it ran on the RLS-scoped client; `loadShrineStats` in
  `src/lib/features/profiles/stats.ts` runs only that one count on the service client, the
  other seven stay RLS-scoped.) Applies to any future cross-member count over an
  owner-scoped-RLS table.
- **Derived-honors pattern (the Reliquary) — compute badges PURELY over already-loaded facts;
  reuse the Shrine stat ledger, do NOT re-query.** A badge/honors surface is a render-time
  derivation, not new state: `computeBadges(BadgeInputs)` in
  `src/lib/features/badges/badges.ts` is a **pure** value-in/value-out module (no
  SvelteKit/Supabase imports, co-located unit tests — same self-contained shape as
  `voting/ranking.ts` / `mustard/decay.ts` / `reports/verdict.ts`), and `Reliquary.svelte` is
  presentational. **No migration / schema / RPC / dependency / write path** — every honor lights
  up when an EXISTING record crosses a threshold, so the badges are un-forgeable by construction
  (nothing on the shelf is client-settable). **The route load assembles `BadgeInputs` from facts
  it ALREADY loaded** — reuse the `loadShrineStats` aggregates (TASK-093), including its
  service-client redeemed-invites count, so a derived shelf adds **no second service-client read**;
  add at most a tiny RLS-client head-count for anything not already in the ledger (the new
  `inquisitor` count). **Decision #27 reporter anonymity is structural here: NO badge keys on the
  reporter SIDE of a report** — `heretic`/`liar` key on the member's OWN dogs' verdicts / OWN
  brand, `inquisitor` on the adjudicator's OWN public action (`decided_by` = the member); there is
  deliberately no "heresies you've called" badge. Tiered relics carry their own ascending
  threshold list + a `nextThreshold`; the founding-cohort cutoff is a single named constant
  (`ELDER_CUTOFF_ISO`), not a scattered magic date. Composes decisions #12/#13/#15/#27 — **no new
  decision row**. Reuse this shape for any future derived-status/honors surface.
- **RLS policies use the `(select auth.uid())` subselect idiom**, not bare
  `auth.uid()`, so the planner caches it as an initplan (Supabase's documented RLS
  perf pattern). Follow this idiom in new policies.
- **Schema-qualify extension-provided types in migrations** (e.g.
  `extensions.citext`, not bare `citext`). The local migration role has
  `extensions` in its `search_path` but the hosted role does not, so an unqualified
  reference passes `supabase db reset` locally yet fails `supabase db push` on
  hosted with `type "x" does not exist`. Applies to every extension type
  (invites, hot_dogs, vote RPC migrations, etc.).
- **Auth-trust boundary:** always read the session via `event.locals.safeGetSession()`,
  never a raw `supabase.auth.getSession()`. `safeGetSession()` re-validates the JWT
  with `supabase.auth.getUser()` and refuses unvalidated sessions — a bare
  `getSession()` returns cookie data the server has not verified.
- **Env access:** the app reads Supabase env via `$env/dynamic/*` (not
  `$env/static/*`) because no real `.env` exists at type-check time. The two
  `PUBLIC_` vars go through `getPublicSupabaseConfig()` (`$lib/supabase/env.ts`),
  which throws on missing/empty values. Don't reach for static env imports.
- **7-day auto-pause:** the keep-alive workflow must stay green or the hosted DB
  pauses. The hosted project is live and the workflow is **enabled and verified**
  (TASK-004 — last manual run returned HTTP 200 against `profiles`). It runs daily
  and depends on the `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` repo secrets.
  The workflow steps are `ping` + `tally` (the daily Top Dog tally); the mustard-prune
  step was REMOVED in lockstep when TASK-094 / decision #29 retired
  `prune_mustard_sprays()`. **Two distinct red-workflow failure modes, diagnosed by
  which STEP fails:** (1) the `ping` step itself fails → reachability/secrets —
  re-check the two repo secrets first; (2) `ping` passes but the `tally` RPC step
  returns a PostgREST **404** → **hosted schema drift**: that RPC's migration was never
  `supabase db push`ed to hosted. This is NOT a secrets problem (ping proves
  reachability) and NOT necessarily an auto-pause emergency (the daily `ping` read
  keeps the DB alive even while the workflow shows red). Remedy: `supabase db push`
  the missing migration; prevention: push migrations to hosted **per-milestone**, not
  just at going-live. (Diagnosed handoff-010 — the M2/M3 migrations had never been
  pushed since the M0/M1 going-live, so `tally_top_dog_day()` 404'd for 4 days.)
- **Scheduled-job auth pattern — privileged-but-input-free RPCs are anon-callable +
  idempotent (decision #26).** A daily job whose RPC takes **no caller input**
  (`pronargs = 0`) and only records server-known facts (e.g. `tally_top_dog_day()`
  records the actual current Top Dog's `current_date`) is EXECUTE-granted to `anon` +
  `authenticated` so the keep-alive workflow can call it via PostgREST with the
  **existing publishable key** — no new repo secret. Safe because it's not forgeable
  and is self-limiting (worst case: an early idempotent run — exactly what the cron
  does). Make such jobs idempotent at the DB (`UNIQUE` + `ON CONFLICT DO NOTHING`) and
  recompute denormalized counts **authoritatively from `COUNT(*)`, never a blind
  `+1`**, so re-runs and early triggers can't drift. Wire the workflow step to **fail
  on non-2xx** so a broken job turns red (also protecting the auto-pause guarantee).
  This pattern was reused for the M4 mustard-prune job (TASK-042), but that job is now
  RETIRED (TASK-094 / decision #29 — `mustard_sprays` is append-only); `tally` is the
  only RPC step the keep-alive workflow drives. Reuse the pattern for any future daily
  server-fact job.
- **E2E harness uses the LOCAL stack only, never the hosted `.env`.** Playwright
  tests (`tests/smoke.e2e.ts`, `tests/db-guards.e2e.ts`, `tests/votes.e2e.ts`,
  `tests/tally.e2e.ts`) resolve local creds via `supabase status -o env` through
  `tests/helpers/local-stack.ts`, behind a **non-localhost guardrail** that aborts if
  the resolved URL isn't local — so a run can never hit the hosted project.
  Invite-only sign-up needs an unconsumed invite first, so `tests/global-setup.ts`
  mints one with a local service-role client and hands the token to the spec. Keep the
  service key Node/server-side only — never expose it to the browser context. Run with
  `supabase start` up: `pnpm test:e2e --grep @smoke` (and `--grep @security` for the
  DB write guards). **`playwright.config.ts` is pinned to `workers: 1`:** the
  `@security` suite mutates the **global singleton crown** (`profiles.is_current_top_dog`)
  against the **one shared local Postgres**, so default multi-worker parallelism races
  across spec files. Keep it serialized; if the suite outgrows a single worker,
  isolated per-file DB fixtures are the scaling path (not relaxing `workers`).
- **E2E `img`/link locators MUST scope to page content, not the shell (M8 PR #119).** The
  full-bleed app shell renders `<img>` elements (the brand wordmark, and the champion avatar
  when the champion uses a non-sigil photo) that **PRECEDE page content in the DOM**, so a bare
  `page.locator('img').first()` now resolves to a SHELL image, not the page's. The App Chrome
  rebuild changed `feed-detail.e2e.ts` from `page.locator('img').first()` to `.dog-image img`.
  Future E2E specs on any `/snacktum-snacktorum` page must scope `img`/link locators to the page
  content container, never the document-wide first match.
- **Data API (PostgREST) authz is TWO-layer — a passing RLS policy is NOT enough; the
  role also needs the base table `GRANT`.** `auto_expose_new_tables` is pinned `false` in
  `supabase/config.toml`, so **every new `public` table migration MUST declare its own base
  grants** — never rely on auto-expose to issue them. Declare: `authenticated` SELECT +
  only the writes the table's RLS actually allows (INSERT/DELETE on counter-free cosmetic
  tables like `hotdog_reactions`/`mustard_sprays`/`wall_messages`/`dms`; nothing on
  RPC-only surfaces like `votes`/`top_dog_days`); `service_role` full DML; **`anon`
  nothing**. **Never re-grant a locked column table-wide** — preserve the decision #24/#25
  column-level lockdowns on `profiles`/`hot_dogs`/`dms` (re-granting table-wide INSERT/UPDATE
  would re-open the forge path the lockdown closed). **Symptom if a table forgets its
  grants:** a fresh `supabase db reset` (or a hosted DB whose table was pushed after
  2026-05-30) returns PostgREST `permission denied` / `42501` on a path whose RLS is intact
  — i.e. the path "mysteriously" breaks with no app-code or RLS change. **Why this exists:**
  the Supabase CLI's `auto_expose_new_tables` default flipped `true`→`false` on 2026-05-30,
  so a fresh reset stopped issuing the implicit base grants the schema had silently relied on
  since M0 — `@smoke`/`@security` went red and the real invite path broke (TASK-052/053).
  The platform removes auto-expose entirely after 2026-10-30, so explicit grants are also the
  permanent forward path. The baseline restore lives in
  `supabase/migrations/20260617000000_restore_data_api_grants.sql`; the `@security` guard
  `tests/grants.e2e.ts` asserts the required AND forbidden grant matrix so a future reset
  can't silently re-drift. This is decision #28 — apply it to every future `public` table.
- **Upload-limit enforcement belongs at the DB + Storage API, NOT only the form action —
  and a "size" CHECK does NOT cap real uploaded bytes.** A SvelteKit form-action size/count
  check is only the friendly UX layer; a direct PostgREST insert with the browser
  publishable key bypasses it. Enforce upload limits at the authoritative boundary
  (TASK-070, `20260617195233_upload_limits.sql`): (1) the **bucket
  `file_size_limit`** (set on both `hotdogs` and `avatars`, 2 MiB) is the ONLY layer that
  bounds the **actual uploaded bytes** — a DB CHECK on a client-supplied size column
  (`hot_dogs.byte_size`) only bounds the **declared** value (which feeds the decision #11
  global-sum guard), so it can be understated and is not a byte cap; (2) per-row admission
  caps like the 100-per-user limit (decision #10) are enforced at the DB via a **BEFORE
  INSERT trigger** (`hot_dogs_enforce_per_user_cap()`), NOT an RPC — the hot-dog upload
  writes through plain owner-scoped RLS with no denormalized counter to maintain, so a
  trigger gates admission in place rather than rerouting the write path through an RPC. The
  trigger function gets the standard private-helper lockdown (SECURITY DEFINER,
  `search_path=''`, schema-qualified, `revoke execute … from public, anon, authenticated`).
  Keep the TS-side size literal as a single source of truth (`MAX_UPLOAD_BYTES = 2097152` in
  `src/lib/features/hotdogs/hotdogs.ts`); SQL can't import it, so carry the literal in the
  migration with cross-reference comments both directions + a unit test pinning the value.
  This composes decisions #10/#11/#24 (the column-grant lockdown is preserved, NOT touched);
  no new decision row. Reuse this layering for any future hard upload/quota limit.
- **Local dev (WSL).** `pnpm dev` binds the Vite server **inside WSL**, so a
  **Windows-native browser cannot reach the default bind** — run **`pnpm dev --host`**
  and open `http://localhost:5173` (or the WSL IP) from Windows. **`/sign-in` is now a
  real working login form** (email/password → `signInWithPassword`, M8 TASK-082), so a
  seeded dev login (`dev@topdog.test`, created via the service-role client) is directly
  usable through the UI — or you can still use the **sign-up + invite path** (mint an
  invite at `/snacktum-snacktorum/summon`, redeem via `/sign-up?token=…`). **A `supabase db reset` wipes
  any seeded user** — re-seed, or run `pnpm test:e2e --grep @smoke` (it mints
  `smoke-inviter@topdog.test`). **Forgot/reset password also exist** (M8 TASK-083):
  `/forgot-password` → a **6-digit recovery code** delivered locally to **Mailpit**
  (`http://localhost:54324`) → enter it at `/reset-password` with a new password.
- **App navigation lives in the persistent shell, not a per-page nav (M8 TASK-080; in-app
  prefix renamed to `/snacktum-snacktorum` by TASK-090; feed leaf renamed to `procession` by
  TASK-091; profile leaf renamed to `shrine` by TASK-093; dogs leaf renamed to `litter` by
  TASK-095; messages leaf renamed to `epistles` by TASK-097; invite leaf renamed to `summon` by
  TASK-098; court leaf renamed to `tribunal` by TASK-099; help leaf renamed to `catechism` by
  TASK-100 — ALL in-app leaves are now renamed).**
  `(protected)/snacktum-snacktorum/+layout.svelte` renders the persistent header/nav across
  every `/snacktum-snacktorum` route (🌭 home → The Procession `/snacktum-snacktorum/procession`;
  feed / Your Litter / Epistles / The Catechism; ＋ Upload; a 🍔/☩ Tribunal link **gated on
  the server-derived `is_current_top_dog` crown flag**, decision #25). It reads
  `{ user, profile }` from `(protected)/snacktum-snacktorum/+layout.server.ts` — **don't add
  a second crown query** for nav. The bare `/snacktum-snacktorum` "kennel" hub is **retired**
  (`redirect(307, '/snacktum-snacktorum/procession')`) and `/` redirects to
  `/snacktum-snacktorum/procession` (`src/routes/+page.server.ts`); there is **no inline
  `.app-nav`** anymore (the old hub nav + its CSS were removed). New `/snacktum-snacktorum`
  pages inherit the shell automatically — do not re-add a page-level nav. **Note: TASK-090
  renamed only the `/app` PREFIX → `/snacktum-snacktorum`; the leaf renames ride their own
  per-page rebuilds. Done so far: TASK-091 `feed` → `procession`; TASK-093
  `profile/[handle]` → `shrine/[handle]` (now `/snacktum-snacktorum/shrine/[handle]`);
  TASK-095 `dogs` → `litter` (the whole folder, so `dogs/[id]` → `litter/[id]` rode along
  rename-only — TASK-096 rebuilds The Relic at the already-renamed `litter/[id]`); TASK-097
  `messages` → `epistles` (the whole folder, so `messages/[handle]` → `epistles/[handle]` rode
  along); TASK-098 `invite` → `summon` (the whole folder, `+page.server.ts` byte-identical /
  R100 rename); TASK-099 `court` → `tribunal` (the whole folder, `+page.server.ts`
  byte-identical / R100 rename — the double gate + anonymous flagged-dog aggregate + `rule`
  action untouched); TASK-100 `help` → `catechism` (the whole folder, a STATIC page so there is
  **no `+page.server.ts`** — the move is the markup rebuild + slug change). So **all in-app
  leaves are now renamed** — the complete set is
  `procession`/`shrine`/`litter`/`epistles`/`summon`/`tribunal`/`catechism`, and **no leaf
  remains pre-rename.** (Only TASK-101's brand-new root `+error.svelte` page is left in the
  milestone.)**
- **The app shell is FULL-BLEED — each child band self-caps; not-yet-rebuilt pages MUST
  self-cap or they sprawl to the viewport edge (M8 PR #119, the App Chrome rebuild).** The
  rebuilt `(protected)/snacktum-snacktorum/+layout.svelte` (matched to
  `docs/design/snacktum-snacktorum/pages/App Chrome.dc.html`) makes the nav header AND the "The Anointed Wiener"
  champion sub-bar span the viewport edge-to-edge, content centered at a new token
  **`--measure-shell: 100rem` (1600px)** in `tokens.css` — the chrome content measure, distinct
  from **`--measure-content`** which still caps PAGE content. Implemented via `app.css`
  `.page-container:has(.shell-header) { max-width: none; padding: 0 0 var(--space-3xl) }`,
  **scoped to the app area** (gate pages are untouched — they key off `:has(> .gate-center)`),
  with **no `100vw`** (it uses `scrollbar-gutter: stable` on `html`, which also fixes a
  navigation layout-shift). **‼️ Structural invariant:** because the app container is now
  full-width with zero horizontal padding, **each child band re-supplies its own horizontal
  gutter AND caps its own width** — `.shell-inner` / `.shell-champion-inner` → `--measure-shell`;
  `.shell-content` (page content) → `--measure-content`; mobile `.shell-scroll` →
  `--measure-shell`. **Any future not-yet-rebuilt `/snacktum-snacktorum` page MUST self-cap its
  content (or wrap it in `.shell-content`) or it will sprawl to the viewport edge.** Style
  against the two measures (chrome vs content), never a literal width.
- **The shell champion sub-bar reads `getCurrentChampion`; the layout load returns
  `{ user, profile, champion }` (M8 PR #119).** `getCurrentChampion(supabase)` in
  `src/lib/features/profiles/profiles.ts` is a read-only `profiles` SELECT
  (`is_current_top_dog = true`, `maybeSingle()`) on the **RLS-scoped** client
  (`event.locals.supabase`); `(protected)/snacktum-snacktorum/+layout.server.ts` surfaces it as
  `champion`. It **degrades to `champion: null` on an empty throne / error, AFTER the
  profile-funnel guard** — a champion failure never breaks the `!profile → /sign-up` funnel.
  `is_current_top_dog` is non-client-writable (decision #25) and public, so there is **no
  decision #27 anonymity concern, no service client, and no write path**. **Don't add a second
  crown query** for the champion sub-bar — read `champion` from the layout load (the same way
  the nav's crown-gated Tribunal link reads `profile.is_current_top_dog`).
- **`TopDogPrivilegesNotice` was RETIRED (M8 TASK-080).** The TASK-074 crown-holder
  nudge component, its `topDogPrivilegesNotice.ts` helper, and its tests were deleted
  when the `/snacktum-snacktorum` hub it rendered on was retired — Top Dog powers are
  documented in **The Catechism** (`/snacktum-snacktorum/help`) and the crown-gated Tribunal
  nav link covers adjudication. Don't reference or re-introduce it.
- **Brand assets live in `src/lib/assets/` and `static/` (M8 PR #107; gate-page wiring
  changed by TASK-092).** Brand marks live under `src/lib/assets/brand/`; the 5 avatar
  sigils under `src/lib/assets/sigils/*.svg`. **The four auth/gate pages (`/sign-up`,
  `/sign-in`, `/forgot-password`, `/reset-password`) now render `ordo-sancti-tubi-seal.svg`
  (the `.gate-mark`, 15rem) + `snacktum-snacktorum-header.svg` (the `.gate-header`
  wordmark)** via shared `.gate-mark`/`.gate-header` in `app.css`. So as of TASK-092:
  `snacktum-snacktorum-header.svg` is **WIRED**, and **`the-holy-tube.svg` is now
  ORPHANED in app code** (only in `docs/design/snacktum-snacktorum/` mockups). **As of the App Chrome rebuild (PR #119)
  the wordmark `snacktum-snacktorum-header.svg` is ALSO the app-shell brand** — the user kept
  the wordmark image rather than the mockup's holy-tube-icon+text lockup, so the wordmark is now
  used in BOTH the auth gates AND the app shell; `the-holy-tube.svg` stays orphaned. The 5 sigil
  SVGs are **inlined by `Sigil.svelte`** (the component ports the art verbatim — it does NOT
  import the asset files), so the `assets/sigils/*.svg` files themselves are effectively
  unreferenced. **Favicons live in `static/`** (`favicon.svg` + `favicon-32/64.png` +
  `apple-touch-icon.png`), wired via `<link>`s in `src/routes/+layout.svelte`. DW-031 tracks the
  remaining orphans (brand-logo SVGs, `the-holy-tube.svg`, the now-inlined sigil files) — wire or
  prune, don't assume they're dead.
- **Onboarding-rite control flow: `createProfile` RETURNS, it does NOT redirect; advance
  the client WITHOUT re-running `load` (M8 TASK-092, `/sign-up`).** The `/sign-up` rite
  (Summoned → Inscribe → Choose Thy Sigil → Renounce → Received) forges the profile at the
  **Sigil** step via a `createProfile` action that returns `{ created, handle }` rather
  than `throw redirect`. The client then advances Sigil→Renounce→Received from local
  `$state` **without re-running `load` / without `invalidateAll`** — on purpose: the rite's
  `load` `throw redirect`s a profile-bearing member out of the rite, so re-running it after
  the profile exists would skip the Renounce oath and the Received step. **Renounce is a
  pure-UI oath** gated only on the sworn state (no session check there); the explicit
  "Enter →" on Received is the single deliberate navigation into the app. A `createProfile`
  failure recovers in place on the Sigil step. **Don't "fix" this by making `createProfile`
  redirect or by adding an `invalidate` after it** — that reintroduces the load-redirect
  that swallows the oath/Received. (A session-less hit at the Sigil step currently
  dead-ends with `fail(401)` and no in-rite recovery — DW-033.)
- **Autofill inputs are kept on-theme via STACKED inset `box-shadow`s (M8, `src/app.css`).**
  Browsers paint `:-webkit-autofill` / `:autofill` with a solid white/yellow UA background
  that ignores `background-color`. The fix layers **two** inset shadows: an **opaque
  `--color-bg` base** plus the translucent `--accent-fill` tint, with
  `-webkit-text-fill-color: var(--color-text)` (plain `color` is ignored on autofill) and
  `font-family: var(--font-body)`. **The opaque base layer is load-bearing** — `--accent-fill`
  is ~5% alpha, so a single translucent-mask shadow lets the UA's white autofill background
  bleed through on commit. Keep both layers when restyling any future autofilled input.
  Use [[wikilinks]] when cross-referencing project docs.
