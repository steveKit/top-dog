# Top Dog — Agent Memory

Stable, cross-session patterns learned during execution. Not a changelog (that's
[[Handoffs/]]) and not conventions/gotchas (those live in [[CLAUDE]]). Only
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
again PR #26 each had to fix pre-existing markdown drift to get the gate green.
Run `pnpm exec prettier --write` on edited markdown (documenter output and/or
director pre-commit) so bookkeeping never red-flags the gate.

Related Bash-hook gotcha: don't chain `git checkout -b <branch> && git commit`
in one Bash call. The pre-tool-safety hook reads the **current** branch BEFORE
the compound command runs and rejects it as a commit-on-main. Run the branch
creation and the commit as separate steps.

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

## Navigation Patterns

### `TASKS.md` is an index, not the queue body (since 2026-06-11)

The task queue uses the indexed per-milestone layout. `TASKS.md` is the
dashboard/index only — the per-task detail and status live in
`tasks/milestone-NN-slug.md`. To find the active work, read the milestone file
the index points to (the milestone file is the source of truth for per-task
status; the index Progress column is a coarse rollup). Completed pre-migration
milestones (M0, M1) are in `TASKS-ARCHIVE.md`; cross-milestone work is in
`tasks/discovered.md` and `tasks/deferred.md`. New completed milestones freeze in
their own file — never move completed tasks out to the archive.
