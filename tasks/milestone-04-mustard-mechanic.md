# Milestone M4: Mustard Mechanic

> **Status:** `active`
> Index: [[TASKS]] · Architecture: [[PROJECT]] · Conventions: [[CLAUDE]]
> **Goal:** spray + render-time decay + >24h prune.

## Active Tasks

### TASK-042: Mustard prune job [`pending`] [`P1`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-041
**Description:** Bound table growth (adversarial finding C).
**Acceptance Criteria:**

- [ ] Daily job deletes sprays older than 24h
- [ ] Wired into the keep-alive workflow alongside the tally

## Completed Tasks (this milestone)

### TASK-040: Mustard decay math [`complete`] [`P1`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-021
**Description:** Render-time decay (finding C). TDD.
**PR:** #53 (`5afd0da`, squash-merged) · **Reviewer:** APPROVE · **Fix cycles:** 0
**Acceptance Criteria:**

- [x] Pure function: given sprayed_at + now, returns opacity (full -> 0 over 24h)
- [x] Tests: fresh, half-life, expired, future timestamp guard

**Notes:**

**Pure render-time math seam — zero schema, RLS, RPC, migration, or
dependency change.** New module `src/lib/features/mustard/decay.ts` mirrors
the established pure-logic shape of `voting/ranking.ts`: a plain `.ts` module
with **no SvelteKit/Supabase imports**, fully unit-testable, holding the
single source of truth for how a mustard spray fades. It exports
`MUSTARD_LIFESPAN_MS = 24h` and `mustardOpacity(sprayedAt, now)`, which
returns an opacity in `[0,1]` — `1.0` at age 0, linear decay to `0.0` across
the 24h lifespan, clamped to `0.0` once expired (never negative), with a
future-timestamp clock-skew guard that clamps to `1.0`. It accepts
`Date | string | number` (ISO strings are how a Postgres `timestamptz`
arrives over PostgREST) and throws on an invalid/unparseable date — validate
at the boundary, fail explicitly.

**Realizes decision #15** (mustard decays over 24h; drip/opacity computed at
**RENDER time** from the stored timestamp, **no cron** for rendering). This is
the pure math half of that decision — the [[CLAUDE]] gotcha that "mustard +
emoji are render-time computations; never persist the decayed output" is what
keeps this seam render-only. It is a straightforward implementation of an
existing decision, so it adds **no new architecture-decision row**.

**TDD-first (tester-led), per decision #2** (mustard decay is one of the
named TDD-first pure-logic specs). The tester wrote `decay.test.ts` first; the
implementer satisfied it. Co-located `src/lib/features/mustard/decay.test.ts`
carries 19 Vitest cases: fresh / quarter-life / half-life / three-quarter-life
/ exact-24h boundary / 48h over-life clamp / the 24h−1ms micro-boundary /
clock-skew (future timestamp) / `Date` vs ISO vs epoch-number input parity /
invalid-input throws / and a `[0,1]` range sweep.

**Orphan-by-design seam, with a named immediate consumer.** `decay.ts` has no
non-test caller yet — TASK-041 (Mustard spray + render) is the immediate
consumer that will compute per-spray opacity at render. This is the same
accepted "pure seam lands before its UI consumer" pattern used for
`voting/ranking.ts` (`selectTopDog` before the vote RPC) and the M0/M1
foundational orphans — not dead code, but a TDD'd seam with a
dependency-declared consumer. **No Discovered Work logged:** the orphan is
accepted-by-design with TASK-041 as the named consumer, and the one review
note was fixed in-PR (below).

**Post-approval comment-only tidy.** After APPROVE, a stale `// TDD STUB`
header on the module was replaced with a "no non-test caller by design" note
mirroring the doc style of `voting/ranking.ts` — comment-only, no behavior
change. (This is the inverse of the DW-010 hazard: rather than leaving an
about-to-be-stale comment, the seam's doc now states its orphan-by-design
status explicitly.)

**Metrics:** `pnpm test` 442/442, `pnpm check` 0 errors, `pnpm lint` clean.
Reviewer APPROVE, 0 fix cycles.

This task does **not** close M4 — TASK-041 (spray + render) and TASK-042
(>24h prune job) remain. **Hosted-migration reminder for M4:** TASK-041/042
add the `mustard_sprays` migration and the second prune RPC wired into the
keep-alive workflow; per the handoff-010 lesson, those migrations must be
`supabase db push`ed to hosted before the prune step ships, or the keep-alive
workflow will 404 exactly as the M2/M3 migrations did.

### TASK-041: Mustard spray + render [`complete`] [`P1`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-040
**PR:** #55 (`e1eafb9`, squash-merged) · **Reviewer:** APPROVE · **Fix cycles:** 0
**Acceptance Criteria:**

- [x] `mustard_sprays` migration + RLS (only current Top Dog may insert)
- [x] Top Dog sprays on a target PROFILE at (x,y); unlimited sprays
- [x] Sprays render with computed decay; persist across crown changes

**Notes:**

