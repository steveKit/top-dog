# Milestone M5: Walls & DMs

> **Status:** `complete` (2026-06-17 · tag `milestone-05-walls-dms`)
> Index: [[TASKS]] · Architecture: [[PROJECT]] · Conventions: [[CLAUDE]]
> **Goal:** message walls + direct messages.

## Active Tasks

\_None — all M5 build/verify tasks are complete. **TASK-054** (push the M5 migrations

- the `restore_data_api_grants` fix to hosted in one `supabase db push`, then verify
  keep-alive) was **deferred out of the milestone** to [[tasks/deferred]] as a user-gated
  ops follow-up (needs hosted creds; no keep-alive step depends on it, so no auto-pause
  risk). The grants hotfix (TASK-052/053) this milestone absorbed restored the explicit
  Data API grants after the Supabase CLI `auto_expose_new_tables` default flip (2026-05-30)
  and pinned the config so local matches cloud.\_

## Completed Tasks (this milestone)

### TASK-053: Grant-invariant verification [`complete`] [`P1`] [`M`]

**Owner:** tester
**Dependencies:** TASK-052
**PR:** #68 (squash `7603438`) · **Reviewer:** APPROVE · **Fix cycles:** 1 (3 review findings: duplicate `dms.read_at` case dropped, anon-SELECT seeding de-vacuumed across all 9 tables, crown cleanup hardened to clear-first + `finally`)
**Acceptance Criteria:**

- [x] Checked-in `@security` guard `tests/grants.e2e.ts` (11 cases) asserting the required AND forbidden grant matrix — focused on the gaps: `anon` has nothing (zero-row SELECT + `42501` INSERT on all 9 tables, every table seeded so non-vacuous); `authenticated` cannot write `votes`/`top_dog_days` (`42501`); plus consolidated positive base-grant checks. Column-lockdown forges cross-referenced to their owning specs (db-guards/dms/tally), not duplicated.
- [x] Passes on current main (TASK-052 merged); would fail if any asserted grant drifts (regression guard against a future `supabase db reset`)

**Notes:** The **regression backstop for TASK-052** — a checked-in `@security` guard that
locks in the grant matrix so a future `supabase db reset` (or a stray `GRANT`/`REVOKE`
edit) can't silently re-drift the Data API grants and quietly re-break a path the way the
auto-expose flip did. The decision: the TASK-052 fix is only durable if a test _fails_
when a grant drifts, so this task asserts the **required AND forbidden** halves of the
matrix against the live local Postgres rather than trusting the migration to stay correct.
New spec `tests/grants.e2e.ts` (`@security`, 11 cases) focused on the **gaps the existing
specs didn't already cover** (column-lockdown forges are cross-referenced to their owning
specs — `db-guards` / `dms` / `tally` — not duplicated): **`anon` has nothing** —
zero-row SELECT and a `42501` INSERT on **all 9 tables** (every table seeded so the
SELECT assertion is non-vacuous, not a false pass on an empty table); **`authenticated`
cannot write `votes` / `top_dog_days`** (`42501`, the decision #12 RPC-only surfaces);
plus consolidated positive base-grant checks proving the restored `authenticated` SELECT /
cosmetic-table INSERT-DELETE actually work. **1 fix cycle (3 review findings):** (a) a
duplicate `dms.read_at` forge case dropped (already owned by `tests/dms.e2e.ts` — no
double coverage); (b) the anon-SELECT assertions **de-vacuumed** by seeding all 9 tables
first, so a zero-row result proves `anon` is denied rather than the table merely being
empty; (c) crown cleanup **hardened to clear-first + a `finally`** so a mid-test failure
can't leave the shared singleton crown set and poison sibling specs (the same
`workers: 1` shared-crown fragility the M2 tally spec first surfaced). Pure test
coverage — **zero schema / RLS / RPC / app-code change, zero new dependencies**. Metrics:
`pnpm test` 573, `pnpm check` 0 errors, `pnpm lint` clean, `@smoke` 4, `@security` 68
(incl. the 11 new grant cases). **This closes the M5 grants hotfix and the milestone.**
**PR #68** (squash `7603438`) · Reviewer APPROVE · 1 fix cycle.

---

### TASK-052: Restore Data API base grants (auto-expose remediation) [`complete`] [`P0`] [`M`]

**Owner:** implementer + tester
**Dependencies:** none
**PR:** #66 (squash `18f9baa`) · **Reviewer:** APPROVE · **Fix cycles:** 0 production (2 stale `@security` assertions updated to the stronger grant-layer `42501` behavior)
**Acceptance Criteria:**

