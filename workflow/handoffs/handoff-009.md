# Handoff 009 — 2026-06-12

## Session Summary

This session **completed and closed Milestone M3 — Reactions & Per-Dog Stats**
in one sitting (4 tasks: TASK-030/031/032/033). The previous session (008) had
just closed M2.

Branch: `main` (all work merged; no open PRs). Session base = `8140604`.

Merged PRs:

- **#43 `b27dc63`** — `feat(reactions)`: cosmetic hot dog reactions on the feed
  (**TASK-030**). New `hotdog_reactions` migration + owner-scoped RLS,
  `src/lib/features/reactions/` (`emojiSet`/`summarize`/`reactions`),
  `ReactionBar.svelte`, feed wiring. Counts at read time, no denormalized
  counter → structurally no ranking effect (decision #12). Reviewer **APPROVE**,
  **0 fix cycles**.
- **#44 `ba37994`** — `docs(bookkeeping)`: TASK-030 notes + M3 progress + DW-012.
- **#45 `e1ffa0e`** — `feat(hotdogs)`: per-dog stats + dog detail view
  (**TASK-031**). `peak_votes` display + new `/app/dogs/[id]` detail route +
  `src/lib/features/hotdogs/detail.ts` (`getDogDetail`). **DW-010** (obsolete
  `votes.ts` comment) folded in. Reviewer **APPROVE**, **0 fix cycles**.
- **#46 `5aaf639`** — `docs(bookkeeping)`: TASK-031 notes + promoted DW-011 →
  TASK-032.
- **#47 `5cf5879`** — `fix(storage)`: non-owner signed-URL rendering + dog-detail
  404 (**TASK-033** P0 fix + **TASK-032** E2E). Reviewer **APPROVE**, **1 fix
  cycle**.
- **#48 `bc659c9`** — `docs(bookkeeping)`: close M3 (TASK-032/033 notes, M3 close
  notes, tag).

Milestone tag **`milestone-03-reactions-per-dog-stats`** was created and pushed
on `5cf5879`. The M3 wiring audit passed (no orphans). Final gates after a clean
`supabase db reset` baseline: unit `pnpm test` **423/0**, `pnpm check` **0
errors**, `pnpm lint` clean, `@smoke` **4/0**, `@security` **31/0**.

### The headline — a P0 caught by a deferred E2E

TASK-032 was the promoted DW-011 (`/app/feed` E2E deferred since M2). Writing it
**surfaced a P0 latent since TASK-024**: the feed and dog-detail loads minted
`hotdogs` signed URLs with the **viewer's RLS-scoped client**, but the `hotdogs`
bucket SELECT policy is owner-only (`hotdogs_select_own`) and `createSignedUrl`
is **RLS-gated at creation** — so members could not see each other's dog images
(every non-owned image rendered "Image unavailable"). It was masked because
`@smoke` only ever viewed the user's OWN dog. TASK-033 fixed it (user-approved
Option 1): mint feed/detail signed URLs **server-side with `getServiceClient()`
after the `safeGetSession()` gate**, signing only `image_path` from rows the
member's own RLS query already returned; the queries stay RLS-scoped, decision
#6's private-bucket + 1h-TTL model is preserved, and no storage RLS / bucket
change was needed. A malformed-id → 404 guard (`isUuid()`) and unit lock-in
tests (the signer must be the service client, not `event.locals.supabase`) round
it out. **The deferred E2E earned its keep.**

## Key Decisions

- **Decision #27 (new [[PROJECT]] architecture-decision row): cross-member views
  of private-bucket content sign signed URLs server-side with the service
  client**, after the `safeGetSession()` auth gate — because
  `storage.createSignedUrl` is RLS-gated at creation and the viewer's RLS-scoped
  client can only sign its OWN objects (the `hotdogs_select_own` policy is
  owner-only). This is the corrected realization of decision #6 (private bucket +
  signed URLs): the bucket stays private and URLs stay 1h-TTL signed; only the
  signer changes (RLS-scoped client → service client, for already-authorized
  rows). No storage RLS / bucket change.
