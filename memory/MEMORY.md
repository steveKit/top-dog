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
