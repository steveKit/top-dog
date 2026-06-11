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
