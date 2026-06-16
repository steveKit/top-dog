# Handoff 011 — 2026-06-16

## Session Summary

A full milestone session on `main`: **Milestone M4 — Mustard Mechanic was
activated, built end to end, and closed.** M4 was pre-exploded, so activation
was just a status flip — no planner dispatch. All three tasks shipped with a
reviewer **APPROVE and 0 fix cycles each**, and the milestone was tagged
`milestone-04-mustard-mechanic`.

The mustard mechanic is now complete: a pure render-time decay seam
(`mustardOpacity`, full → 0 over 24h) realizing decision #15, a Top-Dog-gated
spray that renders an opacity-decayed overlay on a target profile, and a daily
`prune_mustard_sprays()` job — the table's sole DELETE path — wired into the
keep-alive workflow as an anon-callable, idempotent, no-input job (decision #26
extended to a destructive cleanup job). Sprays are immutable + persistent across
crown changes; the drip is computed entirely at render from the stored
timestamp.

Branch: `main` (all work merged; **no open PRs**). Session base = `822c0bd`
(the handoff-010 commit).

Merged PRs this session:

- **#53 `5afd0da`** — `feat(mustard): render-time decay opacity math` (TASK-040)
- **#54** — `docs(bookkeeping): TASK-040 notes + M4 progress`
- **#55 `e1eafb9`** — `feat(mustard): Top Dog spray + render-time decay on profiles` (TASK-041)
- **#56** — `docs(bookkeeping): TASK-041 notes + M4 progress (2/3) + DW-017 + cosmetic-write gotcha`
- **#57 `6452407`** — `feat(mustard): daily >24h prune job wired into keep-alive` (TASK-042)
- **#58 `6ee244e`** — `docs(bookkeeping): close M4 — Mustard Mechanic`

Milestone tag pushed: **`milestone-04-mustard-mechanic`**.

## Key Decisions

No **new** architecture-decision rows were added this session — M4 was built
entirely on existing decisions (#12 cosmetic write, #15 mustard render-time
decay, #25 non-client-writable crown columns, #26 anon-callable idempotent
scheduled jobs). Two reusable techniques were captured as layered guidance
rather than new decision rows:

