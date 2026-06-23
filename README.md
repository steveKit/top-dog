# Top Dog 🌭

Invite-only social app for showing off homemade hot dogs. Upload your dogs, cast
a single movable vote for the best one (not your own), and compete for **Top
Dog** status — earn the badge and spray decaying mustard on rivals' profiles.

See [CLAUDE.md](./CLAUDE.md) for conventions, [PROJECT.md](./PROJECT.md) for
architecture decisions, and [TASKS.md](./TASKS.md) for the work queue.

## Features

The end-to-end slice, the full voting engine, the mustard mechanic, the social
surfaces (walls + DMs), hot-dog emoji rendering, and the 🍔 Hamburger Court are in
place and demoable:

- **Invite-only sign-up** — an existing member mints a single-use invite link;
  the public sign-up flow redeems it (used/invalid tokens are rejected).
- **Profiles** — onboarding sets a unique `@handle` and an optional avatar; the
  profile page shows handle, join date, and stats.
- **Hot dog upload + display** — photos are compressed to WebP client-side and
  uploaded to a private bucket (per-user cap + global storage guard), then
  rendered via a signed URL; deleting a dog removes both the row and the object.
- **Voting & Top Dog crown** — the global feed at `/snacktum-snacktorum/procession` lists other
  members' dogs (sorted by vote count, so it doubles as the live leaderboard);
  cast a single movable vote, move it, or remove it. Votes drive the **Top Dog**
  crown (sticky tie-break), a daily reign tally, and the Top Dog badge.
- **Reactions** — drop cosmetic hot-dog emoji reactions on a dog in the feed
  (many distinct emojis per user, toggleable). Reactions are flair only — they
  never affect a dog's vote count or the Top Dog ranking.
- **Per-dog stats + detail view** — each dog has a detail page at
  `/snacktum-snacktorum/litter/[id]` showing the full image, owner, current and **peak** votes, and
  its reactions; feed/gallery tiles show a per-tile peak-votes indicator.
- **Mustard** — the current Top Dog (and only the Top Dog) can Anoint
  another member's profile with mustard. The drip overlay **fades over ~6h** — its
  opacity is computed at render time from the stored timestamp — but the spray rows
  themselves **persist** (the table is append-only), so each Anointing leaves a
  lasting wall notice even after the splat fades. Spraying is cosmetic only: it
  never affects votes or the Top Dog ranking.
- **Message walls** — post a message to any member's profile wall; the wall owner
  or the message author can delete it. Walls are cosmetic only — they never affect
  votes or ranking.
- **Direct messages** — send a private DM to another member at `/snacktum-snacktorum/epistles`; the
  inbox shows your conversations (with unread counts) and each thread lets you read
  and reply. Only the two participants can read a conversation.
- **Hot-dog emoji rendering** — wall messages and DMs are filtered at render time so
  every emoji becomes a hot-dog-themed one, and wall messages get a deterministic
  random hot-dog sprinkle. The original message text is always stored unchanged — the
  transform is purely cosmetic and applied only when rendering.
- **🍔 Hamburger Court** — report another member's dog as a hamburger; enough fresh
  reports trip a render-time **HAMBURGER ALARM** banner across the image (reporters
  stay anonymous). The current Top Dog adjudicates at `/snacktum-snacktorum/tribunal`: a "not a hamburger"
  verdict brands the reporters **HAMBURGER LIAR** (fades over ~7 days), a "confirmed
  hamburger" verdict brands the uploader a persistent **HAMBURGER HERETIC**. Reporting
  and verdicts are cosmetic only — they never affect votes or the Top Dog ranking.
- **Upload limits** — hot-dog and avatar uploads are hard-capped server-side (2 MiB
  per file at the Storage API, 100 hot dogs per member, plus a global storage guard),
  so the limits hold even against a direct API call, not just the upload form.
- **In-app help** — a static "How Top Dog works" page at `/snacktum-snacktorum/help` explains the
  mechanics (with the vote system emphasized) for anyone who needs a refresher.

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

### Running the smoke test

The `@smoke` Playwright test drives the full M1 slice (redeem invite → set handle
→ upload a dog → see it rendered) plus the feed cast/move/remove + reaction toggle
and the `/snacktum-snacktorum/litter/[id]` detail render, against the **local** Supabase stack. With
the stack running:

```sh
supabase start                  # if not already up
supabase db reset               # clean slate — see precondition below
pnpm test:e2e --grep @smoke
```

> **Precondition — reset the DB first.** Some E2E specs use pinned fixture ids,
> so a dirty local DB can cause collisions (e.g. a `hot_dogs_pkey` duplicate).
> Run `supabase db reset` before the `@smoke`/`@security` suites for a
> deterministic run.

The test harness bootstraps its own invite and reads local credentials from
`supabase status` — it never touches a hosted project or your `.env`. A sibling
`@security` suite asserts the DB-level write guards (forged-counter,
oversized-caption, RLS, and column-grant violations are rejected); run it with
`pnpm test:e2e --grep @security`.

### Testing the password-recovery flow locally

Recovery uses a **6-digit OTP code** (not a magic link). With the local stack up and
the dev server running:

1. Go to `/forgot-password` and submit the account's email (the page always returns the
   same neutral message, whether or not the email exists).
2. Open **Mailpit** at <http://localhost:54324> and read the **6-digit code** from the
   "recovery rite" email. It is code-only — `supabase/config.toml` sets `otp_length = 6`
   and points the recovery template at `supabase/templates/recovery.html`. (Supabase's
   default email sends a link, so this template must be present — and the same template
   must be set on the hosted project, via the dashboard or `supabase config push`, or
   production will send a link instead of a code.)
3. Go to `/reset-password`, enter the code plus a new password (at least 8 characters,
   confirmed) to set it.

A `supabase db reset` wipes any seeded/test user, so re-seed or re-redeem an invite first.

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
[`keepalive.yml`](./.github/workflows/keepalive.yml) GitHub Action runs two
idempotent steps against the hosted DB, all with the publishable key (the two
repo secrets from step 5 — no service key in CI):

1. **Ping** — a tiny read against `profiles` to reset the 7-day auto-pause timer.
2. **Tally Top Dog day** — `tally_top_dog_day()` records today for the current
   Top Dog and recomputes `days_as_top_dog`.

> A mustard-prune step ran here until M8: `mustard_sprays` is now append-only
> (the spray rows persist as lasting wall notices; only the drip overlay fades
> at render), so `prune_mustard_sprays()` is retired and the prune step is gone.

Step 2 is an anon-callable, no-input, idempotent RPC and fails the
workflow on a non-2xx response, so a broken job turns the run red.

> **Push migrations to hosted per-milestone.** The tally step calls an
> RPC added by a migration. If a migration hasn't been `supabase db push`ed to
> the hosted project, its RPC returns a PostgREST 404 and the workflow turns red
> (the `ping` step still keeps the DB alive). Run `supabase db push` when a
> milestone's migrations land — not just at going-live.

### Hosting the app

The project currently uses `@sveltejs/adapter-auto`. To deploy:

1. Pick a host (Vercel / Netlify / Cloudflare / Node).
2. Set the three env vars above in that host's settings.

> **`adapter-node` caveat:** self-hosting with the Node adapter needs an
> `ORIGIN` env var in prod so SvelteKit's form-action CSRF protection works.

No host is chosen yet — treat this section as forward-looking.

## License

UNLICENSED — private project.
