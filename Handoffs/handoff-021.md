# Handoff 021 — 2026-07-08

> **CLEAN MAINTENANCE SESSION — NO PRODUCT TASKS.** Two docs/config PRs merged to `main` — **PR
> #143** (`d2e660b`, `chore(workflow): migrate to workflow v5 + relocate design artifacts to
docs/design`) and **PR #144** (`919f094`, `docs: fix pre-existing prettier drift + update
living-doc design paths`). Branch: `chore/handoff-021` (this bookkeeping; squash-merges to
> `main`); no open PRs. **No milestone or task status changed** — **M8 stays COMPLETE (16/16,
> closed 2026-06-23)** and **M9 — Operator / Admin Dashboard** stays a `pending` stub. **No new
> architecture-decision row — the [[PROJECT]] decision table stays at #29.**

## Session Summary

A pure maintenance / hygiene session — no queued product work. Session base: `80807c0`
(post-handoff-020, M8 closed). Two PRs landed, both docs/config only:

- **PR #143 — workflow v5 config-sync + design relocation.** Ran `/migrate-workflow` in
  config-sync mode: stamped `workflow-version: 5` in [[CLAUDE]], added the machine-readable
  `testing-paradigm: adaptive` key to the Testing Strategy section, and created [[Handoffs/INDEX]]
  (the append-only handoff index, backfilled with handoff-001..020). In the same PR, relocated the
  design artifacts from repo-root `design/` → `docs/design/snacktum-snacktorum/` per the
  [[design-intake]] rule (`docs/design/<feature>/`), via `git mv` so history is preserved (31
  files, R100/R099 renames). Updated the two load-bearing ignore configs — `.prettierignore` and
  `eslint.config.js` — from `design/` → `docs/design/`, and added a point-in-time `status:` genre
  header to the relocated `page-design-prompts.md`.
- **PR #144 — living-doc design paths + a pre-existing prettier fix.** Retargeted the design-path
  references in the two LIVING docs to the new location — [[CLAUDE]] (2 refs) and [[PROJECT]] (20
  refs). Deliberately LEFT the ~17 `src/**` code comments and the frozen handoff / milestone
  archives pointing at the old `design/` path as historical provenance (see Key Decisions). Also
  fixed a **pre-existing** prettier drift in [[tasks/discovered]] (already red on `main`, unrelated
  to any code change this session) so full `pnpm lint` is green again.

## Key Decisions

**No new numbered architecture-decision row** — [[PROJECT]]'s decision table stays at **#29** (no
schema / RPC / stack / infra change). Three lasting session decisions (status / process, not
numbered rows):

1. **Migrated to workflow v5.** `workflow-version: 5` is now stamped in [[CLAUDE]], the
   `testing-paradigm: adaptive` key is machine-readable in the Testing Strategy section, and the
   handoff set has an append-only [[Handoffs/INDEX]].
2. **Design artifacts now live at `docs/design/snacktum-snacktorum/`** (moved from repo-root
   `design/`), aligning with the [[design-intake]] `docs/design/<feature>/` convention. The
   design-source lint / prettier ignore now targets `docs/design/`.
3. **Only living docs were retargeted; frozen archives + code comments keep the old `design/` path
   as provenance.** Living docs ([[CLAUDE]], [[PROJECT]]) describe current shape and were swept to
   the new path; the frozen handoff / milestone-archive files and the ~17 `src/**` code comments
   are point-in-time records of intent at their moment and were intentionally left pointing at
   `design/`. This mirrors the living-vs-point-in-time genre split — point-in-time records are
   superseded, never updated.

## Files Changed

Source of truth is the two merged PRs (#143, #144); this is a derived summary. Per the diff vs
`80807c0`:

- `CLAUDE.md` — **MODIFIED** (PR #143 + #144, and this handoff): `workflow-version: 5` stamped;
  `testing-paradigm: adaptive` key added; 2 design-path refs → `docs/design/`; Project Map "latest
  handoff" pointer → `[[Handoffs/handoff-021]]` (this handoff).
- `PROJECT.md` — **MODIFIED** (PR #144 + this handoff): 20 design-path refs → `docs/design/`; (this
  handoff) **Last Updated** → 2026-07-08 + a maintenance-session Status note.
- `.prettierignore`, `eslint.config.js` — **MODIFIED** (PR #143): design-source ignore `design/` →
  `docs/design/`.
- `tasks/discovered.md` — **MODIFIED** (PR #144): pre-existing prettier drift fixed (formatting
  only, no content change).
- `Handoffs/INDEX.md` — **NEW** (PR #143), + **MODIFIED** (this handoff): created as the
  append-only handoff index (rows 001–020); this handoff appends the 021 row.
- `design/**` → `docs/design/snacktum-snacktorum/**` — **MOVED** (PR #143, 31 files, R100/R099
  `git mv`, history preserved); the relocated `page-design-prompts.md` gained a point-in-time
  `status:` header.
- `Handoffs/handoff-021.md` — **NEW** (this file).

## Blockers & Open Questions

`main` is clean, no open PRs, hosted healthy (the daily keep-alive `ping` keeps the DB alive). All
carry-forward, none local-blocking:

- **No CI on PRs.** There is still no CI pipeline running lint / typecheck / test on PRs (only the
  keep-alive cron). The user deferred it again this session — fold it into M9 activation or ship it
  as a standalone task (see Next Steps).
- **Standing hosted `supabase db push` batch (user's hand, async, NOT a milestone blocker).** One
  hosted push batches: the two M7 migrations (`burger_alarms`, `burger_verdicts`), the TASK-094
  prune-retirement migration (`20260622120000_retire_mustard_prune.sql`, decision #29), and the
  TASK-083 hosted recovery-email template (or hosted sends a recovery LINK, not a 6-digit CODE, and
  `/reset-password` breaks on hosted). No auto-pause risk. See the [[TASKS]] standing-op note.
- **DW-041 (open):** `app_storage_bytes()` is anon-callable — tighten its grants during M9 (its
  storage-used metric consumes the function) or as a standalone one-line migration sooner.
- The carried M8 tweak-session items — **DW-039** (Summon has no inbound nav link; the shell's "＋
  Summon a Frank" button targets upload), **DW-040** (`shell-nav-court` CSS class un-normalized
  after court → tribunal), **DW-031** (orphaned brand/sigil assets), **DW-033** (session-less
  Sigil-step dead-end) — all non-blocking.

Two process notes (recurring, both in [[memory/MEMORY]]): this repo's agents can't run the live
gates (`supabase` / `docker` / Playwright / `git` / `prettier` are denied in subagent sandboxes —
the director runs DB-dependent verification, the final `prettier --write`, and all git on the main
thread); and `main` is hook-protected, so ALL commits (feature, bookkeeping, AND handoffs) go
through a `chore/*` / `docs/*` branch + squash self-merge, never a direct commit / push to `main`.

## Discovered Work

_No new discovered-work items this session_ (docs/config-only). The standing backlog is unchanged:
the newest item, **DW-041** (`app_storage_bytes()` anon-callable, logged 2026-06-30 by a read-only
Supabase security audit), carries open toward M9; the M8 tweak-session items (DW-039 / DW-040 /
DW-031 / DW-033) and the older standing backlog all carry open. See [[tasks/discovered]].

## Next Steps

Prioritized — see [[TASKS]] and the M9 stub for full context:

1. **[user] Activate M9 — Operator / Admin Dashboard via the planner.** The stub is an
   operator-only `/admin` area of read-only aggregates over existing data. The key activation
   decision is **admin authorization** — a server-side operator-id allowlist is recommended over a
   non-client-writable `is_admin` column. Fold in **DW-041** (tighten `app_storage_bytes()` grants,
   since M9's storage-used metric consumes it). Dispatch the **planner** to explode the stub.
2. **[optional] Add a CI workflow** (lint + typecheck + test on PRs) with `timeout-minutes` +
   concurrency-cancel hygiene. Either its own standalone task or folded into M9 activation.
3. **[user, standing, async] Push the outstanding migrations + recovery-email template to hosted.**
   One `supabase db push` / config push batches the two M7 migrations + the TASK-094 prune-retire
   migration + the TASK-083 recovery template. No urgency, no auto-pause risk.

## Files to Read on Resume

- [[PROJECT]] — Status (M8 COMPLETE 16/16, closed 2026-06-23; this maintenance session noted), the
  Milestones table, and the Architecture Decisions table (at **#29**).
- [[TASKS]] — the M9 — Operator / Admin Dashboard stub (the activation decision + the DW-041
  fold-in) and the standing hosted-push op note.
- [[CLAUDE]] — now stamped `workflow-version: 5` with `testing-paradigm: adaptive`; design-path
  refs point at `docs/design/`; the gotchas + Forms-&-validation CANON are unchanged.
- [[tasks/discovered]] — DW-041 and the carried M8 tweak-session backlog.

## Library Candidates

_None extractable (assessed)._ A docs/config-only maintenance session produced no components —
consistent with handoff-016..020's assessment that the theme-token / self-hosted-font / cult-flair
patterns remain entangled with the project, not yet a clean extraction.

See [[Handoffs/handoff-020]] for prior session context (M8 close — Summon / Tribunal / Catechism /
the error boundary; all in-app leaves renamed).
