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
