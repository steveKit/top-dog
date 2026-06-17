# Handoff 014 — 2026-06-17

> **CLEAN SESSION END.** No PR is open — every PR this session merged.
> Milestone **M6 — Emoji Library is CLOSED and tagged** (`milestone-06-emoji-library`,
> close commit `562a418`). The stale-task audit is clean (no `[in_progress]` tasks).
> The M5 hosted-push follow-up (**TASK-054**) is **DONE** this session — **walls & DMs
> now work on hosted** and the keep-alive run is green. `main` is clean and in sync
> with origin. Next: **M7 — Safety & Polish** (pre-exploded, ready to activate).

## Session Summary

Activated, built, **closed, and tagged Milestone M6 — Emoji Library**
([[tasks/milestone-06-emoji-library]]) — two tasks, both reviewer **APPROVE, 0 fix
cycles** — and **discharged the deferred M5 hosted-push ops follow-up (TASK-054)**, so
walls & DMs are now functional on hosted with a verified-green keep-alive. Branch:
`main`. **No PR is open.**

What landed (merged PRs, in order):

- **PR #71 `feat(emoji)`** — **TASK-060**, the **pure render-time emoji seam**. New
  dependency-free feature folder `src/lib/features/emoji/`: `emojiSet.ts` (curated
  `HOTDOG_EMOJIS` — `🌭 🥖 🌮 🥨 🧂 🍟 🔥`, deliberately single-codepoint /
  modifier-free so each is exactly one grapheme cluster — plus `isHotdogEmoji`) and
  `filter.ts` (`filterToHotdog` replaces every non-library emoji with a hot-dog emoji,
  iterating by grapheme **cluster** via `Intl.Segmenter` so ZWJ / skin-tone / flag
  sequences are never split mid-codepoint; `sprinkleHotdog` deterministically adds
  library emoji via a hand-written `mulberry32` PRNG — **zero deps**). Realizes
  **decision #16** (hot-dog-only library; filter at RENDER time; the ORIGINAL stored
  body is never mutated). **TDD-first** per decision #2 (RED → GREEN → verify).
  Orphan-by-design — TASK-061 is the named consumer, so no Discovered Work logged for
  the missing consumer. Reviewer APPROVE, 0 fix cycles.
- **PR #72 `feat(emoji)`** — **TASK-061**, **wired the filter into the render
  surfaces**, closing M6. New pure composition layer `src/lib/features/emoji/render.ts`:
  `renderWallBody(body, id)` = filter + a **seeded** sprinkle keyed on the message's
  immutable uuid `id` via a hand-written FNV-1a `stringToSeed` (so a wall message
  sprinkles the same way on every re-render); `renderMessageBody(body)` = **filter
  only** (the random sprinkle is scoped to wall messages by TASK-060's AC). Wired into
  **three components** — the profile wall, the DM thread, and the DM inbox preview —
  all keeping the body inside Svelte **auto-escaped text** (no `{@html}` → XSS-safe).
  Decision #16's "store original" guarantee holds **structurally** (the transform is
  only ever a render-time return value, never written back). 19 unit tests in
  `render.test.ts`. Reviewer APPROVE, 0 fix cycles.
- **PR `docs`** — task-queue + M6-close bookkeeping (per-task Notes, milestone moves,
  index rollup, tag) and the TASK-060-close bookkeeping pass.

**Milestone M6 closed + tagged** `milestone-06-emoji-library` (close commit `562a418`):
TASK-060/061 both complete; M6 moved to Completed Milestones in the [[TASKS]] index;
[[tasks/milestone-06-emoji-library]] is now its frozen archive.

**Out-of-milestone ops follow-up discharged — TASK-054 (deferred):** the user ran a
single `supabase db push` carrying **all three** previously-unpushed migrations
together (`20260616184139_wall_messages.sql`, `20260616191804_dms.sql`,
`20260617000000_restore_data_api_grants.sql`). Post-push keep-alive verification is
**green** (`workflow_dispatch` run 27714086568 — ping + tally + prune all 2xx).
**Walls & DMs are now functional on hosted.** The [[tasks/deferred]] row is marked
`done`.

