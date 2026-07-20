# Top Dog — Agent Memory

Stable, cross-session patterns learned during execution. Not a changelog (that's
[[workflow/handoffs/]]) and not conventions/gotchas (those live in [[CLAUDE]]). Only
record patterns that recur across sessions.

## Workflow Patterns

### Bookkeeping commits go through `chore/*` branches, never directly to `main`

The pre-tool-safety hook blocks direct commits and pushes to `main`. This applies
to documentation/bookkeeping changes too (PROJECT.md, TASKS.md, handoff files,
Notes blocks), not just feature code.

Route every post-merge bookkeeping batch through a short-lived `chore/*` branch
and land it with `gh pr merge --squash --delete-branch`. The server-side squash
merge succeeds even though a local commit to `main` would be blocked. Every
director session will hit this constraint — plan bookkeeping as its own tiny PR
rather than trying to amend `main` in place.

**This includes handoff files.** `main` is hook-protected here, so ALL commits —
feature, bookkeeping, AND handoffs — go through a PR (`gh pr create` + squash
self-merge), never `git commit`/`git push` to `main` directly. The global
`/handoff` skill's wording ("commit direct to main") does NOT apply to this repo;
prior handoff bookkeeping (PRs #41/#42, and the M3-close PR #48) all landed via
PR. When ending a session, route the handoff + PROJECT/MEMORY/CLAUDE updates
through the same `chore/*`-branch-then-squash-merge flow.

### Markdown bookkeeping must be prettier-formatted before it lands

`pnpm lint` runs `prettier --check .`, so unformatted PROJECT.md / handoff /
TASKS markdown breaks the lint gate. This has **recurred** — PR #6, PR #15, and
again PR #26 each had to fix pre-existing markdown drift to get the gate green;
the **M6 session repeated it twice** (the TASK-060 close and the M6 close), where
unformatted documenter bookkeeping turned `main` lint-RED and the director caught

- fixed each via the Verification Reflex (`prettier --write`). Run
  `pnpm exec prettier --write` on edited markdown so bookkeeping never red-flags the
  gate. **The reliable owner of this is whoever has a working `prettier` in-sandbox:**
  the documenter's sandbox often DENIES `prettier`, so when it cannot self-format it
  must format-by-construction (wrap prose, align tables) and say so explicitly in its
  report — and the director must then run the format pass on the main thread before
  landing (this is the format half of the director-runs-verification pattern below),
  never trusting an unverified "formatted" self-report.

Related Bash-hook gotcha: don't chain `git checkout -b <branch> && git commit`
in one Bash call. The pre-tool-safety hook reads the **current** branch BEFORE
the compound command runs and rejects it as a commit-on-main. Run the branch
creation and the commit as separate steps.

### The director runs DB-dependent verification (and the final format pass) itself — agent self-reports of these gates are not trustworthy here

Subagent sandboxes in this project frequently **deny** the commands the
real quality gates depend on — `supabase` (so `supabase db reset` / a live
local stack), `docker`, Playwright (`pnpm test:e2e`, the `@smoke`/`@security`
suites), `git`, and `prettier`. An agent that cannot run a gate will often
still report success against it (a vacuous pass), so a self-reported "✅
`@security` green" or "✅ formatted" cannot be taken at face value.

The standing remedy: the **director runs the DB-dependent verification
itself on the main thread** — `supabase db reset` (clean slate, all
migrations re-applied) then `pnpm test:e2e --grep @smoke` / `--grep @security`
(and `--grep @grants` for the M5 grant guard) — and **runs the final
prettier/format pass itself** (`pnpm exec prettier --write` on edited markdown

- `pnpm lint`) rather than trusting the agent's report. Treat the implementer/
  tester's unit-test (`pnpm test`, `pnpm check`) numbers as informative but
  **re-run the live-DB and format gates on the main thread before merge**. This
  recurs every milestone (the M5 grant regression — `@smoke`/`@security` turning
  RED on a fresh `supabase db reset` — is exactly the class of failure a
  sandboxed agent cannot observe). Pairs with the markdown-prettier and
  chore-branch patterns below: those say _what_ must be green before landing;
  this says _who_ must actually run the check.

### An "orphan-by-design" export needs its future-consumer task actually queued

When a task ships a seam ahead of its consumer (justified as "orphan-by-design,
wired by a later task"), that later task must be **created in the queue**, not
just named in prose. The milestone-close wiring audit checks for non-test
consumers and will (correctly) **block the milestone close** when the promised
consumer was never queued — the deferral note alone is not a wiring contract.
This bit M2: `castVote`/`removeVote` (`src/lib/features/voting/votes.ts`) were
declared orphan-by-design "until a later M2 task" that never got created, so the
M2-close audit held the milestone open (DW-009). The M0/M1 accepted foundational
orphans avoided this precisely because each named a **dependency-declared**
consumer task that existed in the queue. When deferring wiring, either file the
consumer task immediately or record an explicit accept-the-orphan disposition —
don't leave a bare "later" pointer.

## Testing Patterns

### E2E coverage of cross-member flows catches RLS-at-creation/permission bugs that own-resource smoke tests structurally cannot

A smoke test that only ever exercises the signed-in user's OWN resources can pass
green while a whole class of cross-member permission bugs stays latent. The worked
example: the `@smoke` suite only ever viewed the user's OWN hot dog, so it never
hit the fact that `storage.createSignedUrl` is **RLS-gated at creation** and the
`hotdogs` SELECT policy is owner-only — meaning a member could not mint a signed
URL for ANOTHER member's image. The bug (P0, latent since TASK-024) surfaced the
instant the deferred TASK-032 E2E (`tests/feed-detail.e2e.ts`) viewed a different
member's dog for the first time, and was fixed by TASK-033 (sign server-side with
the service client after the auth gate — decision #27).

The lesson: for any feature whose point is that members interact with EACH OTHER's
content (feed, reactions, votes, walls, DMs, mustard), the E2E must drive a SECOND
member against the FIRST member's resource. Own-resource smoke coverage is
structurally blind to permission/visibility bugs on the cross-member path. Don't
let "the unit tests cover the orchestration" defer the cross-member E2E
indefinitely (DW-011 was deferred from M2 to M3 — it paid for itself the moment it
ran).

## Deploy / Ops Patterns

### A red keep-alive workflow whose `ping` passes but a later RPC step 404s means HOSTED SCHEMA DRIFT, not a secrets or auto-pause emergency

Diagnose a red daily keep-alive run by **which step fails**, not by reflexively
re-checking secrets. Two distinct failure modes:

- The **`ping` step itself fails** → reachability/secrets. Re-check the
  `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` repo secrets first (the older
  [[CLAUDE]] "re-check secrets first" guidance applies HERE only).
- **`ping` passes but a later RPC step** (`tally`, the future M4 `prune`) **returns
  a PostgREST 404** → **hosted schema drift**: that RPC's migration was never
  `supabase db push`ed to hosted. It is **NOT** a secrets problem (a green `ping`
  proves the project is reachable and the key is valid) and **NOT** necessarily an
  auto-pause emergency (the daily `ping` read keeps the hosted DB alive even while
  the workflow shows red, so the 7-day timer keeps resetting).

Remedy: `supabase db push` the missing migration(s), then re-trigger the workflow.
Prevention: push migrations to hosted **per-milestone** (at milestone close, or
whenever a migration lands), not just at going-live — so a milestone's new RPCs are
reachable on hosted before any scheduled job calls them.

Worked example (handoff-010): the M2/M3 migrations had never been pushed to hosted
since the M0/M1 going-live, so `tally_top_dog_day()` 404'd and the keep-alive ran
red for 4 days while `ping` stayed green. `supabase db push` (three migrations) +
re-trigger fixed it with no repo diff. This refines the standing [[CLAUDE]]
keep-alive gotcha, which now records both failure modes. The gate recurs at M4:
TASK-042's prune migration must be pushed to hosted before the prune step ships.

## Security / RLS Patterns

### Gate a privileged-but-cosmetic write with a `WITH CHECK` on a server-maintained, non-client-writable column — not an RPC

When a flair surface needs a "only the current Top Dog (or other privileged
role) may do X" gate but maintains **no denormalized counter**, the right shape
is a **plain owner-scoped RLS write** (the inverse of consuming-writes-via-RPC)
whose INSERT policy adds an authorization conjunct reading a server-maintained,
**non-client-writable** column (e.g. `profiles.is_current_top_dog`, locked down
by decision #25). The gate is trustworthy precisely because the caller cannot
forge the column it reads — so no SECURITY DEFINER RPC is needed just to enforce
the authorization. Worked example: `mustard_sprays_insert_top_dog` (M4 /
TASK-041). This recurs whenever a future surface is "only Top Dog can …" (a
candidate at M5+). Full mechanics live in the [[CLAUDE]] "Cosmetic / many-allowed
tables" gotcha — this is the cross-session pointer that it is a **reusable design
choice**, layered on decisions #12/#15/#25, not a one-off.

## Navigation Patterns

### `TASKS.md` is an index, not the queue body (since 2026-06-11)

The task queue uses the indexed per-milestone layout. `TASKS.md` is the
dashboard/index only — the per-task detail and status live in
`workflow/tasks/milestone-NN-slug.md`. To find the active work, read the milestone file
the index points to (the milestone file is the source of truth for per-task
status; the index Progress column is a coarse rollup). Completed pre-migration
milestones (M0, M1) are in `workflow/tasks/TASKS-ARCHIVE.md`; cross-milestone work is in
`workflow/tasks/discovered.md` and `workflow/tasks/deferred.md`. New completed milestones freeze in
their own file — never move completed tasks out to the archive.
