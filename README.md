# Top Dog 🌭

Invite-only social app for showing off homemade hot dogs. Upload your dogs, cast
a single movable vote for the best one (not your own), and compete for **Top
Dog** status — earn the badge and spray decaying mustard on rivals' profiles.

See [CLAUDE.md](./CLAUDE.md) for conventions, [PROJECT.md](./PROJECT.md) for
architecture decisions, and [TASKS.md](./TASKS.md) for the work queue.

## Stack

- **SvelteKit 2** + **Svelte 5** (runes), TypeScript
- **Supabase** — Postgres + Auth + Storage + RLS (local stack via Supabase CLI)
- **Vitest** (unit) + **Playwright** (E2E/smoke)
- **pnpm** + **mise** (pinned toolchain)

## Prerequisites

- [mise](https://mise.jdx.dev/) (manages node, pnpm, supabase versions)
- Docker (running) — required for the local Supabase stack

## Setup

```sh
# 1. Install pinned tool versions (node, pnpm, supabase)
mise install

# 2. Install dependencies
pnpm install

# 3. Copy env template and fill in values (local values come from `supabase start`)
cp .env.example .env

# 4. Start the local Supabase stack (Postgres + Auth + Storage + Studio)
supabase start

# 5. Apply migrations to the local DB
supabase db reset

# 6. Run the dev server
pnpm dev
```

`supabase start` prints your local API URL and keys — copy them into `.env`.

## Commands

| Command                       | Description                     |
| ----------------------------- | ------------------------------- |
| `pnpm dev`                    | Dev server                      |
| `pnpm build`                  | Production build                |
| `pnpm test`                   | Unit tests (Vitest, CI mode)    |
| `pnpm test:e2e`               | E2E tests (Playwright)          |
| `pnpm test:e2e --grep @smoke` | Vertical-slice smoke test       |
| `pnpm lint`                   | Prettier check + ESLint         |
| `pnpm check`                  | Type check (svelte-check)       |
| `supabase start` / `stop`     | Local Supabase stack            |
| `supabase migration new <n>`  | New migration                   |
| `supabase db reset`           | Re-apply all migrations locally |

## Deploying to hosted Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier)
2. `supabase link --project-ref <ref>`
3. `supabase db push` to apply migrations
4. Copy the publishable + secret keys (Settings → API) into your deploy env

### CI keep-alive

Free-tier projects auto-pause after 7 days of no DB activity. The
[`keepalive.yml`](./.github/workflows/keepalive.yml) workflow pings the DB
daily. Set repo secrets `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for it to
run.

## License

UNLICENSED — private project.