**Cosmetic flair with an extra authorization conjunct — a plain RLS write
gated by a Top-Dog `WITH CHECK`, NOT a SECURITY DEFINER RPC.** Migration
`supabase/migrations/20260616163055_mustard_sprays.sql` adds the
`mustard_sprays` table (`id`, `sprayer_id` → `profiles on delete cascade`,
`target_profile_id` → `profiles on delete cascade`, `x`/`y` `real` in `[0,1]`
with range CHECKs, `sprayed_at timestamptz`), an index on `target_profile_id`
(the per-profile render read), and `extensions.gen_random_uuid()`
schema-qualified per the M0 hosted-parity lesson. Like `hotdog_reactions`
(decision #12 / TASK-030), the table has **no denormalized counter, no
trigger, and nothing that touches `vote_count` / `peak_votes` / the crown** —
so the "no ranking effect" half of decision #15 holds **structurally**, and
the write is a **plain owner-scoped RLS insert, the deliberate inverse of the
consuming-writes-via-RPC convention** (the RPC convention exists only to
maintain a counter transactionally; there is nothing here to maintain).

**The new wrinkle vs the reactions precedent — an authorization predicate on
INSERT.** Where `hotdog_reactions` insert is just `(select auth.uid()) =
user_id`, the `mustard_sprays_insert_top_dog` policy adds a second conjunct:
`sprayer_id = (select auth.uid()) AND EXISTS (select 1 from profiles p where
p.id = (select auth.uid()) and p.is_current_top_dog)`. So only the **current
Top Dog** may insert, and the sprayer is pinned to the caller. **Why the gate
is trustworthy:** the `is_current_top_dog` column it reads is server-maintained
by `recompute_top_dog()` (SECURITY DEFINER) and **non-client-writable**
(decision #25 — verified in place at review), so a member cannot set their own
crown to self-satisfy the check. There is **no UPDATE and no DELETE policy** —
sprays are **immutable and persistent** across crown changes (decision #15);
default-deny covers both, and removal of faded rows is reserved entirely for
the TASK-042 daily prune job (a future SECURITY DEFINER RPC that bypasses RLS),
never the sprayer or target. This "plain-RLS cosmetic write + a `WITH CHECK`
that authorizes against a non-client-writable crown column" is captured as a
reusable [[CLAUDE]] gotcha (extending the "Cosmetic / many-allowed tables"
gotcha) for any future privileged-but-cosmetic surface — it is a technique
layered on decisions #12/#15/#25, not a new architecture invariant, so **no new
decision row**.

**Trust boundaries (L2), verified at review.** The `spray` form action takes
the **sprayer from the session** (`safeGetSession()`, never client-supplied),
the **target from the trusted route param** (`params.handle`), and only the
`x`/`y` coordinates from the form (validated at the `addSpray` boundary, with
the DB range CHECKs as backstop). The Top-Dog gate is RLS-enforced and **not
bypassable**: a non-Top-Dog caller is rejected (`42501` → `NOT_TOP_DOG`
friendly error), `sprayer_id` cannot be forged, and the gate column can't be
self-satisfied. Cross-crown persistence was proven with a byte-for-byte
deep-equal E2E assertion (sprays survive a crown change).

**Server module + render wiring — consuming the TASK-040 decay seam.**
`src/lib/features/mustard/sprays.ts` adds `addSpray(supabase, sprayerId,
targetProfileId, x, y)` and `listSpraysForProfile(supabase, targetProfileId)`
on the RLS-scoped client passed in, returning a discriminated `SprayResult<T>`
(`SprayRow`), mapping `42501` → `NOT_TOP_DOG` and `23514` → position error, and
applying a last-24h read filter via `MUSTARD_LIFESPAN_MS`. This is the **named
immediate consumer** TASK-040 declared: the previously orphan-by-design
`mustardOpacity` / `MUSTARD_LIFESPAN_MS` are now wired. The profile page
(`src/routes/(protected)/app/profile/[handle]/+page.server.ts` +
`+page.svelte`) load gained `safeGetSession()` and returns `{ profile,
avatarUrl, sprays, canSpray }` (`canSpray` = the viewer's own
`is_current_top_dog`); the UI renders an absolutely-positioned mustard overlay
with `opacity = mustardOpacity(sprayed_at, now)` (render-time decay, the DB
stores only the raw timestamp) and a click-to-spray affordance shown only when
`canSpray`. Reads degrade gracefully (empty `sprays` / `canSpray = false`) on
failure rather than blanking the page.

**Mode + coverage.** Standard implementer-first, test-after (the spray write
is wiring, not pure logic). New unit specs `sprays.test.ts` and
`profile/[handle]/spray-action.test.ts`, updated `profile/[handle]/
profile-load.test.ts`, and a live-DB `tests/mustard.e2e.ts` (`@security`,
5 new RLS cases) proving the Top-Dog INSERT gate, the forged-`sprayer_id`
rejection, and cross-crown persistence against a live Postgres.

**One minor non-blocking review finding logged as DW-017:** the `spray` action
parses coordinates with `Number(formData.get(...))`, so a missing/empty value
coerces to `0` — a valid in-range position — spraying at `(0,0)` instead of
returning 400. Cosmetic-only, Top-Dog-gated, no security / ranking / cross-user
impact; current behavior is pinned by a unit test, so a fix must update that
test. Accepted / deferred non-blocking.

**Metrics:** `pnpm test` 481/481, `pnpm check` 0 errors, `pnpm lint` clean,
`@security` 36 (incl. the 5 new mustard RLS tests), `@smoke` 4. Reviewer
APPROVE, 0 fix cycles. **M4 stays open** — TASK-042 (>24h prune job) remains;
per the handoff-010 / 2026-06-16 hosted-drift lesson, the `mustard_sprays`
migration and TASK-042's prune RPC must be `supabase db push`ed to hosted
before the prune step ships, or the keep-alive workflow will 404 exactly as the
M2/M3 migrations did.

---

> **No caps.** Acceptance criteria, subtasks, and integration points are
> unbounded. Give each task as much specificity as it needs to be completed to
> spec — never trim detail to hit a count.
