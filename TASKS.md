# Task Index — Top Dog

> **Milestone status:** `pending` (stub — not yet exploded) | `active` (exploded, in progress) | `deferred` (parked — body preserved) | `complete`
> **Task status (inside milestone files):** `pending` | `in_progress` | `blocked` | `complete`
> **Priority key:** `P0` (critical) | `P1` (high) | `P2` (medium) | `P3` (low)
> **Size key:** `S` (< 1 hour) | `M` (1-4 hours) | `L` (4+ hours)
> See [[PROJECT]] for architecture decisions and [[CLAUDE]] for conventions.

## How this works

- Each milestone has its own file under `tasks/` holding its tasks in full detail.
- Future milestones live here as **one-line stubs** until activated. Only the
  **planner** explodes a stub into its milestone file (never the director or
  other agents).
- Completed tasks stay in their milestone file. When a milestone closes, that
  frozen file is the milestone's permanent archive — there is no separate archive
  for new milestones. The pre-migration milestones (M0, M1) are grandfathered in
  [[TASKS-ARCHIVE]].
- Two cross-milestone logs: [[tasks/deferred]] and [[tasks/discovered]].

## Active Milestones

**Milestone M8 — Snacktum Snacktorum: Rebrand & Redesign** `active` — [[tasks/milestone-08-snacktum-snacktorum-rebrand]]
(planner-exploded 2026-06-18; **BUILD activated 2026-06-19**; **RE-SCOPED 2026-06-19**). A
**user-facing rebrand + UI/UX redesign**: "Top Dog" → the hot-dog **cult** app "Snacktum
Snacktorum"; champion title "Top Dog" → **"The Anointed Wiener"** (copy swap only — code
identifiers unchanged). **Re-scope (2026-06-19, user-directed):** the remaining pages are
**REBUILT FROM the design mockups** (`design/pages/*.dc.html` — a per-page presentational
rebuild, not an incremental restyle) **and the IN-APP routes are RE-SLUGGED to cult names**
(the `app` URL segment → `snacktum-snacktorum`; each `/app/*` leaf → a cult slug). **The
four auth slugs (`/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`) are KEPT
descriptive** (user-finalized — gate pages NOT re-slugged); the onboarding rite lives at
`/sign-up` (no standalone onboarding leaf). **Reuses the locked PROJECT.md
stack/architecture/paradigm and all decisions #1–#28 + L2 — no re-plenary, no new infra, no
new deps.** **Skin not skeleton:**
each rebuild preserves its `+page.server.ts` (load + actions) and re-wires all data/feature
plumbing; no table/RPC/TS-symbol or infra rename.

> **Task set (re-scoped): 4 complete + 12 pending.** Complete: TASK-087 (theme) + TASK-080
> (shell) + TASK-083 (recovery) + TASK-082 (sign-in). Pending: **TASK-090** foundational
> slug refactor (lands first), then per-page rebuilds — **TASK-091** Procession,
> **TASK-092** Onboarding rite (absorbs sign-up), **TASK-093** Shrine, **TASK-094** Anoint
> (THE migration), **TASK-094-R** Reliquary (derived module), **TASK-095** Your Litter,
> **TASK-096** The Relic, **TASK-097** Epistles+Whispers, **TASK-098** Summon, **TASK-099**
> Tribunal, **TASK-100** Catechism, **TASK-101** The Lost Pilgrim (error/404). The old
> pending tasks TASK-081/084/085/086/088/089 are **superseded/folded** (TASK-081 copy →
> carried by the per-page rebuilds; 084→092, 085→093, 086→094, 088→101, 089→094-R).

