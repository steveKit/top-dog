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

## Deployment

### Environments

Dev and prod are fully separate, each backed by its **own Supabase project**:

| Environment | Supabase project                                       | Config source                                              |
| ----------- | ------------------------------------------------------ | ---------------------------------------------------------- |
| **Dev**     | Local stack (`supabase start`, Docker)                 | Local gitignored `.env` (values from `supabase status`)    |
| **Prod**    | Hosted project on [supabase.com](https://supabase.com) | Deploy host's env-var settings (not committed to any file) |

### Environment variables

The app reads exactly three variables. Use the **new** key format
(`sb_publishable_*` / `sb_secret_*`) — legacy anon/service_role keys deprecate
end-2026 (decision #5).

| Variable                          | Purpose                                                                                                                   | Dev source                                          | Prod source                | Lives in                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------- | ------------------------------------ |
| `PUBLIC_SUPABASE_URL`             | Supabase API base URL (browser-exposed)                                                                                   | `supabase status` (local: `http://127.0.0.1:54321`) | Dashboard → Settings → API | Local `.env` (dev) / host env (prod) |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable client key, `sb_publishable_*` (browser-exposed)                                                              | `supabase status`                                   | Dashboard → Settings → API | Local `.env` (dev) / host env (prod) |
| `SUPABASE_SECRET_KEY`             | Secret server key, `sb_secret_*` — **server-only**, used only in `$lib/server`; never `PUBLIC_`-prefixed, never committed | `supabase status`                                   | Dashboard → Settings → API | Local `.env` (dev) / host env (prod) |

### Database migrations (dev → prod promotion)

Migrations live in [`supabase/migrations/`](./supabase/migrations/).

1. Test locally: `supabase db reset` re-applies every migration to the local DB.
2. Promote to hosted: `supabase db push` applies pending migrations to the
   linked project.

> **Gotcha — schema-qualify extension types.** Reference extension-provided
> types with their schema (e.g. `extensions.citext`, not bare `citext`). The
> local migration role has `extensions` in its `search_path` but the hosted
> role does not, so an unqualified reference passes `supabase db reset` locally
> yet fails `supabase db push` on hosted with `type "x" does not exist`.

### Going live (checklist)

1. Create the hosted project at [supabase.com](https://supabase.com) (free tier).
2. `supabase login`
3. `supabase link --project-ref <ref>` (or run `supabase link` interactively).
4. `supabase db push` to apply migrations to the hosted DB.
5. Set the two GitHub **repo secrets** `SUPABASE_URL` and
   `SUPABASE_PUBLISHABLE_KEY` for the keep-alive Action — these are the public
   URL + publishable key only, **never** the secret key.
6. When the auth/invite flows land in M1, configure Supabase **Auth → URL
   Configuration** (Site URL + Redirect URLs) for the deployed origin.
7. Re-enable the keep-alive workflow
   (`gh workflow enable "Supabase keep-alive"`) and confirm a green run.

### Keep-alive

Free-tier projects auto-pause after 7 days of no DB activity. The daily
[`keepalive.yml`](./.github/workflows/keepalive.yml) GitHub Action pings the
hosted DB to prevent that. It needs the two repo secrets from step 5.

### Hosting the app

The project currently uses `@sveltejs/adapter-auto`. To deploy:

1. Pick a host (Vercel / Netlify / Cloudflare / Node).
2. Set the three env vars above in that host's settings.

> **`adapter-node` caveat:** self-hosting with the Node adapter needs an
> `ORIGIN` env var in prod so SvelteKit's form-action CSRF protection works.

No host is chosen yet — treat this section as forward-looking.

## License

UNLICENSED — private project.
