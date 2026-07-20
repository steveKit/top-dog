# Handoff 013 — 2026-06-17

> **CLEAN SESSION END.** No PR is open — every PR this session merged.
> Milestone **M5 — Walls & DMs is CLOSED and tagged** (`milestone-05-walls-dms`,
> commit `d43519a`). The stale-task audit is clean (no `[in_progress]` tasks).
> One user-gated ops follow-up (**TASK-054**, hosted migration push) is parked in
> [[workflow/tasks/deferred]] — walls & DMs do NOT work on hosted until it runs.

## Session Summary

Continued and **closed Milestone M5 — Walls & DMs**
([[workflow/tasks/milestone-05-walls-dms]]). The session opened by merging the open
TASK-051 gate carried over from [[workflow/handoffs/handoff-012]], then absorbed a
project-wide Data API grant regression as two follow-on tasks, and finished with
the milestone close + tag. Branch: `main`. **No PR is open.**

What landed (merged PRs, in order):

- **PR #64 `chore(dev)`** — durable dev-stack auto-restart removal. The Supabase
  CLI re-applies a hardcoded `restart: unless-stopped` on every `supabase start`
  (config.toml has no knob for it), so a new `scripts/db-start.sh` wraps
  `supabase start` and strips that policy afterward. Exposed as `pnpm db:start`
  and documented as the **canonical dev-stack startup** in [[CLAUDE]] § Commands.
  (User's first request this session.)
- **PR #62 `feat(dms)`** — **TASK-051 Direct messages** (the open gate from
  handoff-012). Adds the `dms` table (privacy RLS: SELECT sender-or-recipient,
  INSERT sender-pinned, UPDATE recipient-only via the decision #24 column-grant
  mechanism on `read_at`, no DELETE), `src/lib/features/dms/` (`dms.ts` +
  pure `summarizeConversations`), and the `/app/messages` inbox + `[handle]`
  thread routes. Built on decision #12 (cosmetic / no-counter table → plain
  owner-scoped RLS, not an RPC).
- **PR #66 `fix(db)`** — **TASK-052**, restore Data API base grants. The Supabase
  CLI's `auto_expose_new_tables` default flipped to `false` (2026-05-30), so a
  fresh `supabase db reset` stopped issuing the implicit base-table GRANTs
  PostgREST needs alongside RLS — turning `@smoke`/`@security` **RED** and
  breaking the real invite path. Root-caused by a read-only architect dispatch.
  Fix: new migration `20260617000000_restore_data_api_grants.sql` (declares the
  base grants explicitly, preserving the decision #24/#25 column lockdowns) +
  pinned `auto_expose_new_tables = false` in `supabase/config.toml` so local
  matches cloud. Recorded as **decision #28** (already in [[PROJECT]] + a
  [[CLAUDE]] gotcha — see Key Decisions).
- **PR #68 `test(security)`** — **TASK-053**, `tests/grants.e2e.ts`
  grant-invariant regression guard (11 cases) locking the grant matrix against
  future drift. 1 fix cycle.
- **PR #65, #67, #69 `docs`** — task-queue + M5-close bookkeeping.

**Milestone M5 closed + tagged** `milestone-05-walls-dms` (commit `d43519a`):
TASK-050/051/052/053 all complete; M5 moved to Completed Milestones in the
[[TASKS]] index; [[workflow/tasks/milestone-05-walls-dms]] is now its frozen archive.

## Key Decisions

- **Decision #28 — explicit Data API grant model** (recorded in [[PROJECT]] +
  a [[CLAUDE]] gotcha during the M5-close pass; **referenced here, not
  re-stated**). `auto_expose_new_tables` is pinned `false`; **every new `public`
  table migration must declare its own base GRANTs**; PostgREST authorization is
  **two-layer** — RLS is necessary but **not sufficient** without the base table
  grant. This is the lasting decision of the session. See the canonical decision
  table in [[PROJECT]].