## Key Decisions

- **No new architecture-decision row this session.** Both M6 tasks shipped **entirely
  on existing decision #16** (hot-dog-only library; filter at render; store original)
  — a direct implementation of a decision made at plenary, extending the project's
  established pure-logic-first seam pattern (`voting/ranking.ts`, `mustard/decay.ts`)
  one more time. The canonical decision table in [[PROJECT]] is unchanged.
- **Decision #16's "store original" now holds structurally end to end.** Because the
  M5 social surfaces (`wall_messages` / `dms`) store the body **verbatim** and the M6
  emoji transform is a pure render-time return value that is never written back, there
  is **no persist path that could corrupt the stored text** — the "store original,
  filter at render" guarantee is structural, not a code-discipline promise. The M5
  store-original discipline was the deliberate setup for exactly this.
- **Render is XSS-safe by construction.** All three render surfaces emit the filtered
  body through Svelte **auto-escaped text** (no `{@html}`), so emitting hot-dog emoji
  introduces no XSS surface. Recorded as a render-wiring property, not a decision row.

## Files Changed

This session's full feature diff (excluding bookkeeping markdown):

- `src/lib/features/emoji/emojiSet.ts` + `emojiSet.test.ts` — **NEW** (TASK-060):
  curated `HOTDOG_EMOJIS` + `isHotdogEmoji`.
- `src/lib/features/emoji/filter.ts` + `filter.test.ts` — **NEW** (TASK-060):
  `filterToHotdog` (grapheme-cluster-safe via `Intl.Segmenter`) + `sprinkleHotdog`
  (deterministic via a hand-written `mulberry32`, zero deps).
- `src/lib/features/emoji/render.ts` + `render.test.ts` — **NEW** (TASK-061): pure
  composition layer (`renderWallBody` = filter + seeded sprinkle via FNV-1a
  `stringToSeed`; `renderMessageBody` = filter only); 19 unit cases.
- `src/routes/(protected)/app/profile/[handle]/+page.svelte` — MODIFIED (TASK-061):
  wall messages rendered via `renderWallBody`.
- `src/routes/(protected)/app/messages/[handle]/+page.svelte` — MODIFIED (TASK-061):
  DM thread rendered via `renderMessageBody`.
- `src/routes/(protected)/app/messages/+page.svelte` — MODIFIED (TASK-061): DM inbox
  preview rendered via `renderMessageBody`.
- `CLAUDE.md` — MODIFIED (**this handoff**): Project Map latest-handoff pointer →
  `[[Handoffs/handoff-014]]`.
- `PROJECT.md` — MODIFIED across the session (M6 progress + close notes, milestones
  table, M6 row) and **this handoff** (Status M5 paragraph: TASK-054 done; a new
  Process note recording the hosted push + green keep-alive).
- `TASKS.md`, `tasks/milestone-06-emoji-library.md`, `tasks/discovered.md`,
  `tasks/deferred.md` — MODIFIED (M6-close bookkeeping; DW-019 resolved, DW-020 logged,
  TASK-054 → `done`). _Orchestration-state edits owned by the director; narrative
  Notes/log rows by the documenter._
- `memory/MEMORY.md` — MODIFIED (**this handoff**): sharpened the
  markdown-prettier-before-landing pattern with the M6 double-recurrence and an explicit
  documenter-cannot-self-format / director-runs-the-format-pass ownership note.
- `Handoffs/handoff-014.md` — **NEW** (this file).

## Blockers & Open Questions

No blockers. Hosted is healthy (keep-alive green, no auto-pause risk), `main` is clean
and in sync with origin, no open PRs, no in-progress tasks.

Two **process notes** worth carrying forward (neither blocking):

