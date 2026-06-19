# Top Dog

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
- [[Handoffs/]] — session continuity directory (latest: [[Handoffs/handoff-016]])

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
│   └── keepalive.yml          # daily keep-alive + Top Dog tally + mustard prune
├── supabase/
│   ├── config.toml
│   └── migrations/            # SQL migrations (schema + RLS + RPC functions)
├── src/
│   ├── hooks.server.ts        # per-request @supabase/ssr client, auth guard
│   ├── app.d.ts               # App.Locals types (supabase, session)
│   ├── lib/
│   │   ├── supabase/          # browser client factory
│   │   ├── server/            # server-only secret-key client
│   │   ├── storage/           # SWAPPABLE storage module (hotdogs/avatars)
│   │   ├── features/          # one folder per domain
│   │   │   ├── auth/  invites/  profiles/  hotdogs/
│   │   │   ├── voting/        # pure ranking/tie-break logic + vote RPC wrappers + feed/leaderboard queries
│   │   │   ├── reactions/  mustard/  walls/  dms/
│   │   │   └── emoji/         # render-time filter + sprinkle (TDD)
│   │   ├── styles/            # tokens.css — CSS-custom-property theme layer (M8)
│   │   └── components/        # shared Svelte components
│   └── routes/                # SvelteKit routes (+page, +layout, +server)
│       └── (protected)/app/+layout.svelte  # persistent app shell + nav (M8 TASK-080)
├── static/
│   └── fonts/                 # self-hosted SIL OFL .woff2 (Cinzel, Cormorant) + OFL licenses
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
  additionally restricted to a privileged actor (e.g. only the current Top Dog may
  spray mustard — `mustard_sprays`, TASK-041), DO NOT reach for a SECURITY DEFINER
  RPC. Keep the plain owner-scoped RLS write and add the authorization as a second
  INSERT `WITH CHECK` conjunct: pin the actor (`sprayer_id = (select auth.uid())`,
  so it can't be forged) AND gate on a privilege column via an EXISTS
  (`exists (select 1 from profiles p where p.id = (select auth.uid()) and
p.is_current_top_dog)`). **This is trustworthy ONLY because the gate column is
  itself non-client-writable** (the crown columns, decision #25) — a member cannot
  set their own crown to self-satisfy the check. If the gate column WERE
  client-writable, the predicate would be self-forgeable and the gate worthless, so
  this pattern presupposes the decision #24/#25 column-grant lockdown on whatever
  column the gate reads. Pair with NO UPDATE/DELETE policy when the rows are meant to
  be immutable/persistent (mustard sprays persist across crown changes per decision
  #15; removal is reserved for a separate prune job). This is decisions #12/#15/#25
  composed, not a new architecture decision — reuse the shape for any future
  privileged-flair surface (e.g. an M5 "only the Top Dog may …" write).
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
- **Mustard + emoji are render-time computations** — the DB stores raw timestamps
  and original text; never persist the decayed/filtered output.
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
  private-bucket content** (the `/app/feed` and `/app/dogs/[id]` loads, which show
  OTHER members' dogs) MUST mint signed URLs **server-side with the service client**
  (`$lib/server` `getServiceClient()`), constructed **AFTER** the `safeGetSession()`
  gate, signing only `image_path` from rows the member's own RLS query already
  returned (no exposure widening). Keep the dog/owner/reaction QUERIES on the
  RLS-scoped client — only the storage signing uses the service client; the
  `/app/dogs` own-dogs gallery correctly stays fully on the RLS client. This
  preserves decision #6 (bucket private, 1h TTL signed URLs, service client
  server-only) with no storage RLS / bucket change. (Caught as a P0 in TASK-033 —
  the storage-baseline migration comment claiming "signed URL bypasses RLS" was
  wrong about the creation side.) Applies to any future cross-member view of
  private-bucket content.
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
  **Two distinct red-workflow failure modes, diagnosed by which STEP fails:** (1) the
  `ping` step itself fails → reachability/secrets — re-check the two repo secrets
  first; (2) `ping` passes but a later RPC step (`tally`, future `prune`) returns a
  PostgREST **404** → **hosted schema drift**: that RPC's migration was never
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
  Reuse this pattern for the M4 mustard-prune job (TASK-042).
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
  and open `http://localhost:5173` (or the WSL IP) from Windows. **`/sign-in` is
  currently a non-functional stub** (no form, no action — TASK-082 builds it in M8), so
  there is **no working login UI yet**: to get into the app locally, use the \*\*sign-up
  - invite path** (mint an invite at `/app/invite`, redeem via `/sign-up?token=…`). A
    seeded dev login (`dev@topdog.test`) created via the service-role client becomes
    directly usable **once sign-in is built**; **a `supabase db reset` wipes any seeded
    user** — re-seed, or run `pnpm test:e2e --grep @smoke` (it mints
    `smoke-inviter@topdog.test`). Password-recovery (reset) emails land in **Mailpit\*\*
    (`http://localhost:54324`).
- **App navigation lives in the persistent shell, not a per-page nav (M8 TASK-080).**
  `(protected)/app/+layout.svelte` renders the persistent header/nav across every
  `/app` route (🌭 home → The Procession `/app/feed`; feed / Your Litter / Epistles /
  The Catechism; ＋ Upload; a 🍔/☩ Tribunal link **gated on the server-derived
  `is_current_top_dog` crown flag**, decision #25). It reads `{ user, profile }` from
  `(protected)/app/+layout.server.ts` — **don't add a second crown query** for nav. The
  bare `/app` "kennel" hub is **retired** (`redirect(307, '/app/feed')`) and `/`
  redirects to `/app/feed` (`src/routes/+page.server.ts`); there is **no inline
  `.app-nav`** anymore (the old hub nav + its CSS were removed). New `/app` pages
  inherit the shell automatically — do not re-add a page-level nav.
- **`TopDogPrivilegesNotice` was RETIRED (M8 TASK-080).** The TASK-074 crown-holder
  nudge component, its `topDogPrivilegesNotice.ts` helper, and its tests were deleted
  when the `/app` hub it rendered on was retired — Top Dog powers are documented in **The
  Catechism** (`/app/help`) and the crown-gated Tribunal nav link covers adjudication.
  Don't reference or re-introduce it.
  Use [[wikilinks]] when cross-referencing project docs.
