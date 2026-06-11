# Milestone M2: Voting & Top Dog Engine

> **Status:** `active`
> Index: [[TASKS]] · Architecture: [[PROJECT]] · Conventions: [[CLAUDE]]
> **Goal:** vote rules, ranking, sticky tie-break, daily tally, badge. TDD-first.

## Active Tasks

### TASK-023: Top Dog badge UI [`pending`] [`P2`] [`S`]

**Owner:** unassigned
**Dependencies:** TASK-021
**Description:** Show the hot dog badge on the current Top Dog.
**Acceptance Criteria:**

- [ ] Badge renders on the current Top Dog's profile + their dog
- [ ] Updates after a crown handoff

---

## Completed Tasks (this milestone)

### ~~TASK-022: Daily Top Dog tally job~~ [`complete`]

**Completed:** 2026-06-11 · **PR:** #31 (squash `4351aa9`) · **Reviewer:** APPROVE (0 fix cycles, 2 minor non-blocking notes)
**Acceptance Criteria:**

- [x] `top_dog_days` migration UNIQUE(profile_id, day)
- [x] Pure tally logic TDD'd: multiple reigns same calendar day = one day _(method change, user-approved: realized SQL-authoritative — `UNIQUE(profile_id, day)` + `ON CONFLICT DO NOTHING` + authoritative `COUNT` recompute — and proven by live-DB `@security` tests, not a TS pure module. The invariant is met + tested; the pure-TS-TDD method was descoped because the authoritative logic belongs in SQL, same rationale as the TASK-021 vote RPC.)_
- [x] Wired into the keep-alive workflow (runs daily)
- [x] `profiles.days_as_top_dog` reflects the count