- **Main-commit / push hook boundary.** The pre-tool-safety hook blocks the director
  from committing or pushing to `main`, so **every** bookkeeping commit this session
  **and** the M6 milestone tag push needed the **user's hand**. This is the known
  constraint already recorded in [[memory/MEMORY]] ("Bookkeeping commits go through
  `chore/*` branches"). Standing option if it keeps adding friction: route future
  bookkeeping through branch + PRs consistently rather than direct-to-`main` attempts.
- **Documenter does not run prettier in-sandbox → `main` went lint-RED twice.**
  Unformatted bookkeeping markdown broke the lint gate at the **TASK-060 close** and
  again at the **M6 close**; the director caught and fixed each via the Verification
  Reflex (`prettier --write`). The documenter's sandbox often **denies** `prettier`, so
  it must format-by-construction and say so, and the director must run the format pass
  on the main thread before landing. The [[memory/MEMORY]] markdown-prettier pattern was
  sharpened this session to make that ownership explicit.

## Discovered Work

One item **resolved**, one **new open** item this session (both in
[[tasks/discovered]]):

- **DW-019 — resolved/accepted (TASK-061).** `filterToHotdog` membership is
  exact-string, so a **VS16-decorated variant of a library emoji** (e.g. `🔥` + U+FE0F)
  is replaced with `🌭` rather than preserved. Accepted as benign against decision #16
  (the output is still a hot-dog emoji); the `render.ts` header comment documents the
  call. No grapheme-normalization pass warranted.
- [ ] **DW-020 — open (TASK-061).** No E2E asserts the **browser-rendered** wall/DM
      **DOM** shows the FILTERED body. The store-original half is covered by
      `tests/walls.e2e.ts`'s verbatim-body test and the render wiring by `render.test.ts`
      (19 unit cases), so this is an **accepted tracked gap**, not unwired functionality —
      the sibling of DW-011 / DW-013, a candidate for a future M6/M7 E2E hardening task.

## Next Steps

Prioritized — see [[TASKS]] for full queue context:

1. **[next milestone] Activate M7 — Safety & Polish** (pre-exploded, ready —
   [[tasks/milestone-07-safety-polish]]). Server-side upload limits, a report button,
   and final polish. Activate via a status flip on the user's say-so (it already
   carries full task detail; no planner dispatch needed). **Note for M7 dispatch:** any
   task that adds a migration re-triggers the per-milestone hosted-push gate (push to
   hosted before any scheduled keep-alive step calls a new RPC); M6 added no migrations,
   so there was no M6 gate.
2. **[optional E2E hardening] DW-020** — a render-DOM E2E that drives a real browser and
   asserts the filtered wall/DM body in the page (and, ideally, a second member's view).
   The natural home is an M7 hardening task, alongside the other accepted E2E gaps
   (DW-011 / DW-013 are already closed by `feed-detail.e2e.ts`).
3. **Nothing urgent or blocking.** Hosted is healthy; no auto-pause risk; no open PRs.

## Files to Read on Resume

- [[PROJECT]] — M6 close notes + the new Process note recording the TASK-054 hosted
  push (the lasting state of the session); the Milestones table (M0–M6 complete,
  M7 pending).
- [[TASKS]] — index: M6 complete, **M7 next** (pre-exploded, ready to activate).
- [[tasks/milestone-06-emoji-library]] — the frozen M6 archive (per-task detail).
- [[tasks/milestone-07-safety-polish]] — the next milestone's task detail.
- `src/lib/features/emoji/` (`emojiSet.ts`, `filter.ts`, `render.ts`) — the pure emoji
  seam + its render-time composition layer (the whole M6 surface).
- [[tasks/discovered]] — DW-020 (the new render-DOM E2E gap) and the open backlog.
- [[memory/MEMORY]] — the sharpened markdown-prettier / format-ownership pattern and the
  `chore/*`-branch bookkeeping constraint (both bit this session).

## Library Candidates

_None extractable._ The emoji library (`HOTDOG_EMOJIS`, `filterToHotdog`,
`sprinkleHotdog`, `renderWallBody`) is **hot-dog-domain-specific** by design — the whole
point is replacing arbitrary emoji with the curated hot-dog set, which is not reusable
outside this project. The two general-purpose primitives it embeds — `mulberry32`
(seeded PRNG) and the FNV-1a `stringToSeed` — are **trivial inline utilities** (a handful
of lines each, copy-paste-cheaper-than-a-dependency), not worth extracting to the
[[component-library]]. Assessed and declined.

See [[Handoffs/handoff-013]] for prior session context.
