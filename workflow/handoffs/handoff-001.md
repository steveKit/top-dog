# Handoff 001 — 2026-06-05

## Session Summary

Plenary planning session for **Top Dog** 🌭 (invite-only homemade hot dog social
app). Resumed from a partial director-run plenary (`PLENARY-DECISIONS.md`) and
formalized the full blueprint: verified the stack against current docs, ran an
adversarial review, finalized architecture + data model, produced all planning
artifacts, scaffolded the project, and published the repo.

- **Repo:** https://github.com/steveKit/top-dog (public)
- **Branch:** `main` published (commit `01216e9`); now on `feat/m0-ssr-auth`
  (empty — ready for TASK-001). No PRs yet.
- **Plenary:** complete. See [[PROJECT]] for the 21 architecture decisions and
  5 accepted risks; [[TASKS]] for the M0–M7 queue (~30 tasks).

## Key Decisions

All recorded in [[PROJECT]] Architecture Decisions. Highlights:

- **Emoji handling → filter at render** (overrode the earlier "on store"
  decision; adversarial finding F — render-time filtering is reversible and
  never corrupts stored user text).
- **Stack:** SvelteKit 2.63 + Svelte 5.56 (runes) + Supabase (Postgres/Auth/
  Storage/RLS) + Vitest/Playwright; pnpm + Node 24.16.0 via mise.
- **Local dev:** Supabase CLI local stack (`supabase start`), not hand-written
  docker-compose (convention override recorded in [[CLAUDE]]).
- **Competitive integrity:** votes/crown/counters via transactional Postgres
  RPCs; denormalized `vote_count` never client-writable.
- **mise pnpm via `npm:` backend** — the aqua backend has a broken asset map and
  the ubi backend resolves to a musl build that won't run on this glibc host.

## Files Changed

Initial commit `01216e9` (36 files). Notable:

- `PROJECT.md` / `CLAUDE.md` / `TASKS.md` — plenary blueprint, conventions, queue
- `security-profile.yaml` — L2 profile
- `.mise.toml` — node 24.16.0, pnpm 11.5.2 (npm backend), supabase 2.105.0
- `.env.example` — required env vars (publishable/secret keys)
- `.github/workflows/keepalive.yml` — 7-day auto-pause mitigation
- `.claude/agents/{sveltekit-implementer,supabase-architect}.md` — tech agents
- `.claude/settings.json` — build/quality tool allow-list
- `supabase/config.toml` + `supabase/migrations/.gitkeep` — Supabase init
- SvelteKit scaffold (`src/`, `svelte.config.js`, `vite.config.ts`, configs)

## Next Steps

1. **P0 — TASK-001** (SSR Supabase client + auth hooks) on `feat/m0-ssr-auth`.
   Needs the local stack: `supabase start` then `supabase db reset`, and `.env`
   filled from the printed local keys.
2. **P0 — TASK-003** (RLS baseline migration + buckets) — can parallel TASK-002.
3. **P1 — TASK-002** (swappable storage module), **TASK-005** (global storage
   guard), **TASK-004** (keep-alive secrets).
4. Then **M1 vertical slice** (TASK-010 → TASK-014): invite → profile → upload →
   see dog + `@smoke` test. Keep this green through all later milestones.

Reference [[TASKS]] for the full queue.

## Files to Read on Resume

- [[PROJECT]] — architecture decisions, data model, accepted risks, milestones
- [[TASKS]] — work queue (start with TASK-001)
- [[CLAUDE]] — stack, commands, conventions, gotchas
- `.claude/agents/sveltekit-implementer.md` — SvelteKit/Supabase coding rules

## Environment Notes (for resume)

- Run `mise install` if tools aren't active. `pnpm` only works via mise
  (system `pnpm` is a broken Windows Volta shim) — use `mise exec -- pnpm ...`
  or ensure mise is activated in the shell.
- Local Supabase needs Docker running (confirmed working this session).
- LSP: not installed. Install `typescript-language-server` +
  `svelte-language-server` + the TS Claude plugin to enable code intelligence.
- Going live: create the supabase.com project, `supabase link` + `db push`, set
  repo secrets `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`.
