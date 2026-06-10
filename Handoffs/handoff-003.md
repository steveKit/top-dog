# Handoff 003 — 2026-06-10

## Session Summary

Spans the **entire Milestone M1 — Vertical Slice arc** (never captured in a
handoff after [[Handoffs/handoff-002]]'s M0 close) **plus today's M1-close
finalization**. M1 is now executed end to end and **CLOSED**. The full
invite → profile → compress → upload → see-it slice is navigable and locked in
by a Playwright `@smoke` (with a sibling `@security` DB-guard suite). All work
is merged to `main` — **no PRs open**. The project is **ready to begin M2 —
Voting & Top Dog Engine (TDD-first)**.

- **Branch:** `main` (all work merged).
- **PR status:** none open. **11 PRs merged across this arc (#13–#23):**
  - **TASK-010** invite generation + redemption — PR #13 (`ef59aea`)
  - **TASK-012** client-side WebP compression — PR #16 (`2828468`)
  - **TASK-011** profile creation + onboarding funnel — PR #18 (`38db5d9`)
  - **TASK-013** hot dog upload + display — PR #20 (`c552be5`)
  - **TASK-014** vertical-slice `@smoke` + `@security` E2E — PR #22 (`aed7e90`)
  - plus per-task bookkeeping PRs (#14, #15, #17, #19, #21) and the M1-close
    bookkeeping PR #23 (`0cce6ea`)
- **Tag:** `milestone-01-vertical-slice` (annotated, pushed) — created this
  session after the close bookkeeping merged.
- **Stale-task audit:** none — no `[in_progress]` tasks left dangling.

### Today's M1-close finalization (this resume session)

The M1-close bookkeeping had been **left uncommitted** on resume and the
milestone tag was **missing**. This session finished it:

1. The director ran the **M1 milestone wiring audit** — clean except one
   benign finding (`isValidHandle`, see Key Decisions below).
2. The documenter recorded the audit finding in [[PROJECT]] M1 close notes
   and [[TASKS]] Discovered Work.
3. The close bookkeeping was committed and merged via **PR #23** (squash
   `0cce6ea`).
4. The **`milestone-01-vertical-slice`** annotated tag was created and pushed.

## Key Decisions

Durable, lasting-impact context a resuming session needs. The full decision
table (and the M1 progress/close narrative) lives in [[PROJECT]] — only the
load-bearing points are repeated here.

1. **Invite single-use guards key on `consumed_at`, not `consumed_by`
   (decision #22, TASK-010).** `consumed_at` is the authoritative single-use
   signal (the FK never nulls it); `consumed_by` is `on delete set null` for
   audit only, guarded by a **one-directional** CHECK. Keying a single-use
   guard on an FK-nullable column re-opens a spent record when its referent is
   deleted. Captured as a [[CLAUDE]] gotcha; applies to any future "consume
   once" record.
2. **Pre-auth redemption via anon-executable SECURITY DEFINER RPCs
   (decision #23, TASK-010).** Redemption runs unauthenticated, so it can't use
   the inviter's RLS; `redeem_invite` / `invite_is_redeemable`
   (`search_path=''`, schema-qualified, granted `anon` + `authenticated`) are
   the controlled single-transaction write path. **This is the template the M2
   vote RPC should follow** — consuming writes go through RPC.
3. **Non-client-writable counters via column-level GRANTs on BOTH write paths
   (decision #24, TASK-013).** RLS gates rows, not columns. `vote_count` /
   `peak_votes` / `created_at` are blocked by revoking table-wide write then
   re-granting only safe columns on **insert AND update** — restricting only
   UPDATE leaves the INSERT path open to forge an opening counter (caught in
   review). **M2 directly inherits this:** the `votes` migration and the vote
   RPC must replicate the insert+update column-grant pair for any new
   denormalized counter (`vote_count` write-through, `peak_votes`).
4. **`extensions.citext` schema-qualify lesson (M0/PR #9, reinforced M1).**
   Extension-provided types must be schema-qualified in migrations — the local
   migration role has `extensions` in `search_path`, the hosted role does not,
   so unqualified refs pass `supabase db reset` locally but fail
   `supabase db push` hosted. TASK-013 applied this to
   `extensions.gen_random_uuid()`. **Every M2 vote-RPC migration must follow
   it.** Captured as a [[CLAUDE]] gotcha + in the README migration guide.
5. **E2E harness is LOCAL-stack-only, never the hosted `.env` (TASK-014).**
   Playwright specs resolve local creds via `supabase status -o env` behind a
   non-localhost guardrail that aborts if the URL isn't local — a run can never
   hit the hosted project. Invite-only sign-up needs a real unconsumed invite,
   so `tests/global-setup.ts` mints one with a local service-role client. Keep
   the service key Node/server-side only. Captured as a [[CLAUDE]] gotcha.
6. **Accepted `isValidHandle` test-only export (M1 wiring audit, 2026-06-10).**
   `isValidHandle` (`src/lib/features/profiles/handle.ts`) is exported but has
   **no production consumer** — exercised only by its own unit tests; the wired
   validator is `validateHandle`. It's a redundant one-line sibling predicate,
   not unwired functionality. Accepted and documented at M1 close; the tidy is
   non-blocking Discovered Work (see below). Analogous to — but far more trivial
   than — the M0 "accepted foundational orphans" precedent.

## Files Changed

This handoff covers the whole M1 arc; full per-file detail is in the [[TASKS]]
per-task Notes and the PR diffs. Highlights:

New seams / modules:

- `src/lib/features/invites/` (+migration) — invite mint + the
  `redeem_invite` / `invite_is_redeemable` anon SECURITY DEFINER RPCs (TASK-010)
- `src/lib/image/compress.ts` (+test) — client WebP compression seam
  (`fitWithinMaxEdge` pure downscale + `compressToWebp`), parallel to
  `$lib/storage`, deliberately NOT under a feature folder (TASK-012)
- `src/lib/features/profiles/` (`handle.ts` pure validator + `profiles.ts`
  server wrappers) + `(protected)/app/onboarding` + profile pages — onboarding
  funnel, first live consumer of the image + storage seams (TASK-011)
- `supabase/migrations/20260609181013_hot_dogs.sql` — `hot_dogs` table
  (`byte_size`, caption CHECK ≤280), `app_storage_bytes()` RPC, RLS + the
  column-level counter grants (TASK-013)
- `src/routes/(protected)/app/dogs/` — upload/display/delete route wiring the
  storage guard (`evaluateUpload`) as its first live consumer (TASK-013)
- `tests/smoke.e2e.ts` (`@smoke`), `tests/db-guards.e2e.ts` (`@security`),
  `tests/global-setup.ts`, `tests/helpers/local-stack.ts` — vertical-slice
  regression backstop + DB write-guard assertions (TASK-014)

Modified this session (M1-close + handoff bookkeeping):

- `PROJECT.md` — M1 close notes; decisions #22–#24; `isValidHandle` audit
  finding; `Last Updated` → 2026-06-10; handoff pointer → handoff-003
- `CLAUDE.md` — M1 gotchas (single-use guard, counters, local-stack E2E, env
  access, auth-trust boundary); Project Map latest-handoff pointer → handoff-003
- `README.md` — M1 updates (merged in PR #23)
- `TASKS.md` — M1 tasks moved to Completed with Notes; Discovered Work updated;
  milestone tag recorded (director-owned orchestration edits)
- `Handoffs/handoff-003.md` — this file

## Discovered Work

Open items worth triaging before / during M2 (full text in [[TASKS]]
Discovered Work):

- [ ] **Automated RLS / DB integration-test harness** — found during TASK-003,
      **reinforced by the TASK-010 reviewer**: invite single-use atomicity, RLS,
      and the SECURITY DEFINER RPCs are currently only mock-tested with no live-DB
      coverage. **Recommended to land before the M2 vote RPC** accumulates
      consuming-write logic without integration coverage. Treat as a real near-term
      follow-up, not someday-maybe.
- [ ] **`byte_size` client-supplied soft storage-guard residual** — accepted v1
      residual (TASK-013): a direct insert could understate `byte_size`, so the
      global guard is best-effort, not a hard quota. Cannot be closed at the DB;
      revisit (storage-metadata recompute / reconciliation job) if the trust model
      changes.
- [ ] **`isValidHandle` tidy candidate** — non-blocking (M1 wiring audit): drop
      the `export` or remove the redundant predicate.
- [ ] **Shared `profile` layout/page data key footgun** (TASK-011, non-blocking)
      — rename the layout key (e.g. `viewerProfile`) when it gains a consumer.

## Next Steps

Milestone **M2 — Voting & Top Dog Engine** (TDD-first per the adaptive paradigm,
decision #2):

1. **P0 — TASK-020** (ranking + sticky tie-break logic) — the entry point.
   **Unblocked** (dep TASK-013 ✅). PURE module: given dogs with
   `(vote_count, top_dog_since)`, returns the Top Dog; highest count wins, ties
   → earliest `top_dog_since` (sticky). **Tester-first** — crisp spec, no
   SvelteKit/Supabase imports. This is adversarial finding A.
2. **P0 — TASK-021** (vote RPC: move-vote + counter + crown) — **deps TASK-020**;
   cannot run parallel with it. `votes` migration (UNIQUE(voter_id), RLS forbids
   self-vote) + a single-transaction RPC. **Replicate decision #24's column-grant
   pair and decision #23's RPC pattern; schema-qualify per decision #4.**
3. **P1 — TASK-022** (daily Top Dog tally) — **deps TASK-021**. Idempotent
   `top_dog_days` tally, wired into the keep-alive workflow.
4. **P2 — TASK-023** (Top Dog badge UI) — **deps TASK-021**.

TASK-021/022/023 are **dependency-chained off TASK-020** and cannot run in
parallel with it yet. Reference [[TASKS]] for full queue context.

**Consider** scheduling the RLS/DB integration-test harness (Discovered Work)
before or alongside TASK-021, per the TASK-010 reviewer's recommendation.

## Files to Read on Resume

- [[PROJECT]] — M1 close notes, decisions #22–#24, accepted residuals, data
  model (`votes` / `top_dog_days` / counter columns), milestones
- [[TASKS]] — work queue (start at **TASK-020**) + Discovered Work
- [[CLAUDE]] — stack, conventions, gotchas (citext schema-qualify, counters,
  local-stack E2E, auth-trust boundary)
- `supabase/migrations/20260609181013_hot_dogs.sql` — the `hot_dogs` table +
  column-level counter grants the vote RPC builds on (counter write pattern)
- `src/lib/features/invites/` (invite migration + redeem RPC) — the
  **SECURITY DEFINER, schema-qualified, single-transaction RPC template** the
  M2 vote RPC should mirror
- `src/lib/features/` — feature-folder structure; TASK-020's pure logic module
  follows the `voting/` placement noted in [[CLAUDE]]

## Library Candidates

**No strong candidates.** Most M1 work is app-specific (Supabase RLS migrations,
SvelteKit routes/form actions, invite-only auth wiring). The `src/lib/image/`
compression seam is the closest generic utility, but it's tuned to this app's
WebP / storage-cap strategy (decisions #8/#9) and not yet stable — revisit for
extraction only if a second project needs the same canvas-encode helper.
