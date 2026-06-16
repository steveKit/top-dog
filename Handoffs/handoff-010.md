# Handoff 010 — 2026-06-16

## Session Summary

A short ops/maintenance session on `main` — **no milestone work**. M3 remains the
last closed milestone (see [[Handoffs/handoff-009]]); M4 has not started. Three
things happened:

1. **Confirmed dev DB accessibility** after a Docker daemon fix the user did with
   the core-architect. Verified a **single canonical daemon** (Docker Desktop
   `docker-desktop` 29.3.1) with **no competing native `dockerd`**
   (`systemctl is-active docker` → inactive), the `supabase_db_top-dog` container
   healthy, and the local DB answering a live query (33 profiles, all 6 migrations
   applied). Per [[resource-naming]] § One Canonical Docker Daemon, this is the
   correct single-daemon posture — dev DB is good.
2. **Diagnosed and fixed the keep-alive workflow failure** (the headline — see
   below). Root cause was **hosted schema drift**, fixed with `supabase db push` +
   a workflow re-trigger. No repo diff.
3. **Bumped + pinned the supabase CLI 2.105.0 → 2.106.0** (`.mise.toml`, PR #50
   squash `c53f524`) and updated architecture decision #19 in [[PROJECT]] to match
   (PR #51 squash `0571222`).

Branch: `main` (all work merged; no open PRs). Session base = `a2913cb`.

Merged PRs:

- **#50 `c53f524`** — `chore(toolchain): bump supabase CLI pin to 2.106.0`
  (`.mise.toml`).
- **#51 `0571222`** — `docs(bookkeeping): decision #19 supabase pin → 2.106.0`
  ([[PROJECT]] decision #19 Choice cell).

### The headline — keep-alive was red for 4 days, and it was hosted schema drift

The last 4 daily scheduled keep-alive runs were **red**. Root cause: the
workflow's `Tally Top Dog day` step calls `tally_top_dog_day()` and got a PostgREST
**404** — the M2/M3 migrations
(`20260610181704_votes_and_vote_rpc.sql`,
`20260611174243_top_dog_days_and_tally.sql`,
`20260612104439_hotdog_reactions.sql`) had **never been `supabase db push`ed to
hosted** since the M0/M1 going-live. The hosted DB was at an older schema than the
local stack, so the RPC the workflow calls did not exist on hosted.

Critically, the **`ping` step succeeded throughout**, so the hosted DB was **never
actually at auto-pause risk** — the daily read kept the 7-day timer resetting even
while the workflow showed red. This is the key diagnostic distinction: a red
keep-alive whose `ping` passes but whose RPC step 404s is **schema drift, not a
secrets problem and not an auto-pause emergency**. The older [[CLAUDE]] "if it goes
red, re-check secrets first" guidance applies only to a failing **`ping`** step.

Remedy: the user ran `supabase db push` (three migrations applied to hosted); the
director re-triggered the workflow (`gh workflow run keepalive.yml`, run 27619964284) and it went **green**. No repo diff — a hosted-DB + workflow-rerun
action. The reusable prevention (now in [[PROJECT]], [[memory/MEMORY]], and the
[[CLAUDE]] keep-alive gotcha): **push hosted migrations per-milestone**, not just at
going-live.

## Key Decisions

- **Toolchain pin updated — supabase CLI now 2.106.0** ([[PROJECT]]
  architecture-decision **#19**, Choice cell updated; rationale unchanged: pinned,
  reproducible toolchain). The pin in `.mise.toml` is authoritative.
  - **Environmental caveat worth recording:** an interactive terminal may still
    report `supabase --version` → **2.105.0** until a fresh shell or
    `eval "$(mise activate bash)"`, because mise PATH-activates at shell start.
    `mise which/exec/current supabase` already resolve **2.106.0**, and the
    `.mise.toml` pin is the source of truth — the stale interactive `--version` is a
    shell-activation artifact, not a failed bump.

## Files Changed

This session's repo diff (against session base `a2913cb`) is small — the keep-alive
fix had no diff. Plus this handoff's bookkeeping:

- `.mise.toml` — MODIFIED (PR #50): supabase pin `2.105.0` → `2.106.0`.
- `PROJECT.md` — MODIFIED (PR #51 + this handoff): decision #19 Choice cell →
  supabase 2.106.0 (PR #51); this handoff bumps **Last Updated** to 2026-06-16 and
  adds a **Process notes** entry recording the hosted schema-drift resolution + the
  push-migrations-per-milestone lesson.
- `memory/MEMORY.md` — MODIFIED (this handoff): new **Deploy / Ops Patterns**
  subsection — diagnosing a red keep-alive by which step fails (ping vs RPC-404 =
  schema drift).
- `CLAUDE.md` — MODIFIED (this handoff): Project Map latest-handoff pointer →
  `[[Handoffs/handoff-010]]`; keep-alive gotcha refined to record the two distinct
  red-workflow failure modes (ping-fail = secrets vs RPC-404 = hosted schema drift).
- `Handoffs/handoff-010.md` — NEW (this file).

The keep-alive workflow fix itself produced **no repo diff** (hosted `db push` +
workflow re-trigger).

## Blockers & Open Questions

None blocking. No `[in_progress]` tasks. But surface one **forward-looking gate**
prominently before M4's prune job ships:

- **HOSTED-PUSH GATE for M4.** M4 (Mustard Mechanic) adds a **fourth migration AND a
  second prune RPC** wired into the same keep-alive workflow (**TASK-042**). That
  migration **MUST be `supabase db push`ed to hosted before the prune step ships**,
  or the exact red-workflow failure we just fixed (hosted schema drift → RPC 404)
  **will recur** — this time on the prune step instead of the tally step. Treat the
  hosted push as an explicit acceptance condition for TASK-042 going live.

## Next Steps

Prioritized — see [[TASKS]] for full queue context:

1. **[P1] Activate M4 — Mustard Mechanic** ([[tasks/milestone-04-mustard-mechanic]]).
   Start **TASK-040** (TDD decay/opacity math) → **TASK-041** (spray + render-time
   decay, migration + RLS) → **TASK-042** (>24h prune job, reusing the decision #26
   anon-callable + idempotent job pattern wired into the existing keep-alive
   workflow). **The hosted-push gate above applies before TASK-042 goes live.**
2. **[P3] Optional test-hygiene bundle** — DW-014 / DW-015 / DW-016 could land as
   one quick task before or after M4.
3. **[P3] DW-012** — naturally folds into M6 (Emoji Library).

## Files to Read on Resume

- [[PROJECT]] — decisions (incl. #19 supabase 2.106.0), milestone table, and the new
  Process notes entry on the hosted schema-drift fix.
- [[TASKS]] — index; M3 in Completed Milestones, M4 next.
- [[tasks/milestone-04-mustard-mechanic]] — the next milestone (TASK-040 → 042).
- `.github/workflows/keepalive.yml` — where the M4 prune step gets wired (and where
  the tally step that 404'd lives); the hosted-push gate attaches here.
- [[memory/MEMORY]] — the new Deploy / Ops pattern for diagnosing a red keep-alive.

## Library Candidates

_None — this session touched only `.mise.toml` and `PROJECT.md` (plus bookkeeping)._

See [[Handoffs/handoff-009]] for prior session context.
