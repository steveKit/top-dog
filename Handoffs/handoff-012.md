# Handoff 012 — 2026-06-16

> **MID-TASK HANDOFF.** TASK-051's feature PR (#62) is reviewed and
> **APPROVED but still open**, awaiting the user's merge approval. The session
> stopped at that human-in-the-loop gate. No TASK-051 completion notes, no M5
> close notes, and no PROJECT.md milestone prose were written this session —
> those happen **after** the merge in the next session.

## Session Summary

Continued **Milestone M5 — Walls & DMs** ([[tasks/milestone-05-walls-dms]]),
which was activated this session via a status flip — M5 is pre-exploded, so no
planner dispatch. Two tasks were worked:

- **TASK-050 — Message walls: COMPLETE & MERGED.** Implementer + tester +
  reviewer (**APPROVE, 0 fix cycles**). Feature PR **#60** merged (`d3c7a4d`);
  bookkeeping PR **#61** merged (`c11fb17`). Adds a new `wall_messages` table
  (plain owner-scoped RLS, store-original body, **author-OR-wall-owner** delete,
  no RPC — reuses decision #12), the `src/lib/features/walls/` module, and the
  profile-page wall UI.

- **TASK-051 — Direct messages: BUILT, TESTED, REVIEWED — PR #62 OPEN, AWAITING
  USER MERGE APPROVAL.** Reviewer verdict **APPROVE** (no critical/major; 2 minor
  notes; 2 DW items). The session stopped here per the user's request to halt at
  a logical handoff point. The work adds a new `dms` table (privacy RLS: SELECT
  sender-or-recipient only, INSERT sender-pinned, UPDATE recipient-only, no
  DELETE; **column-grant lockdown** — `grant insert (sender_id, recipient_id,
body)` + `grant update (read_at)` only — so the recipient cannot rewrite the
  sender's body and `read_at`/`created_at` can't be forged; no RPC, reuses
  decision #12 + the decision #24 column-grant mechanism), a pure
  `summarizeConversations`, the `src/lib/features/dms/` module, an inbox route
  `/app/messages` + a thread route `/app/messages/[handle]`, a "Message @handle"
  profile button, and a Messages nav link. The live-DB `@security` suite proves
  the **third-party-cannot-read** privacy guarantee. Gates at review:
  `pnpm test` **573**, `pnpm check` **0 errors**, `@smoke` **4**,
  `@security` **57**.

## Key Decisions

No **new** architecture-decision rows were added this session. Both M5 surfaces
were built entirely on existing decisions — record this as the M5 design
throughline:

- **Walls and DMs both reuse decision #12** — a cosmetic / many-allowed table
  (no server-maintained denormalized column) writes through a **plain
  owner-scoped RLS** `insert`/`delete`/`update`, the deliberate inverse of the
  consuming-writes-via-RPC convention. There is no counter to maintain
  transactionally, so no RPC is warranted.
- **DMs additionally reuse the decision #24 column-grant mechanism** to restrict
  _which columns_ each actor may write: `grant update (read_at)` only (the
  recipient marks-read but cannot rewrite the sender's `body`), and
  `grant insert (sender_id, recipient_id, body)` only (so `read_at`/`created_at`
  can't be forged at insert). This is a **reuse** of the #24 mechanism applied to
  the privacy boundary, not a new decision row.

See [[PROJECT]] for the canonical decision table; no rows were added there this
session.

## Files Changed

This session's feature work landed across the M5 PRs; this handoff itself
changes only the pointer + the DW log:

- `supabase/migrations/20260616184139_wall_messages.sql` — NEW (TASK-050):
  `wall_messages` table + owner-scoped RLS, author-OR-wall-owner delete, no RPC.
- `src/lib/features/walls/` (`walls.ts` + tests) — NEW (TASK-050): wall message
  read/write wrappers (`listWallMessages` with a `limit=50` default).
- Profile-page wall UI — MODIFIED (TASK-050).
- `supabase/migrations/20260616191804_dms.sql` — NEW (TASK-051): `dms` table,
  privacy RLS (SELECT sender-or-recipient, INSERT sender-pinned, UPDATE
  recipient-only, no DELETE) + column-grant lockdown.
- `src/lib/features/dms/` (`dms.ts`, `summarize.ts` + tests) — NEW (TASK-051):
  `listConversations` / `listThread` wrappers + pure `summarizeConversations`.
- `/app/messages` (inbox) + `/app/messages/[handle]` (thread) routes — NEW
  (TASK-051); "Message @handle" profile button + Messages nav link — MODIFIED.
- `tests/` — NEW `@security` coverage for the third-party-cannot-read DM privacy
  guarantee (TASK-051).
- `CLAUDE.md` — MODIFIED (this handoff): Project Map latest-handoff pointer →
  `[[Handoffs/handoff-012]]`.
- `tasks/discovered.md` — MODIFIED (this handoff): DW-018 logged.
- `Handoffs/handoff-012.md` — NEW (this file).

## Blockers & Open Questions

- ⚠️ **HEADLINE — PR #62 is OPEN, APPROVED, and awaiting the user's merge
  approval.** TASK-051's feature work is built/tested/reviewed but **not merged**
  — this is the human-in-the-loop gate the session stopped at. M5 cannot close
  until it merges. Do this first on resume (see Next Steps #1). The
  `feat/direct-messages` branch carries PR #62.
- **Hosted parity is PENDING for BOTH new M5 migrations.**
  `20260616184139_wall_messages.sql` AND `20260616191804_dms.sql` have **not**
  been `supabase db push`ed to hosted. Unlike the M4 prune migration, **neither
  adds a keep-alive workflow step**, so there is **no red-workflow /
  auto-pause risk** this time — but the wall and DM features will not work on
  hosted until pushed. User ops step (needs hosted creds). See Next Steps #2.

## Discovered Work

- [ ] **DW-018** — `listConversations` / `listThread` in
      `src/lib/features/dms/dms.ts` do **unbounded reads** (no `.limit()`),
      diverging from `listWallMessages`' `limit=50` default. Inert at invite-only
      scale; add a bounded `.limit()` when DM volume warrants. Found during the
      TASK-051 review (PR #62). Disposition `open` in [[tasks/discovered]].

## Next Steps

Prioritized — see [[TASKS]] for full queue context:

1. **[user-gated — do first] Merge PR #62** (TASK-051, APPROVED). Then the
   director runs post-merge bookkeeping (move TASK-051 to Completed Tasks in
   [[tasks/milestone-05-walls-dms]], tick both ACs), then **CLOSES M5**: run the
   milestone wiring audit over the new `dms`/`walls` exports, tag
   `milestone-05-walls-dms` (annotated + pushed), move M5 to Completed Milestones
   in the [[TASKS]] index, dispatch the documenter for the TASK-051 notes + M5
   close notes + [[PROJECT]]/[[CLAUDE]] updates, then commit the bookkeeping.
2. **[ops — hosted parity, non-urgent] `supabase db push` BOTH new M5
   migrations** to hosted (`20260616184139_wall_messages.sql` and
   `20260616191804_dms.sql`). No keep-alive step depends on them, so there is no
   red-workflow / auto-pause risk — but walls and DMs won't function on hosted
   until pushed. User ops step (needs hosted creds).
3. **[P3] Discovered work** — DW-018 (unbounded DM reads; add `.limit()` to
   match `walls`). The pre-existing PROJECT.md prettier drift was already fixed
   this handoff.
4. After M5 closes, **M6 — Emoji Library** is the next pre-exploded milestone
   (depends on M5). The render-time emoji filter consumes the **store-original
   bodies** that walls and DMs now persist.

## Files to Read on Resume

- [[PROJECT]] — decisions + milestone table (M5 in progress until PR #62 merges).
- [[TASKS]] — index; M5 active, M6 next.
- [[tasks/milestone-05-walls-dms]] — the active milestone; TASK-051 status stays
  as-is until post-merge bookkeeping.
- `src/lib/features/dms/` (`dms.ts`, `summarize.ts`) — DM wrappers + pure summary
  (the unbounded-read DW-018 lives in `dms.ts`).
- `src/lib/features/walls/walls.ts` — the sibling wall wrappers (the `limit=50`
  pattern DW-018 should adopt).
- The open **PR #62** (`feat/direct-messages`) — the un-merged review artifact.
- [[memory/MEMORY]] — the cross-member-E2E and Deploy/Ops (keep-alive-drift)
  patterns most relevant to M5/M6.

## Library Candidates

_None — walls and DMs are domain-specific (message wrappers, conversation
summary, inbox/thread routes), not general-purpose / extractable._

See [[Handoffs/handoff-011]] for prior session context.
