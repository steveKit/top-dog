# Handoff 002 — 2026-06-08

## Session Summary

Executed and **closed Milestone M0 — Scaffold & Infra** end to end, then did a
real going-live against hosted Supabase. All work is merged to `main` — **no
PRs open**; **11 PRs merged this session (#1–#11)**. Stale-task audit: none (no
`[in_progress]` tasks). The project is now **ready to begin M1 (vertical slice)**.

- **Branch:** `main` (all work merged).
- **PR status:** none open. Merged #1–#11:
  - #1 TASK-001 SSR Supabase client + auth hooks · #2 its bookkeeping
  - #3 TASK-003 RLS baseline migration + storage buckets · #4 its bookkeeping
  - #5 TASK-002 storage module (swappable seam) · #6 its bookkeeping +
    prettier-drift cleanup
  - #7 TASK-005 global storage guard (TDD) · #8 its bookkeeping
  - #9 fix(db): schema-qualify citext for hosted search_path (going-live hotfix)
  - #10 docs: README Deployment guide
  - #11 chore: close Milestone M0 bookkeeping
- **Going-live:** hosted Supabase project created; schema pushed
  (`supabase db push`); repo secrets `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`
  set; keep-alive workflow re-enabled and **verified HTTP 200** (daily run resets
  the 7-day auto-pause timer).
- **Tag:** `milestone-00-scaffold-infra`.

## Key Decisions

Lasting-impact context (architecture decisions are in [[PROJECT]]):

1. **Going-live completed.** The hosted project relies on RLS + the Data API
   "auto-expose new tables" setting being enabled — the keep-alive anon query
   returns 200 because of it. **If auto-expose is ever disabled, future
   migrations will need explicit table `GRANT`s.**
2. **Hosted/local migration parity (PR #9).** Extension-provided types must be
   schema-qualified in migrations (`extensions.citext`, not bare `citext`) —
   the local migration role has `extensions` in its `search_path`, the hosted
   role does not. Captured as a [[CLAUDE]] gotcha and in the README migration
   guide; applies to all future migrations (invites, hot_dogs, vote RPC).
3. **M0 foundational-orphan exception (user-approved).** The M0 wiring audit
   flagged `getServiceClient`, the `$lib/storage` module, and `evaluateUpload`
   as having no non-test consumers yet. Accepted as foundational seams with
   dependency-declared M1 consumers (TASK-011 avatars, TASK-013 upload + guard
   wiring, server-side privileged ops). Documented in [[PROJECT]] M0 close notes.
4. **Bookkeeping-via-chore-branch workflow.** The pre-tool-safety hook blocks
   direct commits/pushes to `main`, so all bookkeeping this session was routed
   through short-lived `chore/*` branches + `gh pr merge --squash` (server-side
   merge succeeds; local main commit is blocked). The next director session will
   hit the same constraint — recorded in `memory/MEMORY.md`.

## Files Changed

New:

- `src/hooks.server.ts` (+test) — per-request SSR Supabase client + auth guard;
  `safeGetSession()` validates the JWT via `getUser()`
- `src/lib/server/supabase.ts` — server-only secret-key client (`getServiceClient`)
- `src/lib/supabase/env.ts` (+test) — boundary env validation
  (`getPublicSupabaseConfig` over `$env/dynamic/*`)
- `src/lib/storage/{index,paths,guard}.ts` (+tests) — swappable storage seam
  (`upload`/`getSignedUrl`/`getPublicUrl`/`remove`, `hotdogPath`/`avatarPath`)
  and the global storage guard (`evaluateUpload`)
- `src/routes/+layout.server.ts`, `src/routes/+layout.ts` — root session load
- `src/routes/(protected)/app/{+layout.server.ts,+page.svelte,layout-guard.test.ts}`
  — protected-route group + guard
- `src/routes/sign-in/+page.svelte` — sign-in page
- `supabase/migrations/20260608153759_rls_baseline_and_storage_buckets.sql` —
  RLS baseline + `hotdogs`/`avatars` buckets (schema-qualified `extensions.citext`)

Modified:

- `src/app.d.ts` — `App.Locals` types (supabase, session, `safeGetSession`)
- `CLAUDE.md` — citext gotcha; Project Map latest-handoff pointer → handoff-002
- `PROJECT.md` — M0 marked complete + close notes; ready-for-M1 status
- `README.md` — Deployment guide (going-live + migration parity lesson)
- `TASKS.md` — M0 tasks moved to Completed; milestone tag recorded
- `.claude/settings.json` — build/quality + git allow-list tweaks

## Next Steps

Milestone **M1 — Vertical Slice** (invite → profile → upload → see dog + smoke):

1. **P0 — TASK-010** (invite generation + redemption; deps TASK-001/003 ✅) —
   unblocked.
2. **P0 — TASK-012** (client-side WebP compression; no deps) — unblocked; can
   run parallel to TASK-010 (disjoint files).
3. **TASK-011** (profile creation; deps TASK-010) — first real consumer of the
   storage module (avatars).
4. **TASK-013** (hot dog upload + display; deps TASK-002/005/011/012) — wires the
   storage seam + guard and re-exports the guard from the `$lib/storage` barrel,
   closing the M0 foundational orphans.
5. **TASK-014** (`@smoke` vertical-slice Playwright test) — must stay green
   through all later milestones.

Reference [[TASKS]] for the full queue context.

## Files to Read on Resume

- [[PROJECT]] — M0 close notes, architecture decisions, data model, milestones
- [[TASKS]] — work queue (start with TASK-010 / TASK-012)
- [[CLAUDE]] — stack, commands, conventions, gotchas (incl. citext)
- `src/lib/storage/index.ts` — the swappable storage seam M1 wires into
- `supabase/migrations/20260608153759_rls_baseline_and_storage_buckets.sql` —
  schema baseline + the schema-qualified-citext lesson
- `README.md` (Deployment section) — going-live + migration steps