- [x] New idempotent, schema-qualified migration `supabase/migrations/20260617000000_restore_data_api_grants.sql` restoring exactly what auto-expose used to issue (`authenticated` SELECT on all 9 tables; INSERT/DELETE only on the counter-free cosmetic tables; DELETE on `hot_dogs`; `service_role` full DML; `anon` nothing)
- [x] `authenticated`: NO table-wide INSERT/UPDATE on `profiles`/`hot_dogs`/`dms` (decision #24/#25 lockdown preserved); NO write on `votes`/`top_dog_days` (decision #12) — empirically confirmed via the live grant matrix
- [x] `auto_expose_new_tables = false` pinned in `supabase/config.toml`
- [x] After `supabase db reset`: `@smoke` (4) + `@security` (57) green
- [x] `pnpm test` (573), `pnpm check` (0 errors), `pnpm lint` clean

**Notes:** A **P0 mid-milestone hotfix for a project-wide regression** that turned
`@smoke`/`@security` RED and broke the real `createInvite()` invite path — the first time
this project's grant model was found relying on platform-implicit behavior rather than its
own migrations. **Root cause (scoped by a read-only architect dispatch):** on 2026-05-30
the Supabase CLI's `auto_expose_new_tables` default flipped from `true` to `false`, so a
fresh `supabase db reset` stopped issuing the **implicit base table GRANTs** the schema had
silently depended on since M0. PostgREST authorizes a request in **two independent layers**
— a passing RLS policy is **necessary but not sufficient**; the role also needs the base
`GRANT` on the table. Every table's RLS was intact, but with the implicit base grants gone,
PostgREST returned `permission denied` (`42501`) on paths that had always worked locally —
hence a green-on-old-reset / red-on-fresh-reset divergence that looked like nothing in the
diff had changed. **Fix:** a new idempotent, schema-qualified migration
`supabase/migrations/20260617000000_restore_data_api_grants.sql` that restores **exactly
what auto-expose used to provide**, made explicit and committed:
`authenticated` SELECT on all 9 tables; INSERT/DELETE only on the **counter-free cosmetic
tables** (`hotdog_reactions`, `mustard_sprays`, `wall_messages`, `dms` — the decision #12
plain-RLS-write surfaces); DELETE on `hot_dogs`; `service_role` full DML; **`anon`
nothing**. Crucially the restore **PRESERVES every existing lockdown** — it does NOT
re-grant table-wide INSERT/UPDATE on `profiles` / `hot_dogs` / `dms` (the decision #24/#25
column-grant lockdowns stay intact) and grants **no** write on `votes` / `top_dog_days`
(those stay RPC-only per decision #12). Plus `auto_expose_new_tables = false` is **pinned
in `supabase/config.toml`** so local now matches both cloud and the permanent
post-2026-10-30 platform behavior (auto-expose is being removed entirely). The takeaway
captured project-wide: the Data API grant model is now **explicit** — see decision #28 and
the [[CLAUDE]] gotcha; every new `public` table migration must declare its own base grants
and never lean on auto-expose. **0 production fix cycles** — the only changes during review
were updating 2 stale `@security` assertions to the now-stronger grant-layer `42501`
behavior (paths that the old implicit grants left open are now correctly denied at the
grant layer). Metrics after `supabase db reset`: `pnpm test` 573, `pnpm check` 0 errors,
`pnpm lint` clean, `@smoke` 4, `@security` 57. **PR #66** (squash `18f9baa`) · Reviewer
APPROVE.

---

### TASK-051: Direct messages [`complete`] [`P2`] [`M`]

**Owner:** implementer + tester
**Dependencies:** TASK-011 (complete)
**PR:** #62 (squash `4ac8ff8`) · **Reviewer:** APPROVE · **Fix cycles:** 0
**Acceptance Criteria:**

- [x] `dms` migration + RLS (only sender/recipient read; sender inserts)
- [x] Send/receive DMs; mark read_at

**Notes:** Direct messages land as the second **cosmetic / many-allowed table with no
denormalized counter** this milestone — but with a **privacy boundary** the public
wall (TASK-050) doesn't have, so the RLS shape differs. Migration
`20260616191804_dms.sql` adds the `dms` table (`id` uuid PK
`extensions.gen_random_uuid()` schema-qualified per the M0 hosted-parity lesson;
`sender_id` and `recipient_id` both → `profiles on delete cascade`; `body` text with a
`char_length(body) <= 2000` CHECK; `created_at`; `read_at` nullable; index on the
`(recipient_id, sender_id)` conversation lookup). Like `wall_messages` /
`hotdog_reactions` / `mustard_sprays` it carries **no server-maintained denormalized
column and nothing that touches `vote_count` / `peak_votes` / the crown**, so the base
write is a **plain owner-scoped RLS write** (decision #12, the inverse of the
consuming-writes-via-RPC convention) — **not a new architecture decision**. The new
wrinkles vs. the public-wall precedent are both **reuses of existing mechanisms, not new
decisions**: (1) **privacy RLS** — SELECT is scoped to a conversation participant
(`sender_id = (select auth.uid()) OR recipient_id = (select auth.uid())`) via the
`(select auth.uid())` initplan idiom, so a member reads only DMs they sent or received
(contrast walls: any member reads any wall); INSERT pins `sender_id = (select
auth.uid())` so the sender is **un-forgeable**; and there is **no DELETE** (DMs are
immutable/persistent). (2) **The `read_at`-only mutation boundary uses the decision #24
column-grant mechanism, not a new pattern** — marking a DM read is the one allowed
UPDATE, so an UPDATE policy lets the **recipient only** (`recipient_id = (select
auth.uid())`) touch the row, and a **column-level `grant update (read_at)`** (after
revoking table-wide UPDATE) prevents anyone — recipient included — from rewriting `body`,
`sender_id`, `recipient_id`, or `created_at`. This is decision #24's "revoke table-wide,
re-grant only the safe column(s)" applied to a privacy column rather than a denormalized
counter — same mechanism, no new decision row. New feature module
`src/lib/features/dms/dms.ts` (discriminated `DmResult<T>` wrappers: `sendDm`,
`listConversations`, `listThread`, `markThreadRead`; SQLSTATE-keyed sentinels; raw
errors logged server-side only) plus the **pure `summarizeConversations`** aggregator
(co-located unit-tested, no SvelteKit/Supabase imports) that collapses a member's raw DM
rows into a per-correspondent inbox list (latest-message preview, unread count, ordered
by recency) entirely at **read time** — there is no stored conversation/unread counter to
maintain, the same render-time-derived discipline as `summarizeReactions`. Wired into two
new routes under `(protected)/app/messages/`: an **inbox** (`/app/messages`) listing
conversations, and a **thread** (`/app/messages/[handle]`) showing a correspondence and a
send box, both `safeGetSession()`-gated with the participant derived from the session and
the correspondent from the trusted route param (never client input). A **"Message
@handle" button** on the profile page and a **nav link** complete the surface. **Security
posture (L2), verified at review:** sender pin un-forgeable (forge → `42501`); the
privacy SELECT scope proven by a live E2E (a non-participant cannot read a conversation);
the `read_at`-only column grant proven by a forged-`body`-UPDATE rejection; body stored
verbatim and rendered through Svelte auto-escaping (no `{@html}` → no XSS). **Zero new
dependencies and no new discovered work** surfaced by the reviewer. Coverage:
`dms.test.ts`, `summarize.test.ts`, `dm-action.test.ts`, live-DB `@security`
`tests/dms.e2e.ts` (privacy + sender-pin + `read_at`-column RLS specs). Metrics at merge:
`pnpm test` 540 pass, `pnpm check` 0 errors, lint clean, `@smoke` 4, `@security` 54.
**PR #62** (squash `4ac8ff8`) · Reviewer APPROVE · 0 fix cycles.

---

### TASK-050: Message walls [`complete`] [`P2`] [`M`]

**Owner:** implementer + tester
**Dependencies:** TASK-011 (complete)
**PR:** #60 (squash `d3c7a4d`) · **Reviewer:** APPROVE · **Fix cycles:** 0
**Acceptance Criteria:**

- [x] `wall_messages` migration + RLS (store ORIGINAL body; author/owner may delete)
- [x] Post to and render a profile's wall

**Notes:** Message walls land as another **cosmetic / many-allowed table with no
denormalized counter**, so `wall_messages` writes through **plain owner-scoped RLS,
the deliberate inverse of the consuming-writes-via-RPC convention** — reusing the
`hotdog_reactions` / `mustard_sprays` precedent (decision #12), **not a new
architecture decision**. Migration `20260616184139_wall_messages.sql`: `body` stores
the **ORIGINAL** message verbatim (`char_length(body) <= 1000` CHECK), keeping the M6
emoji render-time filter free to apply later (never persist filtered text); RLS via
the `(select auth.uid())` initplan idiom — SELECT for all `authenticated` (any member
reads any wall, like the feed), INSERT `with check (author_id = (select auth.uid()))`
(author un-forgeable), DELETE scoped to **message author OR wall owner**
(`author_id = … OR profile_id = …`), and **no UPDATE** (messages immutable). Decision
#24/#25's column-grant lockdown deliberately does **not** apply — there is no
server-maintained column to forge, so client-insertable `created_at`/`id` are inert.
New feature module `src/lib/features/walls/walls.ts` (`postWallMessage` /
`listWallMessages` (latest 50, `created_at` desc, normalized author embed) /
`deleteWallMessage`, discriminated `WallResult<T>`, SQLSTATE-keyed sentinels, raw
errors logged server-side only), wired into the existing
`(protected)/app/profile/[handle]/` route (post box + delete affordance shown only to
author or wall owner; existing mustard spray UI preserved). **Security (L2), verified
at review:** author-pin un-forgeable (forge → 42501, pinned by live E2E), DELETE
scoped to the stored row (no client-widenable path), body verbatim + Svelte
auto-escaped (no `{@html}` → no XSS). Tests: `walls.test.ts`, `wall-action.test.ts`,
live-DB `@security` `tests/walls.e2e.ts` (7 RLS specs), plus a `profile-load.test.ts`
stale-test fix. No new dependencies, no new discovered work. Metrics at merge:
`pnpm test` 514 pass, `pnpm check` 0 errors, lint clean, `@smoke` 4, `@security` 47.
**PR #60** (squash `d3c7a4d`) · Reviewer APPROVE · 0 fix cycles.

---

> **No caps.** Acceptance criteria, subtasks, and integration points are
> unbounded. Give each task as much specificity as it needs to be completed to
> spec — never trim detail to hit a count.