> **🔨 BUILDING + RE-SCOPED — 2026-06-19. 4/16 complete** (theme + shell + the auth
> cluster: sign-in / forgot / reset — auth is functional end-to-end). The remaining work
> is the slug refactor + the per-page rebuilds from the delivered mockups.
> TASK-087 (theme, PR #99 `dcce8c3`): the M8 FOUNDATION — a tokenized dark-temple CSS layer
> (`src/lib/styles/tokens.css`) every rebuild consumes via `var(--…)` tokens (accents via
> `data-accent`), self-hosted SIL OFL Cinzel + Cormorant Garamond `.woff2` (no CDN/package).
> TASK-080 (shell, PR #101 `544b7be`): the persistent `(protected)/app/+layout.svelte` shell;
> repointed `/` → `/app/feed`; retired the bare `/app` hub; **`TopDogPrivilegesNotice`
> RETIRED** (783 → 775). TASK-083 (recovery, PR #103 `3e236be`): `/forgot-password` +
> `/reset-password` (6-digit OTP → `verifyOtp(type:'recovery')` → `updateUser`) + a
> code-emitting recovery email template (live-Mailpit-verified). TASK-082 (sign-in, PR #105
> `5445002`): the real themed "Enter the Snacktum" form → `signInWithPassword` → cascade;
> a `tests/sign-in.e2e.ts` `@smoke` path (live 5/5). All four: no migration / no new
> dependency / no new decision row (table stays #28).
>
> **All designs are IN** (`design/pages/*.dc.html` — every page mocked) and all Open
> Questions resolved (OQ-1…OQ-5). **‼️ One posture change (OQ-2 Option A, user-approved):
> TASK-094 (formerly TASK-086) RETIRES `prune_mustard_sprays()` so the persisting Anoint
> wall-notice rows survive — it CARRIES one migration (prune retirement) + a keep-alive
> workflow edit + a likely new architecture-decision row #29.** Recorded as a plan; batch
> TASK-094's hosted push onto the standing M7 hosted-push gate (below). **‼️ The
> slug refactor (TASK-090) is a RISKY cross-cutting rename** — it MUST update the
> `hooks.server.ts` `startsWith('/app')` auth-guard **prefix** → `'/snacktum-snacktorum'`
> (else the protected area goes unguarded), the root redirect, the shell `resolve(...)`
> links, the per-page `/app/...` references, and the E2E + unit `/app/...` path assertions;
> a **checkpoint tag is warranted at execution**. **The `/sign-in` redirect targets are
> KEPT (not retargeted) and the recovery email template is unchanged** — the auth slugs
> stay descriptive; the guard change is prefix-only. The profile-funnel guard retargets to
> `/sign-up` (the onboarding rite, TASK-092). Pre-launch (invite-only, not deployed) →
> **no old→new redirects needed.** Dispatch M8 tasks **only on explicit user instruction**,
> in the milestone file's § Dependencies & Sequencing order — do not auto-chain. **The
> slug map is FINALIZED by the user** (see the milestone file § Slug Map): auth slugs
> unchanged; in-app prefix `/app` → `/snacktum-snacktorum`; leaves procession / litter
> (+`litter/[id]`) / shrine`[handle]` / epistles (+`epistles/[handle]`) / summon / tribunal
> / catechism; onboarding rite = `/sign-up`.

> **Open ops action (user):** the two M7 migrations
> (`20260617205453_burger_alarms.sql`, `20260618120000_burger_verdicts.sql`) still need a
> hosted `supabase db push` before the report→verdict flow works on hosted. No
> keep-alive / auto-pause risk (no scheduled job touches these tables). **UPDATE
> (2026-06-19): M8 now DOES add a migration** — OQ-2 Option A means **TASK-086 retires
> `prune_mustard_sprays()`** (one migration + a keep-alive workflow edit dropping the
> daily prune step). **Batch TASK-086's hosted push with the two M7 migrations** (one
> `supabase db push`) and drop the prune step from `.github/workflows/keepalive.yml` in
> lockstep so the workflow doesn't keep calling a retired RPC (which would 404). No other
> M8 task adds a migration. **ALSO (TASK-083, 2026-06-19) — a hosted CONFIG item on the
> same gate (no migration):** the hosted Supabase project's **recovery email template must
> be set to the code-emitting `{{ .Token }}` template** (the cult-themed
> `supabase/templates/recovery.html` + `[auth.email.template.recovery]` / `otp_length = 6`
> in `config.toml`), via the dashboard or `supabase config push` — **or production sends a
> recovery LINK instead of a CODE**, breaking the `/reset-password` page. No DB migration,
> no auto-pause risk; batch it with the burger migrations + the TASK-086 prune migration as
> one hosted bring-up step.

## Planned Milestones

These milestones were pre-specified by the project's initial plenary, so they
carry **full task files now** rather than header-only stubs. (The new-model
default is a one-line stub the planner explodes on activation; here the detail
was already written, so it is preserved.) Depends-on is kept coarse.

The pre-specified set (M0–M7) is complete and M8 is the first post-plenary milestone
(exploded above). New future milestones now appear here as one-line **stubs** until you
activate one — the **planner** explodes a stub into its milestone file on activation.

- **Milestone M9 — Operator / Admin Dashboard** `pending` (stub — not yet exploded).
  **Net-new feature work, post-M8** (not part of the M8 skin-only rebrand). An
  operator-only `/admin` area to monitor the platform: member / frank / vote / reaction /
  anointing / report+verdict counts, the **invite funnel** (sent / redeemed / conversion),
  **storage used** (`app_storage_bytes()` already exists), the current champion, and growth
  over `created_at`. Mostly **read-only aggregates over existing data** — little/no new
  tracking. **Key decision at activation — admin authorization:** recommended a
  **server-side allowlist** of operator ids (no schema, non-forgeable) over a
  non-client-writable `is_admin` column; this is distinct from the in-game "Anointed
  Wiener" role. Read-only monitoring for v1.

Other future work is tracked in [[tasks/discovered]].

## Deferred Milestones

None.

## Completed Milestones

| Milestone                               | Completed  | Tag                                    | File                                           |
| --------------------------------------- | ---------- | -------------------------------------- | ---------------------------------------------- |
| Milestone 00: Scaffold & Infra          | 2026-06-08 | `milestone-00-scaffold-infra`          | [[TASKS-ARCHIVE]] (§ Milestone M0)             |
| Milestone 01: Vertical Slice            | 2026-06-09 | `milestone-01-vertical-slice`          | [[TASKS-ARCHIVE]] (§ Milestone M1)             |
| Milestone 02: Voting & Top Dog Engine   | 2026-06-12 | `milestone-02-voting-top-dog-engine`   | [[tasks/milestone-02-voting-top-dog-engine]]   |
| Milestone 03: Reactions & Per-Dog Stats | 2026-06-12 | `milestone-03-reactions-per-dog-stats` | [[tasks/milestone-03-reactions-per-dog-stats]] |
| Milestone 04: Mustard Mechanic          | 2026-06-16 | `milestone-04-mustard-mechanic`        | [[tasks/milestone-04-mustard-mechanic]]        |
| Milestone 05: Walls & DMs               | 2026-06-17 | `milestone-05-walls-dms`               | [[tasks/milestone-05-walls-dms]]               |
| Milestone 06: Emoji Library             | 2026-06-17 | `milestone-06-emoji-library`           | [[tasks/milestone-06-emoji-library]]           |
| Milestone 07: Safety & Polish           | 2026-06-18 | `milestone-07-safety-polish`           | [[tasks/milestone-07-safety-polish]]           |

## Logs

- [[tasks/deferred]] — task-level deferred / descoped work, with disposition
  (whole-milestone deferral lives in § Deferred Milestones above)
- [[tasks/discovered]] — discovered-work log (feeds future milestone stubs)
