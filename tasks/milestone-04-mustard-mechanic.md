# Milestone M4: Mustard Mechanic

> **Status:** `active`
> Index: [[TASKS]] · Architecture: [[PROJECT]] · Conventions: [[CLAUDE]]
> **Goal:** spray + render-time decay + >24h prune.

## Active Tasks

### TASK-041: Mustard spray + render [`pending`] [`P1`] [`M`]

**Owner:** unassigned
**Dependencies:** TASK-040
**Acceptance Criteria:**

- [ ] `mustard_sprays` migration + RLS (only current Top Dog may insert)
- [ ] Top Dog sprays on a target PROFILE at (x,y); unlimited sprays
- [ ] Sprays render with computed decay; persist across crown changes

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

---

> **No caps.** Acceptance criteria, subtasks, and integration points are
> unbounded. Give each task as much specificity as it needs to be completed to
> spec — never trim detail to hit a count.