**Notes:** Landed the daily Top Dog tally as the **third M2 task** — the
day-counting half of the Top Dog engine that turns reign-time into the
`days_as_top_dog` stat. Migration `20260611174243_top_dog_days_and_tally.sql` adds
the `public.top_dog_days` table (`id`, `profile_id` → `profiles on delete cascade`,
`day date`, `UNIQUE(profile_id, day)` per decision #14) under the project's
**default-deny + explicit-grant** RLS: SELECT-only for `authenticated`, **no client
write path at all** — the tally is mediated entirely by RPC. Zero new dependencies.

**Idempotency at two layers (decision #14, drift-free).** `public.tally_top_dog_day()`
(SECURITY DEFINER, `search_path=''`, fully schema-qualified) finds the current Top
Dog (`profiles.is_current_top_dog`), does `insert (holder, current_date) on conflict
(profile_id, day) do nothing`, then recomputes `profiles.days_as_top_dog = count(*)`
authoritatively from `top_dog_days` — **never a blind `+1`**. So the DB-level
`UNIQUE(profile_id, day)` + `ON CONFLICT DO NOTHING` collapses multiple reigns on the
same calendar day to one day, and the authoritative `COUNT` recompute means re-runs
and early triggers can't drift the count. This is the **same drift-free discipline as
the TASK-021 vote RPC** (`vote_count` recomputed from `COUNT(votes)`, never
incremented). The RPC is a **no-op when no current Top Dog** exists.

**AC #2 method change (user-approved):** the "pure tally logic TDD'd" criterion was
realized **SQL-authoritative + live-DB integration-tested** rather than as a TS pure
module — `UNIQUE(profile_id, day)` + `ON CONFLICT DO NOTHING` + authoritative `COUNT`
recompute, proven by the `@security` specs, not a Vitest pure module. The invariant
("multiple reigns same calendar day = one day") is met and tested; the pure-TS-TDD
method was descoped because the authoritative tally logic belongs in SQL — same
rationale as the TASK-021 vote RPC (see the inline AC annotation above).

**Decision A1 — anon-callable idempotent RPC (user-approved; decision #26).**
`tally_top_dog_day()` is EXECUTE-granted to `anon` + `authenticated` so the keep-alive
GitHub Actions workflow can call it via PostgREST with the **existing publishable
key** — deliberately avoiding a new repo secret. This is safe because the RPC is
`pronargs = 0` (it takes **no caller input**) and only ever records the **actual**
current Top Dog's `current_date`; the reviewer **empirically confirmed** it is not
forgeable and is self-limiting (worst case: an anon caller triggers today's
idempotent tally early — exactly what the cron does). This sets the auth pattern for
the **M4 mustard-prune job** (TASK-042), which is wired into the same workflow.

**`days_as_top_dog` stays non-client-writable (decision #24/#25).** The SECURITY
DEFINER RPC (running as owner) is the **sole writer** of the count, and
`top_dog_days` has no client write path — verified by the `@security` tests. The
keep-alive wiring adds a daily tally step that POSTs to the RPC and **fails the step
on non-2xx**, so a broken tally turns the workflow red — which also protects the
7-day auto-pause guarantee (a red workflow can't quietly stop hitting the DB).

**Test-infra — `playwright.config.ts` pinned to `workers: 1`.** The `@security`
suite runs against the **one shared local Postgres** and mutates the global singleton
crown (`profiles.is_current_top_dog`); default Playwright multi-worker parallelism
races across spec files. This was **pre-existing latent fragility** (the existing
suite also failed under default parallelism) that this third crown-mutating spec file
surfaced. A single worker serializes the small/fast live-DB suite deterministically;
the reviewer agreed `workers: 1` is the right granularity (a narrower serial scope
wouldn't close the cross-file race). If the suite grows, isolated per-file fixtures
are the scaling path.

Live-DB `@security` coverage: `tests/tally.e2e.ts` (7 specs) exercises the idempotency
(one day per calendar day across multiple reigns), the authoritative `COUNT` recompute,
the no-current-Top-Dog no-op, and the `top_dog_days` / `days_as_top_dog` write
lockdown against a real Postgres. **Review: APPROVE, 0 fix cycles**, 2 minor
non-blocking notes (recompute already covered by the `UNIQUE` index; the format commit
bundled a benign second concern). **M2 stays in progress** — TASK-023 (badge UI)
remains.

### ~~TASK-021: Vote RPC (move-vote + counter + crown)~~ [`complete`]

**Completed:** 2026-06-11 · **PR:** #28 (squash `a170676`) · **Reviewer:** REQUEST_CHANGES → APPROVE (1 review fix cycle — security: crown-column client-writability + helper-RPC EXECUTE surface; 0 test-failure cycles)
**Acceptance Criteria:**

- [x] `votes` migration: UNIQUE(voter_id), RLS forbids voting own dog
- [x] Postgres RPC: cast/move vote, update `vote_count`, recompute crown, set `top_dog_since` — one transaction
- [x] `vote_count` never client-writable; no drift under concurrent votes
- [x] Tests: cast, move, remove, self-vote rejected, counter consistency

**Notes:** Landed the Vote RPC as the **second M2 task** — the consuming-write
half of the voting engine and the live consumer the TASK-020 `selectTopDog` seam
was built for. Migration `20260610181704_votes_and_vote_rpc.sql` adds the `votes`
table (`UNIQUE(voter_id)` — one active vote per user, decision #12) under the
project's **default-deny + explicit-grant** RLS: SELECT-only for `authenticated`,
**no client write path at all** — voting is mediated entirely by RPC. A BEFORE
INSERT/UPDATE trigger rejects self-votes at the DB. Zero new dependencies.

Two **SECURITY DEFINER** RPCs (`search_path=''`, fully schema-qualified, EXECUTE
granted to `authenticated` only) own all writes: `cast_vote(target_dog uuid)`
casts-or-moves a vote, and `remove_vote()` retracts it — each a single
transaction. **Voter identity is RPC-derived from `(select auth.uid())` inside
the function, never client-supplied** (anti-vote-forgery). Two private helpers,
`recompute_vote_count(uuid)` and `recompute_top_dog()`, have EXECUTE revoked from
`public`, `anon`, **and** `authenticated` — see the fix-cycle lesson below on why
`revoke ... from public` alone is insufficient on Supabase.

**`vote_count` recomputed authoritatively from `COUNT(votes)` in-transaction
(drift-free).** Rather than incrementing a counter, the RPC recomputes
`vote_count` from the live `COUNT(votes)` inside the same transaction, so it can
never drift under concurrent votes (closes adversarial finding B); `peak_votes`
is bumped via `greatest()`. The SECURITY DEFINER RPC is the **sole writer** of
both columns — the column-level write lockdown (decision #24) backs this at the
DB layer.

**Crown recompute provably mirrors `selectTopDog` (the TASK-020 lockstep
constraint, discharged).** `recompute_top_dog()` reproduces the TS comparator's
strict total order in SQL: `vote_count` DESC → earliest non-null `top_dog_since`
(NULL sorts **LAST**, sticky) → ascending `hot_dogs.id`. It reads the current
`top_dog_since` and sets a fresh `now()` **only on a NEW reign** — an incumbent
keeps its original timestamp — and never clears the crown while an eligible dog
(`vote_count >= 1`) exists. The reviewer **empirically confirmed** the SQL stays
in lockstep with `selectTopDog`, including the null-last stickiness and the `id`
tie-break. This **resolves the "TASK-021 crown-recompute must stay in lockstep
with `selectTopDog`" Discovered Work item** (struck below).

`src/lib/features/voting/votes.ts` is the typed wrapper (`castVote` / `removeVote`,
dependency-injected `SupabaseClient`) returning a discriminated `VoteResult`, with
sentinels keyed on **SQLSTATE, never error text**: `28000 → VOTE_UNAUTHENTICATED`,
`23514 → VOTE_SELF`, `P0002 → VOTE_NO_SUCH_DOG`. It carries an accepted
**orphan-by-design** signpost — route wiring is a later M2 task — the same
TDD-first pure-logic-before-consumer pattern as the rest of the codebase. 18
mock-unit tests cover the wrapper (`votes.test.ts`).

**Review: 1 fix cycle — two L2 security findings, both DB-integrity (0
test-failure cycles).** REQUEST_CHANGES → APPROVE:

1. **Crown columns on `profiles` were client-forgeable.** `profiles` had no
   column-level write grants, so an authenticated user could forge
   `is_current_top_dog` / `top_dog_since` / `days_as_top_dog` via a plain
   PostgREST UPDATE (and seed them on INSERT). Fixed by applying the **same
   decision #24 insert+update column-grant pattern** used for `hot_dogs`: `revoke
insert/update on profiles from authenticated`, then `grant insert (id, handle,
display_name, avatar_path)` + `grant update (handle, display_name,
avatar_path)`. The crown columns fall to DEFAULTs / are non-updatable;
   `recompute_top_dog()` (SECURITY DEFINER, runs as owner) still maintains them.
2. **`revoke execute ... from public` is insufficient on Supabase.** Supabase
   grants EXECUTE on new `public.*` functions to `anon` and `authenticated`
   explicitly, so `revoke ... from public` (the PUBLIC pseudo-role only) leaves
   those grants intact — the "private" helpers were still callable. Fixed by
   `revoke execute ... from public, anon, authenticated`. Reusable lesson for
   every future SECURITY DEFINER helper (captured as a [[CLAUDE]] gotcha).

Live-DB `@security` Playwright coverage: `tests/votes.e2e.ts` + `tests/db-guards.e2e.ts`
(8 original vote specs + 10 added in the fix cycle) exercise the cast/move/remove
RPC behavior, the crown lockstep, and the two write-lockdowns against a real
Postgres. **M2 stays in progress** — TASK-022 (daily tally) and TASK-023 (badge UI)
remain.

### ~~TASK-020: Ranking + sticky tie-break logic~~ [`complete`]

**Completed:** 2026-06-10 · **PR:** #25 (squash `835c2f0`) · **Reviewer:** REQUEST_CHANGES → resolved (1 review fix cycle — docs only: stale STUB comment + timestamp-compare precondition; fast-track re-confirm)
**Acceptance Criteria:**

- [x] Pure module: given dogs with (vote_count, top_dog_since), returns the Top Dog
- [x] Highest vote_count wins; ties -> earliest `top_dog_since` (sticky)
- [x] Tests cover: clear winner, tie, crown handoff, no-votes edge case

**Notes:** Landed the ranking + sticky tie-break logic as the **first M2 task** —
the entry point of Milestone M2 (Voting & Top Dog Engine). New **PURE** module
`src/lib/features/voting/ranking.ts` (co-located `ranking.test.ts`) under the
`voting/` feature folder, with **no SvelteKit/Supabase imports** so the crown
math is fully unit-testable in isolation — the same pure/IO seam discipline as
`src/lib/storage/guard.ts` and `src/lib/image/compress.ts`.

`selectTopDog(dogs: readonly RankableDog[]): RankableDog | null` realizes
**decision #13** (Top Dog = the user whose single highest-voted dog leads; sticky
tie-break = earliest to hold the crown). It is deliberately modeled at the **dog
level** — each dog is one entry and the winning dog's `ownerId` is the Top Dog
user. This gives the queued TASK-021 (Vote RPC) a single-value seam to write
`top_dog_since` / `is_current_top_dog` from, rather than re-deriving the crown
across a per-user aggregation.

**The contract is a strict total-order comparator**, so the result is
**input-order independent**: `voteCount` descending → earliest non-null
`topDogSince` (sticky; `null` sorts **LAST**, so a previously-crowned dog keeps
the crown against a never-crowned challenger) → ascending `id` for final
determinism. **Eligibility:** `voteCount >= 1` is required; `selectTopDog`
returns `null` when no dog is eligible (the no-votes edge case). **Boundary
validation:** a negative or non-finite `voteCount` is an upstream programming
error, so the function throws `TypeError` (validating the whole input) — matching
the `storage/guard.ts` / `image/compress.ts` house style.

Built **TDD throughout** — 17 tests written **red-first** (clear winner, tie →
sticky earliest-`topDogSince`, crown handoff, null-last stickiness, `id`
tie-break determinism, no-votes → `null`, and the negative/non-finite
`TypeError` cases), implemented to **green**, then verified. The reviewer
**empirically verified total-order soundness** — ran the comparator against an
independent reference sort across **all permutations** of a mixed pool with
**0 order-dependent mismatches**.

**Accepted orphan by design.** `selectTopDog` / `RankableDog` have no non-test
consumer yet — this is the established **TDD-first pure-logic-before-consumer**
pattern (identical to `src/lib/storage/guard.ts` and the M1 compression seam).
The queued consumer is **TASK-021 (Vote RPC)**, which has a hard dependency on
TASK-020. The reviewer did **not** block on the orphan.

**Review: 1 fix cycle, DOCS ONLY — no logic change.** REQUEST_CHANGES →
resolved: a stale red-phase `STUB` header comment was corrected to a live-wiring
note (it now documents the accepted-orphan situation honestly), and the lexical
timestamp-compare precondition was documented in the `selectTopDog` JSDoc. **No
test-failure fix cycles.** **Zero new dependencies.**

Metrics: full suite **298 passed** (19 files); `pnpm check` **0 errors**; the
ranking source files are prettier + eslint clean.

---

> **No caps.** Acceptance criteria, subtasks, and integration points are
> unbounded. Give each task as much specificity as it needs to be completed to
> spec — never trim detail to hit a count.