- **Cosmetic / many-allowed tables use plain owner-scoped RLS, no RPC, no
  denormalized counter** (reactions) — the inverse of the consuming-writes-via-RPC
  convention, which exists only to maintain a counter transactionally. Because
  `hotdog_reactions` carries no server-maintained column, the "no ranking effect"
  guarantee (decision #12) holds **structurally**, not by code discipline.
  Already captured as a [[CLAUDE]] gotcha; no new decision row (decision #12
  implemented).

## Files Changed

This handoff session's bookkeeping (PROJECT / MEMORY / CLAUDE / this handoff)
plus the merged feature/docs PRs above. The substantive code surfaces landed
across PRs #43/#45/#47:

- `supabase/migrations/20260612104439_hotdog_reactions.sql` — NEW (TASK-030):
  `hotdog_reactions` table, `UNIQUE(user_id, hot_dog_id, emoji)`, owner-scoped
  RLS insert/delete, no denormalized counter.
- `src/lib/features/reactions/` — NEW (TASK-030): `emojiSet.ts`, pure
  `summarize.ts`, server `reactions.ts` (discriminated `ReactionResult`).
- `src/lib/components/ReactionBar.svelte` — NEW (TASK-030): Svelte 5 runes
  picker, wired into `/app/feed`.
- `src/lib/features/hotdogs/detail.ts` — NEW (TASK-031): `getDogDetail` →
  discriminated `DetailResult<DogDetail>`, `DOG_NOT_FOUND` sentinel.
- `src/routes/(protected)/app/dogs/[id]/+page.server.ts` + `+page.svelte` — NEW
  (TASK-031): detail route (404/500 mapping, Stats block, read-only reaction
  summary, `<TopDogBadge>`). The load mints the image signed URL via the service
  client after the auth gate (TASK-033 P0 fix).
- `src/routes/(protected)/app/feed/+page.server.ts` — MODIFIED (TASK-033): feed
  signed URLs now minted via `$lib/server getServiceClient()` after
  `safeGetSession()`; queries stay RLS-scoped.
- `src/lib/storage/paths.ts` — MODIFIED (TASK-033): added `isUuid()` (reusing
  `UUID_RE`) backing the malformed-id 404 guard.
- `tests/feed-detail.e2e.ts` — NEW (TASK-032): live-LOCAL-stack `@smoke` —
  feed cast/move/remove + react toggle + non-owner detail render/decode + 404 on
  missing/malformed ids; serialized under `workers: 1`.
- Unit lock-in: `detail-load.test.ts`, `feed-action.test.ts` assert the signer
  is the service client, not `event.locals.supabase`.
- `PROJECT.md` — MODIFIED (this handoff): added decision #27.
- `workflow/memory/MEMORY.md` — MODIFIED (this handoff): two new cross-session patterns.
- `CLAUDE.md` — MODIFIED (this handoff): Project Map latest-handoff pointer →
  `[[workflow/handoffs/handoff-009]]`.
- `workflow/handoffs/handoff-009.md` — NEW (this file).

## Blockers & Open Questions

None blocking. No `[in_progress]` tasks — M3 is fully closed.

## Discovered Work

Open items, all small, tracked in [[workflow/tasks/discovered]]:

- [ ] **DW-012** — interim hardcoded `REACTION_EMOJIS` set; source from the M6
      emoji library once it lands. Found during TASK-030.
- [ ] **DW-014** — `tests/votes.e2e.ts` pinned fixture-id collision (the
      documented `supabase db reset` precondition); randomize ids. Found during
      TASK-031, reconfirmed TASK-033.
- [ ] **DW-015** — add direct `isUuid` unit coverage in `paths.test.ts` (the
      route test mocks it). Found during TASK-033.
- [ ] **DW-016** — extract the shared service-role E2E helpers
      (`serviceClient` / `resetCrownField` / `voteCount` / `crownState`) into
      `tests/helpers/`. Found during TASK-033.

## Next Steps

Prioritized — see [[TASKS]] for full queue context:

1. **[P2] Activate M4 — Mustard Mechanic** — the next milestone, pre-exploded at
   [[workflow/tasks/milestone-04-mustard-mechanic]]: Top Dog sprays mustard, render-time
   24h decay, a >24h prune job (TASK-042 reuses the decision #26 anon-callable,
   idempotent job pattern wired into the existing keep-alive workflow).
2. **[P3] Optional test-hygiene bundle** — DW-014/015/016 could land as one quick
   task before or after M4.
3. **[P3] DW-012** — naturally folds into M6 (Emoji Library).

## Files to Read on Resume

- [[PROJECT]] — M3 close notes, decisions (incl. new #27), data model.
- [[TASKS]] — index; M3 now in Completed Milestones, M4 next.
- [[workflow/tasks/milestone-04-mustard-mechanic]] — the next milestone.
- `src/routes/(protected)/app/feed/+page.server.ts` +
  `src/routes/(protected)/app/dogs/[id]/+page.server.ts` — the service-client
  signing pattern (the P0 fix).
- [[CLAUDE]] — the new gotcha on `createSignedUrl` being RLS-gated at creation.

## Library Candidates

_None — all new components/modules are domain-specific (hot dogs, reactions,
voting) or trivial one-offs._

See [[workflow/handoffs/handoff-008]] for prior session context.
