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
- [[TASKS]] — work queue with priorities and acceptance criteria
- [[README]] — setup, usage, contributing
- [[Handoffs/]] — session continuity directory (latest: [[Handoffs/handoff-001]])

## Commands

```bash
# Install tool versions (mise: node, pnpm, supabase)
mise install

# Install dependencies
pnpm install

# Start local Supabase stack (Docker: Postgres + Auth + Storage + Studio)
supabase start
# Stop it
supabase stop
# Apply / create migrations
supabase migration new <name>
supabase db reset            # re-apply all migrations to local DB

# Run development server
pnpm dev

# Run tests (CI mode — no watch)
pnpm test                    # vitest run
pnpm test:e2e                # playwright test

# Run linter
pnpm lint                    # eslint + prettier --check

# Run type checker
pnpm check                   # svelte-check

# Smoke test (end-to-end vertical slice: invite -> profile -> upload -> see dog)
pnpm test:e2e --grep @smoke

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
│   │   │   ├── voting/        # pure ranking/tie-break logic + RPC wrappers (TDD)
│   │   │   ├── reactions/  mustard/  walls/  dms/
│   │   │   └── emoji/         # render-time filter + sprinkle (TDD)
│   │   └── components/        # shared Svelte components
│   └── routes/                # SvelteKit routes (+page, +layout, +server)
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
  transaction — never write it from the client.
- **Mustard + emoji are render-time computations** — the DB stores raw timestamps
  and original text; never persist the decayed/filtered output.
- **7-day auto-pause:** the keep-alive workflow must stay green or the hosted DB
  pauses. Use [[wikilinks]] when cross-referencing project docs.