- **Durable dev-stack no-auto-start via `pnpm db:start`** (PR #64) — operational,
  not an architecture-decision row. The wrapper strips the CLI's re-applied
  `restart: unless-stopped`; documented in [[CLAUDE]] § Commands as the canonical
  startup, satisfying the global "containers must not auto-start" standard for
  the Supabase CLI stack.

## Files Changed

This session's full diff (`git diff --name-status 7cd71eb..HEAD`):

- `scripts/db-start.sh` — **NEW** (PR #64): wraps `supabase start`, strips the
  CLI-injected `restart: unless-stopped`. Exposed via the `package.json`
  `db:start` script.
- `package.json` — MODIFIED (PR #64): `db:start` script.
- `supabase/config.toml` — MODIFIED (PR #66): pinned `auto_expose_new_tables = false`.
- `supabase/migrations/20260616191804_dms.sql` — **NEW** (TASK-051): `dms` table,
  privacy RLS + `read_at`-only column-grant lockdown.
- `supabase/migrations/20260617000000_restore_data_api_grants.sql` — **NEW**
  (TASK-052): explicit Data API base grants (decision #28).
- `src/lib/features/dms/dms.ts` + `dms.test.ts` — **NEW** (TASK-051): DM
  read/write wrappers.
- `src/lib/features/dms/summarize.ts` + `summarize.test.ts` — **NEW** (TASK-051):
  pure `summarizeConversations` inbox collapse.
- `src/routes/(protected)/app/messages/**` — **NEW** (TASK-051): inbox +
  `[handle]` thread routes.
- `src/routes/(protected)/app/+page.svelte` — MODIFIED: Messages nav link.
- `src/routes/(protected)/app/profile/[handle]/+page.svelte` — MODIFIED:
  "Message @handle" button.
- `tests/dms.e2e.ts` — **NEW** (TASK-051): `@security` third-party-cannot-read
  privacy coverage.
- `tests/grants.e2e.ts` — **NEW** (TASK-053): grant-invariant regression guard
  (11 cases).
- `tests/walls.e2e.ts` — MODIFIED (TASK-052/053): aligned with the restored grants.
- `CLAUDE.md` — MODIFIED across the session (db:start command, decision #28
  gotcha) and **this handoff** (Project Map latest-handoff pointer →
  `[[workflow/handoffs/handoff-013]]`).
- `PROJECT.md` — MODIFIED (M5-close pass: Status, decision #28, M5 close notes).
- `README.md`, `TASKS.md`, `workflow/tasks/deferred.md`, `workflow/tasks/milestone-05-walls-dms.md` —
  MODIFIED (M5-close bookkeeping; TASK-054 deferred).
- `workflow/memory/MEMORY.md` — MODIFIED (**this handoff**): added the
  director-runs-DB-verification cross-session pattern.
- `workflow/handoffs/handoff-013.md` — **NEW** (this file).

## Blockers & Open Questions

- ⚠️ **TASK-054 (deferred — user-gated ops; [[workflow/tasks/deferred]]).** The hosted
  `supabase db push` must carry **ALL THREE unpushed migrations together** —
  `20260616184139_wall_messages.sql`, `20260616191804_dms.sql`, and
  `20260617000000_restore_data_api_grants.sql` — in one push. If walls/DMs land
  without the grants migration they ship **grant-less** on hosted (PostgREST
  `permission denied` despite intact RLS), and the grant fix **matters on hosted
  too**: any table pushed after 2026-05-30 may be ungranted (the
  `auto_expose_new_tables` flip applies to hosted as well). After pushing,
  manually trigger the keep-alive workflow and confirm **ping + tally + prune all
  return 2xx**. **No auto-pause risk from the delay** — no keep-alive step depends
  on the M5 tables/RPCs, which is why this was deferred out of the milestone
  rather than gating its close. **Walls & DMs do not work on hosted until this is
  done.** Needs hosted credentials the director/agents don't hold.
- **Minor housekeeping:** many stale remote-tracking branches (squash-merged but
  local refs unpruned). `git fetch --prune` tidies them. Cosmetic, non-blocking.

## Discovered Work

No **new** discovered-work items this session. One item carried forward, still
`open` in [[workflow/tasks/discovered]]:

- [ ] **DW-018** — `listConversations` / `listThread` in
      `src/lib/features/dms/dms.ts` do **unbounded reads** (no `.limit()`),
      diverging from `listWallMessages`' `limit=50` default. Inert at invite-only
      scale; add a bounded `.limit()` when DM volume warrants. Found during the
      TASK-051 review (PR #62).

## Next Steps

Prioritized — see [[TASKS]] for full queue context:

1. **[user-gated ops — do when hosted creds are available] TASK-054** — the
   hosted three-migration `supabase db push` + keep-alive verify (see
   [[workflow/tasks/deferred]] for the exact migration list and the post-push
   ping/tally/prune 2xx check). No auto-pause risk, so timing is the user's call —
   but walls & DMs are non-functional on hosted until it runs.
2. **[next milestone] Activate M6 — Emoji Library** (pre-exploded, ready —
   [[workflow/tasks/milestone-06-emoji-library]]). Activate via a status flip (no planner
   dispatch needed; it already carries full task detail). Its **render-time emoji
   filter consumes the store-original wall/DM bodies** that M5 now persists
   verbatim — the M5 store-original discipline was the deliberate setup for M6.
3. **[optional housekeeping] `git fetch --prune`** to clear the stale
   remote-tracking branches left by squash-merges.

## Files to Read on Resume

- [[PROJECT]] — decision #28 + the M5 close notes (the lasting state of the session).
- [[TASKS]] — index: M5 complete, M6 next (pre-exploded, ready to activate).
- [[workflow/tasks/milestone-05-walls-dms]] — the frozen M5 archive (per-task detail).
- [[workflow/tasks/deferred]] — **TASK-054** with the exact three-migration push
  instructions + the post-push verify steps.
- `supabase/migrations/20260617000000_restore_data_api_grants.sql` +
  `tests/grants.e2e.ts` — the explicit-grant model (decision #28) and its
  regression guard.
- `src/lib/features/dms/` (`dms.ts`, `summarize.ts`) — the DM feature (the
  unbounded-read DW-018 lives in `dms.ts`).
- [[CLAUDE]] § Gotchas (the two-layer-authz / explicit-grants gotcha) and
  § Commands (`pnpm db:start`).
- [[workflow/memory/MEMORY]] — the new director-runs-DB-verification pattern (most
  relevant to dispatching M6's DB-touching tasks).

## Library Candidates

_None — the DM feature/routes/migrations are domain-specific, and
`scripts/db-start.sh` is project-specific Supabase tooling, not general-purpose
/ extractable._

See [[workflow/handoffs/handoff-012]] for prior session context.