- **Privileged-but-cosmetic RLS write gated by a `WITH CHECK` on a
  non-client-writable column.** The `mustard_sprays` insert is a plain
  owner-scoped RLS write (the inverse of the consuming-writes-via-RPC
  convention, like `hotdog_reactions`), but adds an INSERT authorization
  conjunct: only the **current Top Dog** may spray
  (`EXISTS (… profiles p where p.id = (select auth.uid()) and
p.is_current_top_dog)`). The gate is trustworthy precisely because
  `is_current_top_dog` is server-maintained and non-client-writable
  (decision #25) — a member cannot self-satisfy it. Captured as a reusable
  [[CLAUDE]] gotcha (extending the cosmetic-table gotcha), layered on
  decisions #12/#15/#25. Reuse for future "only Top Dog can …" privileged-flair
  surfaces (e.g. an M5 gate).
- **Decision #26 extended from a recording job to a destructive job.** The
  daily `prune_mustard_sprays()` RPC takes no caller input (`pronargs = 0`) and
  its predicate is fixed to rows provably >24h old (already opacity-0 / invisible
  per `mustardOpacity`), so it is idempotent, not forgeable, and self-limiting —
  hence anon-callable with the existing publishable key (no new repo secret),
  exactly like `tally_top_dog_day()`. Granting `anon` EXECUTE on a DELETE widens
  no real capability because the deletion set is server-defined and inert to the
  UI. No new decision row — the #26 pattern was set up for reuse at TASK-022.

## Files Changed

This session's git diff (`822c0bd..HEAD`) — feature work landed across PRs
#53/#55/#57, with bookkeeping in #54/#56/#58; this handoff adds only the pointer

- handoff file:

* `src/lib/features/mustard/decay.ts` + `decay.test.ts` — NEW (TASK-040): pure
  render-time decay seam (`mustardOpacity`, `MUSTARD_LIFESPAN_MS`), TDD-first,
  19 cases. No SvelteKit/Supabase imports.
* `src/lib/features/mustard/sprays.ts` + `sprays.test.ts` — NEW (TASK-041):
  `addSpray` / `listSpraysForProfile` RLS-scoped wrappers, discriminated
  `SprayResult<T>`, last-24h read filter, `42501` → `NOT_TOP_DOG` mapping.
* `src/routes/(protected)/app/profile/[handle]/+page.server.ts` +
  `+page.svelte` — MODIFIED (TASK-041): spray UI + form action, render-time
  decay overlay, `canSpray` gate. `profile-load.test.ts` MODIFIED;
  `spray-action.test.ts` NEW.
* `supabase/migrations/20260616163055_mustard_sprays.sql` — NEW (TASK-041):
  `mustard_sprays` table + Top-Dog-gated INSERT RLS (no UPDATE/DELETE policy;
  immutable + persistent).
* `supabase/migrations/20260616170706_mustard_prune.sql` — NEW (TASK-042):
  `prune_mustard_sprays()` SECURITY DEFINER RPC + `sprayed_at` index.
* `.github/workflows/keepalive.yml` — MODIFIED (TASK-042): new "Prune mustard
  sprays (>24h, idempotent)" step after the tally, fail-on-non-2xx.
* `tests/mustard.e2e.ts` — NEW (TASK-041, `@security`, 5 RLS cases).
* `tests/mustard-prune.e2e.ts` — NEW (TASK-042, `@security`, 4 cases).
* `PROJECT.md`, `TASKS.md`, `tasks/milestone-04-mustard-mechanic.md`,
  `tasks/discovered.md` (DW-017), `README.md`, `CLAUDE.md` — bookkeeping (largely
  landed in #54/#56/#58 this session).
* `CLAUDE.md` — MODIFIED (this handoff): Project Map latest-handoff pointer →
  `[[Handoffs/handoff-011]]`.
* `Handoffs/handoff-011.md` — NEW (this file).

## Blockers & Open Questions

- ⚠️ **HEADLINE — the hosted-push gate is PENDING.** The two new M4 migrations
  (`20260616163055_mustard_sprays.sql`, `20260616170706_mustard_prune.sql`) have
  **NOT** been `supabase db push`ed to hosted. TASK-042's prune step now runs in
  the **scheduled** keep-alive workflow (07:17 UTC daily). Until the hosted push
  happens, the prune step will get a PostgREST **404** and turn the workflow
  **red** — the exact hosted-schema-drift class from handoff-010 (which took the
  workflow red for 4 days over the un-pushed M2/M3 migrations). This is a user
  ops step (needs hosted credentials). After the push, the director can verify
  via `gh workflow run keepalive.yml` and confirm the run goes green.
  - Diagnostic reminder ([[memory/MEMORY]] Deploy/Ops): if the workflow goes red,
    a passing `ping` + a 404 on the prune/tally step = hosted schema drift (push
    the migration), NOT a secrets or auto-pause emergency.

## Discovered Work

- [ ] **DW-017** — the `spray` form action coerces a missing/empty `x`/`y` to `0`
      (sprays at `(0,0)`) instead of returning 400 — cosmetic-only, Top-Dog-gated, no
      security / ranking / cross-user impact; current behavior pinned by a unit test
      in `spray-action.test.ts`, so a fix must update that test. Found during
      TASK-041 review. Disposition `open` in [[tasks/discovered]] (minor, deferred).

## Next Steps

Prioritized — see [[TASKS]] for full queue context:

1. **[ops — do first]** `supabase db push` the two M4 migrations to hosted, then
   verify keep-alive green (`gh workflow run keepalive.yml`). Closes the
   hosted-push gate before the next scheduled prune run 404s.
2. **[P1] Activate M5 — Walls & DMs** ([[tasks/milestone-05-walls-dms]]). M5 is
   pre-exploded, so activation is a status flip (no planner). The privileged-flair
   gotcha from M4 may apply if any M5 surface is Top-Dog-gated, and the
   cross-member E2E lesson from M3 ([[memory/MEMORY]]) applies directly to walls
   and DMs (members interacting with EACH OTHER's content).
3. **[P3] Optional test-hygiene bundle** — DW-014 / DW-015 / DW-016 plus the
   DW-017 tidy could land as one quick task before or after M5.

## Files to Read on Resume

- [[PROJECT]] — decisions, milestone table (M4 now complete), and the M4 close +
  Process notes (hosted-push gate).
- [[TASKS]] — index; M4 in Completed Milestones, M5 next.
- [[tasks/milestone-05-walls-dms]] — the next milestone (pre-exploded).
- `.github/workflows/keepalive.yml` — where the hosted-push gate bites (the new
  prune step lives alongside `ping` + `tally`).
- `src/lib/features/mustard/` (`decay.ts`, `sprays.ts`) — M4 patterns (pure
  render-time seam + RLS-scoped wrappers) that M5 may reuse.
- [[memory/MEMORY]] — the cross-member-E2E and Deploy/Ops (keep-alive drift)
  patterns most relevant to M5.

## Library Candidates

_None — the mustard feature (decay math, spray wrappers, profile overlay) is
domain-specific, not general-purpose / extractable._

See [[Handoffs/handoff-010]] for prior session context.
